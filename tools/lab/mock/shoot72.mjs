// LAB ONLY (throwaway). Round 72 stills in headless Edge: every stop (?p= holds it without scrolling), the moves that
// matter (rising, the dive, the iris opening on the desk), an open project, the plain list, phones. Then a contact sheet.
//   PLAYWRIGHT_CORE=<path> node tools/lab/mock/shoot72.mjs [BASE]   (mock server, default port 5180)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const sharp = require('sharp');
const BASE = process.argv[2] ?? 'http://localhost:5180';
const OUT = 'proof-out/lab/mock/r72/stills'; mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/tools/lab/mock/r72.html`;
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

// the timeline comes from the page itself
const probe = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
await probe.goto(`${URL}?p=0`, { waitUntil: 'load' });
await probe.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const TL = await probe.evaluate(() => ({ T: window.__T, start: window.__startOf, hold: window.__HOLD }));
const names = Object.keys(TL.start);
const at = (n, k = 0.5) => ((TL.start[n] + TL.hold[n] * k) / TL.T).toFixed(4);
const mid = (n, k = 0.5) => { const i = names.indexOf(n), next = names[i + 1]; const a = TL.start[n] + TL.hold[n]; return ((a + (TL.start[next] - a) * k) / TL.T).toFixed(4); };

const D = [1440, 810], P = [390, 844];
const jobs = [
  [...D, 'p=0&a=0', '00-first'], [...D, 'p=0&a=-1', '00-first-drift-a'], [...D, 'p=0&a=1', '00-first-drift-b'],
  [...D, `p=${mid('origin', 0.5)}`, '01-move-out'],
  [...D, `p=${at('foundation')}`, '02-foundation'], [...D, `p=${at('interaction')}`, '02b-interaction'],
  [...D, `p=${mid('interaction', 0.5)}`, '03-move-shell'], [...D, `p=${at('protection')}`, '03-protection'],
  [...D, `p=${at('evolution')}`, '04-evolution'],
  [...D, `p=${at('works')}`, '05-works'], [...D, `p=${at('works')}&list`, '05-works-list'],
  [...D, `p=${at('w-jontai')}`, '05a-jontai'], [...D, `p=${at('w-jontai')}&open=jontai`, '05a-jontai-open'],
  [...D, `p=${at('w-lumo')}`, '05b-lumo'], [...D, `p=${at('w-lumo')}&open=lumo`, '05b-lumo-open'],
  [...D, `p=${at('w-locked')}`, '05c-locked'], [...D, `p=${at('w-locked')}&open=locked`, '05c-locked-open'],
  [...D, `p=${at('w-cookies')}`, '05d-cookies'], [...D, `p=${at('w-cookies')}&open=cookies`, '05d-cookies-open'],
  [...D, `p=${mid('w-cookies', 0.45)}`, '06-rising'], [...D, `p=${mid('w-cookies', 0.75)}`, '06-rising-late'],
  [...D, `p=${at('awakening')}`, '06-awakening'],
  [...D, `p=${mid('awakening', 0.6)}`, '07-to-eye'], [...D, `p=${at('eye')}`, '07-eye'],
  [...D, `p=${mid('eye', 0.35)}`, '07-dive'], [...D, `p=${mid('eye', 0.55)}`, '07-iris'], [...D, `p=${mid('eye', 0.62)}`, '07-iris-wide'],
  [...D, `p=${at('desk')}`, '07-desk'],
  [1280, 800, 'p=0&a=0', 'w1280-first'], [1920, 1080, `p=${at('awakening')}`, 'w1920-awakening'],
  [...P, 'p=0&a=0', 'phone-00-first'], [...P, `p=${at('foundation')}`, 'phone-02-foundation'], [...P, `p=${at('protection')}`, 'phone-03-protection'],
  [...P, `p=${at('works')}`, 'phone-05-works'], [...P, `p=${at('w-lumo')}&open=lumo`, 'phone-05b-lumo-open'],
  [...P, `p=${at('awakening')}`, 'phone-06-awakening'], [...P, `p=${at('desk')}`, 'phone-07-desk'],
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
await browser.close();

const sheet = ['00-first', '01-move-out', '02-foundation', '02b-interaction', '03-protection', '04-evolution', '05-works', '05a-jontai', '05a-jontai-open',
  '05b-lumo', '05c-locked', '05d-cookies', '06-rising', '06-awakening', '07-eye', '07-dive', '07-iris', '07-desk'];
const W = 960, H = 540, C = 3;
const tiles = await Promise.all(sheet.map(async (n, i) => ({ input: await sharp(`${OUT}/${n}.jpg`).resize(W, H).toBuffer(), left: (i % C) * W, top: Math.floor(i / C) * H })));
await sharp({ create: { width: W * C, height: H * Math.ceil(sheet.length / C), channels: 3, background: '#0e0a14' } })
  .composite(tiles).jpeg({ quality: 88 }).toFile('proof-out/lab/mock/r72-contact-sheet.jpg');
console.log('sheet proof-out/lab/mock/r72-contact-sheet.jpg');
