#!/usr/bin/env node

/**
 * generate-latex-pdf-fixed.mjs — Fixed LaTeX → PDF generator
 */

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'js-yaml';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

function esc(s) {
  if (!s) return '';
  return String(s)
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

async function loadProfile() {
  const content = await readFile(join(__dirname, 'config', 'profile.yml'), 'utf-8');
  return yaml.load(content);
}

async function loadCV() {
  return await readFile(join(__dirname, 'cv.md'), 'utf-8');
}

function parseCV(cvContent) {
  // Simple markdown parser for cv.md structure
  const sections = {};
  let currentSection = null;
  let currentContent = [];
  
  for (const line of cvContent.split('\n')) {
    if (line.startsWith('## ')) {
      if (currentSection) sections[currentSection] = currentContent;
      currentSection = line.replace('## ', '').trim();
      currentContent = [];
    } else if (line.startsWith('### ')) {
      currentContent.push({ type: 'subsection', title: line.replace('### ', '').trim() });
    } else if (line.trim().startsWith('- ')) {
      currentContent.push({ type: 'bullet', text: line.trim().substring(2) });
    } else if (line.trim()) {
      currentContent.push({ type: 'text', text: line.trim() });
    }
  }
  if (currentSection) sections[currentSection] = currentContent;
  return sections;
}

async function generateResumeTex(profile, cvContent, jobSlug, german = false) {
  const templatePath = join(__dirname, 'templates', 'cv-template.tex');
  let template = await readFile(templatePath, 'utf-8');
  
  const cv = parseCV(cvContent);
  
  // Determine address based on job
  let address = profile.location_label || 'Cham, Bayern, Germany';
  if (jobSlug.includes('munich') || jobSlug.includes('garching')) {
    address = 'Munich, Germany';
  } else if (jobSlug.includes('walldorf')) {
    address = 'Walldorf, Germany';
  } else if (jobSlug.includes('berlin')) {
    address = 'Berlin, Germany';
  } else if (jobSlug.includes('nuremberg') || jobSlug.includes('nürnberg')) {
    address = 'Nuremberg, Germany';
  }
  
  // Photo path
  const photoPath = join(__dirname, 'assets', 'photos', 'profile.jpg');
  
  // Basic info
  template = template
    .replace(/\{\{NAME\}\}/g, esc(profile.name || 'Mahesh Koduri'))
    .replace(/\{\{LOCATION\}\}/g, esc(address))
    .replace(/\{\{PHONE\}\}/g, esc(profile.phone || '+49 01551 08 23544'))
    .replace(/\{\{EMAIL\}\}/g, esc(profile.email || 'mkoduri73@gmail.com'))
    .replace(/\{\{LINKEDIN\}\}/g, esc(profile.linkedin || 'linkedin.com/in/maheshkoduri'))
    .replace(/\{\{GITHUB\}\}/g, esc(profile.github || 'github.com/MaheshBhushan'))
    .replace(/\{\{PORTFOLIO\}\}/g, esc(profile.portfolio || 'maheshkoduri.netlify.app'));
  
  // Summary
  const summaryText = cv['Summary']?.map(x => x.text).join(' ') || 
    (german ? 'KI-Entwickler mit Praxiserfahrung in ML und Datenanalyse.' 
            : 'Applied AI developer building production ML systems, RAG workflows, and data applications with Python, FastAPI, and Azure.');
  template = template.replace(/\{\{SUMMARY\}\}/g, esc(summaryText));
  
  // Education
  const edu = cv['Education'] || [];
  let edu1School = '', edu1Degree = '', edu1Location = '', edu1Date = '';
  let edu1Bullets = ['', '', ''];
  let edu2School = '', edu2Degree = '', edu2Location = '', edu2Date = '';
  let edu2Bullets = ['', ''];
  
  // Parse education entries
  let currentEdu = null;
  for (const item of edu) {
    if (item.type === 'subsection') {
      if (item.title.includes('Deggendorf')) {
        currentEdu = 1;
        edu1School = 'Technische Hochschule Deggendorf';
        edu1Location = address.split(',')[0] + ', Germany';
        edu1Degree = 'M.E. Applied AI in Digital Production Management';
        edu1Date = german ? 'Abschluss 2026 erwartet' : 'Expected 2026';
      } else if (item.title.includes('Peter') || item.title.includes('B.Tech')) {
        currentEdu = 2;
        edu2School = 'St. Peter\'s Engineering College';
        edu2Location = 'Hyderabad, India';
        edu2Degree = 'B.Tech Computer Science';
        edu2Date = german ? '2024 abgeschlossen' : 'Graduated 2024';
      }
    } else if (item.type === 'text' && item.text.includes('2024 - 2026')) {
      edu1Date = '2024 -- 2026';
    }
  }
  
  edu1Bullets[0] = german ? 'Fokus auf Applied AI und digitale Produktionsysteme' : 'Focus on Applied AI and digital production systems';
  edu1Bullets[1] = german ? 'Entwicklung von RAG-Systemen und ML-Pipelines' : 'RAG system development and ML pipeline architecture';
  
  edu2Bullets[0] = german ? 'Informatik-Studium mit Schwerpunkt Software-Engineering' : 'Computer Science with software engineering focus';
  edu2Bullets[1] = 'CGPA: 7.97/10';
  
  template = template
    .replace(/\{\{EDUCATION_1_SCHOOL\}\}/g, esc(edu1School))
    .replace(/\{\{EDUCATION_1_LOCATION\}\}/g, esc(edu1Location))
    .replace(/\{\{EDUCATION_1_DEGREE\}\}/g, esc(edu1Degree))
    .replace(/\{\{EDUCATION_1_DATE\}\}/g, edu1Date)
    .replace(/\{\{EDUCATION_1_BULLET_1\}\}/g, esc(edu1Bullets[0]))
    .replace(/\{\{EDUCATION_1_BULLET_2\}\}/g, esc(edu1Bullets[1]))
    .replace(/\{\{EDUCATION_1_BULLET_3\}\}/g, esc(edu1Bullets[2]))
    .replace(/\{\{EDUCATION_2_SCHOOL\}\}/g, esc(edu2School))
    .replace(/\{\{EDUCATION_2_LOCATION\}\}/g, esc(edu2Location))
    .replace(/\{\{EDUCATION_2_DEGREE\}\}/g, esc(edu2Degree))
    .replace(/\{\{EDUCATION_2_DATE\}\}/g, edu2Date)
    .replace(/\{\{EDUCATION_2_BULLET_1\}\}/g, esc(edu2Bullets[0]))
    .replace(/\{\{EDUCATION_2_BULLET_2\}\}/g, esc(edu2Bullets[1]));
  
  // Experience
  const exp = cv['Experience'] || [];
  template = template
    .replace(/\{\{EXPERIENCE_1_COMPANY\}\}/g, esc('People Tech Group'))
    .replace(/\{\{EXPERIENCE_1_LOCATION\}\}/g, esc('Hyderabad, India'))
    .replace(/\{\{EXPERIENCE_1_ROLE\}\}/g, esc(german ? 'Werkstudent / Junior Software Engineer' : 'Intern - Junior Software Engineer'))
    .replace(/\{\{EXPERIENCE_1_DATE\}\}/g, 'Jan 2024 -- May 2024')
    .replace(/\{\{EXPERIENCE_1_BULLET_1\}\}/g, esc('Reduced automotive OS errors by 15% through Python debugging and SQL validation tools'))
    .replace(/\{\{EXPERIENCE_1_BULLET_2\}\}/g, esc('Optimized UI components improving workflow performance by 30%'))
    .replace(/\{\{EXPERIENCE_1_BULLET_3\}\}/g, esc('Automated testing workflows cutting QA time by 20%'))
    .replace(/\{\{EXPERIENCE_1_BULLET_4\}\}/g, esc(german ? 'Entwicklung von ML-Validierungstools für Produktionsdaten' : 'Built ML validation tools for production data pipelines'));
  
  // Projects
  const projects = cv['Projects'] || [];
  const projNames = ['FinanRAG', 'Supply Chain AI', 'Financion', 'House Price Prediction'];
  const projBullets = [
    ['RAG application for financial documents with FAISS, Hugging Face', 'Improved answer quality to 85% accuracy', 'Full-stack with FastAPI, Streamlit, Python', 'Semantic search and retrieval workflows'],
    ['Processed 126,255 daily transactions for analytics', 'Power BI dashboards for operational visibility', 'SQL data processing and reporting', 'Supply chain decision support system'],
    ['ML-based finance tracker for categorization', '85% transaction categorization accuracy', 'JavaScript frontend with Python backend', 'Budget visibility and financial insights'],
    ['XGBoost model for house price prediction', 'Feature engineering and regression evaluation', 'Scikit-learn pipeline development', 'Model performance optimization']
  ];
  
  for (let i = 0; i < 4; i++) {
    template = template
      .replace(new RegExp(`\{\{PROJECT_${i+1}_NAME\}\}`, 'g'), esc(projNames[i] || ''))
      .replace(new RegExp(`\{\{PROJECT_${i+1}_BULLET_1\}\}`, 'g'), esc(projBullets[i]?.[0] || ''))
      .replace(new RegExp(`\{\{PROJECT_${i+1}_BULLET_2\}\}`, 'g'), esc(projBullets[i]?.[1] || ''))
      .replace(new RegExp(`\{\{PROJECT_${i+1}_BULLET_3\}\}`, 'g'), esc(projBullets[i]?.[2] || ''))
      .replace(new RegExp(`\{\{PROJECT_${i+1}_BULLET_4\}\}`, 'g'), esc(projBullets[i]?.[3] || ''));
  }
  
  // Skills - from profile
  const skills = profile.skills || [];
  const skillCategories = [
    `Programming: ${skills.filter(s => ['Python', 'JavaScript', 'Java'].includes(s)).join(', ')}`,
    `ML/AI: ${skills.filter(s => ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Hugging Face', 'RAG'].includes(s)).join(', ')}`,
    `Backend: ${skills.filter(s => ['FastAPI', 'Flask', 'Streamlit'].includes(s)).join(', ')}`,
    `Data: ${skills.filter(s => ['FAISS', 'Pinecone', 'SQL', 'Pandas', 'NumPy'].includes(s)).join(', ')}`,
    `Cloud: ${skills.filter(s => ['Azure App Services', 'Azure Functions', 'Azure SQL', 'Docker', 'MLflow'].includes(s)).join(', ')}`,
    'Analytics: Power BI, data visualization',
    'Languages: English (fluent), German (A2-B1, improving), Telugu (native)',
    'Certifications: Machine Learning Specialization (Stanford/Coursera)',
    '', '', '', ''
  ];
  
  for (let i = 0; i < 12; i++) {
    template = template.replace(new RegExp(`\{\{SKILL_BULLET_${i+1}\}\}`, 'g'), esc(skillCategories[i] || ''));
  }
  
  // Honors
  const honors = [
    german ? '200+ Mitglieder Tech-Community (Coderelics VP) geleitet' : 'Led 200+ member tech community as Coderelics VP',
    german ? 'Hackathons mit 300+ Teilnehmern organisiert' : 'Organized hackathons with 300+ participants',
    german ? '30% Steigerung der Community-Teilnahme erreicht' : 'Achieved 30% increase in community participation'
  ];
  
  for (let i = 0; i < 3; i++) {
    template = template.replace(new RegExp(`\{\{HONOR_BULLET_${i+1}\}\}`, 'g'), esc(honors[i] || ''));
  }
  
  // Photo
  template = template.replace(/\{\{PROFILE_PIC\}\}/g, photoPath);
  
  return template;
}

async function compileLatex(texPath, pdfPath) {
  const dir = dirname(texPath);
  const baseName = basename(texPath, '.tex');
  
  console.log(`Compiling: ${texPath}`);
  
  try {
    await execAsync(`cd "${dir}" && xelatex -interaction=nonstopmode "${baseName}.tex" 2>&1`, { timeout: 60000 });
    await execAsync(`cd "${dir}" && xelatex -interaction=nonstopmode "${baseName}.tex" 2>&1`, { timeout: 60000 });
    
    const generatedPdf = join(dir, baseName + '.pdf');
    
    if (existsSync(generatedPdf)) {
      if (pdfPath !== generatedPdf) {
        await copyFile(generatedPdf, pdfPath);
      }
      
      // Cleanup
      for (const ext of ['.aux', '.log', '.out']) {
        try { await execAsync(`rm "${join(dir, baseName)}${ext}" 2>/dev/null`); } catch {}
      }
      
      const stats = await execAsync(`ls -lh "${pdfPath}" | awk '{print $5}'`);
      console.log(`PDF generated: ${pdfPath} (${stats.stdout.trim()})`);
      return pdfPath;
    }
  } catch (err) {
    const generatedPdf = join(dir, baseName + '.pdf');
    if (existsSync(generatedPdf)) {
      await copyFile(generatedPdf, pdfPath);
      console.log(`PDF generated with warnings: ${pdfPath}`);
      return pdfPath;
    }
    throw err;
  }
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      args[key] = val;
    }
  }
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const jobSlug = args.job || 'sample';
  const german = args.lang === 'de' || args.german === 'true';
  
  const outputDir = join(__dirname, 'output');
  await mkdir(outputDir, { recursive: true });
  
  const texPath = join('/tmp', `cv-${jobSlug}-${timestamp}.tex`);
  const pdfPath = args.output || join(outputDir, `cv-${jobSlug}-${timestamp}.pdf`);
  
  console.log(`Job: ${jobSlug}`);
  console.log(`Language: ${german ? 'German' : 'English'}`);
  console.log(`Output: ${pdfPath}`);
  
  const profile = await loadProfile();
  const cvContent = await loadCV();
  
  const texContent = await generateResumeTex(profile, cvContent, jobSlug, german);
  await writeFile(texPath, texContent);
  console.log(`TEX written: ${texPath}`);
  
  await compileLatex(texPath, pdfPath);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
