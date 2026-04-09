#!/usr/bin/env node

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename, resolve } from 'path';
import { execFileSync } from 'child_process';
import yaml from 'js-yaml';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PROFILE_PATH = join(ROOT, 'config', 'profile.yml');
const OUTPUT_DIR = join(ROOT, 'output');
const TEMPLATES_DIR = join(ROOT, 'templates');

function parseArgs(argv) {
  const [kind, ...rest] = argv;
  const args = { kind };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    let key;
    let value = '';
    if (arg.includes('=')) {
      [key, value = ''] = arg.slice(2).split('=');
    } else {
      key = arg.slice(2);
      if (rest[i + 1] && !rest[i + 1].startsWith('--')) {
        value = rest[i + 1];
        i += 1;
      }
    }
    args[key] = value;
  }
  return args;
}

function esc(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function loadProfile() {
  return yaml.load(readFileSync(PROFILE_PATH, 'utf8'));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function replaceAll(template, replacements) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}|\\{\\{\\{${key}\\}\\}\\}`, 'g');
    output = output.replace(pattern, value);
  }
  return output;
}

function buildCvReplacements(profile, args) {
  const location = args.location || profile.location_label || profile.candidate?.location || 'Cham, Bayern, Deutschland';
  const role = args.role || profile.target_roles?.[0] || 'AI Engineer';
  const summary = args.summary || "AI \\& Full-Stack Developer pursuing a Master's in Applied AI at Technische Hochschule Deggendorf, with strong experience in machine learning, full-stack development, and cloud computing. Proficient in Python, JavaScript, and Java with hands-on expertise in TensorFlow, PyTorch, and Scikit-learn. Skilled in building scalable AI applications with frontend interfaces integrated with Azure-based backend services. Fluent in English; German A2-B1 level (actively improving).";

  return {
    NAME: esc(profile.name || profile.candidate?.full_name || 'Mahesh Koduri'),
    LOCATION: esc(location),
    PHONE: esc(profile.phone || profile.candidate?.phone || ''),
    EMAIL: esc(profile.email || profile.candidate?.email || ''),
    LINKEDIN: esc((profile.linkedin || profile.candidate?.linkedin || '').replace(/^https?:\/\//, '')),
    GITHUB: esc((profile.github || profile.candidate?.github || '').replace(/^https?:\/\//, '')),
    PORTFOLIO: esc((profile.portfolio || profile.candidate?.portfolio_display || '').replace(/^https?:\/\//, '')),
    SUMMARY: summary,

    EDUCATION_1_SCHOOL: 'TECHNISCHE HOCHSCHULE DEGGENDORF',
    EDUCATION_1_LOCATION: 'Cham, Bayern, Deutschland',
    EDUCATION_1_DEGREE: 'APPLIED AI IN DIGITAL PRODUCTION MANAGEMENT (M.E.)',
    EDUCATION_1_DATE: 'September 2026',
    EDUCATION_1_BULLET_1: 'Focused on data-driven automation, AI integration, and business analytics.',
    EDUCATION_1_BULLET_2: 'Applied Retrieval-Augmented Generation (RAG) techniques for financial document intelligence and process automation.',
    EDUCATION_1_BULLET_3: 'Coursework includes Machine Learning, ERP Systems, Cyber-Physical Systems, and Data Analytics.',

    EDUCATION_2_SCHOOL: "ST. PETER'S ENGINEERING COLLEGE",
    EDUCATION_2_LOCATION: 'Hyderabad, India',
    EDUCATION_2_DEGREE: 'COMPUTER SCIENCE ENGINEERING (B.Tech)',
    EDUCATION_2_DATE: 'July 2024',
    EDUCATION_2_BULLET_1: 'Graduated with a 7.97 CGPA, specializing in AI, machine learning, and data analytics.',
    EDUCATION_2_BULLET_2: 'Led a team that won First Prize in a University Hackathon for a blockchain-based real estate solution.',

    EXPERIENCE_1_COMPANY: 'People Tech Group',
    EXPERIENCE_1_LOCATION: 'Hyderabad',
    EXPERIENCE_1_ROLE: 'Intern-Junior Software Engineer',
    EXPERIENCE_1_DATE: 'Jan 2024 -- May 2024',
    EXPERIENCE_1_BULLET_1: 'Contributed to the development of an automotive-specific operating system, leading to a 15\\% reduction in system errors.',
    EXPERIENCE_1_BULLET_2: 'Collaborated with a cross-functional team to design and optimize user interface components, enhancing user experience by 30\\%.',
    EXPERIENCE_1_BULLET_3: 'Applied Python and SQL for testing, data validation, and reporting performance metrics in real-world applications.',
    EXPERIENCE_1_BULLET_4: 'Automated portions of the debugging and testing workflow, improving efficiency of QA cycles by 20\\%.',

    PROJECT_1_NAME: 'FinanRAG - Full-Stack AI Application with Vector Database',
    PROJECT_1_BULLET_1: 'Designed and developed a full-stack AI application using FastAPI backend and Streamlit frontend for intelligent document retrieval.',
    PROJECT_1_BULLET_2: 'Implemented FAISS vector database for semantic search and embeddings storage to optimize retrieval performance.',
    PROJECT_1_BULLET_3: 'Built machine learning models using PyTorch and Hugging Face for natural language understanding and question-answering.',
    PROJECT_1_BULLET_4: 'Integrated frontend interfaces with backend services while ensuring scalability, security, and comprehensive documentation.',

    PROJECT_2_NAME: 'ML Model Training \\& Cloud Deployment Pipeline',
    PROJECT_2_BULLET_1: 'Developed and deployed machine learning models using TensorFlow, PyTorch, and Scikit-learn for predictive analytics and classification.',
    PROJECT_2_BULLET_2: 'Built scalable backend services and integrated with Azure cloud services for robust model hosting and API endpoint management.',
    PROJECT_2_BULLET_3: 'Implemented experiment tracking using MLflow and containerized applications with Docker to ensure consistent deployment workflows.',
    PROJECT_2_BULLET_4: 'Documented development processes and model results to facilitate team collaboration and effective knowledge sharing.',

    PROJECT_3_NAME: 'AI Dashboard \\& Analytics Platform (Supply Chain)',
    PROJECT_3_BULLET_1: 'Built an AI-powered analytics dashboard processing 126,255 daily transactions for effective forecasting and pattern detection.',
    PROJECT_3_BULLET_2: 'Developed interactive data visualizations using Power BI and Matplotlib to present actionable insights to key stakeholders.',
    PROJECT_3_BULLET_3: 'Analyzed large-scale datasets using Python, Pandas, and SQL to derive business intelligence and operational efficiencies.',
    PROJECT_3_BULLET_4: 'Collaborated with cross-functional teams to translate business requirements into technical AI features and real-time reporting.',

    PROJECT_4_NAME: 'Finance Tracker (Financion) - Full-Stack AI Application',
    PROJECT_4_BULLET_1: 'Developed a full-stack finance tracking application featuring an interactive dashboard and a robust Python-based backend.',
    PROJECT_4_BULLET_2: 'Built machine learning models achieving approximately 85\\% accuracy for the intelligent categorization of user transactions.',
    PROJECT_4_BULLET_3: 'Created comprehensive data visualizations using Power BI for continuous monitoring, reporting, and stakeholder presentations.',
    PROJECT_4_BULLET_4: 'Integrated frontend interfaces with backend services to provide a seamless user experience and efficient data processing.',

    SKILL_BULLET_1: '\\textbf{Proficient in Python, JavaScript, and Java} for building AI-powered applications and full-stack solutions.',
    SKILL_BULLET_2: '\\textbf{Strong understanding of machine learning algorithms} and techniques with hands-on experience in TensorFlow, PyTorch, and Scikit-learn.',
    SKILL_BULLET_3: '\\textbf{Experienced in full-stack development}, building and maintaining AI dashboards and tools with frontend interfaces and backend services.',
    SKILL_BULLET_4: '\\textbf{Familiar with frontend frameworks} including React and Streamlit for building interactive user interfaces and data visualization tools.',
    SKILL_BULLET_5: '\\textbf{Hands-on experience with Azure cloud services} including Azure App Services, Azure Functions, and Azure SQL for scalable application deployment.',
    SKILL_BULLET_6: '\\textbf{Experienced with vector databases} (FAISS, Pinecone) for semantic search, embeddings storage, and AI-powered retrieval systems.',
    SKILL_BULLET_7: '\\textbf{Proficient in data visualization tools} (Power BI, Tableau, Matplotlib, Seaborn) for presenting insights and results to stakeholders.',
    SKILL_BULLET_8: '\\textbf{Skilled in analyzing large-scale datasets} using Pandas, NumPy, and SQL to derive actionable insights.',
    SKILL_BULLET_9: '\\textbf{Strong problem-solving and communication skills} with the ability to translate business requirements into technical solutions.',
    SKILL_BULLET_10: '\\textbf{Experience collaborating with interdisciplinary teams} to identify AI \\& ML potentials and develop innovative solutions.',
    SKILL_BULLET_11: '\\textbf{Proficient in Git version control, Docker containerization, and MLflow} for scalable and reproducible ML workflows.',
    SKILL_BULLET_12: '\\textbf{Languages:} Fluent in English; German A2-B1 level (actively improving).',

    HONOR_BULLET_1: '\\textbf{Vice President, CODERELICS:} Led a community of 200+ members, driving initiatives in coding and AI.',
    HONOR_BULLET_2: '\\textbf{Machine Learning Specialization:} Stanford University - Coursera certified in supervised, unsupervised, and deep learning.',
    HONOR_BULLET_3: '\\textbf{Hackathon 2023 Winner:} Developed an AI-driven real-time blockchain solution for secure transactions.',
  };
}

function buildCoverReplacements(profile, args) {
  const name = profile.name || profile.candidate?.full_name || 'Mahesh Koduri';
  const location = args.location || profile.location_label || profile.candidate?.location || 'Cham, Bayern';
  const company = args.company || 'Hiring Company';
  const role = args.role || profile.target_roles?.[0] || 'AI Engineer';
  const manager = args['hiring-manager'] || 'Hiring Manager';
  const companyAddress = args['company-address'] || (args.location ? `${args.location}, Germany` : 'Germany');
  const portfolio = (profile.portfolio || profile.candidate?.portfolio_display || '').replace(/^https?:\/\//, '');

  const opening = args.opening || `I am applying for the ${role} position at ${company}. My background combines applied AI, full-stack development, and cloud deployment, with hands-on experience building production-style ML and RAG systems during my master's studies at Technische Hochschule Deggendorf.`;
  const body1 = args.body1 || `At People Tech Group, I contributed to an automotive software initiative that reduced system errors by 15\\%, improved user experience by 30\\%, and increased QA efficiency by 20\\% through automation. Alongside that experience, I have built end-to-end AI projects using Python, FastAPI, Streamlit, FAISS, TensorFlow, PyTorch, Azure, Docker, and MLflow.`;
  const body2 = args.body2 || `What makes this role particularly relevant is the overlap between your needs in ${role} and my experience translating ML and data workflows into usable products. I am especially interested in opportunities in Munich and Nuremberg, and I can contribute in English immediately while continuing to improve my German.`;
  const body3 = args.body3 || `Beyond technical implementation, I am comfortable communicating analytical findings clearly and collaborating with interdisciplinary teams. I am motivated by practical, data-driven work and would be glad to contribute that mindset to ${company}.`;
  const closing = args.closing || `I am confident that my experience in applied AI, full-stack development, and data-driven problem solving would allow me to contribute effectively in this role. I would welcome the opportunity to discuss how I can support ${company}.`;

  return {
    NAME: esc(name),
    LOCATION: esc(location),
    EMAIL: esc(profile.email || profile.candidate?.email || ''),
    PHONE: esc(profile.phone || profile.candidate?.phone || ''),
    LINKEDIN: esc((profile.linkedin || profile.candidate?.linkedin || '').replace(/^https?:\/\//, '')),
    GITHUB: esc((profile.github || profile.candidate?.github || '').replace(/^https?:\/\//, '')),
    PORTFOLIO: esc(portfolio),
    DATE: esc(today()),
    HIRING_MANAGER: esc(manager),
    COMPANY: esc(company),
    COMPANY_ADDRESS: esc(companyAddress),
    ROLE: esc(role),
    OPENING_PARAGRAPH: opening,
    BODY_PARAGRAPH_1: body1,
    BODY_PARAGRAPH_2: body2,
    BODY_PARAGRAPH_3: body3,
    CLOSING_PARAGRAPH: closing,
    ENCLOSURES: esc(args.enclosures || 'CV, GitHub Profile, Portfolio'),
  };
}

function renderTemplate(templateName, replacements, outPath) {
  const templatePath = join(TEMPLATES_DIR, templateName);
  const template = readFileSync(templatePath, 'utf8');
  writeFileSync(outPath, replaceAll(template, replacements));
}

function compileLatex(texPath, outputPdf) {
  const workDir = mkdtempSync(join(tmpdir(), 'career-ops-latex-'));
  const localTex = join(workDir, basename(texPath));
  writeFileSync(localTex, readFileSync(texPath, 'utf8'));

  const photoSrc = join(TEMPLATES_DIR, 'photo.jpg');
  if (existsSync(photoSrc)) {
    copyFileSync(photoSrc, join(workDir, 'photo.jpg'));
    copyFileSync(photoSrc, join(workDir, 'profile_pic.jpg'));
    copyFileSync(photoSrc, join(workDir, 'profile_pic.jpeg'));
    copyFileSync(photoSrc, join(workDir, 'profile_pic.png'));
    copyFileSync(photoSrc, join(workDir, 'profile_pic'));
  }

  execFileSync('xelatex', ['-interaction=nonstopmode', basename(localTex)], { cwd: workDir, stdio: 'inherit' });
  execFileSync('xelatex', ['-interaction=nonstopmode', basename(localTex)], { cwd: workDir, stdio: 'inherit' });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  copyFileSync(join(workDir, `${basename(localTex, '.tex')}.pdf`), outputPdf);
  rmSync(workDir, { recursive: true, force: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['cv', 'cover'].includes(args.kind)) {
    console.error('Usage: node tools/generate-jobpack.mjs <cv|cover> [--company=...] [--role=...] [--location=...] [--output=...]');
    process.exit(1);
  }

  const profile = loadProfile();
  const slug = `${(args.company || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(args.role || args.kind).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${today()}`;
  const texPath = join(OUTPUT_DIR, `${args.kind}-${slug}.tex`);
  const pdfPath = args.output ? resolve(args.output) : join(OUTPUT_DIR, `${args.kind}-${slug}.pdf`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  if (args.kind === 'cv') {
    renderTemplate('cv-template.tex', buildCvReplacements(profile, args), texPath);
  } else {
    renderTemplate('cover-template.tex', buildCoverReplacements(profile, args), texPath);
  }

  compileLatex(texPath, pdfPath);
  console.log(`${args.kind.toUpperCase()} generated: ${pdfPath}`);
}

main();
