// The share image's source, shot from the journey's real first view at the size social cards use. Run after a JOURNEY=1 build,
// with the site served on BASE, and commit what it writes.
//   BASE=http://localhost:4490 node tools/share_image.mjs      (PLAYWRIGHT_CORE as in tools/proof)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');
const BASE = process.env.BASE ?? 'http://localhost:4490';
const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-position=-2400,0', '--use-angle=d3d11'] });
const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
await context.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
const page = await context.newPage();
await page.goto(`${BASE}/en/journey/?proof`);
await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
// The tree grows in its first seconds.
await page.waitForTimeout(6000);
// What belongs to the page and not to a picture of it: the header, the chapters, the bar and the cursor.
await page.evaluate(() => {
  for (const el of document.querySelectorAll('.site-header, .j-rail, .j-bar, .lock-cursor, [data-lock-cursor]')) el.style.setProperty('visibility', 'hidden', 'important');
});
await page.mouse.move(1199, 629);
await page.waitForTimeout(600);
await page.screenshot({ path: 'src/assets/journey/share.png', type: 'png' });
await browser.close();
console.log('share image written');
