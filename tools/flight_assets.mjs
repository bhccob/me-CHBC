// The flight's pictures in public/flight: the real screenshots, with the cookie painted out of the game and the cookie and
// Portle's ring cut out, so that they can float in front of their own place.
//   node tools/flight_assets.mjs      (PLAYWRIGHT_CORE as in tools/proof)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');
const SRC = 'src/assets/projects/';
const OUT = 'public/flight/';
mkdirSync(OUT, { recursive: true });
const url = (file) => `data:image/webp;base64,${readFileSync(SRC + file).toString('base64')}`;

for (const [from, to] of [['jontai-type.webp', 'jontai.webp'], ['portle-portfolio.webp', 'portle.webp'], ['steady-welcome.webp', 'steady-1.webp'], ['steady-home.webp', 'steady-2.webp'], ['steady-reminders.webp', 'steady-3.webp']]) copyFileSync(SRC + from, OUT + to);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.setContent('<!doctype html><body></body>');
const made = await page.evaluate(
  async ({ cookies, portle }) => {
    const load = async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    };
    const game = await load(cookies), archive = await load(portle);
    // The game with its cookie and counter painted out, since the real cookie floats in front.
    const c = document.createElement('canvas');
    c.width = 1440;
    c.height = 900;
    const x = c.getContext('2d');
    x.drawImage(game, 0, 0);
    x.drawImage(game, 470, 0, 1, 900, 0, 0, 470, 900);
    x.drawImage(game, 0, 0, 1440, 72, 0, 0, 1440, 72);
    const cut = (image, sx, sy, sr, ring) => {
      const S = 512, o = document.createElement('canvas');
      o.width = o.height = S;
      const g = o.getContext('2d'), m = S * 0.44, cx = S / 2, k = m / sr;
      g.shadowColor = 'rgba(0,0,0,.6)';
      g.shadowBlur = 30;
      g.shadowOffsetY = 12;
      g.beginPath();
      g.arc(cx, cx, m, 0, 7);
      g.fillStyle = ring;
      g.fill();
      g.shadowColor = 'transparent';
      g.save();
      g.beginPath();
      g.arc(cx, cx, m, 0, 7);
      g.clip();
      g.drawImage(image, cx - sx * k, cx - sy * k, image.naturalWidth * k, image.naturalHeight * k);
      g.restore();
      return o.toDataURL('image/webp', 0.9);
    };
    return { 'cookies.webp': c.toDataURL('image/webp', 0.86), 'cookie-piece.webp': cut(game, 240, 335, 126, 'rgba(120,70,30,0)'), 'ring-piece.webp': cut(archive, 480, 314, 132, '#17151f') };
  },
  { cookies: url('cookies-playing.webp'), portle: url('portle-portfolio.webp') },
);
await browser.close();
for (const [name, data] of Object.entries(made)) writeFileSync(OUT + name, Buffer.from(data.split(',')[1], 'base64'));
console.log('flight pictures done');
