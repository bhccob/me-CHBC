// LAB ONLY (throwaway). Round 74: key frames of the automaton with transitions that say where the camera goes (pull
// back from the print to the heart, along the body, closer as it rises, back out through the glass onto Bob's monitor),
// and the works as a live ring you hold and drag round the kneeling automaton. Lengths in screen heights.
import * as THREE from 'three';
import { PROJECTS } from './r73-projects.js';

const q = new URLSearchParams(location.search);
const DIR = '/proof-out/lab/mock/r74/keys/keys-';
const LAY = await fetch('/proof-out/lab/mock/r74/keys/layout.json').then((r) => r.json()).catch(() => ({}));
const ORDER = ['origin', 'software', 'game', 'cyber', 'mechatronics', 'works', 'awakening', 'touch', 'desk'];
const HOLD = { origin: 0.7, software: 1.2, game: 1.1, cyber: 1.2, mechatronics: 1.2, works: 1.6, awakening: 1.2, touch: 1.0, desk: 1.3 };
const MOVE = { origin: 1.1, software: 0.8, game: 0.8, cyber: 0.8, mechatronics: 0.9, works: 1.0, awakening: 0.9, touch: 1.4 };
// how each move looks: pull (the next frame grows out of the middle of this one), slide (along the chambers),
// dive (into the middle, through black), turn (the upside-down image rights itself and fills the screen), fade
const KIND = { origin: 'pull', software: 'slide', game: 'slide', cyber: 'slide', mechatronics: 'fade', works: 'fade', awakening: 'push', touch: 'pullout' };
const CHAPTER = { origin: 'origin', software: 'foundation', game: 'foundation', cyber: 'protection', mechatronics: 'evolution', works: 'works', awakening: 'awakening', touch: 'ending', desk: 'ending' };
const FOCUS = { origin: 0.5, software: 0.62, game: 0.62, cyber: 0.62, mechatronics: 0.6, works: 0.5, awakening: 0.6, touch: 0.6, desk: 0.6 };
// where the next frame comes out of in a pull (fraction of the frame): the heart in the software frame
const AIM = { software: [0.585, 0.43], awakening: [0.5, 0.45] };

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n, w) => String(n).padStart(w, '0');
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const sm = (t) => t * t * (3 - 2 * t);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = matchMedia('(max-aspect-ratio: 1/1)');
const N = PROJECTS.length, WORKS = PROJECTS.map((p) => p.key);

// ---- project pages and the list, from the records
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

// ---- pictures
const pics = Object.fromEntries(ORDER.map((n) => { const im = new Image(); im.src = `${DIR}${n}.jpg`; return [n, im]; }));
let loaded = 0; const count = $('.loader b');
await Promise.all(Object.values(pics).map((im) => im.decode().catch(() => {}).then(() => { count.textContent = Math.round((++loaded / ORDER.length) * 100); })));
document.body.classList.remove('loading');

const canvas = $('.film'), ctx = canvas.getContext('2d');
const beats = Object.fromEntries($$('.beat').map((el) => [el.dataset.beat, el]));
const scrim = $('.scrim'), chapters = $('.chapters');
let cw = 0, ch = 0, dpr = 1;
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
function size() {
  dpr = Math.min(devicePixelRatio || 1, 2); cw = innerWidth; ch = innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  ring.resize();
}
function crop(fx) {
  let s = Math.max(cw / 16, ch / 9);
  if (!phone.matches) s = Math.min(s, cw / (0.88 * 16), ch / (0.80 * 9));
  const w = 16 * s, h = 9 * s;
  return { x: w >= cw ? Math.min(0, Math.max(cw - w, cw / 2 - fx * w)) : (cw - w) / 2, y: (ch - h) / 2, w, h };
}
// draw a frame scaled by k about a point (fractions of the frame), rotated by rot, at alpha
function draw(name, { k = 1, at = [0.5, 0.5], rot = 0, alpha = 1, fx = 0.5, dx = 0, dy = 0 } = {}) {
  const im = pics[name]; if (!im?.naturalWidth || alpha <= 0.001) return;
  const c = crop(fx), px = c.x + at[0] * c.w, py = c.y + at[1] * c.h;
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate((px + dx) * dpr, (py + dy) * dpr); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-px * dpr, -py * dpr);
  ctx.drawImage(im, c.x * dpr, c.y * dpr, c.w * dpr, c.h * dpr); ctx.restore();
}

function render(u, now) {
  u = clamp(u, 0, T);
  const seg = segs.findLast((s) => u >= s.from) ?? segs[0];
  const t = seg.len ? clamp((u - seg.from) / seg.len) : 0;
  const a = ORDER[seg.i], b = ORDER[seg.i + 1];
  const pres = {}; let at = a;
  ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const par = calm ? 0 : 1, px = -mouse.sx * 10 * par, py = -mouse.sy * 6 * par;
  if (seg.kind === 'hold') {
    pres[a] = 1;
    // a slow push in while resting, so a still never feels like a still
    draw(a, { k: 1 + 0.035 * (calm ? 0 : sm(t)), fx: FOCUS[a], dx: px, dy: py });
  } else {
    const e = sm(t), kind = KIND[a];
    pres[a] = clamp(1 - t / 0.25); pres[b] = clamp((t - 0.75) / 0.25); if (t > 0.5) at = b;
    const fx = FOCUS[a] + (FOCUS[b] - FOCUS[a]) * e;
    if (calm) { draw(a, { alpha: 1 - e, fx }); draw(b, { alpha: e, fx }); }
    else if (kind === 'pull') {            // pull back: the next, wider frame shrinks into place around the last one
      const aim = AIM[b] ?? [0.5, 0.5];
      draw(b, { k: 1 + 9.0 * (1 - e) ** 2, at: aim, fx });
      draw(a, { k: 1 + 0.15 * e, at: [0.5, 0.5], alpha: 1 - sm(clamp(t / 0.45)), fx });
    } else if (kind === 'dive') {          // into the middle of this frame, through black, the next one opens
      const aim = AIM[a] ?? [0.5, 0.5];
      const k1 = 1 + 7 * sm(clamp(t / 0.6)) ** 1.5;
      draw(a, { k: k1, at: aim, alpha: 1 - sm(clamp((t - 0.35) / 0.25)), fx });
      draw(b, { k: 1.25 - 0.25 * sm(clamp((t - 0.55) / 0.45)), alpha: sm(clamp((t - 0.6) / 0.4)), fx });
    } else if (kind === 'slide') {         // along the spiral to the next chamber
      draw(a, { alpha: 1 - sm(clamp((t - 0.2) / 0.6)), fx, dx: -cw * 0.18 * e, k: 1.035 + 0.06 * e });
      draw(b, { alpha: sm(clamp((t - 0.25) / 0.6)), fx, dx: cw * 0.18 * (1 - e), k: 1.08 - 0.08 * e });
    } else if (kind === 'turn') {          // the image on the far wall rights itself and becomes what you see
      draw(a, { alpha: 1 - sm(clamp((t - 0.3) / 0.5)), fx, k: 1 + 0.6 * e, at: [0.55, 0.5] });
      draw(b, { k: lerp(0.40, 1, e), rot: Math.PI * (1 - e), alpha: sm(clamp(t / 0.35)), fx, at: [0.5, 0.5] });
    } else if (kind === 'pullout') {       // back out through the glass: it was the monitor on his desk
      const mon = LAY.monitor ?? { x0: 0.34, y0: 0.27, x1: 0.71, y1: 0.63 };
      const mc = [(mon.x0 + mon.x1) / 2, (mon.y0 + mon.y1) / 2], kmax = 1 / (mon.x1 - mon.x0);
      const k = kmax + (1 - kmax) * e;
      draw(b, { k, at: mc, fx });
      // the sharp frame sits over the monitor's own copy of it until the room takes over
      const c = crop(fx), px = c.x + mc[0] * c.w, py = c.y + mc[1] * c.h;
      const w = (mon.x1 - mon.x0) * c.w * k, hh = (mon.y1 - mon.y0) * c.h * k;
      const im = pics[a];
      if (im?.naturalWidth) { ctx.globalAlpha = 1 - sm(clamp((t - 0.25) / 0.45)); ctx.drawImage(im, (px - w / 2) * dpr, (py - hh / 2) * dpr, w * dpr, hh * dpr); ctx.globalAlpha = 1; }
    } else if (kind === 'push') {          // closer
      draw(a, { k: 1 + 0.5 * e, at: AIM.awakening, alpha: 1 - sm(clamp((t - 0.3) / 0.5)), fx });
      draw(b, { k: 1.4 - 0.4 * e, at: [0.5, 0.5], alpha: sm(clamp((t - 0.3) / 0.5)), fx });
    } else { draw(a, { alpha: 1 - e, fx }); draw(b, { alpha: e, fx }); }
  }
  let side = 0, corner = 0;
  for (const [name, el] of Object.entries(beats)) {
    const v = pres[name] ?? 0;
    el.style.opacity = v; el.style.transform = `translateY(${(1 - v) * 14}px)`;
    el.classList.toggle('live', v > 0.01);
    if (el.classList.contains('col')) side = Math.max(side, v);
    if (el.classList.contains('free')) corner = Math.max(corner, v);
  }
  scrim.style.setProperty('--side', open ? 1 : side); scrim.style.setProperty('--corner', open ? 0 : corner);
  chapters.style.setProperty('--progress', (u / T).toFixed(4));
  const chap = CHAPTER[at];
  $$('a', chapters).forEach((x) => { if (x.dataset.ch === chap) x.setAttribute('aria-current', 'step'); else x.removeAttribute('aria-current'); });
  ring.show(pres.works ?? 0, now);
}
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- the ring of works: hold and drag to turn it
const ring = (() => {
  const el = $('.ring');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true }); }
  catch { return { resize() {}, show() {}, to() {}, front: () => 0 }; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  cam.position.set(0, 1.9, 10.5); cam.lookAt(0, -0.2, 0);
  const group = new THREE.Group(); scene.add(group);
  const R = 3.4, step = (Math.PI * 2) / N;
  // the ring itself: a thin gold line that the objects ride on
  const pts = Array.from({ length: 257 }, (_, i) => new THREE.Vector3(Math.sin((i / 256) * Math.PI * 2) * R, 0, Math.cos((i / 256) * Math.PI * 2) * R));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc5a45a, transparent: true, opacity: 0.45 }));
  group.add(line);
  // one simple object per project: a dark glass disc with its picture inside, in a gold rim
  function face(p) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#120c1b'; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const finish = () => {
      const grad = g.createRadialGradient(256, 256, 120, 256, 256, 256); grad.addColorStop(0, 'rgba(14,10,20,0)'); grad.addColorStop(1, 'rgba(14,10,20,0.75)');
      g.fillStyle = grad; g.fillRect(0, 0, 512, 512); tex.needsUpdate = true;
    };
    if (p.image) {
      const im = new Image(); im.src = p.image.src;
      im.decode().then(() => {
        const s = Math.max(512 / im.naturalWidth, 512 / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
        g.drawImage(im, (512 - w) / 2, p.image.tall ? 0 : (512 - h) / 2, w, h); finish();
      }).catch(finish);
    } else {
      g.fillStyle = '#48266b'; g.fillRect(0, 0, 512, 512);
      g.fillStyle = '#e9e1d3'; g.font = '500 92px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.fillText(p.title, 256, 270);
      g.fillStyle = '#c5a45a'; g.font = '500 26px "IBM Plex Mono", monospace'; g.fillText('SCREENS TO COME', 256, 330); finish();
    }
    return tex;
  }
  const items = PROJECTS.map((p, i) => {
    const o = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.60, 96), new THREE.MeshBasicMaterial({ map: face(p), transparent: true }));
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.60, 0.645, 96), new THREE.MeshBasicMaterial({ color: 0xc5a45a, transparent: true }));
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.645, 0.82, 96), new THREE.MeshBasicMaterial({ color: 0x8a5cc5, transparent: true, opacity: 0.0 }));
    o.add(disc, rim, halo); o.userData = { i, disc, rim, halo }; group.add(o);
    return o;
  });
  let angle = 0, target = 0, vel = 0, drag = null, alpha = 0, lastFront = -1;
  if (q.has('ring')) target = angle = -Number(q.get('ring')) * step;
  const front = () => ((Math.round(-target / step) % N) + N) % N;
  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight; cam.fov = innerWidth / innerHeight < 1 ? 52 : 32; cam.updateProjectionMatrix();
    group.position.set(innerWidth / innerHeight < 1 ? 0 : 0.35, 0.35, 0);
  }
  function setFront(i) {
    const p = PROJECTS[i];
    $('.front-n').textContent = `${pad(i + 1, 2)} / ${pad(N, 2)}`; $('.front-kind').textContent = `${p.kind} · ${p.year}`;
    $('.front-title').textContent = p.title; $('.front-open').dataset.open = p.key;
  }
  function to(i) { const cur = Math.round(-target / step); let d = ((i - cur) % N + N) % N; if (d > N / 2) d -= N; target = -(cur + d) * step; }
  const v = new THREE.Vector3();
  function placeLabel() {
    const o = items[front()]; o.getWorldPosition(v); v.y -= 0.82; v.project(cam);
    const fe = $('.front');
    if (!phone.matches) { fe.style.setProperty('--fx', `${(v.x * 0.5 + 0.5) * 100}%`); fe.style.setProperty('--fy', `${(-v.y * 0.5 + 0.5) * 100}%`); }
  }
  let last = performance.now();
  function show(a, now) {
    alpha += ((a > 0.5 ? 1 : a * 2) - alpha) * 0.2;
    el.style.opacity = alpha.toFixed(3); el.classList.toggle('live', a > 0.6);
    if (alpha < 0.01) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) {
      if (Math.abs(vel) > 0.0004 && !calm) { target += vel; vel *= 0.92; if (Math.abs(vel) < 0.002) { to(front()); vel = 0; } }
      angle += (target - angle) * (calm ? 1 : 0.12);
    } else angle = target;
    items.forEach((o, i) => {
      const th = angle + i * step, x = Math.sin(th) * R, z = Math.cos(th) * R;
      o.position.set(x, Math.sin(th * 1 + now / 1600) * 0.05, z);
      o.quaternion.copy(cam.quaternion);
      const f = (z / R + 1) / 2;                       // 1 at the front, 0 at the back
      o.scale.setScalar(0.75 + 0.45 * f ** 2);
      o.userData.disc.material.opacity = 0.28 + 0.72 * f ** 1.5;
      o.userData.rim.material.opacity = 0.35 + 0.65 * f;
      o.userData.halo.material.opacity = 0.18 * f ** 4;
      o.renderOrder = Math.round(f * 100);
    });
    const fi = front(); if (fi !== lastFront) { lastFront = fi; setFront(fi); }
    renderer.render(scene, cam); placeLabel();
  }
  // hold and drag (left button, pen or a sideways swipe); a tap on an object brings it round, a tap on the front one opens it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  el.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; drag = { x: e.clientX, x0: e.clientX, t: performance.now(), id: e.pointerId }; vel = 0; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX;
    target += dx * 0.0065; vel = dx * 0.0065;
  });
  const up = (e) => {
    if (!drag) return; el.classList.remove('dragging');
    const moved = Math.abs(e.clientX - drag.x0); drag = null;
    if (moved < 6) {
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(items.map((o) => o.userData.disc))[0];
      if (hit) { const i = items.findIndex((o) => o.userData.disc === hit.object); if (i === front()) openProject(PROJECTS[i].key, $('.front-open')); else to(i); }
      vel = 0;
    } else if (Math.abs(vel) < 0.002 || calm) { to(front()); vel = 0; }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  addEventListener('keydown', (e) => {
    if (!el.classList.contains('live') || open || !$('.list').hidden) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); to((front() + 1) % N); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); to((front() - 1 + N) % N); }
  });
  resize(); setFront(front());
  return { resize, show, to, front };
})();

// ---------------------------------------------------------------- opening a project over the ring
const sheet = $('.sheet'), sheetBody = $('.sheet-body'), articles = $$('.project'), pagerB = $('.pager b'), list = $('.list');
let open = null, opener = null, pin = null;
function openProject(key, from) {
  if (key && from) opener = from;
  const was = open; open = key; document.body.classList.toggle('open', !!key);
  if (key) {
    ring.to(WORKS.indexOf(key));
    pin = startOf.works + HOLD.works * 0.5; cur = pin;
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
  if (open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); stepP(e.key === 'ArrowRight' ? 1 : -1); }
});

// ---- a few motes
const motes = $('.motes'), mctx = motes.getContext('2d');
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const dust = Array.from({ length: 36 }, (_, i) => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, vx: (rnd() - 0.5) * 0.006, vy: -0.002 - rnd() * 0.005, warm: i % 5 === 2 }));
let lastY = scrollY, lastT = performance.now();
function drawDust(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; const dy = (scrollY - lastY) / innerHeight; lastY = scrollY;
  if (motes.width !== canvas.width || motes.height !== canvas.height) { motes.width = canvas.width; motes.height = canvas.height; }
  mctx.clearRect(0, 0, motes.width, motes.height);
  for (const p of dust) {
    if (!calm) { p.x += p.vx * dt * p.z; p.y += p.vy * dt * p.z - dy * 0.22 * p.z; }
    p.x = (p.x + 1) % 1; p.y = (p.y + 1) % 1;
    mctx.globalAlpha = (p.warm ? 0.7 : 0.3) * (0.35 + p.z * 0.65); mctx.fillStyle = p.warm ? '#c5a45a' : '#8a5cc5';
    mctx.beginPath(); mctx.arc((p.x * cw - mouse.sx * 14 * p.z) * dpr, (p.y * ch - mouse.sy * 10 * p.z) * dpr, (0.5 + p.z * 1.4) * dpr, 0, Math.PI * 2); mctx.fill();
  }
}

// ---- run
const held = q.has('p') ? Number(q.get('p')) * T : null;
let cur = held ?? scrollY / innerHeight;
size(); addEventListener('resize', size);
addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
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
