// The picture on the machine's software layer: a small class that names the machine's four layers.
//   node tools/code_screen.mjs      (PLAYWRIGHT_CORE as in tools/proof; it fetches IBM Plex Mono from Google Fonts just for this)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.setContent('<!doctype html><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&display=swap">');
await page.evaluate(() => document.fonts.load('500 40px "IBM Plex Mono"'));
await page.waitForTimeout(600);
const data = await page.evaluate(() => {
  const K = '#e6b84a', C = '#f2efe8', T = '#b9a4ff', M = '#6d6780';
  const lines = [
    [['// bob.chung', M]],
    [['class ', K], ['Machine', T], [' {', C]],
    [['  brain    ', C], ['= new ', K], ['Software', T], ['();', C]],
    [['  controls ', C], ['= new ', K], ['Game', T], ['();', C]],
    [['  armour   ', C], ['= new ', K], ['Security', T], ['();', C]],
    [['  body     ', C], ['= new ', K], ['Mechatronics', T], ['();', C]],
    [],
    [['  boot', T], ['() {', C]],
    [['    this', K], ['.brain.', C], ['run', T], ['();', C]],
    [['    this', K], ['.controls.', C], ['listen', T], ['();', C]],
    [['    this', K], ['.armour.', C], ['lock', T], ['();', C]],
    [['    this', K], ['.body.', C], ['stand', T], ['();', C]],
    [['  }', C]],
    [['}', C]],
    [],
    [['new ', K], ['Machine', T], ['().', C], ['boot', T], ['();', C]],
  ];
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#07060c';
  x.fillRect(0, 0, 1024, 1024);
  x.font = '500 46px "IBM Plex Mono", Consolas, monospace';
  x.textBaseline = 'alphabetic';
  lines.forEach((row, i) => {
    let px = 40;
    const y = 74 + i * 58;
    row.forEach(([t, col]) => {
      x.fillStyle = col;
      x.fillText(t, px, y);
      px += x.measureText(t).width;
    });
  });
  return c.toDataURL('image/png');
});
await browser.close();
await sharp(Buffer.from(data.split(',')[1], 'base64')).webp({ quality: 88 }).toFile('src/assets/journey/code-screen.webp');
console.log('code screen done');
