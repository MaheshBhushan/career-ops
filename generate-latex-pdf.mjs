#!/usr/bin/env node

/**
 * generate-latex-pdf.mjs — LaTeX → PDF via XeLaTeX
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

// Escape LaTeX special characters
function esc(s) {
  if (!s) return '';
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}');
}

async function loadProfile(profilePath) {
  const content = await readFile(profilePath, 'utf-8');
  return yaml.load(content);
}

async function loadCV(cvPath) {
  const content = await readFile(cvPath, 'utf-8');
  return content;
}

function resolveAddress(jobLocation, profile) {
  if (!jobLocation || !profile.location?.cv_location_strategy === 'match_job_location') {
    return profile.location?.city + ', ' + profile.location?.country;
  }
  
  const loc = jobLocation.toLowerCase();
  const mappings = profile.cv_preferences?.address_mappings || {};
  
  if (loc.includes('munich') || loc.includes('münchen')) return mappings.munich || 'Munich, Germany';
  if (loc.includes('berlin')) return mappings.berlin || 'Berlin, Germany';
  if (loc.includes('nuremberg') || loc.includes('nürnberg')) return mappings.nuremberg || 'Nuremberg, Germany';
  if (loc.includes('india') || loc.includes('hyderabad') || loc.includes('bangalore')) return mappings.india || 'Hyderabad, India';
  
  return profile.location?.city + ', ' + profile.location?.country;
}

async function generateResumeTex(profile, cvContent, jobData, outputPath, german = false) {
  const templatePath = join(__dirname, 'templates', 'cv-template.tex');
  let template = await readFile(templatePath, 'utf-8');
  
  const address = resolveAddress(jobData?.location, profile);
  const photoPath = join(__dirname, profile.candidate?.photo_path || 'assets/photos/profile.jpg');
  
  // Titles based on language
  const titles = german ? {
    summary: 'Profil',
    education: 'Ausbildung',
    experience: 'Berufserfahrung',
    skills: 'Technische Fähigkeiten',
    projects: 'Projekterfahrung',
    achievements: 'Erfolge & Zertifikate'
  } : {
    summary: 'Summary',
    education: 'Education',
    experience: 'Experience',
    skills: 'Technical Skills',
    projects: 'Project Experience',
    achievements: 'Achievements & Certifications'
  };
  
  // Replace basic placeholders
  template = template
    .replace(/\{\{NAME\}\}/g, esc(profile.candidate?.full_name))
    .replace(/\{\{LOCATION\}\}/g, esc(address))
    .replace(/\{\{PHONE\}\}/g, esc(profile.candidate?.phone))
    .replace(/\{\{EMAIL\}\}/g, esc(profile.candidate?.email))
    .replace(/\{\{LINKEDIN\}\}/g, esc(profile.candidate?.linkedin))
    .replace(/\{\{LINKEDIN_DISPLAY\}\}/g, esc(profile.candidate?.linkedin?.replace('https://', '')))
    .replace(/\{\{GITHUB\}\}/g, esc(profile.candidate?.github))
    .replace(/\{\{GITHUB_DISPLAY\}\}/g, esc(profile.candidate?.github?.replace('https://', '')))
    .replace(/\{\{PORTFOLIO\}\}/g, esc(profile.candidate?.portfolio_url))
    .replace(/\{\{PORTFOLIO_DISPLAY\}\}/g, esc(profile.candidate?.portfolio_display))
    .replace(/\{\{PHOTO_PATH\}\}/g, photoPath)
    .replace(/\{\{SUMMARY_TITLE\}\}/g, titles.summary)
    .replace(/\{\{EDUCATION_TITLE\}\}/g, titles.education)
    .replace(/\{\{EXPERIENCE_TITLE\}\}/g, titles.experience)
    .replace(/\{\{SKILLS_TITLE\}\}/g, titles.skills)
    .replace(/\{\{PROJECTS_TITLE\}\}/g, titles.projects)
    .replace(/\{\{ACHIEVEMENTS_TITLE\}\}/g, titles.achievements);
  
  // Summary
  const summary = profile.narrative?.headline || 
    (german ? 'Angewandter KI-Entwickler mit produktionserfahrung' : 'Applied AI developer building production ML systems');
  template = template.replace(/\{\{SUMMARY\}\}/g, esc(summary));
  
  // Skills - from superpowers
  const skills = profile.narrative?.superpowers || [];
  const skillItems = skills.map(s => `  \\item ${esc(s)}`).join('\n');
  template = template.replace(/\{\{SKILL_ITEMS\}\}/g, skillItems);
  
  // Education (simplified)
  const education = german 
    ? `\\textbf{Technische Hochschule Deggendorf} \\hfill Cham, Deutschland \\\\
\\textit{M.Eng. Applied AI} \\hfill Abschluss Sept 2026 erwartet
\\begin{itemize}[leftmargin=1.5em,nosep]
  \\item Fokus auf datengetriebene Automatisierung, KI-Integration und Business Analytics
  \\item RAG-Ansätze für Finanzdokument-Intelligenz angewendet
\\end{itemize}`
    : `\\textbf{Technische Hochschule Deggendorf} \\hfill Cham, Germany \\\\
\\textit{M.Eng. Applied AI} \\hfill Expected Sept 2026
\\begin{itemize}[leftmargin=1.5em,nosep]
  \\item Focus on data-driven automation, AI integration, and business analytics
  \\item Applied RAG approaches for financial document intelligence
\\end{itemize}`;
  template = template.replace(/\{\{EDUCATION\}\}/g, education);
  
  // Experience (from profile or cv)
  const experience = `\\textbf{People Tech Group} \\hfill Hyderabad, India \\\\
\\textit{Junior Software Engineer} \\hfill Jan 2024 -- May 2024
\\begin{itemize}[leftmargin=1.5em,nosep]
  \\item Reduced automotive OS errors by 15\\% through Python debugging tools
  \\item Improved UI workflow performance by 30\\%
  \\item Automated testing with SQL/Python, cutting QA time by 20\\%
\\end{itemize}`;
  template = template.replace(/\{\{EXPERIENCE\}\}/g, experience);
  
  // Projects - from proof_points
  const projects = profile.narrative?.proof_points || [];
  let projectBlocks = '';
  for (const proj of projects.slice(0, 3)) {
    const displayUrl = proj.url?.replace('https://', '') || '';
    projectBlocks += `\\textbf{${esc(proj.name)}} \\\\
\\textit{${german ? 'Schlüsselkompetenzen' : 'Key Skills'}: Python, ML, Cloud}
\\begin{itemize}[leftmargin=1.5em,nosep]
  \\item ${esc(proj.hero_metric)}
\\end{itemize}
\\vspace{4pt}
`;
  }
  template = template.replace(/\{\{PROJECTS\}\}/g, projectBlocks);
  
  // Achievements
  const achievements = german
    ? `  \\item Machine Learning Specialization (Stanford University, Coursera)`
    : `  \\item Machine Learning Specialization (Stanford University, Coursera)`;
  template = template.replace(/\{\{ACHIEVEMENT_ITEMS\}\}/g, achievements);
  
  await writeFile(outputPath, template);
  return outputPath;
}

async function compileLatex(texPath, pdfPath) {
  const dir = dirname(texPath);
  const baseName = basename(texPath, '.tex');
  const base = join(dir, baseName);
  
  console.log(`Compiling: ${texPath}`);
  
  try {
    // First run
    await execAsync(`cd "${dir}" && xelatex -interaction=nonstopmode "${texPath}" 2>&1`, 
                   { timeout: 60000 });
    
    // Second run for references
    await execAsync(`cd "${dir}" && xelatex -interaction=nonstopmode "${texPath}" 2>&1`, 
                   { timeout: 60000 });
    
    const generatedPdf = base + '.pdf';
    
    if (pdfPath !== generatedPdf) {
      await copyFile(generatedPdf, pdfPath);
    }
    
    // Clean up aux files
    for (const ext of ['.aux', '.log', '.out']) {
      try { await execAsync(`rm "${base}${ext}" 2>/dev/null`); } catch {}
    }
    
    console.log(`PDF generated: ${pdfPath}`);
    return pdfPath;
  } catch (err) {
    const generatedPdf = base + '.pdf';
    if (existsSync(generatedPdf)) {
      console.log('PDF exists despite errors, copying...');
      await copyFile(generatedPdf, pdfPath);
      return pdfPath;
    }
    console.error('Compilation failed:', err.message);
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
  
  const profilePath = join(__dirname, 'config', 'profile.yml');
  const outputDir = join(__dirname, 'output');
  await mkdir(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().slice(0, 10);
  const companySlug = args.job || 'sample';
  const german = args.lang === 'de' || args.german === 'true';
  const texPath = join('/tmp', `cv-${companySlug}-${timestamp}.tex`);
  const pdfPath = args.output || join(outputDir, `cv-${companySlug}-${timestamp}.pdf`);
  
  console.log(`Profile: ${profilePath}`);
  console.log(`Output: ${pdfPath}`);
  console.log(`Language: ${german ? 'German' : 'English'}`);
  
  const profile = await loadProfile(profilePath);
  const cvPath = join(__dirname, 'cv.md');
  const cvContent = await loadCV(cvPath);
  
  // Mock job data if provided
  const jobData = args.location ? { location: args.location } : null;
  
  await generateResumeTex(profile, cvContent, jobData, texPath, german);
  console.log(`TEX generated: ${texPath}`);
  
  await compileLatex(texPath, pdfPath);
  console.log(`Final PDF: ${pdfPath}`);
  
  // Show file size
  const stats = await execAsync(`ls -lh "${pdfPath}" | awk '{print $5}'`);
  console.log(`Size: ${stats.stdout.trim()}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
