// LAB ONLY (throwaway). Round 66 stills: each page's three frames (?still&f=n) and the contact sheet, in headless Edge.
//   PLAYWRIGHT_CORE=<path to playwright-core> node tools/lab/mock/shoot66.mjs [sizes]   (needs the mock server on 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const BASE = 'http://localhost:5180/tools/lab/mock';
const OUT = 'proof-out/lab/mock';
mkdirSync(OUT, { recursive: true });
const sizes = (process.argv[2] ?? '1440x810').split(',').map((s) => s.split('x').map(Number));
const jobs = [];
for (const idea of ['overlap', 'fold', 'weight']) for (const f of [1, 2, 3]) jobs.push([`r66-${idea}.html?still&f=${f}`, `r66-${idea}-${f}`]);

const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1 });
  const shots = w < 700 ? jobs.filter(([, n]) => n.endsWith('-1')) : jobs;
  for (const [url, name] of shots) {
    const page = await ctx.newPage(); const problems = [];
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
    page.on('pageerror', (e) => problems.push(e.message));
    await page.goto(`${BASE}/${url}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).catch(() => problems.push('never ready'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.jpg`, type: 'jpeg', quality: 90 });
    console.log(`${name}-${w}x${h}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
    await page.close();
  }
  await ctx.close();
}
if (!process.argv[3]) {
  const ctx = await browser.newContext({ viewport: { width: 2048, height: 1400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/r66-sheet.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).catch(() => console.log('sheet never ready'));
  await page.screenshot({ path: 'proof-out/lab/mock/r66-contact-sheet.jpg', type: 'jpeg', quality: 90, fullPage: true });
  console.log('proof-out/lab/mock/r66-contact-sheet.jpg');
}
await browser.close();
