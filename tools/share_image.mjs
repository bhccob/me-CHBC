// The share image's source and the calm journey's still of the machine, shot from the real journey. Run after a JOURNEY=1 build,
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
// What belongs to the page and not to a picture of it: the header, the chapters, the bar, the cursor and the scrollbar.
const asPicture = (extra = '') =>
  page.evaluate((more) => {
    document.documentElement.style.setProperty('scrollbar-width', 'none');
    for (const el of document.querySelectorAll(`.site-header, .j-rail, .j-bar, .lock-cursor${more}`)) el.style.setProperty('visibility', 'hidden', 'important');
  }, extra);
await asPicture();
await page.mouse.move(1199, 629);
await page.waitForTimeout(600);
await page.screenshot({ path: 'src/assets/journey/share.png', type: 'png' });

// The finished machine, with nothing over it, for the page that does not move.
await page.setViewportSize({ width: 1440, height: 810 });
await page.waitForTimeout(400);
const sharp = (await import('sharp')).default;
await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo({ top: (0.035 + (304 / 934) * 0.965) * max, behavior: 'auto' });
});
await page.waitForFunction(() => Math.abs(window.__journeyDebug.frame() - 304) < 0.4, null, { timeout: 15_000 });
await asPicture(', #j-stack, [data-tag]');
await page.waitForTimeout(900);
await sharp(await page.screenshot({ type: 'png' })).webp({ quality: 82 }).toFile('src/assets/journey/machine-still.webp');
await browser.close();
console.log('share image and still written');
