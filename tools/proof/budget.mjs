// What the journey costs to download: walks it with a clean cache and sums what came over the wire. At the first view only the
// machine stage's files may have come; the whole journey must stay within 15 MB.
//   node tools/proof/budget.mjs          (a JOURNEY=1 build, served on PORT; PLAYWRIGHT_CORE as in tools/proof)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');
const PORT = process.env.PORT ?? '4492';
const LIMIT = 15 * 1024 * 1024;
const server = spawn(process.execPath, ['tools/serve-pages.mjs'], { env: { ...process.env, PORT }, stdio: 'ignore' });
await new Promise((done) => setTimeout(done, 800));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
const urls = new Map();
const sizes = new Map();
cdp.on('Network.responseReceived', ({ requestId, response }) => urls.set(requestId, response.url));
cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => sizes.set(requestId, encodedDataLength));
const list = () => [...sizes.entries()].map(([id, bytes]) => ({ url: urls.get(id) ?? '', bytes }));
const sum = (files) => files.reduce((total, file) => total + file.bytes, 0);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

await page.goto(`http://localhost:${PORT}/en/journey/?proof`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('.j-door-on') || window.__journeyDebug?.ready(), null, { timeout: 60_000 });
await page.waitForTimeout(3000);
const first = list();
const early = first.filter((file) => /\/flight\/|gate\.glb/.test(file.url));
console.log(`at the first view: ${mb(sum(first))} in ${first.length} files`);
const failures = [];
if (early.length) failures.push(`at the first view the later stages' files have already come: ${early.map((file) => file.url).join(', ')}`);

await page.evaluate(async () => {
  const max = () => document.documentElement.scrollHeight - innerHeight;
  for (let top = 0; top <= max(); top += 600) {
    scrollTo({ top, behavior: 'auto' });
    await new Promise((done) => setTimeout(done, 40));
  }
  scrollTo({ top: max(), behavior: 'auto' });
});
await page.waitForTimeout(4000);
const whole = list();
console.log(`the whole journey: ${mb(sum(whole))} in ${whole.length} files`);
for (const file of [...whole].sort((a, b) => b.bytes - a.bytes).slice(0, 8)) console.log(`  ${mb(file.bytes)}  ${file.url.replace(/^https?:\/\/[^/]+/, '')}`);
if (sum(whole) > LIMIT) failures.push(`the whole journey is ${mb(sum(whole))}, over 15 MB`);
if (!whole.some((file) => /gate\.glb/.test(file.url))) failures.push('the later stages never came');
await browser.close();
server.kill();
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(failures.length ? 'FAIL' : 'PASS');
process.exit(failures.length ? 1 : 0);
