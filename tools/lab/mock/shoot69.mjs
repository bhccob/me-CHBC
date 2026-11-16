// LAB ONLY (throwaway). Round 69 stills in headless Edge: each stop of the journey (?p= holds it without scrolling) at
// 1440x810, mid-moves, and a phone.   PLAYWRIGHT_CORE=<path> node tools/lab/mock/shoot69.mjs   (mock server on 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const OUT = 'proof-out/lab/mock/r69/stills'; mkdirSync(OUT, { recursive: true });
// timeline lengths as in r69.js
const HOLD = [0.45, 0.9, 0.7, 0.7, 0.7, 0.7, 2.6, 0.9], MOVE = [1, 0.6, 0.6, 0.6, 0.6, 1, 1], NAMES = ['first', 'about', 'soft', 'game', 'sec', 'mech', 'work', 'talk'];
const start = []; let T = 0; HOLD.forEach((h, i) => { start.push(T); T += h + (MOVE[i] ?? 0); });
const at = (i, k = 0.5) => (start[i] + HOLD[i] * k) / T;
const jobs = NAMES.map((n, i) => [1440, 810, at(i), `${i}-${n}`]);
jobs.push([1440, 810, at(6, 0.02), '6-work-a'], [1440, 810, at(6, 0.98), '6-work-z'], [1440, 810, (start[0] + HOLD[0] + 0.5) / T, 'move-0-1'], [1440, 810, (start[5] + HOLD[5] + 0.5) / T, 'move-5-6']);
for (const i of [1, 2, 6, 7]) jobs.push([390, 844, at(i), `phone-${i}-${NAMES[i]}`]);
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h, p, name] of jobs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 700 });
  const page = await ctx.newPage(); const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text())); page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`http://localhost:5180/tools/lab/mock/r69.html?p=${p.toFixed(4)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => problems.push('never ready'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 });
  console.log(`${name}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
  await ctx.close();
}
await browser.close();
