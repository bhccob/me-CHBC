// LAB ONLY (throwaway). Round 70 stills in headless Edge: the first view (middle and both ends of its turn), each
// chapter's stop (?p= holds it without scrolling), a lit branch, an open project, two mid-moves, and a phone. Then one
// contact sheet.   PLAYWRIGHT_CORE=<path> node tools/lab/mock/shoot70.mjs [BASE]   (mock server, default port 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const sharp = require('sharp');
const BASE = process.argv[2] ?? 'http://localhost:5180';
const OUT = 'proof-out/lab/mock/r70/stills'; mkdirSync(OUT, { recursive: true });
// timeline lengths as in r70.js
const NAMES = ['hero', 'origin', 'foundation', 'development', 'experiments', 'identity', 'connection'];
const HOLD = [0.5, 0.9, 1.1, 1.3, 1.3, 0.9, 0.9], MOVE = [1.0, 1.2, 0.8, 0.8, 1.0, 1.0];
const start = []; let T = 0; HOLD.forEach((h, i) => { start.push(T); T += h + (MOVE[i] ?? 0); });
const at = (i, k = 0.5) => ((start[i] + HOLD[i] * k) / T).toFixed(4);
const mid = (i, k = 0.5) => ((start[i] + HOLD[i] + MOVE[i] * k) / T).toFixed(4);
const D = [1440, 810], P = [390, 844];
const jobs = [
  [...D, 'p=0&a=0', '0-first'], [...D, 'p=0&a=-1', '0-first-turn-a'], [...D, 'p=0&a=1', '0-first-turn-b'],
  [...D, `p=${mid(0)}`, 'move-0-1'],
  [...D, `p=${at(1)}`, '1-origin'], [...D, `p=${mid(1)}`, 'move-1-2'],
  [...D, `p=${at(2)}`, '2-foundation'],
  [...D, `p=${at(3)}`, '3-development'], [...D, `p=${at(3)}&arm=2`, '3-development-circuits'], [...D, `p=${at(3)}&arm=3`, '3-development-mechanics'],
  [...D, `p=${at(4)}`, '4-experiments'], [...D, `p=${at(4)}&open=jontai`, '4-open-jontai'], [...D, `p=${at(4)}&open=lumo`, '4-open-lumo'], [...D, `p=${at(4)}&open=locked`, '4-open-locked'],
  [...D, `p=${mid(4)}`, 'move-4-5'],
  [...D, `p=${at(5)}`, '5-identity'], [...D, `p=${at(6)}`, '6-connection'],
  [1280, 800, 'p=0&a=0', 'w1280-first'], [1920, 1080, `p=${at(3)}`, 'w1920-development'],
  [...P, 'p=0&a=0', 'phone-0-first'], [...P, `p=${at(2)}`, 'phone-2-foundation'], [...P, `p=${at(3)}`, 'phone-3-development'], [...P, `p=${at(4)}`, 'phone-4-experiments'], [...P, `p=${at(6)}`, 'phone-6-connection'],
];
const only = process.env.ONLY?.split(',');
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h, query, name] of jobs) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 700 });
  const page = await ctx.newPage(); const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text())); page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${BASE}/tools/lab/mock/r70.html?${query}${process.env.DIR ? '&dir=' + process.env.DIR : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => problems.push('never ready'));
  await page.waitForTimeout(1600);       // the lit branch and the open project fade in
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log(`${name}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
  await ctx.close();
}
await browser.close();

// the contact sheet: the nine frames that tell the story, three across
const sheet = ['0-first', '1-origin', '2-foundation', '3-development', '3-development-circuits', '4-experiments', '4-open-jontai', '5-identity', '6-connection'];
const W = 960, H = 540, C = 3;
const tiles = await Promise.all(sheet.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.jpg`).resize(W, H).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })));
await sharp({ create: { width: W * C, height: H * Math.ceil(sheet.length / C), channels: 3, background: '#100b19' } })
  .composite(tiles).jpeg({ quality: 88 }).toFile('proof-out/lab/mock/r70-contact-sheet.jpg');
console.log('sheet proof-out/lab/mock/r70-contact-sheet.jpg');
