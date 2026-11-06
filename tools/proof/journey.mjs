/**
 * The proof harness of the journey (spec 2026-11-05-bob-machine-rebuild-design.md, section 11). It drives a real Edge through
 * the built site, served the way GitHub Pages serves it, with real wheel input. One PASS or FAIL line per step, results.json
 * and the stills in a folder, exit 1 if a step failed. Every step also fails on a console error, a page error or a CSP
 * violation.
 *
 *   JOURNEY=1 PUBLIC_WEB3FORMS_KEY=local-proof-placeholder npm run build
 *   STEPS=stills,smooth node tools/proof/journey.mjs
 *
 * Environment:
 *   BASE             site to test; by default the harness serves dist/client itself
 *   ROUTE            the journey's address, default /journey/
 *   GPU=weak         Edge's low-power GPU with the CPU throttled 4x at 1080p, the slowest machine the site is held to
 *   PROOF_DIR        where results.json and the stills go, default ./proof-out
 *   STEPS            comma list of steps, default all
 *   PLAYWRIGHT_CORE  path to a playwright-core package outside the repo
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { tsImport } from 'tsx/esm/api';

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_CORE ? require(resolve(process.env.PLAYWRIGHT_CORE)) : require('playwright-core');
const { buildTimeline, scrollFromFrame } = await tsImport('../../src/journey/timeline.ts', import.meta.url);

const ROUTE = process.env.ROUTE ?? '/journey/';
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const WEAK = process.env.GPU === 'weak';
const ARGS = ['--use-angle=d3d11', '--enable-gpu', ...(WEAK ? ['--force_low_power_gpu'] : [])];
const VIEW = WEAK ? { width: 1920, height: 1080 } : { width: 1440, height: 810 };
const timeline = buildTimeline();
export const REVIEW_FRAMES = [0, 36, 112, 190, 262, 304, 345, 360];

class Step {
  constructor(id) {
    this.id = id;
    this.checks = [];
    this.errors = [];
    this.csp = [];
  }
  check(ok, message) {
    this.checks.push({ ok: Boolean(ok), message });
  }
  get pass() {
    return this.checks.every((c) => c.ok);
  }
}

/** A page of its own, with its errors and CSP violations going to the step. */
async function openPage(browser, step, viewport = VIEW, options = {}) {
  const context = await browser.newContext({ viewport, ...options });
  const page = await context.newPage();
  page.on('pageerror', (error) => step.errors.push(String(error).slice(0, 300)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/Content Security Policy/i.test(text)) step.csp.push(text.slice(0, 300));
    else step.errors.push(text.slice(0, 300));
  });
  return { context, page };
}

/** The journey, loaded and drawing. */
async function openJourney(browser, step, viewport, options) {
  const opened = await openPage(browser, step, viewport, options);
  await opened.page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  await opened.page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  await opened.page.mouse.move(viewport?.width ? viewport.width / 2 : VIEW.width / 2, 300);
  return opened;
}

/** Scrolls to frame `f` by wheel, as a person does, and waits for the shown frame to get there. */
async function goToFrame(page, f, stepPx = 300, gap = 16) {
  const target = await page.evaluate(({ f, last, hold }) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return (hold + (Math.min(f, last) / last) * (1 - hold)) * max;
  }, { f, last: timeline.last, hold: scrollFromFrame(0, 1, timeline) });
  for (;;) {
    const y = await page.evaluate(() => scrollY);
    const left = target - y;
    if (Math.abs(left) < 1) break;
    await page.mouse.wheel(0, Math.sign(left) * Math.min(Math.abs(left), stepPx));
    await page.waitForTimeout(gap);
    if (Math.abs(left) <= stepPx) {
      await page.waitForTimeout(40);
      const after = await page.evaluate(() => scrollY);
      if (Math.abs(target - after) < 2) break;
      await page.evaluate((top) => scrollTo({ top, behavior: 'auto' }), target);
      break;
    }
  }
  await page.waitForFunction((want) => Math.abs(window.__journeyDebug.frame() - want) < 0.1, f, { timeout: 15_000 });
  await page.waitForTimeout(120);
}

// ---------------------------------------------------------------- steps

/** The eight frames Bob compares with the renders he approved. */
async function stills(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  const seen = [];
  for (const f of REVIEW_FRAMES) {
    await goToFrame(page, f);
    const shot = await page.screenshot({ type: 'jpeg', quality: 92 });
    writeFileSync(join(dir, `f${String(f).padStart(4, '0')}.jpg`), shot);
    const { channels } = await sharp(shot).stats();
    const bright = channels.reduce((sum, c) => sum + c.mean, 0) / 3, spread = channels.reduce((sum, c) => sum + c.stdev, 0) / 3;
    seen.push(`${f}: ${bright.toFixed(0)}`);
    step.check(spread > 6, `frame ${f} shows the machine, not an empty page (spread ${spread.toFixed(1)})`);
  }
  await context.close();
  return seen.join(', ');
}

/** A walk through the machine: how long the frames take, and how long any task holds up the page. */
async function smooth(browser, step) {
  const { context, page } = await openJourney(browser, step);
  if (WEAK) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__tasks = [];
    new PerformanceObserver((list) => window.__tasks.push(...list.getEntries().map((e) => ({ ms: e.duration, frame: window.__journeyDebug.frame() })))).observe({ type: 'longtask', buffered: false });
  });
  const start = (await page.evaluate(() => window.__journeyDebug.frameTimes())).length;
  const end = Math.min(timeline.last, Number(process.env.WALK_TO ?? 366));
  const stepPx = 180;
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const target = scrollFromFrame(end, max, timeline);
  for (let y = 0; y < target; y += stepPx) {
    await page.mouse.wheel(0, stepPx);
    await page.waitForTimeout(32);
  }
  await page.waitForTimeout(400);
  const { times, tasks } = await page.evaluate(() => ({ times: window.__journeyDebug.frameTimes(), tasks: window.__tasks }));
  const walk = times.slice(start).sort((a, b) => a - b);
  const median = walk[Math.floor(walk.length / 2)] ?? 0, p95 = walk[Math.floor(walk.length * 0.95)] ?? 0, worst = walk.at(-1) ?? 0;
  step.check(walk.length > 100, `the walk drew frames all the way (${walk.length})`);
  const longest = tasks.reduce((a, b) => (b.ms > a.ms ? b : a), { ms: 0, frame: 0 });
  step.check(longest.ms < 200, `no main-thread task over 200 ms (the longest ${longest.ms.toFixed(0)}, near frame ${longest.frame.toFixed(0)})`);
  step.median = median;
  await context.close();
  return `median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, worst ${worst.toFixed(1)} ms, ${walk.length} frames`;
}

const STEPS = { stills, smooth };

// ---------------------------------------------------------------- run

const wanted = (process.env.STEPS ?? Object.keys(STEPS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const unknown = wanted.filter((id) => !(id in STEPS));
if (wanted.length === 0 || unknown.length > 0) {
  console.error(`STEPS must name some of ${Object.keys(STEPS).join(', ')} (unknown: ${unknown.join(', ')})`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// The site, served by the repo's own Pages-like server unless BASE names another.
let server = null;
let BASE = process.env.BASE?.replace(/\/$/, '');
if (!BASE) {
  const PORT = process.env.PORT ?? '4491';
  server = spawn(process.execPath, ['tools/serve-pages.mjs'], { env: { ...process.env, PORT }, stdio: 'ignore' });
  BASE = `http://localhost:${PORT}`;
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`${BASE}/`);
      break;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
}

const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ARGS });
try {
  for (const id of wanted) {
    const step = new Step(id);
    const started = Date.now();
    let summary = '';
    try {
      summary = await STEPS[id](browser, step);
    } catch (error) {
      step.check(false, `the step threw: ${String(error?.message ?? error).split('\n')[0]}`);
    }
    step.check(step.errors.length === 0, `no console or page errors (got ${step.errors.length}: ${step.errors.slice(0, 2).join(' | ')})`);
    step.check(step.csp.length === 0, `no CSP violations (got ${step.csp.length}: ${step.csp.slice(0, 2).join(' | ')})`);
    step.seconds = Math.round((Date.now() - started) / 100) / 10;
    results.push(step);
    const failed = step.checks.filter((c) => !c.ok).map((c) => c.message);
    console.log(`${step.pass ? 'PASS' : 'FAIL'} ${id} ${step.pass ? `${summary} (${step.checks.length} checks, ${step.seconds} s)` : failed.join('; ')}`);
  }
} finally {
  await browser.close();
  server?.kill();
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: BASE, route: ROUTE, weak: WEAK, ranAt: new Date().toISOString(), steps: results.map(({ id, pass, seconds, checks, errors, csp }) => ({ id, pass, seconds, checks, errors, csp })) }, null, 2));
process.exitCode = results.every((step) => step.pass) ? 0 : 1;
