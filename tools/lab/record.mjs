// LAB ONLY (throwaway): stills, frame-by-frame seam checks and screen recordings of the /lab previews, in headless Edge
// with the GPU on. Playwright stays outside the repo, as tools/proof does (PLAYWRIGHT_CORE points at it).
//
//   ID=a MODE=shots  node tools/lab/record.mjs          stills at FRAMES
//   ID=a MODE=seam   node tools/lab/record.mjs          a still per frame across the seam and the brain's start, with diffs
//   ID=a MODE=record node tools/lab/record.mjs          a screen recording: hold, scroll down into the brain, scroll back
//   ID=a MODE=passes node tools/lab/record.mjs          forward and back five times; the same frame must look the same
//
// BASE (http://localhost:5175), W, H, DSF, REDUCED=1, QUERY ('?smooth=0.02'), OUT (proof-out/lab), FRAMES.
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
const BASE = process.env.BASE ?? 'http://localhost:5175';
const ID = process.env.ID ?? 'a';
const MODE = process.env.MODE ?? 'shots';
const OUT = process.env.OUT ?? 'proof-out/lab';
const VIEW = { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 810) };
const DSF = Number(process.env.DSF ?? 1);
const QUERY = process.env.QUERY ?? '';
const TAG = process.env.TAG ?? `${VIEW.width}x${VIEW.height}${DSF !== 1 ? `@${DSF}` : ''}`;
const FRAMES = (process.env.FRAMES ?? '0,40,80,130,185,225,250,280,300,318,330,338,350,360,368,372,400,450,477,520,560').split(',').map(Number);
mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const video = MODE === 'record' ? { dir: join(OUT, 'video-tmp'), size: VIEW } : undefined;
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference', recordVideo: video });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const started = Date.now();
await page.goto(`${BASE}/lab/${ID}/${QUERY}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.hasAttribute('data-lab-ready') && window.__lab, null, { timeout: 60000 });
const readyMs = Date.now() - started;
const info = await page.evaluate(() => ({ console: [], last: window.__lab.scrollFor(1e9), dpr: devicePixelRatio }));

async function go(f, settle = 0.03) {
  await page.evaluate((frame) => scrollTo(0, window.__lab.scrollFor(frame)), f);
  await page.waitForFunction(([frame, eps]) => Math.abs(window.__lab.frame() - frame) < eps, [f, settle], { timeout: 15000, polling: 16 }).catch(() => {});
  await sleep(120);
}

async function diff(a, b) {
  const [x, y] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
  let sum = 0;
  for (let i = 0; i < x.data.length; i++) sum += Math.abs(x.data[i] - y.data[i]);
  return sum / x.data.length;
}

if (MODE === 'shots') {
  await sleep(1800);
  for (const f of FRAMES) {
    await go(f);
    await page.screenshot({ path: join(OUT, `${ID}-${TAG}-${String(f).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 88 });
  }
}

if (MODE === 'seam') {
  // The new seam (chip to tunnel, 326 to 380) and the brain's own start (470 to 490), a still per frame.
  const ranges = [[326, 380], [470, 490]];
  for (const [from, to] of ranges) {
    const files = [];
    for (let f = from; f <= to; f++) {
      await go(f, 0.01);
      const file = join(OUT, `${ID}-seam-${String(f).padStart(3, '0')}.png`);
      await page.screenshot({ path: file });
      files.push([f, file]);
    }
    const diffs = [];
    for (let i = 1; i < files.length; i++) diffs.push([files[i][0], await diff(files[i - 1][1], files[i][1])]);
    const values = diffs.map(([, d]) => d).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    console.log(`seam ${from}-${to}: mean abs diff per frame step (0-255), median ${median.toFixed(2)}, max ${values.at(-1).toFixed(2)}`);
    console.log(diffs.map(([f, d]) => `${f}:${d.toFixed(1)}`).join(' '));
  }
}

if (MODE === 'passes') {
  const probe = [60, 200, 340, 365, 380, 480];
  const base = new Map();
  for (const f of probe) {
    await go(f, 0.01);
    base.set(f, await page.screenshot({ type: 'png' }));
  }
  const results = [];
  for (let pass = 1; pass <= 5; pass++) {
    // Down past the brain's start with the wheel, then back up to the top, with the wheel.
    const last = await page.evaluate(() => window.__lab.scrollFor(500));
    await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
    for (let y = await page.evaluate(() => scrollY); y < last; y += 160) {
      await page.mouse.wheel(0, 160);
      await sleep(16);
    }
    await sleep(600);
    for (let y = await page.evaluate(() => scrollY); y > 0; y -= 200) {
      await page.mouse.wheel(0, -200);
      await sleep(16);
    }
    await sleep(600);
    for (const f of probe) {
      await go(f, 0.01);
      const now = await page.screenshot({ type: 'png' });
      results.push([pass, f, await diff(base.get(f), now)]);
    }
  }
  const worst = results.reduce((m, r) => (r[2] > m[2] ? r : m), [0, 0, 0]);
  console.log(`passes: ${results.length} comparisons after 5 wheel passes down into the brain and back; worst mean abs diff ${worst[2].toFixed(2)} (pass ${worst[0]}, frame ${worst[1]})`);
  console.log(results.map(([p, f, d]) => `p${p}f${f}:${d.toFixed(2)}`).join(' '));
}

if (MODE === 'keys') {
  // The skip link by keyboard alone: Tab until it has focus, Enter, and the page must land on the brain's first frame.
  await sleep(1500);
  let tabs = 0;
  for (; tabs < 20; tabs++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.classList.contains('lab-skip'))) break;
  }
  const visible = await page.evaluate(() => getComputedStyle(document.activeElement).transform);
  await page.keyboard.press('Enter');
  // 477: timeline.head[0] with the two projects on the site now.
  await page.waitForFunction(() => Math.abs(window.__lab.frame() - 477) < 1, null, { timeout: 20000 }).catch(() => {});
  const result = await page.evaluate(() => ({ frame: window.__lab.frame(), focus: document.activeElement?.id ?? null }));
  console.log(`keys: skip link reached after ${tabs + 1} Tab presses (transform ${visible}); after Enter the frame is ${result.frame.toFixed(1)} and focus is on #${result.focus}`);
}

if (MODE === 'record') {
  // A visitor's way through: the hero, a steady scroll down into the brain's shaft, a pause, and back up.
  await sleep(3200);
  await page.mouse.move(VIEW.width * 0.62, VIEW.height * 0.5);
  const end = await page.evaluate(() => window.__lab.scrollFor(1e9));
  const speed = Number(process.env.SPEED ?? 760); // px a second
  for (let y = 0; y < end; y += speed / 60) {
    await page.mouse.wheel(0, speed / 60);
    await sleep(16);
  }
  await sleep(2200);
  for (let y = await page.evaluate(() => scrollY); y > 0; y -= 2400 / 60) {
    await page.mouse.wheel(0, -2400 / 60);
    await sleep(16);
  }
  await sleep(1800);
}

const frames = await page.evaluate(() => window.__lab.frameTimes());
const sorted = frames.slice().sort((a, b) => a - b);
await context.close();
await browser.close();
if (video) {
  const dir = join(OUT, 'video-tmp');
  const made = readdirSync(dir).filter((f) => f.endsWith('.webm'));
  if (made[0]) renameSync(join(dir, made[0]), join(OUT, `${ID}-${TAG}.webm`));
}
console.log(JSON.stringify({ id: ID, mode: MODE, view: VIEW, dsf: DSF, readyMs, trackPx: Math.round(info.last), frameMs: sorted.length ? { median: sorted[Math.floor(sorted.length / 2)].toFixed(1), p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(1), worst: sorted.at(-1).toFixed(1) } : null, problems: problems.slice(0, 12) }));
