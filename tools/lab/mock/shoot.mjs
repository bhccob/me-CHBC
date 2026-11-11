// LAB ONLY (throwaway): stills of the mock-ups in headless Edge with the GPU on, into proof-out/lab/mock.
//   PAGES=coin-01-name,coin-02-lift SIZES=1440x810,390x844 node tools/lab/mock/shoot.mjs
// Needs the mock server (launch.json "mock", port 5180) and PLAYWRIGHT_CORE pointing at playwright-core.
import { mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const BASE = process.env.BASE ?? 'http://localhost:5180/tools/lab/mock';
const OUT = process.env.OUT ?? 'proof-out/lab/mock';
const pages = (process.env.PAGES ?? readdirSync('tools/lab/mock').filter((f) => /^(coin|seal|cart)-.*\.html$/.test(f)).map((f) => f.replace('.html', '')).join(',')).split(',');
const sizes = (process.env.SIZES ?? '1440x810').split(',').map((s) => s.split('x').map(Number));
mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h] of sizes) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1 });
  for (const name of pages) {
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
    page.on('pageerror', (e) => problems.push(e.message));
    const started = Date.now();
    await page.goto(`${BASE}/${name}.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).catch(() => problems.push('never ready'));
    await page.waitForTimeout(300);
    const file = join(OUT, `${name}-${w}x${h}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
    console.log(`${file} · ${Date.now() - started} ms${problems.length ? ` · ${problems.join(' | ').slice(0, 400)}` : ''}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
