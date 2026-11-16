// LAB ONLY (throwaway). Round 71 stills in headless Edge: every stop (?p= holds it without scrolling), a lit system,
// an open project, the plain list, a few mid-moves, and a phone. Then one contact sheet.
//   PLAYWRIGHT_CORE=<path> node tools/lab/mock/shoot71.mjs [BASE]   (mock server, default port 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const sharp = require('sharp');
const BASE = process.argv[2] ?? 'http://localhost:5180';
const OUT = 'proof-out/lab/mock/r71/stills'; mkdirSync(OUT, { recursive: true });
// timeline lengths as in r71.js
const NAMES = ['hero', 'origin', 'foundation', 'development', 'works', 'w-jontai', 'w-lumo', 'w-locked', 'w-cookies', 'identity', 'connection'];
const HOLD = [0.5, 0.9, 1.2, 1.3, 0.9, 0.9, 0.9, 0.9, 0.9, 1.0, 0.9], MOVE = [0.8, 1.4, 1.6, 0.8, 0.7, 0.8, 0.8, 0.8, 1.3, 1.1];
const start = []; let T = 0; HOLD.forEach((h, i) => { start.push(T); T += h + (MOVE[i] ?? 0); });
const at = (n, k = 0.5) => { const i = NAMES.indexOf(n); return ((start[i] + HOLD[i] * k) / T).toFixed(4); };
const mid = (n, k = 0.5) => { const i = NAMES.indexOf(n); return ((start[i] + HOLD[i] + MOVE[i] * k) / T).toFixed(4); };
const D = [1440, 810], P = [390, 844];
const jobs = [
  [...D, 'p=0&a=0', '00-first'], [...D, 'p=0&a=-1', '00-first-turn-a'], [...D, 'p=0&a=1', '00-first-turn-b'],
  [...D, `p=${at('origin')}`, '01-origin'], [...D, `p=${mid('origin', 0.3)}`, '01-move-in'], [...D, `p=${mid('origin', 0.75)}`, '01-move-up'],
  [...D, `p=${at('foundation')}`, '02-foundation'], [...D, `p=${mid('foundation', 0.45)}`, '02-move-out'], [...D, `p=${mid('foundation', 0.8)}`, '02-move-reveal'],
  [...D, `p=${at('development')}`, '03-development'], [...D, `p=${at('development')}&sys=2`, '03-development-circuits'], [...D, `p=${at('development')}&sys=0`, '03-development-logic'],
  [...D, `p=${at('works')}`, '04-works'], [...D, `p=${at('works')}&list`, '04-works-list'],
  [...D, `p=${at('w-jontai')}`, '04a-jontai'], [...D, `p=${at('w-jontai')}&open=jontai`, '04a-jontai-open'],
  [...D, `p=${at('w-lumo')}`, '04b-lumo'], [...D, `p=${at('w-lumo')}&open=lumo`, '04b-lumo-open'],
  [...D, `p=${at('w-locked')}`, '04c-locked'], [...D, `p=${at('w-locked')}&open=locked`, '04c-locked-open'],
  [...D, `p=${at('w-cookies')}`, '04d-cookies'], [...D, `p=${at('w-cookies')}&open=cookies`, '04d-cookies-open'],
  [...D, `p=${mid('w-cookies', 0.5)}`, '05-move-back'],
  [...D, `p=${at('identity')}`, '05-identity'], [...D, `p=${at('connection')}`, '06-connection'],
  [1280, 800, 'p=0&a=0', 'w1280-first'], [1920, 1080, `p=${at('w-jontai')}`, 'w1920-jontai'],
  [...P, 'p=0&a=0', 'phone-00-first'], [...P, `p=${at('foundation')}`, 'phone-02-foundation'], [...P, `p=${at('development')}`, 'phone-03-development'],
  [...P, `p=${at('w-lumo')}`, 'phone-04b-lumo'], [...P, `p=${at('w-lumo')}&open=lumo`, 'phone-04b-lumo-open'], [...P, `p=${at('connection')}`, 'phone-06-connection'],
];
const only = process.env.ONLY?.split(',');
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h, query, name] of jobs) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 700 });
  const page = await ctx.newPage(); const problems = [];
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && problems.push(m.text())); page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${BASE}/tools/lab/mock/r71.html?${query}${process.env.DIR ? '&dir=' + process.env.DIR : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => problems.push('never ready'));
  await page.waitForTimeout(2400);       // the rest of the frames, a lit system and an open project fade in
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log(`${name}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
  await ctx.close();
}
await browser.close();

// the contact sheet: the frames that tell the story, three across
const sheet = ['00-first', '01-origin', '02-foundation', '03-development', '03-development-circuits', '04-works', '04a-jontai', '04a-jontai-open', '04b-lumo', '04c-locked', '04d-cookies', '05-identity', '06-connection', '01-move-in', '02-move-reveal'];
const W = 960, H = 540, C = 3;
const tiles = await Promise.all(sheet.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.jpg`).resize(W, H).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })));
await sharp({ create: { width: W * C, height: H * Math.ceil(sheet.length / C), channels: 3, background: '#100b19' } })
  .composite(tiles).jpeg({ quality: 88 }).toFile('proof-out/lab/mock/r71-contact-sheet.jpg');
console.log('sheet proof-out/lab/mock/r71-contact-sheet.jpg');
