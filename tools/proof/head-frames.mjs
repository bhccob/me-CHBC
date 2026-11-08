/**
 * Screenshots of the head journey at given t values (and the tunnel's exit), from the built site or a dev server, for a
 * person to judge by eye: the join, the scan, the lid, the pour. Not a pass or fail check; journey.mjs holds those.
 *
 *   BASE        site to shoot, default http://localhost:5173
 *   TS          the head's t values, comma separated
 *   OUT         where the pictures go, default proof-out/head
 *   PREFIX      the pictures' name, default site
 *   WIDTH, HEIGHT  the view, default 1280 x 800
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tsImport } from 'tsx/esm/api';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const { scrollFromFrame } = await tsImport('../../src/journey/timeline.ts', import.meta.url);
const { headFrame } = await tsImport('../../src/journey/head/time.ts', import.meta.url);
const { projects } = await tsImport('../../src/data/projects.ts', import.meta.url);
const { flightLayout, timelineFor } = await tsImport('../../src/journey/flight/layout.ts', import.meta.url);

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'proof-out/head';
const PREFIX = process.env.PREFIX ?? 'site';
const view = { width: Number(process.env.WIDTH ?? 1280), height: Number(process.env.HEIGHT ?? 800) };
const timeline = timelineFor(flightLayout(projects.byDate()));
const shots = (process.env.TS ?? 'exit,0.03,0.06,0.1,0.13,0.17,0.25,0.3').split(',').map((v) => (v === 'exit' ? { name: 'exit', f: timeline.head[0] - 6 } : { name: v, f: headFrame(Number(v), timeline) }));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: view });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 300));
});
await page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
await page.goto(`${BASE}/en/?proof&stages=all`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 90_000 });
await page.mouse.move(view.width / 2, view.height / 2);
for (const { name, f } of shots) {
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.evaluate((top) => scrollTo({ top, behavior: 'auto' }), scrollFromFrame(f, max, timeline));
  await page.waitForFunction((want) => Math.abs(window.__journeyDebug.frame() - want) < 0.6, f, { timeout: 30_000 });
  // The head's stage may still be coming: wait for it to show, then for a few frames to draw.
  if (name !== 'exit') await page.waitForFunction(() => window.__journeyDebug.stops()?.head !== null, null, { timeout: 60_000 }).catch(() => errors.push(`no head at ${name}`));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` });
  const head = await page.evaluate(() => window.__journeyDebug.stops()?.head ?? null);
  console.log(name, f.toFixed(1), JSON.stringify(head));
}
console.log(JSON.stringify({ errors }));
await browser.close();
