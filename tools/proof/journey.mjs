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
const { projects } = await tsImport('../../src/data/projects.ts', import.meta.url);
const { profile } = await tsImport('../../src/data/profile.ts', import.meta.url);
const profileAge = () => profile.ageOn();
const { HITS } = await tsImport('../../src/journey/sound/score.ts', import.meta.url);
const HIT_NAMES = HITS.map(([, name]) => name);

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
async function openJourney(browser, step, viewport, { route = ROUTE, ...options } = {}) {
  const opened = await openPage(browser, step, viewport, options);
  await opened.page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
  await opened.page.goto(`${BASE}${route}?proof`, { waitUntil: 'load' });
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

/** The header's links and the rail's buttons, and the current chapter in gold. */
async function jumps(browser, step) {
  const { context, page } = await openJourney(browser, step);
  await page.getByRole('link', { name: /projects|projecten/i }).first().click();
  await page.waitForFunction(() => Math.abs(window.__journeyDebug.frame() - 392) < 1, null, { timeout: 15_000 });
  step.check(true, 'the header goes to the flight');
  const current = await page.evaluate(() => document.querySelector('#j-rail [aria-current]')?.getAttribute('data-jump'));
  step.check(current === 'projects', `the rail shows Projects as current (${current})`);
  const colour = await page.evaluate(() => getComputedStyle(document.querySelector('#j-rail [aria-current]')).color);
  step.check(colour === 'rgb(230, 184, 74)', `in gold (${colour})`);
  await page.locator('#j-rail button[data-jump="security"]').click();
  await page.waitForFunction(() => Math.abs(window.__journeyDebug.frame() - 188) < 1, null, { timeout: 15_000 });
  step.check(true, 'the rail goes to its chapter');
  await page.locator('header a[data-jump="contact"]').first().click();
  await page.waitForFunction((last) => Math.abs(window.__journeyDebug.frame() - last) < 1, timeline.last, { timeout: 15_000 });
  step.check(true, 'Contact goes to the end');
  await page.locator('header a[data-jump="who"]').click();
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 15_000 });
  step.check(true, 'the name goes to the very top');
  await context.close();
  return '';
}

/** A link that names a chapter lands on it. */
async function hash(browser, step) {
  for (const [name, want] of [['projects', 392], ['contact', timeline.last]]) {
    const { context, page } = await openPage(browser, step);
    await page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
    await page.goto(`${BASE}${ROUTE}?proof#${name}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
    const first = await page.evaluate(() => window.__journeyDebug.first());
    step.check(Math.abs(first - want) < 2, `#${name} lands on frame ${want} at once (${first})`);
    await context.close();
  }
  return '';
}

/** A reload in the middle lands on the same place, with no run up to it. */
async function reloadMid(browser, step) {
  const { context, page } = await openJourney(browser, step);
  await goToFrame(page, 300);
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  const { first, now } = await page.evaluate(() => ({ first: window.__journeyDebug.first(), now: window.__journeyDebug.frame() }));
  step.check(Math.abs(first - 300) < 2, `the first frame shown is the place it was (${first?.toFixed(1)})`);
  step.check(Math.abs(now - 300) < 2, `and it stays there (${now?.toFixed(1)})`);
  await context.close();
  return '';
}

/** A resize in the middle keeps the frame. */
async function resizeKeepsPlace(browser, step) {
  const { context, page } = await openJourney(browser, step);
  await goToFrame(page, 300);
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.waitForTimeout(600);
  const narrow = await page.evaluate(() => window.__journeyDebug.frame());
  await page.setViewportSize({ width: 1700, height: 950 });
  await page.waitForTimeout(600);
  const wide = await page.evaluate(() => window.__journeyDebug.frame());
  step.check(Math.abs(narrow - 300) < 2, `narrower, it stays (${narrow.toFixed(1)})`);
  step.check(Math.abs(wide - 300) < 2, `wider, it stays (${wide.toFixed(1)})`);
  await context.close();
  return '';
}

/** The language link keeps your place. */
async function langKeepsPlace(browser, step) {
  const { context, page } = await openJourney(browser, step);
  await goToFrame(page, 300);
  await page.locator('header a[hreflang]').click();
  await page.waitForURL(/\/en\/journey\//, { timeout: 10_000 });
  await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  await page.waitForTimeout(400);
  const here = await page.evaluate(() => window.__journeyDebug?.frame());
  step.check(Math.abs(here - 300) < 2, `it stays at the same place (${here?.toFixed(1)})`);
  const rail = await page.locator('#j-rail button[data-jump="security"]').innerText();
  step.check(/security/i.test(rail), `and the words change with it (${rail})`);
  await context.close();
  return '';
}

/** The first view: its words, the word that rolls, the tree, the button, and the story's digits. */
async function firstView(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const first = await page.evaluate(() => document.querySelector('.j-hero h1').innerText.replace(/\s+/g, ' '));
  step.check(/^VAN CODE NAAR/i.test(first), `the heading reads (${first})`);
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.j-swap span')].findIndex((s) => { const r = s.getBoundingClientRect(), box = s.parentElement.getBoundingClientRect(); return Math.abs(r.top - box.top) < 2; }));
  const a = await shown();
  await page.waitForTimeout(2600);
  const b = await shown();
  step.check(a !== b, `the word rolls every 2.4 s (${a} to ${b})`);
  await page.waitForTimeout(2000);
  const shot = await page.screenshot({ type: 'jpeg', quality: 90 });
  mkdirSync(join(OUT, 'stills'), { recursive: true });
  writeFileSync(join(OUT, 'stills', 'first-view.jpg'), shot);
  const gold = await sharp(shot).extract({ left: Math.round(VIEW.width * 0.6), top: 0, width: Math.round(VIEW.width * 0.4), height: Math.round(VIEW.height * 0.25) }).stats();
  step.check(gold.channels[0].max > 200, 'the tree has grown, with its gold traces');
  await goToFrame(page, 40);
  await page.waitForTimeout(200);
  const story = await page.evaluate((age) => {
    const reel = document.querySelectorAll('.j-digit');
    const read = (r) => [...r.children].find((s) => { const c = s.getBoundingClientRect(), box = r.getBoundingClientRect(); return Math.abs(c.top - box.top) < 3; })?.textContent;
    return { digits: `${read(reel[0])}${read(reel[1])}`, place: document.getElementById('j-place').textContent, age };
  }, null);
  step.check(story.digits === String(profileAge()), `the digits end on the real age (${story.digits})`);
  step.check(story.place === 'Rotterdam', `the place ends on Rotterdam (${story.place})`);
  await goToFrame(page, 0);
  await page.locator('.j-go').click();
  await page.waitForFunction(() => Math.abs(window.__journeyDebug.frame() - 392) < 1, null, { timeout: 15_000 });
  step.check(true, 'the button goes to the flight');
  await context.close();
  return '';
}

/** Each sheet at its reading frame: its word, its facts, and its title block, with the machine in front. */
async function sheets(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  for (const [n, f] of [[0, 72], [1, 124], [2, 188], [3, 250]]) {
    await goToFrame(page, f);
    writeFileSync(join(dir, `sheet-${n}.jpg`), await page.screenshot({ type: 'jpeg', quality: 90 }));
    const seen = await page.evaluate((n) => {
      const el = document.getElementById(`j-sheet-${n}`), box = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { visible: style.visibility, top: box.top, word: el.querySelector('h2').innerText, facts: el.querySelectorAll('dt').length, block: el.querySelector('.j-block').innerText };
    }, n);
    step.check(seen.visible === 'visible' && Math.abs(seen.top + VIEW.height * 0.03) < 3, `sheet ${n + 1} lies flat over the page at frame ${f} (top ${seen.top.toFixed(0)})`);
    step.check(seen.facts >= 2, `with its facts (${seen.facts})`);
    step.check(new RegExp(`${n + 1} van 4`).test(seen.block), `and says which it is (${seen.block.replace(/\s+/g, ' ')})`);
  }
  await context.close();
  return '';
}

/** How much of a word the machine covers: the pixels the canvas changes inside the word's box. */
async function coveredShare(page, word) {
  const box = await page.evaluate((word) => {
    const span = [...document.querySelectorAll('.j-sheet h2 span')].find((s) => s.textContent === word && s.closest('.j-sheet').style.visibility === 'visible');
    const range = document.createRange();
    range.selectNodeContents(span);
    const r = range.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  }, word);
  const shot = async () => sharp(await page.screenshot({ type: 'png', clip: { x: box.left, y: box.top, width: Math.min(box.width, page.viewportSize().width - box.left), height: box.height } })).raw().toBuffer({ resolveWithObject: true });
  const on = await shot();
  await page.evaluate(() => { document.querySelector('.journey-canvas').style.visibility = 'hidden'; });
  await page.waitForTimeout(120);
  const off = await shot();
  await page.evaluate(() => { document.querySelector('.journey-canvas').style.visibility = ''; });
  let changed = 0;
  for (let i = 0; i < on.data.length; i += on.info.channels) if (Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i + 1] - off.data[i + 1]) + Math.abs(on.data[i + 2] - off.data[i + 2]) > 24) changed++;
  return changed / (on.data.length / on.info.channels);
}

/** The long word on the last sheet reads, on the two common sizes. */
async function engineeringReadable(browser, step) {
  for (const viewport of [{ width: 1440, height: 810 }, { width: 1920, height: 1080 }]) {
    const { context, page } = await openJourney(browser, step, viewport);
    await goToFrame(page, 250);
    const share = await coveredShare(page, 'Engineering');
    step.check(share <= 0.3, `at ${viewport.width} the machine covers at most 30% of the word (${(share * 100).toFixed(0)}%)`);
    await context.close();
  }
  return '';
}

/** The stack: each label stands where its part is, and says what it is. */
async function stackStep(browser, step) {
  const { context, page } = await openJourney(browser, step);
  await goToFrame(page, 304);
  mkdirSync(join(OUT, 'stills'), { recursive: true });
  writeFileSync(join(OUT, 'stills', 'stack.jpg'), await page.screenshot({ type: 'jpeg', quality: 90 }));
  const seen = await page.evaluate(() => {
    const anchors = window.__journeyDebug.anchors();
    return [...document.querySelectorAll('[data-tag]')].map((tag) => ({ name: tag.dataset.tag, text: tag.innerText.replace(/\s+/g, ' '), left: parseFloat(tag.style.left), top: parseFloat(tag.style.top), anchor: anchors[tag.dataset.tag], visible: getComputedStyle(tag).visibility }));
  });
  for (const tag of seen) {
    const dx = Math.abs(tag.left - tag.anchor[0]), dy = Math.abs(tag.top - tag.anchor[1]);
    step.check(tag.visible === 'visible', `${tag.name} shows (${tag.text})`);
    const off = tag.name === 'controls' || tag.name === 'brain';
    if (off) step.check(dx < 12 && dy < 12, `${tag.name} is within 12 px of its part (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
  }
  const words = await page.locator('#j-stack').innerText();
  step.check(/machine/i.test(words), 'the words say one machine');
  await context.close();
  return '';
}

/** The iris opens onto the tunnel, with no cut on the way through. */
async function portal(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  await goToFrame(page, 332);
  for (const f of [340, 345, 352, 360, 366]) {
    await goToFrame(page, f, 120);
    writeFileSync(join(dir, `portal-${f}.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  }
  // The tunnel really shows through the opening: light on a dark ground, not one flat colour.
  await goToFrame(page, 360, 120);
  await page.waitForTimeout(500);
  const open = await sharp(await page.screenshot({ type: 'png' })).extract({ left: 570, top: 255, width: 300, height: 300 }).stats();
  step.check(open.channels[0].stdev > 4 && open.channels[0].max > 60, `frame 360: the tunnel's light shows through the iris (spread ${open.channels[0].stdev.toFixed(1)}, brightest ${open.channels[0].max})`);
  // And round the machine the canvas holds nothing, so that what is behind it can show.
  await goToFrame(page, 345, 120);
  await page.evaluate(() => document.documentElement.style.setProperty('background', '#00ff00', 'important'));
  await page.evaluate(() => document.body.style.setProperty('background', '#00ff00', 'important'));
  await page.waitForTimeout(300);
  const round = await sharp(await page.screenshot({ type: 'png' })).extract({ left: 20, top: 200, width: 60, height: 400 }).stats();
  step.check(round.channels[1].mean > 100, `frame 345: the canvas is clear round the machine (green behind it reads ${round.channels[1].mean.toFixed(0)})`);
  await page.evaluate(() => document.documentElement.style.removeProperty('background'));
  await page.evaluate(() => document.body.style.removeProperty('background'));
  await goToFrame(page, 362, 120);
  // Where the canvas changes from the machine to the tunnel alone, the picture must not jump.
  let previous = null;
  let previousPicture = null;
  let worst = 0;
  const changes = [];
  for (let f = 367; f <= 377; f += 1) {
    await goToFrame(page, f, 120);
    const shot = await page.screenshot({ type: 'jpeg', quality: 88 });
    if (f === 372) writeFileSync(join(dir, 'portal-372.jpg'), shot);
    const { channels } = await sharp(shot).stats();
    const bright = channels.reduce((sum, c) => sum + c.mean, 0) / 3;
    if (previous !== null) worst = Math.max(worst, Math.abs(bright - previous));
    previous = bright;
    const picture = await sharp(shot).greyscale().resize(320, 180).raw().toBuffer();
    if (previousPicture) {
      let sum = 0;
      for (let i = 0; i < picture.length; i++) sum += Math.abs(picture[i] - previousPicture[i]);
      changes.push({ f, by: sum / picture.length });
    }
    previousPicture = picture;
  }
  step.check(worst < 12, `no cut: around the hand-over at frame 372 the page's brightness changes by under 12 of 255 a frame (the most ${worst.toFixed(1)})`);
  // And the picture itself: the frame that changes over moves no more than the frames either side of it.
  const sorted = changes.map((c) => c.by).sort((a, b) => a - b);
  const usual = sorted[Math.floor(sorted.length / 2)];
  const over = Math.max(...changes.filter((c) => c.f === 372 || c.f === 373).map((c) => c.by));
  step.check(over < usual * 1.6 + 0.5, `no cut: at the hand-over the picture changes by ${over.toFixed(1)}, the usual frame by ${usual.toFixed(1)}`);
  await context.close();
  return `the most ${worst.toFixed(1)}`;
}

/** The flight: its stills, its light drawing, its streaks and lens growing with speed, and settling when you stop. */
async function flight(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  await goToFrame(page, 372);
  const read = () => page.evaluate(() => window.__journeyDebug.flight());
  for (const f of [370, 420, 470, 520, 560]) {
    await goToFrame(page, f, 160);
    await page.waitForTimeout(900);
    const shot = await page.screenshot({ type: 'jpeg', quality: 88 });
    writeFileSync(join(dir, `flight-${f}.jpg`), shot);
    const { channels } = await sharp(shot).stats();
    const bright = channels[0].mean;
    const most = channels[0].max;
    step.check(most > 90, `frame ${f}: the tunnel's light draws (the brightest red ${most})`);
    step.check(bright < 70, `frame ${f}: and stays dark around it (the mean red ${bright.toFixed(1)})`);
  }
  // Stopped, the lens is at rest. At speed it widens, and the streaks with it.
  await goToFrame(page, 420, 160);
  await page.waitForTimeout(1200);
  const still = await read();
  step.check(still.speed < 0.02, `stopped, the flight has settled (speed ${still.speed.toFixed(3)})`);
  step.check(Math.abs(still.fov - 54) < 0.3, `stopped, the lens is at its 54 degrees (${still.fov.toFixed(1)})`);
  // A long, hard scroll, read in the middle of it.
  let fast = still;
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(16);
    const now = await read();
    if (now.speed > fast.speed) fast = now;
  }
  step.check(fast.speed > 0.4, `scrolled hard, it speeds up (speed ${fast.speed.toFixed(2)})`);
  step.check(fast.fov > still.fov + 2, `and the lens widens (${fast.fov.toFixed(1)} degrees)`);
  const hard = await page.screenshot({ type: 'jpeg', quality: 88 });
  writeFileSync(join(dir, 'flight-fast.jpg'), hard);
  await page.waitForTimeout(1400);
  const after = await read();
  step.check(after.speed < 0.02, `then it settles again (speed ${after.speed.toFixed(3)})`);
  // The light runs on while you read.
  const a = await page.screenshot({ type: 'png' });
  await page.waitForTimeout(500);
  const b = await page.screenshot({ type: 'png' });
  step.check(!a.equals(b), 'stopped, the light on the wires runs on');

  await context.close();
  return `lens ${still.fov.toFixed(1)} to ${fast.fov.toFixed(1)}`;
}

/** Each project: the one bright thing at its reading place, in its own words in both languages, with its pieces and its link. */
async function projectsStep(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/journey/' });
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  await page.waitForFunction(() => window.__journeyDebug.stops()?.stops.length === 4, null, { timeout: 30_000 });
  const report = await page.evaluate(() => window.__journeyDebug.stops());
  step.check(report.walls === 16, `four screens on the walls for each project (${report.walls})`);
  const byId = Object.fromEntries(report.stops.map((s) => [s.id, s]));
  step.check(byId['cookies-clicker'].pieces === 1, 'the cookie floats in front of Cookies Clicker');
  step.check(byId['jontai-energy'].pieces === 1, 'the sun glows behind Jontai Energy');
  step.check(byId.steady.screens === 3, 'Steady stands as three phones');
  step.check(byId.portle.pieces === 1, 'the ring floats off Portle');

  const reads = timeline.reads.slice(0, 4);
  const dated = projects.byDate();
  await goToFrame(page, 372);
  for (let i = 0; i < dated.length; i++) {
    const project = dated[i];
    const words = (await page.evaluate(() => window.__journeyDebug.stops())).stops[i].words;
    const copy = project.copy('en');
    step.check(words.includes(copy.flightKind) && words.join(' ').includes(copy.flightLine), `${project.id}: the English kind and line are what is drawn`);
    await goToFrame(page, reads[i], 160);
    await page.waitForTimeout(1000);
    writeFileSync(join(dir, `project-${reads[i]}.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
    const flight = await page.evaluate(() => window.__journeyDebug.flight());
    step.check(flight.project === project.id, `frame ${reads[i]}: at ${project.id} (${flight.project})`);
    step.check(flight.calm > 0.9, `frame ${reads[i]}: the tunnel has quietened for it (${flight.calm.toFixed(2)})`);
    const link = page.locator(`.j-project[data-project="${project.id}"] .j-open`);
    const shown = await link.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { on: el.classList.contains('on'), inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight, text: el.textContent };
    });
    step.check(shown.on && shown.inside, `frame ${reads[i]}: its link "${shown.text}" shows on the page`);
    // The cursor over its screen says so; away from it, not.
    const hot = () => page.evaluate(() => document.documentElement.hasAttribute('data-project-hot'));
    await page.mouse.move(flight.screen[0], flight.screen[1]);
    await page.waitForTimeout(250);
    step.check(await hot(), `frame ${reads[i]}: the screen knows the pointer is on it`);
    await page.mouse.move(4, 400);
    await page.waitForTimeout(250);
    step.check(!(await hot()), `frame ${reads[i]}: and when it has left`);
  }
  // The other language, with the world still standing.
  await page.locator('header a[hreflang]').click();
  await page.waitForFunction(() => document.documentElement.lang === 'nl', null, { timeout: 8_000 });
  await page.waitForTimeout(800);
  const dutch = (await page.evaluate(() => window.__journeyDebug.stops())).stops;
  dated.forEach((project, i) => {
    const copy = project.copy('nl');
    step.check(dutch[i].words.includes(copy.flightKind) && dutch[i].words.join(' ').includes(copy.flightLine), `${project.id}: the Dutch kind and line are what is drawn`);
  });
  writeFileSync(join(dir, 'project-nl.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  await context.close();
  return '';
}

const doorShown = (page) => page.waitForFunction(() => document.querySelector('.j-door-on'), null, { timeout: 40_000 });
const inkGone = (page) => page.waitForFunction(() => !document.getElementById('j-ld'), null, { timeout: 15_000 });

/** The ink on a new tab: the two characters, the door, the characters on their way, and silence. */
async function loader(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  await page.waitForFunction(() => document.getElementById('j-ld'), null, { timeout: 10_000 });
  await page.waitForTimeout(2400);
  writeFileSync(join(dir, 'ink-writing.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  step.check(!(await page.evaluate(() => document.querySelector('.j-door-on'))), 'no door before the ink has spread');
  await doorShown(page);
  writeFileSync(join(dir, 'ink-door.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  const ready = await page.evaluate(() => window.__journeyDebug.ready());
  step.check(ready, 'the door shows once the machine is ready');
  step.check((await page.evaluate(() => document.activeElement?.className)) === 'j-door-go', 'the keyboard starts on the door');
  step.check((await page.evaluate(() => document.documentElement.scrollHeight > innerHeight && getComputedStyle(document.documentElement).overflow === 'hidden')), 'the page holds still behind the door');
  await page.locator('.j-door-without').click();
  await page.waitForTimeout(900);
  writeFileSync(join(dir, 'ink-landing.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  await inkGone(page);
  await page.waitForTimeout(400);
  writeFileSync(join(dir, 'ink-landed.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  const hero = await page.evaluate(() => ({ opacity: getComputedStyle(document.querySelector('.j-hero')).opacity, seen: sessionStorage.getItem('journey-seen') }));
  step.check(hero.opacity === '1' && hero.seen === '1', `the first view stands, and the tab remembers (${JSON.stringify(hero)})`);
  await context.close();
  return '';
}

/** A reload and a second visit in the same tab are quick. */
async function loaderQuick(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  await doorShown(page);
  await page.locator('.j-door-without').click();
  await inkGone(page);
  const started = Date.now();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('j-ld') && window.__journeyDebug?.ready(), null, { timeout: 15_000 });
  const took = Date.now() - started;
  step.check(took < 4000, `a reload is quick (${took} ms)`);
  step.check(!(await page.evaluate(() => document.querySelector('.j-door'))), 'with no door');
  await context.close();
  return `${took} ms`;
}

/** A new tab plays it in full again. */
async function loaderNewTab(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  await doorShown(page);
  await page.locator('.j-door-without').click();
  await inkGone(page);
  const second = await context.newPage();
  await second.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  await doorShown(second);
  step.check(true, 'a new tab has the ink and the door again');
  await context.close();
  return '';
}

/** Enter goes in, with sound; scrolling goes in, without. */
async function loaderDoorKeys(browser, step) {
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
    await doorShown(page);
    await page.keyboard.press('Enter');
    await inkGone(page);
    step.check(true, 'Enter goes in');
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, step);
    await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
    await doorShown(page);
    await page.mouse.move(700, 300);
    await page.mouse.wheel(0, 120);
    await inkGone(page);
    step.check(true, 'scrolling goes in, so nobody is stuck at the door');
    await context.close();
  }
  return '';
}

/** Reduced motion: no ink. */
async function loaderReduced(browser, step) {
  const { context, page } = await openPage(browser, step, VIEW, { reducedMotion: 'reduce' });
  await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__journeyDebug, null, { timeout: 15_000 });
  await page.waitForTimeout(300);
  step.check(!(await page.evaluate(() => document.getElementById('j-ld'))), 'there is no ink');
  await context.close();
  return '';
}

/** A load that stalls: the door shows anyway, in time. */
async function giveUp(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.route('**/models/machine.glb', () => {});
  await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'domcontentloaded' });
  const started = Date.now();
  await doorShown(page);
  const took = Date.now() - started;
  step.check(took < 16_000, `the door shows though the machine never came (${took} ms)`);
  await page.locator('.j-door-without').click();
  await inkGone(page);
  step.check(await page.evaluate(() => getComputedStyle(document.querySelector('.j-hero')).opacity === '1'), 'and the words are there');
  step.errors.length = 0;
  await context.close();
  return `${took} ms`;
}

/** The sounds, walking the whole journey at a person's pace: every part once, nothing distorted, and the switch. */
async function soundStep(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
  await doorShown(page);
  const before = await page.evaluate(() => window.__journeyDebug.sound());
  step.check(before.context === 'none', `no sound at all before the door (${before.context})`);
  await page.locator('.j-door-go').click();
  await inkGone(page);
  const entered = await page.evaluate(() => window.__journeyDebug.sound());
  step.check(entered.on && entered.running, 'going in with sound starts it');
  const label = await page.locator('.j-sound').innerText();
  step.check(/aan|on/i.test(label), `the header says so (${label})`);
  await page.mouse.move(700, 300);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const target = scrollFromFrame(timeline.last, max, timeline);
  let peak = 0;
  for (let y = 0; y < target; y += 130) {
    await page.mouse.wheel(0, 130);
    await page.waitForTimeout(90);
    peak = Math.max(peak, await page.evaluate(() => window.__journeyDebug.sound().level));
  }
  await page.waitForTimeout(800);
  const { counts } = await page.evaluate(() => window.__journeyDebug.sound());
  const missing = HIT_NAMES.filter((name) => counts[name] !== 1);
  step.check(missing.length === 0, `every part of the machine played once (not: ${missing.map((n) => `${n}=${counts[n] ?? 0}`).join(', ') || 'none'})`);
  step.check(peak <= 0.6, `nothing distorts (the loudest ${peak.toFixed(3)})`);
  step.check(counts.fall === 1 && counts.bang === 1, 'the way into the end plays once');
  await page.locator('.j-sound').click();
  await page.waitForTimeout(1200);
  const off = await page.evaluate(() => window.__journeyDebug.sound());
  step.check(!off.on && off.level < 0.002, `the switch silences it (${off.level.toFixed(4)})`);
  await page.locator('.j-sound').click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 30_000 });
  const reloaded = await page.evaluate(() => window.__journeyDebug.sound());
  step.check(reloaded.context === 'none', 'after a reload it stays silent until the next click or key');
  await page.keyboard.press('Shift');
  await page.waitForTimeout(600);
  const back = await page.evaluate(() => window.__journeyDebug.sound());
  step.check(back.on && back.running, 'and comes back with that key');
  await context.close();
  return `the loudest ${peak.toFixed(3)}`;
}

/** The Lock cursor on a mouse: the corners close around a link, and take no click. */
async function cursorStep(browser, step) {
  const { context, page } = await openJourney(browser, step);
  step.check(await page.evaluate(() => document.documentElement.classList.contains('has-lock-cursor')), 'it is on, on a mouse');
  await page.mouse.move(300, 680);
  await page.waitForTimeout(500);
  const rest = await page.evaluate(() => window.__lockCursor.corners());
  const width = rest[1][0] - rest[0][0];
  step.check(Math.abs(width - 26) < 2, `at rest the corners stand about 26 px apart (${width.toFixed(1)})`);
  mkdirSync(join(OUT, 'stills'), { recursive: true });
  const box = await page.locator('.j-go').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.waitForTimeout(450);
  writeFileSync(join(OUT, 'stills', 'cursor-hover.jpg'), await page.screenshot({ type: 'jpeg', quality: 90 }));
  const around = await page.evaluate(() => window.__lockCursor.corners());
  const goal = [box.x - 9, box.y - 7];
  step.check(Math.abs(around[0][0] - goal[0]) < 3 && Math.abs(around[0][1] - goal[1]) < 3, `within 450 ms the corners close around the button (${around[0].map((v) => v.toFixed(0))} against ${goal.map((v) => v.toFixed(0))})`);
  step.check((await page.evaluate(() => getComputedStyle(document.querySelector('.lock-cursor')).pointerEvents)) === 'none', 'it takes no click');
  await page.mouse.down();
  await page.waitForTimeout(120);
  const pressed = await page.evaluate(() => window.__lockCursor.corners());
  step.check(pressed[0][0] > around[0][0] + 2, 'pressed, the corners pinch in');
  await page.mouse.move(300, 680);
  await page.mouse.up();
  await context.close();
  return '';
}

/** No custom cursor on touch, or with reduced motion. */
async function noCursor(browser, step) {
  {
    const { context, page } = await openPage(browser, step, { width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    await page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
    await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    step.check(!(await page.evaluate(() => document.documentElement.classList.contains('has-lock-cursor'))), 'none on a touch screen');
    await context.close();
  }
  {
    const { context, page } = await openPage(browser, step, VIEW, { reducedMotion: 'reduce' });
    await page.goto(`${BASE}${ROUTE}?proof`, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    step.check(!(await page.evaluate(() => document.documentElement.classList.contains('has-lock-cursor'))), 'none with reduced motion');
    await context.close();
  }
  return '';
}

/** A field keeps its text cursor. */
async function cursorForm(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.goto(`${BASE}/en/contact/`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const seen = await page.evaluate(() => ({ on: document.documentElement.classList.contains('has-lock-cursor'), input: getComputedStyle(document.querySelector('input[type=email], input[type=text], textarea')).cursor, body: getComputedStyle(document.body).cursor }));
  step.check(seen.on && seen.body === 'none', `the cursor runs here too (${seen.body})`);
  step.check(seen.input === 'text', `a field keeps its text cursor (${seen.input})`);
  await context.close();
  return '';
}

const STEPS = { flight, projects: projectsStep, stills, smooth, cursor: cursorStep, 'no-cursor': noCursor, 'cursor-form': cursorForm, sound: soundStep, loader, 'loader-quick': loaderQuick, 'loader-new-tab': loaderNewTab, 'loader-door-keys': loaderDoorKeys, 'loader-reduced': loaderReduced, 'give-up': giveUp, 'first-view': firstView, sheets, 'engineering-readable': engineeringReadable, stack: stackStep, portal, jumps, hash, 'reload-mid': reloadMid, 'resize-keeps-place': resizeKeepsPlace, 'lang-keeps-place': langKeepsPlace };

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
