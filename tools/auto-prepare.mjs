#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(new URL('..', import.meta.url).pathname);
const SCAN_SCRIPT = join(ROOT, 'tools', 'scan-portals.mjs');
const BROWSER_SCRIPT = join(ROOT, 'career-browser.mjs');
const HISTORY_FILE = join(ROOT, 'data', 'scan-history.tsv');
const REPORTS_DIR = join(ROOT, 'reports');
const JDS_DIR = join(ROOT, 'jds');

function parseArgs(argv) {
  const args = {
    threshold: 4,
    maxCompanies: 10,
    perCompanyLimit: 40,
    company: null,
    fetchJds: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--threshold=')) {
      args.threshold = Number.parseFloat(arg.slice('--threshold='.length)) || args.threshold;
    } else if (arg === '--threshold' && argv[i + 1]) {
      args.threshold = Number.parseFloat(argv[i + 1]) || args.threshold;
      i += 1;
    } else if (arg.startsWith('--max-companies=')) {
      args.maxCompanies = Number.parseInt(arg.slice('--max-companies='.length), 10) || args.maxCompanies;
    } else if (arg === '--max-companies' && argv[i + 1]) {
      args.maxCompanies = Number.parseInt(argv[i + 1], 10) || args.maxCompanies;
      i += 1;
    } else if (arg.startsWith('--per-company-limit=')) {
      args.perCompanyLimit = Number.parseInt(arg.slice('--per-company-limit='.length), 10) || args.perCompanyLimit;
    } else if (arg === '--per-company-limit' && argv[i + 1]) {
      args.perCompanyLimit = Number.parseInt(argv[i + 1], 10) || args.perCompanyLimit;
      i += 1;
    } else if (arg.startsWith('--company=')) {
      args.company = arg.slice('--company='.length);
    } else if (arg === '--company' && argv[i + 1]) {
      args.company = argv[i + 1];
      i += 1;
    } else if (arg === '--no-jd') {
      args.fetchJds = false;
    }
  }

  return args;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  const lines = readFileSync(HISTORY_FILE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) return [];

  const rows = [];
  for (const line of lines.slice(1)) {
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    rows.push({
      date: parts[0],
      company: parts[1],
      title: parts[2],
      location: parts[3],
      url: parts[4],
      matchScore: Number.parseFloat(parts[5]) || 0,
      status: parts[6],
    });
  }
  return rows;
}

function runScan(args) {
  const scanArgs = [
    SCAN_SCRIPT,
    `--max-companies=${args.maxCompanies}`,
    `--per-company-limit=${args.perCompanyLimit}`,
  ];
  if (args.company) scanArgs.push(`--company=${args.company}`);

  execFileSync('node', scanArgs, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function fetchJd(entry) {
  const base = `${today()}-${slugify(entry.company)}-${slugify(entry.title).slice(0, 60)}`;
  const outFile = join(JDS_DIR, `${base}.json`);
  try {
    const stdout = execFileSync('node', [BROWSER_SCRIPT, 'jd', entry.url, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    writeFileSync(outFile, stdout);
    return outFile;
  } catch (error) {
    return `FAILED: ${error.message.split('\n')[0]}`;
  }
}

function writePrepReport(entries, args, jdResults) {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = join(REPORTS_DIR, `prep-${today()}.md`);
  const lines = [
    `# Auto-Prepare Report - ${today()}`,
    '',
    `Threshold: ${args.threshold.toFixed(1)}/5`,
    `Companies scanned: ${args.company || `up to ${args.maxCompanies}`}`,
    `JD fetch: ${args.fetchJds ? 'enabled' : 'disabled'}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('No roles met the shortlist threshold today.');
    lines.push('');
    lines.push('Next step: rerun with a lower threshold or a more specific company filter.');
  } else {
    lines.push('## Shortlist');
    lines.push('');
    lines.push('| # | Company | Role | Location | Score | URL | JD Cache |');
    lines.push('|---|---------|------|----------|-------|-----|----------|');
    entries.forEach((entry, index) => {
      const jd = jdResults.get(entry.url) || '-';
      lines.push(`| ${index + 1} | ${entry.company} | ${entry.title} | ${entry.location} | ${entry.matchScore.toFixed(1)}/5 | ${entry.url} | ${jd} |`);
    });
    lines.push('');
    lines.push('## Next Actions');
    lines.push('');
    lines.push('1. Review the shortlisted roles manually.');
    lines.push('2. Run `./career-ops jd "<job-url>"` for any role you want to inspect further.');
    lines.push('3. Generate tailored materials before applying. No submission happens automatically.');
  }

  writeFileSync(reportPath, `${lines.join('\n')}\n`);
  return reportPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(JDS_DIR, { recursive: true });

  runScan(args);

  const shortlist = readHistory()
    .filter((row) => row.date === today())
    .filter((row) => row.status.toLowerCase() === 'new')
    .filter((row) => row.matchScore >= args.threshold);

  const jdResults = new Map();
  if (args.fetchJds) {
    for (const entry of shortlist) {
      jdResults.set(entry.url, fetchJd(entry));
    }
  }

  const reportPath = writePrepReport(shortlist, args, jdResults);

  console.log('');
  console.log(`Auto-prepare complete. Shortlisted: ${shortlist.length}`);
  console.log(`Report: ${reportPath}`);
  if (args.fetchJds && shortlist.length > 0) {
    console.log(`JD cache directory: ${JDS_DIR}`);
  }
}

main();
