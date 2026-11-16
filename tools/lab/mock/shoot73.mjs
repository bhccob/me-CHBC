// LAB ONLY (throwaway). Round 73 stills in headless Edge: every key frame, the transitions that carry the story (pull
// back from the print, the slide between chambers, the dive through the pinhole, the image righting itself), the ring
// turned by a real drag, an open project, phones. Then a contact sheet.
//   PLAYWRIGHT_CORE=<path> node tools/lab/mock/shoot73.mjs [BASE]   (mock server, default port 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const sharp = require('sharp');
const BASE = process.argv[2] ?? 'http://localhost:5180';
const OUT = 'proof-out/lab/mock/r73/stills'; mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/tools/lab/mock/r73.html`;
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
  [...D, `p=${at('origin', 0.2)}`, '00-first'], [...D, `p=${mid('origin', 0.35)}`, '01-move-out'], [...D, `p=${mid('origin', 0.7)}`, '01-move-out-late'],
  [...D, `p=${at('origin-out')}`, '01-print-out'], [...D, `p=${at('software')}`, '02-software'], [...D, `p=${mid('software', 0.5)}`, '02-slide'],
  [...D, `p=${at('game')}`, '02b-game'], [...D, `p=${at('cyber')}`, '03-cyber'], [...D, `p=${at('mechatronics')}`, '04-mech'],
  [...D, `p=${at('works')}`, '05-works'], [...D, `p=${at('works')}&ring=1`, '05-works-ring2'], [...D, `p=${at('works')}&open=lumo`, '05a-open'],
  [...D, `p=${at('works')}&list`, '05-list'],
  [...D, `p=${at('awakening')}`, '06-awakening'], [...D, `p=${at('eye')}`, '07-eye'], [...D, `p=${mid('eye', 0.4)}`, '07-dive'],
  [...D, `p=${at('obscura')}`, '07-obscura'], [...D, `p=${mid('obscura', 0.45)}`, '07-turn'], [...D, `p=${at('desk')}`, '07-desk'],
  [1920, 1080, `p=${at('works')}`, 'w1920-works'],
  [...P, `p=${at('origin', 0.2)}`, 'phone-00-first'], [...P, `p=${at('software')}`, 'phone-02-software'], [...P, `p=${at('works')}`, 'phone-05-works'], [...P, `p=${at('desk')}`, 'phone-07-desk'],
];
const only = process.env.ONLY?.split(',');
for (const [w, h, query, name] of jobs) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 700 });
  const page = await ctx.newPage(); const problems = [];
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && problems.push(m.text())); page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${URL}?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => problems.push('never ready'));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 90 });
  console.log(`${name}${problems.length ? ' · ' + problems.join(' | ').slice(0, 300) : ''}`);
  await ctx.close();
}
// a real drag on the ring: hold, move left, let go
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } }); const page = await ctx.newPage(); const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto(`${URL}?p=${at('works')}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__ready === true); await page.waitForTimeout(1500);
  const before = await page.evaluate(() => document.querySelector('.front-title').textContent);
  await page.mouse.move(900, 420); await page.mouse.down();
  for (let i = 0; i < 12; i++) { await page.mouse.move(900 - i * 22, 420); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(1800);
  const after = await page.evaluate(() => document.querySelector('.front-title').textContent);
  await page.screenshot({ path: `${OUT}/05-works-dragged.jpg`, type: 'jpeg', quality: 90 });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200);
  const key = await page.evaluate(() => document.querySelector('.front-title').textContent);
  console.log(`drag: front ${before} -> ${after}; ArrowRight -> ${key}${problems.length ? ' · ' + problems.join(' | ') : ''}`);
  await ctx.close();
}
await browser.close();
const sheet = ['00-first', '01-move-out', '01-print-out', '02-software', '02b-game', '03-cyber', '04-mech', '05-works', '05-works-dragged', '05a-open', '06-awakening', '07-eye', '07-dive', '07-obscura', '07-turn', '07-desk'];
const W = 720, H = 405, C = 4;
const tiles = await Promise.all(sheet.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.jpg`).resize(W, H).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })));
await sharp({ create: { width: W * C, height: H * Math.ceil(sheet.length / C), channels: 3, background: '#0e0a14' } })
  .composite(tiles).jpeg({ quality: 88 }).toFile('proof-out/lab/mock/r73-contact-sheet.jpg');
console.log('sheet proof-out/lab/mock/r73-contact-sheet.jpg');
