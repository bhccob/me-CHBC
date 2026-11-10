// LAB ONLY (throwaway): samples a recording every few seconds into one strip, to check what it shows.
//   node tools/lab/strip.mjs proof-out/lab/video/a-1440x810.webm
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const files = process.argv.slice(2);
const browser = await pw.chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
for (const file of files) {
  await page.goto(pathToFileURL(resolve(file)).href);
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
  const duration = await page.evaluate(() => document.querySelector('video').duration);
  const tiles = [];
  for (let i = 0, t = 1; t < duration; i++, t += duration / 15) {
    await page.evaluate((at) => new Promise((done) => { const v = document.querySelector('video'); v.pause(); v.onseeked = () => done(); v.currentTime = at; }), t);
    const shot = await page.locator('video').screenshot();
    tiles.push({ input: await sharp(shot).resize(480, 270).toBuffer(), left: (i % 5) * 480, top: Math.floor(i / 5) * 270 });
  }
  const out = file.replace(/\.webm$/, '-strip.jpg');
  await sharp({ create: { width: 2400, height: 270 * Math.ceil(tiles.length / 5), channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
  console.log(`${out}: ${duration.toFixed(1)} s, ${tiles.length} samples`);
}
await browser.close();
