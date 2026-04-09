#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const ROOT = join(new URL('..', import.meta.url).pathname);
const PORTALS_FILE = join(ROOT, 'portals.yml');
const PROFILE_FILE = join(ROOT, 'config', 'profile.yml');
const PIPELINE_FILE = join(ROOT, 'data', 'pipeline.md');
const HISTORY_FILE = join(ROOT, 'data', 'scan-history.tsv');
const CAREER_BROWSER = join(ROOT, 'career-browser.mjs');
const ALT_URLS = {
  'sap': ['https://jobs.sap.com/viewalljobs/'],
  'bmw': ['https://www.bmwgroup.jobs/de/en/jobs.html'],
  'bosch': ['https://jobs.bosch.de/en'],
  'siemens': ['https://jobs.siemens.com/careers'],
};

function parseArgs(argv) {
  const args = {
    company: null,
    maxCompanies: 20,
    perCompanyLimit: 40,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--company=')) {
      args.company = arg.slice('--company='.length);
    } else if (arg === '--company' && argv[i + 1]) {
      args.company = argv[i + 1];
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
    }
  }

  return args;
}

function loadYaml(path) {
  return yaml.load(readFileSync(path, 'utf8'));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractLocation(listing) {
  const haystack = `${listing.title || ''} ${listing.context || ''}`;
  const patterns = [
    /munich|münchen/i,
    /nuremberg|nurnberg|nürnberg/i,
    /cham/i,
    /deggendorf/i,
    /berlin/i,
    /stuttgart/i,
    /frankfurt/i,
    /hamburg/i,
    /herzogenaurach/i,
    /walldorf/i,
    /remote/i,
    /hybrid/i,
    /germany/i,
  ];

  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match) return match[0];
  }
  return 'Unknown';
}

function titleMatches(title, positive, negative) {
  const lower = normalizeText(title);
  const positiveMatch = positive.some((term) => lower.includes(String(term).toLowerCase()));
  const negativeMatch = negative.some((term) => lower.includes(String(term).toLowerCase()));
  const coreTechMatch = /(ai|ml|machine learning|llm|data|software|python|backend|full-stack|softwareentwicklung|research|analytics|nlp|computer vision|deep learning|rag|genai|artificial intelligence)/i.test(title);
  return positiveMatch && coreTechMatch && !negativeMatch;
}

function locationMatches(location, prefs) {
  const lower = normalizeText(location);
  if (!lower || lower === 'unknown') return 0;
  if (lower.includes('remote') || lower.includes('hybrid')) {
    return prefs.remote_friendly ? 1 : 0;
  }
  for (const city of prefs.primary || []) {
    if (lower.includes(String(city).toLowerCase())) return 2;
  }
  for (const city of prefs.acceptable || []) {
    if (lower.includes(String(city).toLowerCase())) return 1;
  }
  return 0;
}

function computeMatchScore(listing, cfg, locationScore) {
  let score = 0;
  const title = normalizeText(listing.title);

  for (const term of cfg.titleFilter.positive) {
    if (title.includes(String(term).toLowerCase())) score += 1;
  }
  if (locationScore === 2) score += 2;
  if (locationScore === 1) score += 1;
  if (/working student|werkstudent/i.test(listing.title)) score += 1;
  if (/ai|ml|machine learning|data|python|backend/i.test(listing.title)) score += 1;

  return Math.min(5, Math.max(1, score));
}

function readScanHistory() {
  if (!existsSync(HISTORY_FILE)) return { urls: new Set(), lines: [] };
  const raw = readFileSync(HISTORY_FILE, 'utf8').trim();
  if (!raw) return { urls: new Set(), lines: [] };

  const lines = raw.split('\n').filter(Boolean);
  const urls = new Set();

  for (const line of lines.slice(1)) {
    const parts = line.split('\t');
    if (parts.length >= 5) {
      urls.add(parts[4].trim());
      continue;
    }
    const wsParts = line.trim().split(/\s+/);
    if (wsParts.length >= 5) {
      urls.add(wsParts[4].trim());
    }
  }

  return { urls, lines };
}

function readKnownUrlsFromPipeline() {
  if (!existsSync(PIPELINE_FILE)) return new Set();
  const content = readFileSync(PIPELINE_FILE, 'utf8');
  const matches = content.match(/https?:\/\/\S+/g) || [];
  return new Set(matches.map((url) => url.trim()));
}

function readKnownUrlsFromApplications() {
  const file = join(ROOT, 'data', 'applications.md');
  if (!existsSync(file)) return new Set();
  const content = readFileSync(file, 'utf8');
  const matches = content.match(/https?:\/\/\S+/g) || [];
  return new Set(matches.map((url) => url.trim()));
}

function runListings(company, url, limit) {
  const stdout = execFileSync('node', [CAREER_BROWSER, 'listings', url, `--company=${company}`, `--limit=${limit}`, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(stdout);
}

function getScanUrls(companyName, primaryUrl) {
  const slug = slugify(companyName);
  const urls = [primaryUrl, ...(ALT_URLS[slug] || [])].filter(Boolean);
  return [...new Set(urls)];
}

function formatHistoryLine(entry) {
  return [
    entry.date,
    entry.company,
    entry.title,
    entry.location,
    entry.url,
    entry.matchScore.toFixed(1),
    entry.status,
  ].join('\t');
}

function updatePipeline(scannedEntries) {
  const header = '# Pipeline - URLs to Evaluate';
  const lines = [
    header,
    '',
    '## High Priority',
    '- https://jobs.schaeffler.com/... (Working Student AI)',
    '- https://jobs.siemens.com/... (Werkstudent Data)',
    '',
    '## Medium Priority',
    '- https://jobs.sap.com/... (ML Engineer)',
    '',
    '## Scanned Today',
  ];

  if (scannedEntries.length === 0) {
    lines.push('- (Auto-populated by scan mode)');
  } else {
    for (const entry of scannedEntries) {
      lines.push(`- ${entry.url} | ${entry.company} | ${entry.title} | ${entry.location}`);
    }
  }

  writeFileSync(PIPELINE_FILE, `${lines.join('\n')}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const portals = loadYaml(PORTALS_FILE);
  const profile = loadYaml(PROFILE_FILE);

  const titleFilter = {
    positive: portals?.title_filter?.positive || profile?.title_filters?.positive || [],
    negative: portals?.title_filter?.negative || profile?.title_filters?.negative || [],
  };
  const locationPrefs = profile?.location_preferences || { primary: [], acceptable: [], remote_friendly: true };

  const companies = (portals?.tracked_companies || [])
    .filter((item) => item.enabled)
    .filter((item) => !args.company || normalizeText(item.name).includes(normalizeText(args.company)))
    .slice(0, args.maxCompanies);

  const history = readScanHistory();
  const knownPipelineUrls = readKnownUrlsFromPipeline();
  const knownApplicationUrls = readKnownUrlsFromApplications();
  const knownUrls = new Set([...history.urls, ...knownPipelineUrls, ...knownApplicationUrls]);
  const seenThisRun = new Set();

  const scannedToday = [];
  const historyLines = history.lines.length > 0
    ? history.lines.filter(Boolean)
    : ['Date\tCompany\tTitle\tLocation\tURL\tMatch Score\tStatus'];

  let totalListings = 0;
  let filteredOut = 0;
  let duplicates = 0;
  let failures = 0;

  for (const company of companies) {
    try {
      let listings = [];
      let lastError = null;

      for (const url of getScanUrls(company.name, company.careers_url)) {
        try {
          const result = runListings(company.name, url, args.perCompanyLimit);
          listings = Array.isArray(result.listings) ? result.listings : [];
          if (listings.length > 0) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (listings.length === 0 && lastError) {
        throw lastError;
      }

      totalListings += listings.length;

      for (const listing of listings) {
        const url = String(listing.url || '').trim();
        if (!url) continue;

        const location = extractLocation(listing);
        const isTitleMatch = titleMatches(listing.title, titleFilter.positive, titleFilter.negative);
        const locScore = locationMatches(location, locationPrefs);

        if (!isTitleMatch || locScore === 0) {
          filteredOut += 1;
          continue;
        }

        if (knownUrls.has(url) || seenThisRun.has(url)) {
          duplicates += 1;
          continue;
        }

        const matchScore = computeMatchScore(listing, { titleFilter }, locScore);
        const entry = {
          date: today(),
          company: company.name,
          title: String(listing.title || '').replace(/\s+/g, ' ').trim(),
          location,
          url,
          matchScore,
          status: 'New',
        };

        scannedToday.push(entry);
        historyLines.push(formatHistoryLine(entry));
        seenThisRun.add(url);
      }
    } catch (error) {
      failures += 1;
      console.error(`scan failed for ${company.name}: ${error.message}`);
    }
  }

  writeFileSync(HISTORY_FILE, `${historyLines.join('\n')}\n`);
  updatePipeline(scannedToday);

  console.log(`Portal Scan - ${today()}`);
  console.log('====================');
  console.log(`Companies scanned: ${companies.length}`);
  console.log(`Listings found: ${totalListings}`);
  console.log(`Filtered out: ${filteredOut}`);
  console.log(`Duplicates skipped: ${duplicates}`);
  console.log(`New matches added: ${scannedToday.length}`);
  console.log(`Company scan failures: ${failures}`);
  console.log('');

  if (scannedToday.length > 0) {
    for (const entry of scannedToday.slice(0, 20)) {
      console.log(`+ ${entry.company} | ${entry.title} | ${entry.location} | ${entry.matchScore.toFixed(1)}/5`);
    }
    if (scannedToday.length > 20) {
      console.log(`... and ${scannedToday.length - 20} more`);
    }
  } else {
    console.log('No new matching jobs found.');
  }
}

main();
