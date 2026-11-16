// LAB ONLY (throwaway). Round 68 stills of the first view in headless Edge: the orbit's two ends and middle at 1440x810,
// a 16:10 laptop, and a phone.   PLAYWRIGHT_CORE=<path to playwright-core> node tools/lab/mock/shoot68.mjs
// (needs the mock server on 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const BASE = 'http://localhost:5180/tools/lab/mock/r68.html';
const OUT = 'proof-out/lab/mock/r68/stills';
mkdirSync(OUT, { recursive: true });
const jobs = [
  [1440, 810, 'f=8', 'desk-1440-mid'], [1440, 810, 'f=0', 'desk-1440-left'], [1440, 810, 'f=16', 'desk-1440-right'],
  [1280, 800, 'f=8', 'desk-1280x800'], [390, 844, '', 'phone-390'],
];
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h, f, name] of jobs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 700 });
  const page = await ctx.newPage(); const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${BASE}?still${f ? '&' + f : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).catch(() => problems.push('never ready'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log(`${name}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
  await ctx.close();
}
await browser.close();
