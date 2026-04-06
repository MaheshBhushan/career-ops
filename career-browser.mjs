#!/usr/bin/env node

/**
 * career-browser.mjs — Playwright helpers for Codex-friendly browser extraction.
 *
 * Modes:
 *   node career-browser.mjs jd <url> [--json] [--output=path]
 *   node career-browser.mjs listings <url> [--json] [--output=path] [--company="Name"] [--limit=100]
 *
 * Purpose:
 *   Replaces prompt-only browser tool assumptions such as browser_navigate/browser_snapshot
 *   with concrete repo-local commands that any coding agent can run.
 */

import { writeFile } from 'fs/promises';

function printHelp() {
  console.log(`career-browser — Playwright extraction helpers

Usage:
  node career-browser.mjs jd <url> [--json] [--output=path]
  node career-browser.mjs listings <url> [--json] [--output=path] [--company="Name"] [--limit=100]

Examples:
  node career-browser.mjs jd "https://jobs.example.com/role/123" --json
  node career-browser.mjs listings "https://jobs.ashbyhq.com/openai" --company="OpenAI" --json
`);
}

function parseArgs(argv) {
  const args = {
    mode: null,
    url: null,
    json: false,
    output: null,
    company: null,
    limit: 100,
  };

  const positional = [];

  for (const raw of argv) {
    if (raw === '--json') {
      args.json = true;
    } else if (raw.startsWith('--output=')) {
      args.output = raw.slice('--output='.length);
    } else if (raw.startsWith('--company=')) {
      args.company = raw.slice('--company='.length);
    } else if (raw.startsWith('--limit=')) {
      const parsed = Number.parseInt(raw.slice('--limit='.length), 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        args.limit = parsed;
      }
    } else if (raw === '-h' || raw === '--help') {
      args.help = true;
    } else {
      positional.push(raw);
    }
  }

  args.mode = positional[0] ?? null;
  args.url = positional[1] ?? null;
  return args;
}

function cleanText(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function hostnameFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function dismissCookieBanners(page) {
  const labels = [
    'Accept',
    'Accept all',
    'I agree',
    'Agree',
    'Allow all',
    'Allow cookies',
    'Got it',
    'OK',
  ];

  for (const label of labels) {
    const selectors = [
      `button:has-text("${label}")`,
      `a:has-text("${label}")`,
      `[role="button"]:has-text("${label}")`,
    ];

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      try {
        if (await locator.isVisible({ timeout: 250 })) {
          await locator.click({ timeout: 500 });
          return;
        }
      } catch {
        // Best effort only.
      }
    }
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let previousHeight = 0;

    for (let i = 0; i < 8; i += 1) {
      window.scrollTo(0, document.body.scrollHeight);
      await delay(250);
      const currentHeight = document.body.scrollHeight;
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;
    }

    window.scrollTo(0, 0);
  });
}

async function preparePage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);
  await dismissCookieBanners(page);
  await autoScroll(page);
}

async function extractJobDescription(page, inputUrl) {
  const extracted = await page.evaluate(() => {
    const bodyText = document.body?.innerText ?? '';
    const candidates = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
      document.querySelector('.job-post, .job-posting, .posting, .description, .job-description'),
      document.body,
    ].filter(Boolean);

    const root = candidates[0];
    const content = root?.innerText ?? bodyText;
    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('title')?.textContent?.trim() ||
      '';

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean)
      .slice(0, 25);

    const applySignals = Array.from(document.querySelectorAll('a, button, [role="button"]'))
      .map((node) => ({
        text: node.textContent?.trim() || '',
        href: 'href' in node ? node.href || '' : '',
      }))
      .filter((entry) => /apply|application|submit/i.test(entry.text))
      .slice(0, 10);

    return {
      title,
      content,
      bodyText,
      headings,
      applySignals,
      finalUrl: location.href,
    };
  });

  const closedPatterns = [
    /no longer accepting applications/i,
    /job is no longer available/i,
    /position has been filled/i,
    /this job has expired/i,
    /role is closed/i,
    /vacancy closed/i,
  ];

  const content = cleanText(extracted.content || extracted.bodyText);
  const closedSignals = closedPatterns
    .map((pattern) => pattern.exec(content)?.[0] ?? null)
    .filter(Boolean);

  return {
    mode: 'jd',
    url: inputUrl,
    finalUrl: extracted.finalUrl || inputUrl,
    hostname: hostnameFromUrl(extracted.finalUrl || inputUrl),
    title: cleanText(extracted.title),
    headings: extracted.headings,
    active: closedSignals.length === 0 && extracted.applySignals.length > 0,
    applySignals: extracted.applySignals,
    closedSignals,
    extractedAt: new Date().toISOString(),
    content,
  };
}

async function extractListings(page, inputUrl, companyHint, limit) {
  const extracted = await page.evaluate(({ companyHint, limit }) => {
    const genericNav = new Set([
      'about',
      'blog',
      'careers',
      'contact',
      'cookies',
      'help',
      'home',
      'jobs',
      'legal',
      'login',
      'privacy',
      'sign in',
      'terms',
    ]);

    const rolePattern = /\b(ai|ml|machine learning|data|engineer|engineering|scientist|research|manager|product|architect|developer|analyst|consultant|specialist|intern|designer)\b/i;
    const hrefPattern = /(job|jobs|career|careers|opening|position|greenhouse|lever|ashby|workday)/i;

    const entries = [];

    for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
      const text = (anchor.innerText || anchor.getAttribute('aria-label') || anchor.title || '').trim();
      if (!text || text.length < 3 || text.length > 160) continue;
      if (genericNav.has(text.toLowerCase())) continue;

      const href = anchor.href;
      const parentText = anchor.parentElement?.innerText?.trim() || '';
      let score = 0;

      if (hrefPattern.test(href)) score += 2;
      if (rolePattern.test(text)) score += 4;
      if (rolePattern.test(parentText)) score += 1;
      if (/remote|hybrid|berlin|munich|germany|europe/i.test(text)) score += 1;

      if (score <= 0) continue;

      entries.push({
        title: text.replace(/\s+/g, ' ').trim(),
        url: href,
        company: companyHint || location.hostname.replace(/^www\./, ''),
        context: parentText.replace(/\s+/g, ' ').trim().slice(0, 240),
        score,
      });
    }

    const deduped = new Map();
    for (const entry of entries) {
      const existing = deduped.get(entry.url);
      if (!existing || entry.score > existing.score) {
        deduped.set(entry.url, entry);
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, limit);
  }, { companyHint, limit });

  return {
    mode: 'listings',
    url: inputUrl,
    finalUrl: page.url(),
    hostname: hostnameFromUrl(page.url()),
    company: companyHint || hostnameFromUrl(page.url()),
    extractedAt: new Date().toISOString(),
    count: extracted.length,
    listings: extracted,
  };
}

function formatResult(result, asJson) {
  if (asJson) {
    return JSON.stringify(result, null, 2);
  }

  if (result.mode === 'jd') {
    const lines = [
      `Title: ${result.title || '(unknown)'}`,
      `URL: ${result.url}`,
      `Final URL: ${result.finalUrl}`,
      `Active: ${result.active ? 'yes' : 'unclear/no'}`,
    ];

    if (result.closedSignals.length > 0) {
      lines.push(`Closed signals: ${result.closedSignals.join(' | ')}`);
    }
    if (result.applySignals.length > 0) {
      lines.push(`Apply signals: ${result.applySignals.map((s) => s.text).join(' | ')}`);
    }
    lines.push('');
    lines.push(result.content);
    return lines.join('\n');
  }

  const lines = [
    `Listings from: ${result.finalUrl}`,
    `Company: ${result.company}`,
    `Count: ${result.count}`,
    '',
  ];

  for (const listing of result.listings) {
    lines.push(`${listing.title}\t${listing.url}\t${listing.company}\t${listing.score}`);
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.mode || !args.url) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (!['jd', 'listings'].includes(args.mode)) {
    console.error(`Unsupported mode: ${args.mode}`);
    printHelp();
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('career-browser failed: Playwright is not installed.');
    console.error('Run `cmd /c npm install` and `cmd /c npx playwright install chromium` first.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 2200 },
  });

  try {
    await preparePage(page, args.url);

    const result = args.mode === 'jd'
      ? await extractJobDescription(page, args.url)
      : await extractListings(page, args.url, args.company, args.limit);

    const formatted = formatResult(result, args.json);

    if (args.output) {
      await writeFile(args.output, formatted, 'utf8');
    } else {
      process.stdout.write(`${formatted}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`career-browser failed: ${error.message}`);
  process.exit(1);
});
