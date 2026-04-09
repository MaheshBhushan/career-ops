#!/usr/bin/env node
/**
 * verify-pipeline.mjs — Health check for career-ops pipeline integrity
 *
 * Checks:
 * 1. All statuses are canonical (per states.yml)
 * 2. No duplicate company+role entries
 * 3. All report links point to existing files
 * 4. Scores match format X.XX/5 or N/A or DUP
 * 5. All rows have proper pipe-delimited format
 * 6. No pending TSVs in tracker-additions/ (only in merged/ or archived/)
 * 7. states.yml canonical IDs for cross-system consistency
 *
 * Run: node career-ops/verify-pipeline.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const CAREER_OPS = new URL('.', import.meta.url).pathname;
// Support both layouts: data/applications.md (boilerplate) and applications.md (original)
const APPS_FILE = existsSync(join(CAREER_OPS, 'data/applications.md'))
  ? join(CAREER_OPS, 'data/applications.md')
  : join(CAREER_OPS, 'applications.md');
const ADDITIONS_DIR = join(CAREER_OPS, 'batch/tracker-additions');
const REPORTS_DIR = join(CAREER_OPS, 'reports');
const STATES_FILE = existsSync(join(CAREER_OPS, 'templates/states.yml'))
  ? join(CAREER_OPS, 'templates/states.yml')
  : join(CAREER_OPS, 'states.yml');

const CANONICAL_STATUSES = [
  'evaluada', 'evaluated',
  'review',
  'aplicado', 'applied',
  'respondido',
  'entrevista', 'phone screen', 'technical', 'onsite',
  'oferta', 'offer',
  'accepted',
  'rechazado', 'rejected',
  'descartado', 'no aplicar',
];

const ALIASES = {
  'enviada': 'aplicado', 'aplicada': 'aplicado', 'applied': 'aplicado', 'sent': 'aplicado',
  'cerrada': 'descartado', 'descartada': 'descartado', 'cancelada': 'descartado',
  'rechazada': 'rechazado',
  'no_aplicar': 'no aplicar', 'skip': 'no aplicar', 'monitor': 'no aplicar',
  'evaluated': 'evaluated',
  'review': 'review',
  'rejected': 'rejected',
  'phone screen': 'phone screen',
  'technical': 'technical',
  'onsite': 'onsite',
  'offer': 'offer',
  'accepted': 'accepted',
};

let errors = 0;
let warnings = 0;

function error(msg) { console.log(`❌ ${msg}`); errors++; }
function warn(msg) { console.log(`⚠️  ${msg}`); warnings++; }
function ok(msg) { console.log(`✅ ${msg}`); }

function isDividerOrHeader(line) {
  return line.includes('---') || /\|\s*#\s*\|/i.test(line);
}

function parseHeaderMap(lines) {
  const headerLine = lines.find((line) => line.startsWith('|') && /\|\s*#\s*\|/i.test(line));
  if (!headerLine) return null;
  const cols = headerLine.split('|').map((s) => s.trim()).filter(Boolean);
  const map = {};
  cols.forEach((col, idx) => {
    map[col.toLowerCase()] = idx;
  });
  return map;
}

function getCol(parts, headerMap, name, fallbackIndex) {
  if (headerMap && headerMap[name] !== undefined) {
    return parts[headerMap[name] + 1] || '';
  }
  return parts[fallbackIndex] || '';
}

// --- Read applications.md ---
if (!existsSync(APPS_FILE)) {
  console.log('\n📊 No applications.md found. This is normal for a fresh setup.');
  console.log('   The file will be created when you evaluate your first offer.\n');
  process.exit(0);
}
const content = readFileSync(APPS_FILE, 'utf-8');
const lines = content.split('\n');
const headerMap = parseHeaderMap(lines);

const entries = [];
for (const line of lines) {
  if (!line.startsWith('|')) continue;
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 9 || isDividerOrHeader(line)) continue;
  const num = parseInt(getCol(parts, headerMap, '#', 1));
  if (isNaN(num)) continue;
  entries.push({
    num,
    date: getCol(parts, headerMap, 'date', 2),
    company: getCol(parts, headerMap, 'company', 3),
    role: getCol(parts, headerMap, 'role', 4),
    location: getCol(parts, headerMap, 'location', 5),
    score: getCol(parts, headerMap, 'score', 5),
    status: getCol(parts, headerMap, 'status', 6),
    pdf: getCol(parts, headerMap, 'pdf', 7),
    report: getCol(parts, headerMap, 'report', 8),
    notes: getCol(parts, headerMap, 'notes', 9),
  });
}

console.log(`\n📊 Checking ${entries.length} entries in applications.md\n`);

// --- Check 1: Canonical statuses ---
let badStatuses = 0;
for (const e of entries) {
  const clean = e.status.replace(/\*\*/g, '').trim().toLowerCase();
  // Strip trailing dates
  const statusOnly = clean.replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();

  if (!CANONICAL_STATUSES.includes(statusOnly) && !ALIASES[statusOnly]) {
    error(`#${e.num}: Non-canonical status "${e.status}"`);
    badStatuses++;
  }

  // Check for markdown bold in status
  if (e.status.includes('**')) {
    error(`#${e.num}: Status contains markdown bold: "${e.status}"`);
    badStatuses++;
  }

  // Check for dates in status
  if (/\d{4}-\d{2}-\d{2}/.test(e.status)) {
    error(`#${e.num}: Status contains date: "${e.status}" — dates go in date column`);
    badStatuses++;
  }
}
if (badStatuses === 0) ok('All statuses are canonical');

// --- Check 2: Duplicates ---
const companyRoleMap = new Map();
let dupes = 0;
for (const e of entries) {
  const key = e.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '::' +
    e.role.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (!companyRoleMap.has(key)) companyRoleMap.set(key, []);
  companyRoleMap.get(key).push(e);
}
for (const [key, group] of companyRoleMap) {
  if (group.length > 1) {
    warn(`Possible duplicates: ${group.map(e => `#${e.num}`).join(', ')} (${group[0].company} — ${group[0].role})`);
    dupes++;
  }
}
if (dupes === 0) ok('No exact duplicates found');

// --- Check 3: Report links ---
let brokenReports = 0;
for (const e of entries) {
  const match = e.report.match(/\]\(([^)]+)\)/);
  if (!match) continue;
  const reportPath = join(CAREER_OPS, match[1]);
  if (!existsSync(reportPath)) {
    error(`#${e.num}: Report not found: ${match[1]}`);
    brokenReports++;
  }
}
if (brokenReports === 0) ok('All report links valid');

// --- Check 4: Score format ---
let badScores = 0;
for (const e of entries) {
  const s = e.score.replace(/\*\*/g, '').trim();
  if (!/^\d+\.?\d*\/5$/.test(s) && s !== 'N/A' && s !== 'DUP') {
    error(`#${e.num}: Invalid score format: "${e.score}"`);
    badScores++;
  }
}
if (badScores === 0) ok('All scores valid');

// --- Check 5: Row format ---
let badRows = 0;
for (const line of lines) {
  if (!line.startsWith('|')) continue;
  if (isDividerOrHeader(line)) continue;
  const parts = line.split('|');
  if (parts.length < 9) {
    error(`Row with <9 columns: ${line.substring(0, 80)}...`);
    badRows++;
  }
}
if (badRows === 0) ok('All rows properly formatted');

// --- Check 6: Pending TSVs ---
let pendingTsvs = 0;
if (existsSync(ADDITIONS_DIR)) {
  const files = readdirSync(ADDITIONS_DIR).filter(f => f.endsWith('.tsv'));
  pendingTsvs = files.length;
  if (pendingTsvs > 0) {
    warn(`${pendingTsvs} pending TSVs in tracker-additions/ (not merged)`);
  }
}
if (pendingTsvs === 0) ok('No pending TSVs');

// --- Check 7: Bold in scores ---
let boldScores = 0;
for (const e of entries) {
  if (e.score.includes('**')) {
    warn(`#${e.num}: Score has markdown bold: "${e.score}"`);
    boldScores++;
  }
}
if (boldScores === 0) ok('No bold in scores');

// --- Summary ---
console.log('\n' + '='.repeat(50));
console.log(`📊 Pipeline Health: ${errors} errors, ${warnings} warnings`);
if (errors === 0 && warnings === 0) {
  console.log('🟢 Pipeline is clean!');
} else if (errors === 0) {
  console.log('🟡 Pipeline OK with warnings');
} else {
  console.log('🔴 Pipeline has errors — fix before proceeding');
}

process.exit(errors > 0 ? 1 : 0);
