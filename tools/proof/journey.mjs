/**
 * The proof harness of the journey (spec 2026-11-05-bob-machine-rebuild-design.md, section 11). It drives a real Edge through
 * the built site, served the way GitHub Pages serves it, with real wheel input. One PASS or FAIL line per step, results.json
 * and the stills in a folder, exit 1 if a step failed. Every step also fails on a console error, a page error or a CSP
 * violation.
 *
 *   PUBLIC_WEB3FORMS_KEY=local-proof-placeholder npm run build
 *   STEPS=stills,smooth node tools/proof/journey.mjs
 *
 * Environment:
 *   BASE             site to test; by default the harness serves dist/client itself
 *   ROUTE            the journey's address, default /
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
const { scrollFromFrame } = await tsImport('../../src/journey/timeline.ts', import.meta.url);
const { projects } = await tsImport('../../src/data/projects.ts', import.meta.url);
const { flightLayout, timelineFor } = await tsImport('../../src/journey/flight/layout.ts', import.meta.url);
const { profile } = await tsImport('../../src/data/profile.ts', import.meta.url);
const profileAge = () => profile.ageOn();
const { HITS } = await tsImport('../../src/journey/sound/score.ts', import.meta.url);
const { headFrame, SPIT_T, FINALE_S } = await tsImport('../../src/journey/head/time.ts', import.meta.url);
const { dwellT } = await tsImport('../../src/journey/head/thoughts.ts', import.meta.url);
const { en } = await tsImport('../../src/i18n/en.ts', import.meta.url);
const { nl } = await tsImport('../../src/i18n/nl.ts', import.meta.url);
const HIT_NAMES = HITS.map(([, name]) => name);

const ROUTE = process.env.ROUTE ?? '/';
const OUT = resolve(process.env.PROOF_DIR ?? './proof-out');
const WEAK = process.env.GPU === 'weak';
const ARGS = ['--use-angle=d3d11', '--enable-gpu', ...(WEAK ? ['--force_low_power_gpu'] : [])];
const VIEW = WEAK ? { width: 1920, height: 1080 } : { width: 1440, height: 810 };
const timeline = timelineFor(flightLayout(projects.byDate()));
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
async function openJourney(browser, step, viewport, { route = ROUTE, stages = '&stages=all', ...options } = {}) {
  const opened = await openPage(browser, step, viewport, options);
  await opened.page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
  await opened.page.goto(`${BASE}${route}?proof${stages}`, { waitUntil: 'load' });
  await opened.page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  await opened.page.mouse.move(viewport?.width ? viewport.width / 2 : VIEW.width / 2, 300);
  return opened;
}

/** Scrolls to frame `f` by wheel, as a person does, and waits for the shown frame to get there. */
async function goToFrame(page, f, stepPx = 300, gap = 16) {
  // The site's own mapping, which takes the questions slower (timeline.ts, QA_PACE): never a copy of it here.
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const target = scrollFromFrame(f, max, timeline);
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
  // As a visitor loads it: each stage as it comes near.
  const { context, page } = await openJourney(browser, step, undefined, { stages: '' });
  if (WEAK) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__tasks = [];
    new PerformanceObserver((list) => window.__tasks.push(...list.getEntries().map((e) => ({ ms: e.duration, frame: window.__journeyDebug.frame() })))).observe({ type: 'longtask', buffered: false });
  });
  // Every shader the machine needs is built before the journey shows, wherever the first view's camera stands.
  await page.evaluate(() => {
    window.__links = [];
    const link = WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram = function (program) {
      window.__links.push(window.__journeyDebug.frame());
      return link.call(this, program);
    };
  });
  // Reading the first view: the light runs along the traces on its own, so it draws every frame while nothing scrolls.
  const reading = (await page.evaluate(() => window.__journeyDebug.frameTimes())).length;
  await page.waitForTimeout(2500);
  const read = (await page.evaluate(() => window.__journeyDebug.frameTimes())).slice(reading).sort((a, b) => a - b);
  const readMedian = read[Math.floor(read.length / 2)] ?? 0;
  step.check(read.length > 60, `reading the first view for 2.5 s, the page keeps its pace (${read.length} frames, median ${readMedian.toFixed(1)} ms)`);
  if (WEAK) step.check(readMedian < 33, `on the weak GPU the first view's median frame is under 33 ms (${readMedian.toFixed(1)})`);
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
  step.check(walk.length > 100, `the walk drew frames all the way (${walk.length}: median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, worst ${worst.toFixed(1)} ms)`);
  // The flight's own stage loads from frame 260 and builds its shaders then, by design; before that, none.
  const midway = (await page.evaluate(() => window.__links)).filter((f) => f < 255);
  step.check(midway.length === 0, `no shader is built in the middle of the machine (${midway.length ? `at frames ${midway.map((f) => f.toFixed(0)).join(', ')}` : 'none'})`);
  const longest = tasks.reduce((a, b) => (b.ms > a.ms ? b : a), { ms: 0, frame: 0 });
  step.check(longest.ms < 200, `no main-thread task over 200 ms (the longest ${longest.ms.toFixed(0)}, near frame ${longest.frame.toFixed(0)})`);
  if (WEAK) {
    step.check(median < 33, `on the weak GPU the median frame is under 33 ms (${median.toFixed(1)})`);
    step.check(worst < 100, `and no frame is over 100 ms (the worst ${worst.toFixed(1)})`);
  }
  const ladder = await page.evaluate(() => ({ step: window.__journeyDebug.quality(), dpr: window.__journeyDebug.dpr() }));
  step.check(true, `the ladder stands at step ${ladder.step}, pixel ratio ${ladder.dpr}`);
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
  await page.waitForURL(/\/en\/(\?|#|$)/, { timeout: 10_000 });
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
/** The rolling word stands on the same line as the word before it, with its tail whole. */
async function rollingWordSits(page, step) {
  const seen = await page.evaluate(() => {
    const line = document.querySelector('.j-hero .j-to');
    const box = line.querySelector('.j-swap');
    const word = box.children[0];
    const ruler = document.createElement('canvas').getContext('2d');
    const baseline = (node, element) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      ruler.font = getComputedStyle(element).font;
      return range.getBoundingClientRect().top + ruler.measureText('x').fontBoundingBoxAscent;
    };
    const first = baseline(line.firstChild, line);
    // Measured at rest: it may have rolled away by now.
    const { transform, transition } = word.style;
    word.style.transition = "none";
    word.style.transform = "none";
    const rolling = baseline(word, word);
    word.style.transform = transform;
    void word.offsetWidth;
    word.style.transition = transition;
    ruler.font = getComputedStyle(word).font;
    return { first, rolling, tail: rolling + ruler.measureText('g').actualBoundingBoxDescent, bottom: box.getBoundingClientRect().bottom };
  });
  step.check(Math.abs(seen.first - seen.rolling) < 2, `the rolling word sits on the line of the word before it (${seen.first.toFixed(1)} and ${seen.rolling.toFixed(1)})`);
  step.check(seen.tail <= seen.bottom + 0.5, `and the tail of its g is whole (${seen.tail.toFixed(1)} inside ${seen.bottom.toFixed(1)})`);
}

async function rollingWordsStayAway(page, step) {
  const seen = await page.evaluate(() => new Promise((done) => {
    const box = document.querySelector('.j-swap');
    const started = performance.now();
    let frames = 0, shown = 0, rolls = 0, last = box.children[0];
    const tick = () => {
      frames++;
      const view = box.getBoundingClientRect();
      for (const word of box.children) {
        if (word.style.transform === 'none' && word !== last) {
          last = word;
          rolls++;
        }
        if (word.style.transform === 'translateY(120%)' && word.getBoundingClientRect().top < view.bottom - 1) shown++;
      }
      if (performance.now() - started < 6500) requestAnimationFrame(tick);
      else done({ frames, shown, rolls });
    };
    tick();
  }));
  step.check(seen.rolls >= 2 && seen.shown === 0, `a word that has rolled away stays out of sight until its turn (${seen.shown} of ${seen.frames} frames show one, over ${seen.rolls} rolls)`);
}

async function firstView(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const order = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => { const style = getComputedStyle(h); return style.display !== 'none' && style.visibility !== 'hidden' && h.getClientRects().length > 0; }).map((h) => Number(h.tagName[1])));
  step.check(order[0] === 1 && order.every((level, i) => i === 0 || level - order[i - 1] <= 1), `the headings a screen reader finds go down one level at a time (${order.join(' ')})`);
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
  // The age rolls from 13 to its end by frame 42 (round 24's slower roll); the story stands to 46.
  await goToFrame(page, 44);
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
  await rollingWordSits(page, step);
  await rollingWordsStayAway(page, step);
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
  for (const [viewport, route, word] of [[{ width: 1440, height: 810 }, '/en/', 'Engineering'], [{ width: 1920, height: 1080 }, '/en/', 'Engineering'], [{ width: 1440, height: 810 }, '/', 'Mechatronica'], [{ width: 1920, height: 1080 }, '/', 'Mechatronica']]) {
    const { context, page } = await openJourney(browser, step, viewport, { route });
    await goToFrame(page, 250);
    const share = await coveredShare(page, word);
    step.check(share <= 0.3, `at ${viewport.width} the machine covers at most 30% of ${word} (${(share * 100).toFixed(0)}%)`);
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

/** The flight's parts come a frame at a time after the first view: all of them, with their words. */
const flightLoaded = (page, n) => page.waitForFunction((count) => {
  const report = window.__journeyDebug.stops();
  return report?.stops.length === count && report.walls === 4 * count && report.stops.every((stop) => stop.words.length > 0);
}, n, { timeout: 30_000 });

/** Each project: the one bright thing at its reading place, in its own words in both languages, with its pieces and its link. */
async function projectsStep(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  const dated = projects.byDate();
  await flightLoaded(page, dated.length);
  const report = await page.evaluate(() => window.__journeyDebug.stops());
  step.check(report.walls === 4 * dated.length, `four screens on the walls for each project (${report.walls})`);
  const byId = Object.fromEntries(report.stops.map((s) => [s.id, s]));
  step.check(byId['cookies-clicker'].pieces === 1, 'the cookie floats in front of Cookies Clicker');
  step.check(byId['jontai-energy'].pieces === 1, 'the sun glows behind Jontai Energy');
  step.check(!byId.steady && !byId.portle, 'no Steady or Portle stop, for now (Bob, 2026-11-07)');

  const reads = timeline.reads;
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

/** Less motion asked for: the same words and links on a page that simply scrolls. */
async function reducedMotion(browser, step) {
  const { context, page } = await openPage(browser, step, VIEW, { reducedMotion: 'reduce' });
  await page.goto(`${BASE}/en/`, { waitUntil: 'load' });
  await page.waitForSelector('.j-calm', { timeout: 15_000 });
  await page.waitForTimeout(500);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  const seen = await page.evaluate(() => ({ canvases: document.querySelectorAll('.journey-canvas, #j-paper').length, text: document.querySelector('.j-calm').innerText, tall: document.documentElement.scrollHeight > innerHeight * 2, links: document.querySelectorAll('.j-calm a').length, sound: getComputedStyle(document.querySelector('.j-sound') ?? document.body).display }));
  step.check(seen.canvases === 0, 'no flight, no head, no canvas');
  const header = await page.evaluate(() => getComputedStyle(document.querySelector('.site-header')).backgroundColor);
  // The site's night, dark purple since 2026-11-08 (Plan 1, tokens.css --night).
  step.check(header === 'rgb(19, 7, 36)', `the words scroll under a solid header (${header})`);
  step.check(seen.tall, 'it scrolls as a normal page');
  for (const words of ['Software Engineering', 'Cookies Clicker', 'Jontai Energy', 'What is your plan after MBO?', 'Prefrontal cortex', 'Scan complete', 'Chinese', "Let's talk."]) step.check(seen.text.toLowerCase().includes(words.toLowerCase()), `"${words}" reads there`);
  // Each project's, and the six of the rail, the contact and the header.
  // The report's three ways and the way back up: no Email since 2026-11-08 (Bob: "send a message is the same").
  step.check(seen.links >= 5 + projects.all().length, `its links are there (${seen.links})`);
  // Its pictures come as they are reached.
  const whole = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let at = 0; at < whole; at += 500) {
    await page.evaluate((top) => scrollTo({ top, behavior: 'auto' }), at);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(400);
  const pictures = await page.evaluate(() => [...document.querySelectorAll('.j-calm img')].map((img) => img.complete && img.naturalWidth > 0));
  // The machine's still, and at least one picture for each project.
  step.check(pictures.length >= 1 + projects.all().length && pictures.every(Boolean), `its stills are all there (${pictures.filter(Boolean).length} of ${pictures.length})`);
  writeFileSync(join(dir, 'calm.jpg'), await page.screenshot({ type: 'jpeg', quality: 86, fullPage: true }));
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'auto' }));
  const y = await page.evaluate(() => scrollY);
  await page.locator('header a[href="#contact"]').click();
  await page.waitForTimeout(400);
  step.check((await page.evaluate(() => scrollY)) > y, "the header's Contact goes to its place");
  await context.close();
  return '';
}

/** Without WebGL: never blank, and Lite one link away. */
async function noWebgl(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/i.test(kind) ? null : original.call(this, kind, ...rest);
    };
  });
  await page.goto(`${BASE}/en/`, { waitUntil: 'load' });
  await page.waitForSelector('.j-calm', { timeout: 15_000 });
  await page.waitForTimeout(400);
  const link = page.locator('.j-calm-note a');
  step.check((await link.getAttribute('href')) === '/en/lite/', 'Lite is one link away');
  step.check((await page.evaluate(() => document.querySelector('.j-calm').innerText)).toLowerCase().includes('software engineering'), 'and the words are there, never a blank page');
  await link.click();
  await page.waitForFunction(() => location.pathname === '/en/lite/', null, { timeout: 8_000 });
  await context.close();
  return '';
}

/** The GPU takes the drawing away in the middle of the flight: the words stay, Lite is one link away. */
async function contextLost(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  await flightLoaded(page, projects.byDate().length);
  await goToFrame(page, 372);
  await goToFrame(page, 450, 200);
  await page.evaluate(() => {
    const gl = document.querySelector('.journey-canvas canvas').getContext('webgl2');
    gl.getExtension('WEBGL_lose_context').loseContext();
  });
  await page.waitForSelector('.j-calm', { timeout: 10_000 });
  await page.waitForTimeout(300);
  step.check((await page.locator('.j-calm-note a').getAttribute('href')) === '/en/lite/', 'it ends on the fallback, with Lite one link away');
  step.check((await page.evaluate(() => document.querySelector('.j-calm').innerText)).includes('Jontai Energy'.toUpperCase()) || (await page.evaluate(() => document.querySelector('.j-calm').textContent)).includes('Jontai Energy'), 'and the words are reachable');
  // Losing it is the one error this step expects.
  step.errors.length = 0;
  await context.close();
  return '';
}

/** His head never comes: past the flight the page falls back as a failed 3D does, with Lite one link away (spec 10). */
async function headMissing(browser, step) {
  // As a visitor loads it: the head's stage is asked for as the flight nears its end.
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/', stages: '' });
  await page.route('**/models/head.bin', (route) => route.abort());
  await goToFrame(page, timeline.head[0] - 120);
  await flightLoaded(page, projects.byDate().length);
  // Into the last stretch of the flight, where the head's stage loads, and on past it.
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const past = scrollFromFrame(timeline.head[0] + 40, max, timeline);
  for (let y = await page.evaluate(() => scrollY); y < past; y += 300) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('.j-calm', { timeout: 20_000 });
  await page.waitForTimeout(300);
  step.check((await page.locator('.j-calm-note a').getAttribute('href')) === '/en/lite/', 'without his head it ends on the fallback, with Lite one link away');
  // The head that never came is the one error this step expects.
  step.errors.length = 0;
  await context.close();
  return '';
}

/** An answer showing, the language switched: the place holds, and the answer, the labels, the read-out and his poured words change with it. */
async function headLanguage(browser, step) {
  const { context, page } = await openJourney(browser, step);
  // The third answer, his hobbies, stands at its fullest here.
  const at = headFrame(0.5, timeline);
  await goToFrame(page, at);
  await page.waitForFunction(() => window.__journeyDebug.stops()?.head?.active === 2, null, { timeout: 30_000 });
  const before = await page.evaluate(() => document.querySelector('[data-answer="2"] h3').textContent);
  await page.locator('header a[hreflang]').click();
  await page.waitForURL(/\/en\/(\?|#|$)/, { timeout: 10_000 });
  await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  await page.waitForTimeout(400);
  const here = await page.evaluate(() => window.__journeyDebug?.frame());
  step.check(Math.abs(here - at) < 2, `it stays at the same place (${here?.toFixed(1)}, was ${at.toFixed(1)})`);
  const seen = await page.evaluate(() => ({
    card: document.querySelector('[data-answer="2"] h3').textContent,
    shown: Number(getComputedStyle(document.querySelector('[data-answer="2"]')).opacity),
    label: document.querySelector('.j-hud-label b').textContent,
    region: document.querySelector('.j-hud-region').textContent,
    poured: window.__journeyDebug.stops()?.head?.locale,
  }));
  const question = en.end.questions[2].question;
  step.check(seen.card === question && seen.card !== before && seen.shown > 0.9, `the answer showing is the English one (${seen.card}, opacity ${seen.shown})`);
  step.check(seen.label === en.journey.head.topics.plans, `the labels are English (${seen.label})`);
  step.check(seen.region === en.journey.head.regions.motor, `the read-out is English (${seen.region})`);
  step.check(seen.poured === 'en', `and the words that pour into his head are English (${seen.poured})`);
  await context.close();
  return '';
}

/** A window turned to a phone mid-answer, and mid-print: the answer keeps its place on the page, and the report prints by its new rows. */
async function headResize(browser, step) {
  const wide = { width: 1280, height: 800 }, tall = { width: 390, height: 844 };
  const { context, page } = await openJourney(browser, step, wide);
  // The third answer, at its stop.
  await goToFrame(page, headFrame(dwellT(2), timeline));
  await page.waitForFunction(() => window.__journeyDebug.stops()?.head?.active === 2, null, { timeout: 30_000 });
  await page.setViewportSize(tall);
  await page.waitForTimeout(800);
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-answer="2"]'), r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, opacity: Number(getComputedStyle(el).opacity), width: innerWidth, height: innerHeight };
  });
  step.check(card.opacity > 0.9, `the answer still shows (${card.opacity})`);
  step.check(card.left >= 0 && card.right <= card.width && card.top >= 0 && card.bottom <= card.height, `inside the page (${card.left.toFixed(0)}, ${card.top.toFixed(0)} to ${card.right.toFixed(0)}, ${card.bottom.toFixed(0)} in ${card.width} x ${card.height})`);
  step.check(Math.abs(card.left - 18) < 3, `at its anchor, the phone's 18 px column (${card.left.toFixed(1)})`);
  // Wide again, to the end; turned to a phone 0.3 s after the scan line starts printing.
  await page.setViewportSize(wide);
  await page.waitForTimeout(500);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.evaluate((top) => scrollTo({ top, behavior: 'auto' }), scrollFromFrame(headFrame(0.9, timeline), max, timeline));
  await page.waitForFunction(() => (window.__journeyDebug.stops()?.head?.t ?? 0) > 0.89, null, { timeout: 30_000 });
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' }));
  const printing = 0.962 + ((1 - SPIT_T) * 0.3) / FINALE_S;
  await page.waitForFunction((want) => (window.__journeyDebug.stops()?.head?.t ?? 0) >= want, printing, { timeout: 30_000, polling: 'raf' });
  await page.setViewportSize(tall);
  await page.waitForTimeout(250);
  const rows = await page.evaluate(() => {
    const panel = document.querySelector('.j-report-panel').getBoundingClientRect();
    const band = document.querySelector('.j-report-band');
    const y = new DOMMatrixReadOnly(getComputedStyle(band).transform).m42;
    const down = y / Math.max(1, panel.height - 2);
    return { down, rows: [...document.querySelectorAll('.j-report-row')].map((row) => ({ top: (row.getBoundingClientRect().top - panel.top) / panel.height, printed: getComputedStyle(row).clipPath !== 'inset(0px 100% 0px 0px)' })) };
  });
  const wrong = rows.rows.filter((row) => (row.top < rows.down - 0.02 && !row.printed) || (row.top > rows.down + 0.02 && row.printed));
  step.check(rows.down > 0 && rows.down < 1, `caught mid-print (the line ${(rows.down * 100).toFixed(0)} % down)`);
  step.check(wrong.length === 0, `the printed rows are those above the line, in the phone's layout (${rows.rows.filter((r) => r.printed).length} of ${rows.rows.length}; wrong: ${wrong.map((r) => r.top.toFixed(2)).join(', ') || 'none'})`);
  await context.close();
  return '';
}

/** His head reported, or null while it does not show. */
const headNow = (page) => page.evaluate(() => window.__journeyDebug.stops()?.head ?? null);

/** To `t` of his head by the scroll, with its stage come. */
async function toHead(page, t) {
  await jumpTo(page, headFrame(t, timeline));
  await page.waitForFunction(() => window.__journeyDebug.stops()?.head != null, null, { timeout: 60_000 });
  await page.waitForTimeout(450);
}

/** Behind his lips, then on to the end: from the spit the ending runs on its own clock. */
async function playEnding(page) {
  await toHead(page, 0.9);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' }));
}

/** The scan: the scanner's read-out counting, the lid lifting as things pour in, and six labels round the head. */
async function headScan(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  await toHead(page, 0.13);
  const scanning = await page.evaluate(() => ({ status: document.querySelector('.j-hud-status').textContent, readout: Number(getComputedStyle(document.querySelector('.j-hud-readout')).opacity) }));
  const at13 = await headNow(page);
  step.check(scanning.readout > 0.9 && /^Scanning \d+ %$/.test(scanning.status), `the read-out counts the scan (${scanning.status})`);
  step.check(at13.open > 0, `the lid is lifting by t 0.13 (${at13.open.toFixed(3)})`);
  writeFileSync(join(dir, 'head-scan.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
  await toHead(page, 0.2);
  step.check((await headNow(page)).open > 0.99, 'and open by t 0.2');
  // The sixth label arrives from t 0.245 to 0.253 (the mock's timing): all six stand from there to 0.27.
  await toHead(page, 0.26);
  const labels = await page.evaluate(() => [...document.querySelectorAll('.j-hud-label')].map((el) => { const r = el.getBoundingClientRect(); return { shown: Number(getComputedStyle(el).opacity), left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
  const shown = labels.filter((label) => label.shown > 0.9);
  step.check(shown.length === 6, `six labels show at t 0.26 (${shown.length})`);
  step.check(shown.every((b) => b.left >= 0 && b.right <= VIEW.width && b.top >= 0 && b.bottom <= VIEW.height), 'each on the page');
  const meet = shown.some((a, i) => shown.some((b, j) => j > i && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
  step.check(!meet, 'and none over another');
  writeFileSync(join(dir, 'head-labels.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
  await context.close();
  return '';
}

/** Each thought: its answer readable at its stop, on the page, on the shade, with the read-out naming it. */
async function headThoughts(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 6; i++) {
    await toHead(page, dwellT(i));
    const seen = await page.evaluate((n) => {
      const cards = [...document.querySelectorAll('.j-answer')], el = cards[n], r = el.getBoundingClientRect();
      return { shown: Number(getComputedStyle(el).opacity), others: Math.max(...cards.filter((_, k) => k !== n).map((c) => Number(getComputedStyle(c).opacity))), shade: Number(getComputedStyle(document.querySelector('.j-hud-shade')).opacity), status: document.querySelector('.j-hud-status').textContent, box: [r.left, r.top, r.right, r.bottom] };
    }, i);
    const head = await headNow(page);
    const [l, t, r, b] = seen.box;
    step.check(seen.shown > 0.9 && seen.others < 0.05, `answer ${i + 1} reads at its stop, alone (${seen.shown.toFixed(2)}; others ${seen.others.toFixed(2)})`);
    step.check(l >= 0 && t >= 0 && r <= VIEW.width && b <= VIEW.height, `answer ${i + 1} stays on the page (${[l, t, r, b].map((v) => v.toFixed(0)).join(', ')})`);
    step.check(seen.shade > 0.9, `answer ${i + 1} stands on the shade (${seen.shade.toFixed(2)})`);
    step.check(seen.status === `Thought 0${i + 1} / 06` && head.active === i, `the read-out names thought ${i + 1} (${seen.status})`);
    writeFileSync(join(dir, `head-answer-${i + 1}.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
  }
  await context.close();
  return '';
}

/** The spit: the pressure read out behind his lips, then one spark, landing on the top middle of the scan report. */
async function headSpit(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  await toHead(page, 0.92);
  const held = await page.evaluate(() => document.querySelector('.j-hud-status').textContent);
  const pressing = await headNow(page);
  step.check(held === 'Holding it in' && pressing.pressure > 0.5, `behind his lips, the read-out says so and the pressure builds (${held}, ${pressing.pressure.toFixed(2)})`);
  await playEnding(page);
  await page.waitForFunction(() => (window.__journeyDebug.stops()?.head?.t ?? 0) >= 0.952, null, { timeout: 20_000, polling: 'raf' });
  const landed = await page.evaluate(() => {
    const panel = document.querySelector('.j-report-panel').getBoundingClientRect(), head = window.__journeyDebug.stops().head;
    return { spark: head.spark, top: [panel.left + panel.width / 2, panel.top] };
  });
  const miss = Math.hypot(landed.spark[0] - landed.top[0], landed.spark[1] - landed.top[1]);
  step.check(miss < 8, `the spark lands on the report's top middle (${miss.toFixed(1)} px off)`);
  await page.waitForFunction(() => (window.__journeyDebug.stops()?.head?.t ?? 0) >= 0.959, null, { timeout: 20_000, polling: 'raf' });
  const flash = await page.evaluate(() => Number(document.getElementById('j-flash').style.opacity || 0));
  step.check(flash <= 0.221, `its flash is faint (${flash.toFixed(3)}, at most 0.22)`);
  await context.close();
  return '';
}

/** The ending's own clock: the report finished 4.8 s after the spit, rewound by scrolling up, and finished on arrival at #contact. */
async function endClockStep(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  await playEnding(page);
  await page.waitForFunction((spit) => (window.__journeyDebug.stops()?.head?.t ?? 0) >= spit, SPIT_T, { timeout: 20_000, polling: 'raf' });
  const spat = Date.now();
  await page.waitForFunction(() => (window.__journeyDebug.stops()?.head?.t ?? 0) >= 0.999, null, { timeout: 20_000, polling: 'raf' });
  const took = (Date.now() - spat) / 1000;
  step.check(Math.abs(took - FINALE_S) < 0.5, `the report is finished ${took.toFixed(2)} s after the spit (${FINALE_S} s)`);
  const printed = () => page.evaluate(() => ({ frame: Number(getComputedStyle(document.querySelector('.j-report-frame')).opacity), title: getComputedStyle(document.querySelector('.j-report-next')).clipPath }));
  const done = await printed();
  step.check(done.frame === 1 && done.title === 'none', 'every row of it printed');
  await toHead(page, 0.85);
  const back = await printed();
  const t = (await headNow(page)).t;
  step.check(t < SPIT_T && back.frame === 0 && back.title !== 'none', `scrolling up above the spit rewinds it (t ${t.toFixed(3)})`);
  await context.close();
  // A link to Contact lands on the report, finished.
  const arrival = await openPage(browser, step, VIEW);
  await arrival.page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
  await arrival.page.goto(`${BASE}/en/?proof&stages=all#contact`, { waitUntil: 'load' });
  await arrival.page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  const came = Date.now();
  await arrival.page.waitForFunction(() => getComputedStyle(document.querySelector('.j-report-next')).clipPath === 'none', null, { timeout: 10_000 });
  const waited = (Date.now() - came) / 1000;
  step.check(waited < 1, `#contact lands on the report finished (${waited.toFixed(2)} s)`);
  await arrival.context.close();
  return `${took.toFixed(2)} s`;
}

/** The report's words in English and Dutch: what the scan found, his heritage, Let's talk, the three ways and no Email. */
async function headReport(browser, step) {
  for (const [route, words, contact] of [['/en/', en, '/en/contact/'], ['/', nl, '/contact/']]) {
    const { context, page } = await openPage(browser, step, VIEW);
    await page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
    await page.goto(`${BASE}${route}?proof&stages=all#contact`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.j-report-next')).clipPath === 'none', null, { timeout: 10_000 });
    const seen = await page.evaluate(() => ({
      head: document.querySelector('.j-report-head').textContent,
      rows: document.querySelector('.j-report-rows').textContent,
      title: document.getElementById('j-end-word').textContent,
      links: [...document.querySelectorAll('#contact a')].map((a) => a.getAttribute('href')),
      mail: document.querySelectorAll('a[href^="mailto:"]').length,
    }));
    const r = words.journey.head.report;
    const tag = route === '/' ? 'Dutch' : 'English';
    step.check(seen.head.includes(r.complete) && /\d{2} \S+ \d{4} · \d{2}:\d{2}/.test(seen.head), `${tag}: "${r.complete}", with the visitor's date (${seen.head.trim()})`);
    const values = [r.subject, 'Bob Chung', r.basedIn, r.basedInValue, r.bornIn, r.bornInValue, r.heritage, r.heritageValue, r.thoughtsRead, '6 / 6', r.stillMissing, r.stillMissingValue];
    const missing = values.filter((value) => !seen.rows.includes(value));
    step.check(missing.length === 0, `${tag}: every row reads (missing: ${missing.join(', ') || 'none'})`);
    step.check(seen.title === words.journey.end.title, `${tag}: ${seen.title}`);
    step.check(seen.links.length === 3 && seen.links.includes(contact) && seen.links.some((h) => h.includes('github.com')) && seen.links.some((h) => h.includes('instagram.com')), `${tag}: GitHub, Instagram and Send a message (${seen.links.join(', ')})`);
    step.check(seen.mail === 0, `${tag}: and no Email`);
    await context.close();
  }
  return '';
}

/** Every link reachable by Tab, the focus visible, and a link bringing its chapter into place. */
async function keyboard(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  await flightLoaded(page, projects.byDate().length);
  const reached = [];
  let unseen = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const now = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const seen = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const again = el.hasAttribute('data-proof-seen');
      el.setAttribute('data-proof-seen', '');
      return { again, key: el.getAttribute('href') ?? el.getAttribute('data-jump') ?? el.textContent.trim().slice(0, 30), seen, project: el.closest('.j-project')?.dataset.project ?? null, end: Boolean(el.closest('#j-end')), tag: el.tagName };
    });
    if (!now || now.again) break;
    if (!now.seen) unseen += 1;
    reached.push(now);
    if (now.project === 'jontai-energy') {
      await page.waitForFunction((want) => Math.abs(window.__journeyDebug.frame() - want) < 2, timeline.reads[projects.byDate().findIndex((p) => p.id === 'jontai-energy')], { timeout: 20_000 });
      step.check(true, "reaching Jontai Energy's link brings its stop into place");
    }
  }
  const keys = reached.map((r) => r.key);
  for (const chapter of ['who', 'software', 'games', 'security', 'mechatronics', 'stack', 'projects', 'qa', 'contact']) step.check(keys.includes(chapter), `the rail's ${chapter} can be reached`);
  for (const project of projects.byDate()) step.check(reached.some((r) => r.project === project.id), `${project.id}'s link can be reached`);
  // The scan report's three ways; no Email, since Send a message is the same (Bob, spec 2026-11-08 "Into my head", 5.11).
  for (const href of ['https://github.com/bhccob', 'https://www.instagram.com/bhccob/', '/en/contact/']) step.check(keys.includes(href), `${href} can be reached`);
  step.check(!keys.some((key) => String(key).startsWith('mailto:')), 'and no Email link is left');
  step.check(unseen === 0, `the focus is visible on every one (${unseen} of ${reached.length} not)`);
  await page.waitForFunction((last) => window.__journeyDebug.frame() > last - 2, timeline.last, { timeout: 25_000 });
  step.check(true, 'reaching the scan report\'s links brings it into place');
  await context.close();
  return `${reached.length} stops`;
}

/** A tab nobody looks at for 30 s: it keeps its place and comes back with no burst of sound. */
async function backgroundTab(browser, step) {
  const { context, page } = await openJourney(browser, step, VIEW, { route: '/en/' });
  await goToFrame(page, 372);
  await goToFrame(page, 450, 200);
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.__journeyDebug.frame());
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await other.waitForTimeout(Number(process.env.HIDE_MS ?? 30_000));
  await page.bringToFront();
  await other.close();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ f: window.__journeyDebug.frame(), level: window.__journeyDebug.sound().level, on: window.__journeyDebug.sound().on }));
  step.check(Math.abs(after.f - before) <= 2, `its place is unchanged (${before.toFixed(1)} to ${after.f.toFixed(1)})`);
  step.check(after.level <= 0.6, `and no burst of sound (${after.level.toFixed(2)})`);
  await context.close();
  return '';
}

/** With no script at all the words are in the page, and it says where to go. */
async function noScript(browser, step) {
  const { context, page } = await openPage(browser, step, VIEW, { javaScriptEnabled: false });
  await page.goto(`${BASE}/en/`, { waitUntil: 'load' });
  const text = await page.content();
  // The scan report's words and ways to reach him; no Email since 2026-11-08 (Bob: "send a message is the same").
  for (const words of ['Software', 'Cookies Clicker', 'What is your plan after MBO?', 'Scan complete', 'github.com/bhccob', 'href="/en/contact/"']) step.check(text.includes(words), `"${words}" is in the HTML`);
  step.check(!text.includes('mailto:'), 'and no Email');
  step.check((await page.locator('.j-noscript a').getAttribute('href')) === '/en/lite/', 'and it points to Lite');
  await context.close();
  return '';
}

/** The scan report, finished: the ending runs on its own clock from the spit, so a scroll to the end waits for it. */
const reportPrinted = (page) => page.waitForFunction(() => (window.__journeyDebug.stops()?.head?.t ?? 0) >= 0.999, null, { timeout: 20_000 });

const jumpTo = async (page, f) => {
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const top = f <= 0 ? 0 : scrollFromFrame(f, max, timeline);
  await page.evaluate((to) => scrollTo({ top: to, behavior: 'auto' }), top);
  await page.waitForFunction((want) => Math.abs(window.__journeyDebug.frame() - want) < 0.5, f, { timeout: 15_000 });
};

/** How much of an element's letters the canvas covers, 0 to 1. */
const coveredBy3D = async (page, selector) => {
  const box = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(innerWidth, r.right) - Math.max(0, r.left), height: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) };
  }, selector);
  if (!box || box.width <= 0 || box.height <= 0) return 0;
  const shot = async () => sharp(await page.screenshot({ type: 'png', clip: box, scale: 'css' })).raw().toBuffer({ resolveWithObject: true });
  const on = await shot();
  await page.evaluate(() => { document.querySelector('.journey-canvas').style.visibility = 'hidden'; });
  await page.waitForTimeout(150);
  const off = await shot();
  await page.evaluate(() => { document.querySelector('.journey-canvas').style.visibility = ''; });
  let changed = 0;
  for (let i = 0; i < on.data.length; i += on.info.channels) if (Math.abs(on.data[i] - off.data[i]) + Math.abs(on.data[i + 1] - off.data[i + 1]) + Math.abs(on.data[i + 2] - off.data[i + 2]) > 60) changed += 1;
  return changed / (on.data.length / on.info.channels);
};

const inside = (page, selector) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).every((e) => {
  const r = e.getBoundingClientRect();
  return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
}), selector);

/** One whole journey by touch, at one size. */
async function smallScreen(browser, step, viewport, tag) {
  const { context, page } = await openJourney(browser, step, viewport, { route: '/en/', hasTouch: true, isMobile: true });
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  await flightLoaded(page, projects.byDate().length);
  await page.waitForFunction(() => window.__journeyDebug.stops()?.end !== null, null, { timeout: 30_000 });
  step.check(await page.evaluate(() => getComputedStyle(document.getElementById('j-rail')).display === 'none'), `${tag}: the rail is hidden`);
  const sheets = [72, 124, 188, 250];
  for (let n = 0; n < sheets.length; n++) {
    await jumpTo(page, sheets[n]);
    await page.waitForTimeout(700);
    writeFileSync(join(dir, `${tag}-sheet-${n + 1}.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    const sheet = `#j-sheet-${n}`;
    step.check(await inside(page, `${sheet} h2 span`), `${tag}, sheet ${n + 1}: its title stays on the page`);
    const title = await coveredBy3D(page, `${sheet} h2`);
    const line = await coveredBy3D(page, `${sheet} .j-line`);
    step.check(title < 0.04, `${tag}, sheet ${n + 1}: the machine leaves its title clear (${(title * 100).toFixed(1)}%)`);
    step.check(line < 0.04, `${tag}, sheet ${n + 1}: and its line (${(line * 100).toFixed(1)}%)`);
  }
  await jumpTo(page, 304);
  await page.waitForTimeout(600);
  writeFileSync(join(dir, `${tag}-stack.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
  step.check(await page.evaluate(() => { const r = document.querySelector('.journey-canvas').getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight - 1 && r.left <= 0 && r.right >= innerWidth - 1; }), `${tag}: the canvas fills the page, with no dark bands`);
  await jumpTo(page, 352);
  await page.waitForTimeout(500);
  writeFileSync(join(dir, `${tag}-portal.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
  for (const [i, f] of timeline.reads.entries()) {
    await jumpTo(page, f);
    await page.waitForTimeout(600);
    if (i === 1) writeFileSync(join(dir, `${tag}-project.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    step.check(await inside(page, '.j-open.on'), `${tag}: project ${i + 1}'s link stays on the page`);
  }
  for (let i = 0; i < 6; i++) {
    await jumpTo(page, headFrame(dwellT(i), timeline));
    await page.waitForTimeout(500);
    if (i === 0) writeFileSync(join(dir, `${tag}-qa.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    const card = await page.evaluate((n) => { const el = document.querySelector(`[data-answer="${n}"]`), r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, shown: Number(getComputedStyle(el).opacity) }; }, i);
    step.check(card.shown > 0.9 && card.l >= 0 && card.r <= viewport.width && card.t >= 0 && card.b <= viewport.height, `${tag}: answer ${i + 1} shows on the page (${card.l.toFixed(0)} to ${card.r.toFixed(0)}, ${card.t.toFixed(0)} to ${card.b.toFixed(0)})`);
  }
  await jumpTo(page, timeline.last);
  await reportPrinted(page);
  await page.waitForTimeout(300);
  writeFileSync(join(dir, `${tag}-end.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
  step.check(await inside(page, '.j-report nav a'), `${tag}: the report's links stay on the page`);
  step.check(await inside(page, '.j-report-panel'), `${tag}: and the report`);
  const bar = await page.evaluate(() => [...document.querySelectorAll('.j-report-bar > *')].map((e) => { const r = e.getBoundingClientRect(); return { height: r.height, left: r.left, right: r.right }; }));
  step.check(bar.every((b) => b.height < 24 && b.left >= 0 && b.right <= innerWidthOf(viewport)), `${tag}: its bottom line does not wrap (${bar.map((b) => b.height.toFixed(0)).join(', ')})`);
  await context.close();
  return '';
}

const innerWidthOf = (viewport) => viewport.width + 1;
const phoneStep = (browser, step) => smallScreen(browser, step, { width: 390, height: 844 }, 'phone');
const tabletStep = (browser, step) => smallScreen(browser, step, { width: 820, height: 1180 }, 'tablet');

/** What an element's words cover: as wide as the letters, as high as its box, as tight type runs past its own line boxes. */
const inkBoxes = (page, selectors) => page.evaluate((list) => list.flatMap((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
  const range = document.createRange();
  range.selectNodeContents(e);
  const ink = range.getBoundingClientRect(), box = e.getBoundingClientRect();
  return { text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 44), left: ink.left, right: ink.right, top: box.top, bottom: box.bottom };
})), selectors);

/** These parts of a page: each inside it, and none over another. */
async function partsFit(page, step, tag, selectors) {
  const boxes = await inkBoxes(page, selectors);
  step.check(boxes.length >= selectors.length, `${tag}: all its parts are there (${boxes.length})`);
  const { width, height } = page.viewportSize();
  const out = boxes.filter((b) => b.left < -1 || b.right > width + 1 || b.top < -1 || b.bottom > height + 1);
  step.check(out.length === 0, `${tag}: stays on the page${out.map((b) => ` | "${b.text}" ${b.left.toFixed(0)},${b.top.toFixed(0)} to ${b.right.toFixed(0)},${b.bottom.toFixed(0)}`).join('')}`);
  const over = [];
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) over.push(`"${a.text}" and "${b.text}"`);
  }));
  step.check(over.length === 0, `${tag}: nothing lies over anything${over.map((o) => ` | ${o}`).join('')}`);
}

/**
 * The English that stays in the Dutch page, as Dutch people in the trade use it, and the names. Every other sentence in English
 * must be gone from it.
 */
const AGREED_ENGLISH = new Set(['Software', 'Engineering', 'Game', 'Development', 'Software Engineering', 'Game Development', 'Cybersecurity', 'Stack', 'Full-stack', 'Engine', 'Godot, Roblox Studio', 'games.', 'Games', 'machines.', 'Q&A', 'GitHub', 'Instagram', 'Contact', 'OPEN', 'HBO', 'MBO 4, Rotterdam', 'Aruba', 'Rotterdam']);

/** Every sentence of an object of words, walked. */
const sentencesIn = (value) => (typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(sentencesIn) : []);

/** Whether a sentence stands in a text as whole words: "Age" is not in "pagina". */
const standsIn = (sentence, text) => {
  const quoted = sentence.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${quoted}($|[^\\p{L}])`, 'u').test(text);
};

/** Everything a Dutch visitor reads: inside the page, over nothing, and none of it still in English. */
async function dutchFit(browser, step) {
  const { en } = await tsImport('../../src/i18n/en.ts', import.meta.url);
  const dated = projects.byDate();
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  const read = [];
  for (const [viewport, tag, options] of [[{ width: 1440, height: 810 }, 'desktop', {}], [{ width: 390, height: 844 }, 'phone', { hasTouch: true, isMobile: true }]]) {
    // The door, before anything else.
    const door = await openPage(browser, step, viewport, options);
    await door.page.goto(`${BASE}/?proof`, { waitUntil: 'load' });
    await door.page.waitForSelector('.j-door-on', { timeout: 60_000 });
    await partsFit(door.page, step, `${tag}, the door`, ['.j-door-go', '.j-door-without']);
    read.push(await door.page.evaluate(() => document.querySelector('.j-door').textContent));
    await door.context.close();

    const { context, page } = await openJourney(browser, step, viewport, { route: '/', ...options });
    await flightLoaded(page, dated.length);
    await page.waitForFunction(() => window.__journeyDebug.stops() !== null, null, { timeout: 30_000 });
    await page.waitForTimeout(600);
    await partsFit(page, step, `${tag}, the first view`, ['.j-hero h1', '.j-hero p', '.j-go']);
    const rolling = await page.evaluate(() => [...document.querySelectorAll('.j-swap > *')].map((e) => { const r = document.createRange(); r.selectNodeContents(e); const box = r.getBoundingClientRect(); return { word: e.textContent, right: box.right }; }));
    step.check(rolling.length > 0 && rolling.every((w) => w.right <= viewport.width - 1), `${tag}: each rolling word fits (${rolling.map((w) => `${w.word} ${w.right.toFixed(0)}`).join(', ')})`);
    writeFileSync(join(dir, `nl-${tag}-hero.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
    await page.waitForFunction(() => { const [, second] = document.querySelectorAll('.j-swap > *'); return second && !second.style.transform.includes('120'); }, null, { timeout: 8_000 });
    await page.waitForTimeout(800);
    writeFileSync(join(dir, `nl-${tag}-hero-long.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
    for (const [n, f] of [72, 124, 188, 250].entries()) {
      await jumpTo(page, f);
      await page.waitForTimeout(700);
      writeFileSync(join(dir, `nl-${tag}-sheet-${n + 1}.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
      await partsFit(page, step, `${tag}, sheet ${n + 1}`, [`#j-sheet-${n} .j-trio > div`, `#j-sheet-${n} h2`, `#j-sheet-${n} .j-line`, `#j-sheet-${n} .j-block`]);
    }
    await jumpTo(page, 304);
    await page.waitForTimeout(600);
    writeFileSync(join(dir, `nl-${tag}-stack.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
    for (const [i, f] of timeline.reads.entries()) {
      await jumpTo(page, f);
      await page.waitForTimeout(1000);
      writeFileSync(join(dir, `nl-${tag}-project-${i + 1}.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
      const { stops } = await page.evaluate(() => window.__journeyDebug.stops());
      const rect = stops[i].rect ?? [NaN, NaN, NaN, NaN];
      const [l, t, r, b] = rect;
      step.check(l >= -1 && t >= -1 && r <= viewport.width + 1 && b <= viewport.height + 1, `${tag}, ${dated[i].id}: its words stay on the page (${rect.map((v) => v.toFixed(0)).join(', ')})`);
      const link = (await inkBoxes(page, ['.j-open.on']))[0];
      step.check(link && link.top >= stops[i].foot - 2 && link.bottom <= viewport.height, `${tag}, ${dated[i].id}: its link stands under them (${link?.top.toFixed(0)} under ${stops[i].foot?.toFixed(0)})`);
      read.push(stops[i].words.join(' '));
    }
    for (let i = 0; i < 6; i++) {
      await jumpTo(page, headFrame(dwellT(i), timeline));
      await page.waitForTimeout(600);
      if (tag === 'phone' || i === 0) writeFileSync(join(dir, `nl-${tag}-qa-${i + 1}.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
      await partsFit(page, step, `${tag}, answer ${i + 1}`, [`[data-answer="${i}"] h3`, `[data-answer="${i}"] .j-answer-say`]);
      read.push(await page.evaluate((n) => document.querySelector(`[data-answer="${n}"]`).textContent, i));
    }
    await jumpTo(page, timeline.last);
    await reportPrinted(page);
    await page.waitForTimeout(300);
    writeFileSync(join(dir, `nl-${tag}-end.jpg`), await page.screenshot({ type: 'jpeg', quality: 84 }));
    await partsFit(page, step, `${tag}, the scan report`, ['.j-report-panel h2', '.j-report-rows', '.j-report nav', '.j-report-bar']);
    // The words, not the page's scripts: the router's inline script says ".slice(", which is not the English "Slice".
    read.push(await page.evaluate(() => [(() => { const body = document.body.cloneNode(true); body.querySelectorAll('script, style').forEach((e) => e.remove()); return body.textContent; })(), ...[...document.querySelectorAll('[aria-label], [alt], [title]')].flatMap((e) => [e.getAttribute('aria-label'), e.getAttribute('alt'), e.getAttribute('title')])].join(' ')));
    await context.close();
  }

  // The English sentences, each looked for in what the Dutch visitor was given.
  const text = read.join(' ').replace(/\s+/g, ' ').toLowerCase();
  const english = [...new Set([
    ...sentencesIn(en.journey).flatMap((sentence) => sentence.split(/\{\w+\}/)).map((sentence) => sentence.trim()),
    ...en.end.questions.flatMap((q) => [q.question, q.answer]),
    ...dated.flatMap((project) => [project.copy('en').flightKind, project.copy('en').flightLine]),
  ])].filter((sentence) => sentence && !AGREED_ENGLISH.has(sentence));
  const left = english.filter((sentence) => standsIn(sentence, text));
  step.check(left.length === 0, `no English is left, of ${english.length} sentences compared${left.map((sentence) => ` | "${sentence}"`).join('')}`);
  return `${english.length} English sentences compared`;
}

/** Turning a phone in the middle of the flight keeps the place. */
async function rotateStep(browser, step) {
  const { context, page } = await openJourney(browser, step, { width: 390, height: 844 }, { route: '/en/', hasTouch: true, isMobile: true });
  await flightLoaded(page, projects.byDate().length);
  await jumpTo(page, 450);
  await page.waitForTimeout(600);
  const before = await atFrame(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1200);
  const after = await atFrame(page);
  step.check(Math.abs(after - before) <= 2, `portrait to landscape keeps its place (${before.toFixed(1)} to ${after.toFixed(1)})`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const back = await atFrame(page);
  step.check(Math.abs(back - before) <= 2, `and back (${back.toFixed(1)})`);
  await context.close();
  return '';
}

/** Each step of the ladder by itself: it draws, and it draws what it says. */
async function rungs(browser, step) {
  const { journeyQuality, journeySteps } = await tsImport('../../src/journey/quality.ts', import.meta.url);
  const summary = [];
  for (let n = 0; n < journeySteps(true); n++) {
    const opened = await openPage(browser, step, { width: 1280, height: 720 }, { deviceScaleFactor: 1.5 });
    await opened.page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
    await opened.page.goto(`${BASE}/en/?proof&stages=all&step=${n}`, { waitUntil: 'load' });
    await opened.page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
    await flightLoaded(opened.page, projects.byDate().length);
    const want = journeyQuality(n, true);
    const got = await opened.page.evaluate(() => ({ step: window.__journeyDebug.quality(), dpr: window.__journeyDebug.dpr() }));
    step.check(got.step === n && Math.abs(got.dpr - Math.min(1.5, want.pixelRatio)) < 0.01, `step ${n}: pixel ratio ${got.dpr}, as it says (${want.pixelRatio})`);
    // The machine, the stack, the flight, then his head: the scan, an answer, and the report.
    for (const f of [0, 304, 448, headFrame(0.17, timeline), headFrame(dwellT(2), timeline), timeline.last]) {
      await jumpTo(opened.page, f);
      if (f === timeline.last) await reportPrinted(opened.page);
      await opened.page.waitForTimeout(f === timeline.last ? 300 : 450);
      const { channels } = await sharp(await opened.page.screenshot({ type: 'jpeg', quality: 80 })).stats();
      step.check(channels[0].max > 40, `step ${n}, frame ${f}: it draws (brightest ${channels[0].max})`);
    }
    await opened.context.close();
    summary.push(`${n}: ${want.pixelRatio}`);
  }
  return summary.join(', ');
}

/** Slow frames walk the ladder down, in place: nothing is built again on the way. */
async function walkDown(browser, step) {
  const opened = await openPage(browser, step, { width: 1280, height: 720 }, { deviceScaleFactor: 1.5 });
  const { page, context } = opened;
  await page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
  await page.goto(`${BASE}/en/?proof&stages=all&step=0&govern`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__journeyDebug?.ready(), null, { timeout: 60_000 });
  await flightLoaded(page, projects.byDate().length);
  await goToFrame(page, 372);
  await goToFrame(page, 430, 200);
  // Into his head: the ladder walks down where the most is drawn.
  await jumpTo(page, headFrame(0.17, timeline));
  await page.waitForTimeout(600);
  const start = await page.evaluate(() => ({ step: window.__journeyDebug.quality(), dpr: window.__journeyDebug.dpr() }));
  await page.evaluate(() => {
    window.__tasks = [];
    new PerformanceObserver((list) => window.__tasks.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask' });
    // Each frame held 40 ms on the main thread: slow enough to ask for steps.
    const hold = () => {
      const until = performance.now() + 40;
      while (performance.now() < until);
      window.__holding = requestAnimationFrame(hold);
    };
    window.__holding = requestAnimationFrame(hold);
  });
  await page.waitForTimeout(6000);
  await page.evaluate(() => cancelAnimationFrame(window.__holding));
  await page.waitForTimeout(600);
  const end = await page.evaluate(() => ({ step: window.__journeyDebug.quality(), dpr: window.__journeyDebug.dpr(), longest: Math.max(0, ...window.__tasks) }));
  step.check(start.step === 0, `it starts at the top (${start.step})`);
  step.check(end.step > start.step, `the ladder has walked down (step ${start.step} to ${end.step}, pixel ratio ${start.dpr} to ${end.dpr})`);
  const { channels } = await sharp(await page.screenshot({ type: 'jpeg', quality: 80 })).stats();
  step.check(channels[0].max > 40, `his head is still drawn on the way down (brightest ${channels[0].max})`);
  step.check(end.longest <= 250, `no main-thread task over 250 ms on the way (the longest ${end.longest.toFixed(0)} ms): nothing is built again`);
  await context.close();
  return `step ${start.step} to ${end.step}`;
}

/** Pressing End at the very start on a slow line: no error, the scan report printed on its own clock, and no pile of sounds. */
async function jumpEarly(browser, step) {
  const { context, page } = await openJourney(browser, step, undefined, { route: '/en/', stages: '' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
  await jumpTo(page, 10);
  await page.waitForTimeout(400);
  const hits = () => page.evaluate(() => Object.values(window.__journeyDebug.sound().counts).reduce((a, b) => a + b, 0));
  const before = await hits();
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' }));
  await page.waitForFunction((last) => window.__journeyDebug.frame() > last - 1, timeline.last, { timeout: 15_000 });
  // The report is the page's own: it prints on the ending's clock, whether or not the 3D has come yet.
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.j-report-next')).clipPath === 'none', null, { timeout: 15_000 });
  const end = await page.evaluate(() => ({ frame: getComputedStyle(document.querySelector('.j-report-frame')).opacity, word: document.getElementById('j-end-word').textContent }));
  step.check(Number(end.frame) === 1 && end.word.length > 0, `then the scan report stands printed (${end.word})`);
  const after = await hits();
  step.check(after - before <= 6, `and the sounds of the jump do not pile up (${after - before})`);
  await context.close();
  return '';
}

const atFrame = (page) => page.evaluate(() => window.__journeyDebug.frame());
const openAddress = (page) => page.evaluate(() => location.pathname);

/** A project opens in place, and Back puts you where you were. */
async function projectOpen(browser, step) {
  const { context, page } = await openJourney(browser, step);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  const dated = projects.byDate();
  const index = dated.findIndex((p) => p.id === 'jontai-energy');
  const read = timeline.reads[index];
  await flightLoaded(page, dated.length);
  await goToFrame(page, 372);
  await goToFrame(page, read, 160);
  await page.waitForTimeout(1000);
  const before = await atFrame(page);
  const { screen } = await page.evaluate(() => window.__journeyDebug.flight());
  await page.mouse.move(screen[0], screen[1]);
  await page.waitForTimeout(250);
  await page.mouse.click(screen[0], screen[1]);
  await page.waitForTimeout(170);
  writeFileSync(join(dir, 'open-growing.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  await page.waitForTimeout(1100);
  writeFileSync(join(dir, 'open-full.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  step.check((await openAddress(page)) === '/projects/jontai-energy/', `a click on the screen opens it at its own address (${await openAddress(page)})`);
  const copy = dated[index].copy('nl');
  const seen = await page.evaluate(() => {
    const view = document.querySelector('.j-open-view');
    const box = view?.getBoundingClientRect();
    return {
      covers: box?.width === innerWidth || box?.width >= innerWidth - 20,
      top: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.j-open-view') !== null,
      text: view?.textContent ?? '',
      links: [...(view?.querySelectorAll('.ps-link') ?? [])].map((a) => a.getAttribute('href')),
      pictures: view?.querySelectorAll('.ps-media img').length ?? 0,
      inert: document.querySelector('.journey').hasAttribute('inert'),
      focus: document.activeElement?.closest('.j-open-view') !== null,
      hot: document.documentElement.hasAttribute('data-project-hot'),
    };
  });
  step.check(seen.covers && seen.top, 'it fills the view');
  step.check(seen.text.includes(copy.summary), 'its words show');
  step.check(!copy.overview || seen.text.includes(copy.overview), 'its case shows');
  step.check(seen.pictures > 0, `its pictures show (${seen.pictures})`);
  step.check(seen.links.length > 0, `its links show (${seen.links.join(', ')})`);
  step.check(seen.inert, 'everything under it is out of reach');
  step.check(seen.focus, 'the focus is in it');
  step.check(!seen.hot, 'the cursor no longer says it is over a screen');
  // Under it, nothing scrolls.
  await page.mouse.move(720, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  step.check(Math.abs((await atFrame(page)) - before) < 0.6, 'the wheel does not move the flight under it');
  // Back.
  await page.goBack();
  await page.waitForTimeout(800);
  step.check((await page.evaluate(() => document.querySelector('.j-open-view') === null)), 'Back closes it');
  step.check((await openAddress(page)) === ROUTE, `and the address is the flight's again (${await openAddress(page)})`);
  step.check(Math.abs((await atFrame(page)) - before) <= 2, `within 2 frames of the same place (${before.toFixed(1)} to ${(await atFrame(page)).toFixed(1)})`);
  const focusBack = await page.evaluate(() => document.activeElement?.closest('.j-project')?.dataset.project);
  step.check(focusBack === 'jontai-energy', `the focus is back on its link (${focusBack})`);
  // Forward opens it again, and Escape and the link do the same as before.
  await page.goForward();
  await page.waitForTimeout(900);
  step.check((await page.evaluate(() => document.querySelector('.j-open-view') !== null)) && (await openAddress(page)) === '/projects/jontai-energy/', 'Forward opens it again');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  step.check((await page.evaluate(() => document.querySelector('.j-open-view') === null)) && (await openAddress(page)) === ROUTE, 'Escape closes it');
  await page.locator('.j-project[data-project="jontai-energy"] .j-open').click();
  await page.waitForTimeout(1100);
  step.check((await openAddress(page)) === '/projects/jontai-energy/', 'its link opens it too');
  // In another language, in place.
  await page.locator('header a[hreflang]').click();
  await page.waitForTimeout(700);
  step.check((await openAddress(page)) === '/en/projects/jontai-energy/', `the language changes with it open, and the address follows (${await openAddress(page)})`);
  const english = await page.evaluate(() => document.querySelector('.j-open-view')?.textContent ?? '');
  step.check(english.includes(dated[index].copy('en').summary), 'and its words');
  await page.goBack();
  await page.waitForTimeout(800);
  step.check((await page.evaluate(() => document.documentElement.lang)) === 'en' && (await openAddress(page)) === `/en${ROUTE}`, `Back leaves you in that language (${await openAddress(page)})`);
  step.check(Math.abs((await atFrame(page)) - before) <= 2, `at the same place (${(await atFrame(page)).toFixed(1)})`);
  await context.close();
  return '';
}

/** A direct visit: the page on its own, with no WebGL at all. */
async function projectDirect(browser, step) {
  const { context, page } = await openPage(browser, step);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      return /webgl/i.test(kind) ? null : original.call(this, kind, ...rest);
    };
  });
  await page.goto(`${BASE}/projects/jontai-energy/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const dir = join(OUT, 'stills');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'project-direct.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  const project = projects.byId('jontai-energy');
  const seen = await page.evaluate(() => {
    const sheet = document.querySelector('.ps-page');
    return { text: sheet?.textContent ?? '', href: sheet?.querySelector('.ps-back')?.getAttribute('href'), covers: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.ps-page') !== null, pictures: sheet?.querySelectorAll('.ps-media img').length ?? 0 };
  });
  step.check(seen.text.includes(project.copy('nl').summary), 'with WebGL off, its words show');
  step.check(seen.pictures === project.pictures.length, `its pictures show (${seen.pictures})`);
  step.check(seen.covers, 'it fills the view');
  step.check(seen.href === '/#project-jontai-energy', `its close goes to its stop (${seen.href})`);
  // A project taken off for now: its old address goes to the projects on the home page.
  await page.goto(`${BASE}/projects/steady/`, { waitUntil: 'load' });
  await page.waitForURL((url) => url.pathname === '/' && url.hash === '#projects', { timeout: 10_000 }).catch(() => {});
  step.check(new URL(page.url()).hash === '#projects', `Steady's old page goes to the projects (${page.url()})`);
  await context.close();
  // That address at the review page, until the swap (Task 28): the hash lands at the stop.
  const opened = await openPage(browser, step);
  await opened.page.addInitScript(() => sessionStorage.setItem('journey-seen', '1'));
  await opened.page.goto(`${BASE}${ROUTE}?proof#project-jontai-energy`, { waitUntil: 'load' });
  await opened.page.waitForFunction(() => window.__journeyDebug && window.__journeyDebug.first() !== null, null, { timeout: 60_000 });
  const first = await opened.page.evaluate(() => window.__journeyDebug.first());
  const want = timeline.reads[projects.byDate().findIndex((p) => p.id === 'jontai-energy')];
  step.check(Math.abs(first - want) <= 2, `#project-jontai-energy lands at its stop (${first.toFixed(1)}, its stop ${want})`);
  await opened.context.close();
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
  await page.waitForSelector('.j-calm', { timeout: 15_000 });
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
  // The ending runs on its own clock: its sounds are all in once the report is printed.
  await page.waitForFunction(() => (window.__journeyDebug.stops()?.head?.t ?? 0) >= 0.999, null, { timeout: 15_000 });
  await page.waitForTimeout(400);
  const { counts } = await page.evaluate(() => window.__journeyDebug.sound());
  const missing = HIT_NAMES.filter((name) => counts[name] !== 1);
  step.check(missing.length === 0, `every part of the machine played once (not: ${missing.map((n) => `${n}=${counts[n] ?? 0}`).join(', ') || 'none'})`);
  step.check(peak <= 0.6, `nothing distorts (the loudest ${peak.toFixed(3)})`);
  const once = ['scan', 'lid', 'dive', 'spit', 'gather', 'softBang', 'printTitle'].filter((cue) => counts[cue] !== 1);
  step.check(once.length === 0, `his head's sounds play once each (not: ${once.map((c) => `${c}=${counts[c] ?? 0}`).join(', ') || 'none'})`);
  step.check(counts.label === 6 && counts.thought === 7, `a ping for each of the six labels and a tone for each of the seven thoughts (${counts.label}, ${counts.thought})`);
  step.check((counts.print ?? 0) >= 7, `and the report ticks as it prints (${counts.print ?? 0})`);
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

const STEPS = { 'dutch-fit': dutchFit, rungs, 'walk-down': walkDown, 'jump-early': jumpEarly, phone: phoneStep, tablet: tabletStep, rotate: rotateStep, 'reduced-motion': reducedMotion, 'no-webgl': noWebgl, 'context-lost': contextLost, 'head-missing': headMissing, 'head-language': headLanguage, 'head-resize': headResize, 'head-scan': headScan, 'head-thoughts': headThoughts, 'head-spit': headSpit, 'end-clock': endClockStep, 'head-report': headReport, keyboard, 'background-tab': backgroundTab, 'no-script': noScript, flight, projects: projectsStep, 'project-open': projectOpen, 'project-direct': projectDirect, stills, smooth, cursor: cursorStep, 'no-cursor': noCursor, 'cursor-form': cursorForm, sound: soundStep, loader, 'loader-quick': loaderQuick, 'loader-new-tab': loaderNewTab, 'loader-door-keys': loaderDoorKeys, 'loader-reduced': loaderReduced, 'give-up': giveUp, 'first-view': firstView, sheets, 'engineering-readable': engineeringReadable, stack: stackStep, portal, jumps, hash, 'reload-mid': reloadMid, 'resize-keeps-place': resizeKeepsPlace, 'lang-keeps-place': langKeepsPlace };

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
