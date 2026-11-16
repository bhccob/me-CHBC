// LAB ONLY (throwaway). Round 75, "Compiled". Scroll scrubs one continuous rendered camera move; the two cuts (into the
// screen, out to the PC's chip) are frames rendered to match, so a crossfade between them is invisible. At the
// turntable, holding and dragging turns it through 36 rendered frames; the project at the front is named and opens.
// Lengths in screen heights.
import { PROJECTS } from './r73-projects.js';

const q = new URLSearchParams(location.search);
const DIR = '/proof-out/lab/mock/r75';
const json = (u) => fetch(u).then((r) => r.json());
const info = await json(`${DIR}/seq/frames.json`);
const spinInfo = await json(`${DIR}/spin/spin.json`).catch(() => ({ count: 0 }));
const ORDER = ['print', 'cursor', 'screen', 'd-cursor', 'software', 'game', 'cyber', 'compile', 'chip', 'board', 'cable', 'arm', 'works', 'desk'];
const HOLD = { print: 0.7, cursor: 0.6, screen: 0.05, 'd-cursor': 0.25, software: 1.2, game: 1.2, cyber: 1.2, compile: 0.5, chip: 0.35, board: 0.3, cable: 0.3, arm: 1.3, works: 1.6, desk: 1.3 };
const MOVE = { print: 0.8, cursor: 0.9, screen: 0.35, 'd-cursor': 1.4, software: 1.1, game: 1.1, cyber: 1.2, compile: 0.4, chip: 0.7, board: 1.0, cable: 0.8, arm: 1.6, works: 1.3 };
const CHAPTER = { print: 'origin', cursor: 'origin', screen: 'origin', 'd-cursor': 'origin', software: 'foundation', game: 'foundation', cyber: 'protection',
  compile: 'evolution', chip: 'evolution', board: 'evolution', cable: 'evolution', arm: 'evolution', works: 'works', desk: 'maker' };
const FOCUS = { print: 0.55, cursor: 0.5, screen: 0.5, 'd-cursor': 0.5, software: 0.62, game: 0.62, cyber: 0.62, compile: 0.5, chip: 0.5, board: 0.6, cable: 0.6, arm: 0.62, works: 0.62, desk: 0.6 };
const N = PROJECTS.length, WORKS = PROJECTS.map((p) => p.key);
// turntable: spin frame i turns the platter 10 degrees; the slot at the front is (-i / 9) mod 4 in build order
const BUILD = ['jontai', 'lumo', 'locked', 'cookies'];

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n, w) => String(n).padStart(w, '0');
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(max-aspect-ratio: 1/1)');

// ---- project pages and the list
const field = (label, v) => `<div><dt>${label}</dt><dd${v ? '' : ' class="todo"'}>${v || 'To write'}</dd></div>`;
$('.sheet-body').innerHTML = PROJECTS.map((p) => `
  <article class="project" data-project="${p.key}" hidden>
    <h2 id="sheet-title-${p.key}">${p.title}</h2>
    <p class="cat">${p.kind} · ${p.year}</p>
    <p class="lead">${p.lead}</p>
    ${p.image ? `<figure${p.image.tall ? ' class="tall"' : ''}><img src="${p.image.src}" width="${p.image.w}" height="${p.image.h}" alt="${p.image.alt}" loading="lazy" /><figcaption>${p.image.caption}</figcaption></figure>`
              : `<figure class="empty"><p>Screens to come</p></figure>`}
    <dl>
      ${field('Objective', p.objective)}${field('My part', p.contribution)}
      <div><dt>Built with</dt><dd class="chips">${p.tech.map((t) => `<i>${t}</i>`).join('')}</dd></div>
      ${field('How it works', p.implementation)}${field('Decisions', p.decisions)}${field('Challenges', p.challenges)}${field('Outcome', p.outcome)}
      <div><dt>Links</dt><dd>${p.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join(' · ')}</dd></div>
    </dl>
  </article>`).join('');
$('.list ol').innerHTML = PROJECTS.map((p, i) => `<li><button type="button" data-open="${p.key}"><span>${pad(i + 1, 2)}</span><b>${p.title}</b><i>${p.kind}</i><em>${p.year}</em></button></li>`).join('');

// ---- the timeline
const segs = []; let T = 0;
ORDER.forEach((name, i) => {
  segs.push({ kind: 'hold', i, from: T, len: HOLD[name] }); T += HOLD[name];
  if (MOVE[name]) { segs.push({ kind: 'move', i, from: T, len: MOVE[name] }); T += MOVE[name]; }
});
const startOf = Object.fromEntries(segs.filter((s) => s.kind === 'hold').map((s) => [ORDER[s.i], s.from]));
$('.runway').style.height = `${(T + 1) * 100}vh`;

// ---- pictures: the first stretch first
const img = (src, go = true) => { const im = new Image(); im.dataset.src = src; if (go) im.src = src; return im; };
const firstN = info.stops.software + 1;
const frames = Array.from({ length: info.count }, (_, i) => img(`${DIR}/seq/f${pad(i, 3)}.jpg`, i < firstN));
const spins = Array.from({ length: spinInfo.count }, (_, i) => img(`${DIR}/spin/s${pad(i, 2)}.jpg`, false));
const all = [...frames, ...spins]; let loaded = 0; const count = $('.loader b');
const wait = (im) => im.decode().catch(() => {}).then(() => { count.textContent = Math.round((++loaded / all.length) * 100); });
await Promise.all(frames.slice(0, firstN).map(wait));
document.body.classList.remove('loading');
(async () => {
  const rest = [...frames.slice(firstN), ...spins];
  for (let i = 0; i < rest.length; i += 8) { const b = rest.slice(i, i + 8); b.forEach((im) => (im.src = im.dataset.src)); await Promise.all(b.map(wait)); }
})();

const canvas = $('.film'), ctx = canvas.getContext('2d');
const beats = Object.fromEntries($$('.beat').map((el) => [el.dataset.beat, el]));
const scrim = $('.scrim'), chapters = $('.chapters'), pad_ = $('.spinpad');
let cw = 0, ch = 0, dpr = 1, sig = '';
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
function size() { dpr = Math.min(devicePixelRatio || 1, 2); cw = innerWidth; ch = innerHeight; canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); sig = ''; }
function crop(fx) {
  let s = Math.max(cw / 16, ch / 9);
  if (!phone.matches) s = Math.min(s, cw / (0.88 * 16), ch / (0.80 * 9));
  const w = 16 * s, h = 9 * s;
  return { x: w >= cw ? Math.min(0, Math.max(cw - w, cw / 2 - fx * w)) : (cw - w) / 2, y: (ch - h) / 2, w, h };
}
function draw(im, alpha, fx) {
  if (!im || !im.complete || !im.naturalWidth || alpha <= 0.001) return false;
  const c = crop(fx); ctx.globalAlpha = Math.min(1, alpha); ctx.drawImage(im, c.x * dpr, c.y * dpr, c.w * dpr, c.h * dpr); return true;
}
function nearest(list, i) { for (let d = 0; d < list.length; d++) for (const j of [i - d, i + d]) if (list[j]?.complete && list[j].naturalWidth) return list[j]; return null; }
function blend(list, f, fx) {
  const i = Math.floor(clamp(f, 0, list.length - 1)), k = f - i;
  if (!draw(list[i], 1, fx)) draw(nearest(list, i), 1, fx);
  if (k > 0.002 && list[i + 1]) draw(list[i + 1], k, fx);
}

// ---- the turntable: drag to turn, it settles with the nearest project at the front
let spin = q.has('spin') ? Number(q.get('spin')) : 0, spinTarget = spin, drag = null, vel = 0;
const SN = spinInfo.count || 36, STEP = SN / 4;
const frontIndex = () => { const s = Math.round(spinTarget / STEP); return ((-s % 4) + 4) % 4; };
function setFront() {
  const key = BUILD[frontIndex()], p = PROJECTS.find((x) => x.key === key), i = WORKS.indexOf(key);
  $('.front-n').textContent = `${pad(i + 1, 2)} / ${pad(N, 2)}`; $('.front-kind').textContent = `${p.kind} · ${p.year}`;
  $('.front-title').textContent = p.title; $('.front-open').dataset.open = key;
}
function toProject(key) { const j = BUILD.indexOf(key); const cur = Math.round(spinTarget / STEP); let d = ((-j - cur) % 4 + 4) % 4; if (d > 2) d -= 4; spinTarget = (cur + d) * STEP; }
pad_.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, x0: e.clientX }; vel = 0; pad_.setPointerCapture(e.pointerId); pad_.classList.add('dragging'); });
pad_.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; spinTarget -= dx * 0.06; vel = -dx * 0.06; });
const up = () => { if (!drag) return; drag = null; pad_.classList.remove('dragging'); if (calm || Math.abs(vel) < 0.3) { spinTarget = Math.round(spinTarget / STEP) * STEP; vel = 0; } };
pad_.addEventListener('pointerup', up); pad_.addEventListener('pointercancel', up);

let open = null, opener = null, pin = null, lastFront = -1;
function render(u, now) {
  u = clamp(u, 0, T);
  const seg = segs.findLast((s) => u >= s.from) ?? segs[0];
  const t = seg.len ? clamp((u - seg.from) / seg.len) : 0;
  const pres = {}; let f, fx, at = ORDER[seg.i];
  if (seg.kind === 'hold') { pres[at] = 1; f = info.stops[at]; fx = FOCUS[at]; }
  else {
    const a = ORDER[seg.i], b = ORDER[seg.i + 1];
    pres[a] = clamp(1 - t / 0.25); pres[b] = clamp((t - 0.75) / 0.25);
    f = info.stops[a] + (info.stops[b] - info.stops[a]) * t; fx = FOCUS[a] + (FOCUS[b] - FOCUS[a]) * t; if (t > 0.5) at = b;
  }
  // at the turntable the spin frames take over
  const atWorks = seg.kind === 'hold' && ORDER[seg.i] === 'works' && spins.length;
  pad_.classList.toggle('live', !!atWorks && !open);
  if (atWorks) {
    if (!drag) { if (Math.abs(vel) > 0.05 && !calm) { spinTarget += vel; vel *= 0.9; if (Math.abs(vel) < 0.3) { spinTarget = Math.round(spinTarget / STEP) * STEP; vel = 0; } } }
    spin += (spinTarget - spin) * (calm || drag ? 1 : 0.14);
    const fi = frontIndex(); if (fi !== lastFront) { lastFront = fi; setFront(); }
  }
  const sf = ((spin % SN) + SN) % SN;
  const s = `${f.toFixed(3)}|${atWorks ? sf.toFixed(3) : ''}|${fx.toFixed(3)}|${loaded}`;
  if (s !== sig) {
    sig = s; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (atWorks && Math.abs(spin) > 0.01) {
      const i = Math.floor(sf), k = sf - i;
      if (!draw(spins[i], 1, fx)) draw(frames[info.stops.works], 1, fx);
      if (k > 0.002) draw(spins[(i + 1) % SN], k, fx);
    } else blend(frames, f, fx);
  }
  let side = 0, corner = 0;
  for (const [name, el] of Object.entries(beats)) {
    const a = pres[name] ?? 0;
    el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * 14}px)`; el.classList.toggle('live', a > 0.01);
    if (el.classList.contains('col')) side = Math.max(side, a);
    if (el.classList.contains('free')) corner = Math.max(corner, a);
  }
  scrim.style.setProperty('--side', open ? 1 : side); scrim.style.setProperty('--corner', open ? 0 : corner);
  chapters.style.setProperty('--progress', (u / T).toFixed(4));
  const chap = CHAPTER[at];
  $$('a', chapters).forEach((x) => { if (x.dataset.ch === chap) x.setAttribute('aria-current', 'step'); else x.removeAttribute('aria-current'); });
}

// ---- opening a project over the turntable
const sheet = $('.sheet'), sheetBody = $('.sheet-body'), articles = $$('.project'), pagerB = $('.pager b'), list = $('.list');
function openProject(key, from) {
  if (key && from) opener = from;
  open = key; document.body.classList.toggle('open', !!key);
  if (key) {
    toProject(key); pin = startOf.works + HOLD.works * 0.5; cur = pin;
    document.documentElement.style.overflow = 'hidden'; sheet.hidden = false;
    articles.forEach((x) => (x.hidden = x.dataset.project !== key));
    sheet.setAttribute('aria-labelledby', `sheet-title-${key}`);
    pagerB.textContent = `${pad(WORKS.indexOf(key) + 1, 2)} / ${pad(N, 2)}`; sheetBody.scrollTop = 0;
    requestAnimationFrame(() => sheetBody.focus({ preventScroll: true }));
  } else {
    const back = pin; pin = null; document.documentElement.style.overflow = '';
    if (back !== null) scrollTo({ top: back * innerHeight, behavior: 'auto' });
    setTimeout(() => { if (!open) sheet.hidden = true; }, calm ? 0 : 450);
    setTimeout(() => $('.front-open').focus({ preventScroll: true }), 80);
  }
}
const stepP = (d) => openProject(WORKS[(WORKS.indexOf(open) + d + N) % N]);
$$('[data-open]').forEach((b) => b.addEventListener('click', () => { closeList(); openProject(b.dataset.open, b); }));
$('.front-open').addEventListener('click', (e) => openProject(e.currentTarget.dataset.open, e.currentTarget));
$('.back').addEventListener('click', () => openProject(null));
$('.prev').addEventListener('click', () => stepP(-1));
$('.next').addEventListener('click', () => stepP(1));
function openList(from) { opener = from; list.hidden = false; $('.list-close').focus(); }
function closeList() { if (!list.hidden) list.hidden = true; }
$('[data-list]').addEventListener('click', (e) => openList(e.currentTarget));
$('.list-close').addEventListener('click', () => { closeList(); opener?.focus(); });
list.addEventListener('click', (e) => { if (e.target === list) { closeList(); opener?.focus(); } });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!list.hidden) { closeList(); opener?.focus(); } else if (open) openProject(null); }
  if (open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); stepP(e.key === 'ArrowRight' ? 1 : -1); return; }
  if (pad_.classList.contains('live') && list.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault(); spinTarget = (Math.round(spinTarget / STEP) + (e.key === 'ArrowRight' ? 1 : -1)) * STEP;
  }
});

// ---- motes
const motes = $('.motes'), mctx = motes.getContext('2d');
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const dust = Array.from({ length: 30 }, (_, i) => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, vx: (rnd() - 0.5) * 0.006, vy: -0.002 - rnd() * 0.005, warm: i % 5 === 2 }));
let lastY = scrollY, lastT = performance.now();
function drawDust(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; const dy = (scrollY - lastY) / innerHeight; lastY = scrollY;
  if (motes.width !== canvas.width || motes.height !== canvas.height) { motes.width = canvas.width; motes.height = canvas.height; }
  mctx.clearRect(0, 0, motes.width, motes.height);
  for (const p of dust) {
    if (!calm) { p.x += p.vx * dt * p.z; p.y += p.vy * dt * p.z - dy * 0.22 * p.z; }
    p.x = (p.x + 1) % 1; p.y = (p.y + 1) % 1;
    mctx.globalAlpha = (p.warm ? 0.6 : 0.25) * (0.35 + p.z * 0.65); mctx.fillStyle = p.warm ? '#c5a45a' : '#8a5cc5';
    mctx.beginPath(); mctx.arc((p.x * cw - mouse.sx * 14 * p.z) * dpr, (p.y * ch - mouse.sy * 10 * p.z) * dpr, (0.5 + p.z * 1.3) * dpr, 0, Math.PI * 2); mctx.fill();
  }
}

// ---- run
const held = q.has('p') ? Number(q.get('p')) * T : null;
let cur = held ?? scrollY / innerHeight;
size(); addEventListener('resize', size);
addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
setFront();
if (q.has('open')) openProject(q.get('open'));
if (q.has('list')) openList(null);
(function tick(now) {
  const want = pin ?? held ?? scrollY / innerHeight;
  cur += (want - cur) * (calm || held !== null ? 1 : 0.1); if (Math.abs(want - cur) < 0.0005) cur = want;
  mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
  render(cur, now ?? performance.now()); drawDust(now ?? performance.now()); requestAnimationFrame(tick);
})();
window.__ready = true; window.__T = T; window.__startOf = startOf; window.__HOLD = HOLD;
$$('[data-go]').forEach((x) => x.addEventListener('click', (e) => {
  e.preventDefault(); if (open) openProject(null); closeList();
  scrollTo({ top: (startOf[x.dataset.go] + HOLD[x.dataset.go] * 0.4) * innerHeight, behavior: calm ? 'auto' : 'smooth' });
}));
