// LAB ONLY (throwaway). Round 75 stills in headless Edge: every stop and the moves between them (the cut into the
// screen and the cut out to the PC's chip included), the turntable turned by a real drag, an open project, phones.
//   PLAYWRIGHT_CORE=<path> node tools/lab/mock/shoot75.mjs [BASE]   (mock server, default port 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const sharp = require('sharp');
const BASE = process.argv[2] ?? 'http://localhost:5180';
const OUT = 'proof-out/lab/mock/r75/stills'; mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/tools/lab/mock/r75.html`;
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const probe = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
await probe.goto(`${URL}?p=0`, { waitUntil: 'load' });
await probe.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const TL = await probe.evaluate(() => ({ T: window.__T, start: window.__startOf, hold: window.__HOLD }));
const names = Object.keys(TL.start);
const at = (n, k = 0.5) => ((TL.start[n] + TL.hold[n] * k) / TL.T).toFixed(4);
const mid = (n, k = 0.5) => { const i = names.indexOf(n), next = names[i + 1]; const a = TL.start[n] + TL.hold[n]; return ((a + (TL.start[next] - a) * k) / TL.T).toFixed(4); };
const D = [1440, 810], P = [390, 844];
const jobs = [
  [...D, `p=${at('print', 0.2)}`, '00-print'], [...D, `p=${at('cursor')}`, '01-cursor'], [...D, `p=${mid('cursor', 0.6)}`, '01-pull'],
  [...D, `p=${mid('screen', 0.5)}`, '02-cut-in'], [...D, `p=${mid('d-cursor', 0.3)}`, '02-typing'], [...D, `p=${mid('d-cursor', 0.75)}`, '02-lift'],
  [...D, `p=${at('software')}`, '03-software'], [...D, `p=${mid('software', 0.5)}`, '03-lights'], [...D, `p=${at('game')}`, '04-game'],
  [...D, `p=${mid('game', 0.5)}`, '04-attack'], [...D, `p=${at('cyber')}`, '05-cyber'], [...D, `p=${mid('cyber', 0.6)}`, '05-compiling'],
  [...D, `p=${at('compile')}`, '06-chip-inside'], [...D, `p=${mid('compile', 0.5)}`, '06-cut-out'], [...D, `p=${at('chip')}`, '06-chip-pc'],
  [...D, `p=${mid('chip', 0.6)}`, '07-board'], [...D, `p=${mid('board', 0.6)}`, '07-out'], [...D, `p=${at('cable')}`, '07-cable'],
  [...D, `p=${at('arm')}`, '08-arm'], [...D, `p=${mid('arm', 0.35)}`, '08-printing'], [...D, `p=${mid('arm', 0.7)}`, '08-printing-late'],
  [...D, `p=${at('works')}`, '09-works'], [...D, `p=${at('works')}&spin=9`, '09-works-spin'], [...D, `p=${at('works')}&open=lumo`, '09-open'],
  [...D, `p=${mid('works', 0.5)}`, '10-pullback'], [...D, `p=${at('desk')}`, '10-desk'],
  [1920, 1080, `p=${at('desk')}`, 'w1920-desk'],
  [...P, `p=${at('print', 0.2)}`, 'phone-00-print'], [...P, `p=${at('software')}`, 'phone-03-software'], [...P, `p=${at('works')}`, 'phone-09-works'], [...P, `p=${at('desk')}`, 'phone-10-desk'],
];
const only = process.env.ONLY?.split(',');
for (const [w, h, query, name] of jobs) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 700 });
  const page = await ctx.newPage(); const problems = [];
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && problems.push(m.text())); page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${URL}?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => problems.push('never ready'));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log(`${name}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
  await ctx.close();
}
// a real drag on the turntable
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } }); const page = await ctx.newPage(); const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${URL}?p=${at('works')}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true); await page.waitForTimeout(3500);
  const before = await page.evaluate(() => document.querySelector('.front-title').textContent);
  await page.mouse.move(1000, 420); await page.mouse.down();
  for (let i = 0; i < 10; i++) { await page.mouse.move(1000 - i * 16, 420); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(2200);
  const after = await page.evaluate(() => document.querySelector('.front-title').textContent);
  await page.screenshot({ path: `${OUT}/09-works-dragged.jpg`, type: 'jpeg', quality: 90 });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500);
  const key = await page.evaluate(() => document.querySelector('.front-title').textContent);
  console.log(`drag: front ${before} -> ${after}; ArrowRight -> ${key}${problems.length ? ' · ' + problems.join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
const sheet = ['00-print', '01-cursor', '02-typing', '02-lift', '03-software', '04-game', '04-attack', '05-cyber', '05-compiling', '06-chip-inside', '06-chip-pc', '07-board',
  '07-cable', '08-arm', '08-printing', '09-works', '09-works-dragged', '09-open', '10-pullback', '10-desk'];
const W = 720, H = 405, C = 4;
const tiles = await Promise.all(sheet.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.jpg`).resize(W, H).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })));
await sharp({ create: { width: W * C, height: H * Math.ceil(sheet.length / C), channels: 3, background: '#0e0a14' } })
  .composite(tiles).jpeg({ quality: 88 }).toFile('proof-out/lab/mock/r75-contact-sheet.jpg');
console.log('sheet proof-out/lab/mock/r75-contact-sheet.jpg');
