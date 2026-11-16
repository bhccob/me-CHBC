// LAB ONLY (throwaway). Round 70, "Digital DNA". Scroll scrubs one rendered camera move along the structure; each
// chapter's words show while the camera rests at its stop. The first view turns by itself and under the pointer, and
// settles to its middle frame as scrolling starts, so the move begins from the same picture. Lengths are in screen heights.
(async () => {
  const q = new URLSearchParams(location.search);
  const DIR = '/proof-out/lab/mock/' + (q.get('dir') ?? 'r70');      // ?dir= points at another render set
  const json = (u) => fetch(u).then((r) => r.json());
  const [info, spin, lay] = await Promise.all([json(`${DIR}/seq/frames.json`), json(`${DIR}/spin/spin.json`), json(`${DIR}/layout.json`)]);
  const ORDER = ['hero', 'origin', 'foundation', 'development', 'experiments', 'identity', 'connection'];
  const HOLD = { hero: 0.5, origin: 0.9, foundation: 1.1, development: 1.3, experiments: 1.3, identity: 0.9, connection: 0.9 };
  const MOVE = [1.0, 1.2, 0.8, 0.8, 1.0, 1.0];
  // where the subject sits across the frame at each stop (for the crop on tall screens)
  const FOCUS = { hero: 0.5, origin: 0.62, foundation: 0.66, development: 0.54, experiments: 0.5, identity: 0.58, connection: 0.68 };
  const SLIDES = ['jontai', 'lumo', 'cookies', 'locked'];

  // the timeline: hold, move, hold, ...
  const segs = []; let T = 0;
  ORDER.forEach((name, i) => {
    segs.push({ kind: 'hold', i, from: T, len: HOLD[name] }); T += HOLD[name];
    if (i < MOVE.length) { segs.push({ kind: 'move', i, from: T, len: MOVE[i] }); T += MOVE[i]; }
  });
  const startOf = Object.fromEntries(segs.filter((s) => s.kind === 'hold').map((s) => [ORDER[s.i], s.from]));
  document.querySelector('.runway').style.height = `${(T + 1) * 100}vh`;

  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const canvas = $('.film'), ctx = canvas.getContext('2d');
  const beats = Object.fromEntries($$('.beat').map((el) => [el.dataset.beat, el]));
  const scrim = $('.scrim'), chapters = $('.chapters'), seqText = $('.seq');
  const armBtns = $$('.arms button'), slideBtns = $$('.slides button'), details = $$('.detail'), closeBtn = $('.close');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = matchMedia('(max-aspect-ratio: 1/1)');
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

  // ---- pictures
  const img = (src) => { const im = new Image(); im.src = src; return im; };
  const pad = (n, w) => String(n).padStart(w, '0');
  const MID = (spin.count - 1) / 2;
  const spins = Array.from({ length: spin.count }, (_, i) => img(`${DIR}/spin/s${pad(i, 2)}.jpg`));
  const frames = Array.from({ length: info.count }, (_, i) => (i === 0 ? spins[MID] : img(`${DIR}/seq/f${pad(i, 3)}.jpg`)));
  const hovers = armBtns.map((_, k) => img(`${DIR}/hover/h${k}.jpg`));
  const closes = Object.fromEntries(SLIDES.map((k) => [k, img(`${DIR}/close/c-${k}.jpg`)]));
  const tall = img(`${DIR}/phone-hero.jpg`);          // a phone's own first view: the title stacked, no turn
  const all = [...new Set([...spins, ...frames])]; let loaded = 0;
  const count = $('.loader b');
  await Promise.all(all.map((im) => im.decode().catch(() => {}).then(() => { count.textContent = Math.round((++loaded / all.length) * 100); })));
  document.body.classList.remove('loading');

  // ---- state
  let cw = 0, ch = 0, dpr = 1, sig = '';
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let arm = -1, pinned = q.has('arm') ? Number(q.get('arm')) : -1, open = null;
  const hoverA = armBtns.map(() => 0), closeA = Object.fromEntries(SLIDES.map((k) => [k, 0]));
  const held = q.has('p') ? Number(q.get('p')) * T : null;
  const heldTurn = q.has('a') ? Number(q.get('a')) : null;
  let cur = held ?? scrollY / innerHeight, fxNow = 0.5;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); cw = innerWidth; ch = innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); sig = '';
    ctx.fillStyle = '#100b19'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    place();
  }
  // the frame's cover crop, in CSS pixels: where a point of the 16:9 render lands on screen
  // (a landscape screen never loses more than 6% a side or 10% top and bottom: see --plate-w in r70.css)
  function crop(fx) {
    let s = Math.max(cw / 16, ch / 9);
    if (!phone.matches) s = Math.min(s, cw / (0.88 * 16), ch / (0.80 * 9));
    const w = 16 * s, h = 9 * s;
    return { x: w >= cw ? Math.min(0, Math.max(cw - w, cw / 2 - fx * w)) : (cw - w) / 2, y: (ch - h) / 2, w, h };
  }
  // where the plate stops short of the screen, its edge fades into the ground colour
  function feather(fx) {
    const c = crop(fx), G = '16, 11, 25';
    const band = (x0, y0, x1, y1, w, h, x, y) => {
      const g = ctx.createLinearGradient(x0 * dpr, y0 * dpr, x1 * dpr, y1 * dpr);
      g.addColorStop(0, `rgba(${G}, 1)`); g.addColorStop(1, `rgba(${G}, 0)`);
      ctx.fillStyle = g; ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
    };
    ctx.globalAlpha = 1;
    if (c.h < ch - 1) { const d = c.h * 0.12; band(0, c.y, 0, c.y + d, cw, d + 1, 0, c.y - 1); band(0, c.y + c.h, 0, c.y + c.h - d, cw, d + 1, 0, c.y + c.h - d); }
    if (c.w < cw - 1) { const d = c.w * 0.10; band(c.x, 0, c.x + d, 0, d + 1, ch, c.x - 1, 0); band(c.x + c.w, 0, c.x + c.w - d, 0, d + 1, ch, c.x + c.w - d, 0); }
  }
  function draw(im, alpha, fx) {
    if (!im || !im.naturalWidth || alpha <= 0.001) return;
    const c = crop(fx); ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(im, c.x * dpr, c.y * dpr, c.w * dpr, c.h * dpr);
  }
  function drawTall(alpha) {
    if (!tall.naturalWidth || alpha <= 0.001) return;
    const s = Math.max(cw / tall.naturalWidth, ch / tall.naturalHeight), w = tall.naturalWidth * s, h = tall.naturalHeight * s;
    ctx.globalAlpha = Math.min(1, alpha); ctx.drawImage(tall, ((cw - w) / 2) * dpr, ((ch - h) / 2) * dpr, w * dpr, h * dpr);
  }
  function blend(list, f, fx) {
    const i = Math.floor(clamp(f, 0, list.length - 1)), k = f - i;
    draw(list[i], 1, fx); if (k > 0.002 && list[i + 1]) draw(list[i + 1], k, fx);
  }

  // names beside the six nodes and buttons over the four slides, from the render's own coordinates
  function place() {
    if (phone.matches) { [...armBtns, ...slideBtns].forEach((b) => b.removeAttribute('style')); return; }
    let c = crop(FOCUS.development);
    armBtns.forEach((b, k) => {
      const a = lay.arms[k], left = a.tip[0] < a.base[0], r = 0.062 * c.h + 6;
      b.classList.toggle('left', left);
      b.style.setProperty('--x', `${c.x + a.tip[0] * c.w + (left ? -r : r)}px`);
      b.style.setProperty('--y', `${c.y + a.tip[1] * c.h}px`);
    });
    c = crop(FOCUS.experiments);
    slideBtns.forEach((b) => {
      const s = lay.slides[b.dataset.slide];
      b.style.setProperty('--x', `${c.x + s.tl[0] * c.w}px`); b.style.setProperty('--y', `${c.y + s.tl[1] * c.h}px`);
      b.style.setProperty('--w', `${(s.br[0] - s.tl[0]) * c.w}px`); b.style.setProperty('--h', `${(s.br[1] - s.tl[1]) * c.h}px`);
    });
  }

  const stopFrame = (i) => info.stops[ORDER[i]];
  function render(u, now) {
    u = clamp(u, 0, T);
    const seg = segs.findLast((s) => u >= s.from) ?? segs[0];
    const t = seg.len ? clamp((u - seg.from) / seg.len) : 0;
    const pres = {}; let f, fx, at = ORDER[seg.i];
    if (seg.kind === 'hold') { pres[at] = 1; f = stopFrame(seg.i); fx = FOCUS[at]; }
    else {
      const a = ORDER[seg.i], b = ORDER[seg.i + 1];
      pres[a] = clamp(1 - t / 0.28); pres[b] = clamp((t - 0.72) / 0.28);
      f = stopFrame(seg.i) + (stopFrame(seg.i + 1) - stopFrame(seg.i)) * t;
      fx = FOCUS[a] + (FOCUS[b] - FOCUS[a]) * t; if (t > 0.5) at = b;
    }
    fxNow = fx;

    // the first view's turn: slow on its own, nudged by the pointer, fading to the middle frame as the scroll begins
    let turn = null;
    if (seg.kind === 'hold' && seg.i === 0) {
      const amount = clamp(1 - u / (HOLD.hero * 0.7));
      const idle = calm ? 0 : Math.sin((now / 1000) * (Math.PI * 2 / 26)) * 0.78;
      const a = heldTurn ?? clamp(idle + (calm ? 0 : mouse.sx * 0.3), -1, 1) * amount;
      turn = MID + a * MID;
    }

    // the lit branch and the open project fade over the film
    const dev = pres.development ?? 0, exp = pres.experiments ?? 0;
    armBtns.forEach((_, k) => { const want = (arm === k || (arm < 0 && pinned === k)) && dev > 0.5 ? 1 : 0; hoverA[k] += (want - hoverA[k]) * (calm ? 1 : 0.14); if (Math.abs(want - hoverA[k]) < 0.004) hoverA[k] = want; });
    SLIDES.forEach((k) => { const want = open === k && exp > 0.5 ? 1 : 0; closeA[k] += (want - closeA[k]) * (calm ? 1 : 0.085); if (Math.abs(want - closeA[k]) < 0.004) closeA[k] = want; });

    // on a phone the first view is the tall plate; it gives way to the film over the first part of the first move
    const tallA = phone.matches && tall.naturalWidth ? (seg.i === 0 ? (seg.kind === 'hold' ? 1 : clamp(1 - t / 0.35)) : 0) : 0;
    if (tallA > 0) turn = null;
    fx += (0.72 - fx) * Math.max(...SLIDES.map((k) => closeA[k]));      // a close-up's slide sits right of centre
    const s = `${tallA.toFixed(3)}|${f.toFixed(3)}|${turn === null ? '' : turn.toFixed(3)}|${hoverA.map((v) => v.toFixed(3))}|${SLIDES.map((k) => closeA[k].toFixed(3))}|${fx.toFixed(3)}`;
    if (s !== sig) {
      sig = s; ctx.globalAlpha = 1;
      if (turn !== null) blend(spins, turn, fx); else blend(frames, f, fx);
      hoverA.forEach((a, k) => draw(hovers[k], a, fx));
      SLIDES.forEach((k) => draw(closes[k], closeA[k], fx));
      drawTall(tallA);
      if (!phone.matches) feather(fx);
      ctx.globalAlpha = 1;
    }

    let side = 0, corner = 0;
    for (const [name, el] of Object.entries(beats)) {
      const a = pres[name] ?? 0;
      el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * 16}px)`;
      el.classList.toggle('live', a > 0.01);
      if (el.classList.contains('col')) side = Math.max(side, a * (name === 'identity' ? 0.45 : 1));   // the far view keeps its whole length
      if (el.classList.contains('free')) corner = Math.max(corner, a);
    }
    const inside = Math.max(...SLIDES.map((k) => closeA[k]));
    scrim.style.setProperty('--side', Math.max(side, inside)); scrim.style.setProperty('--corner', corner * (1 - inside));
    chapters.style.setProperty('--progress', (u / T).toFixed(4));
    $$('a', chapters).forEach((a) => { if (a.dataset.go === at) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
  }

  // ---- 03: light a branch by pointing at it; selecting it keeps it lit and keeps its line of text
  function sayArm() {
    const k = arm >= 0 ? arm : pinned;
    seqText.textContent = k >= 0 ? armBtns[k].dataset.text : seqText.dataset.idle;
    seqText.classList.toggle('lit', k >= 0);
    armBtns.forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-pressed', String(i === pinned)); });
  }
  armBtns.forEach((b, k) => {
    b.addEventListener('pointerenter', () => { arm = k; sayArm(); });
    b.addEventListener('pointerleave', () => { arm = -1; sayArm(); });
    b.addEventListener('focus', () => { arm = k; sayArm(); });
    b.addEventListener('blur', () => { arm = -1; sayArm(); });
    b.addEventListener('click', () => { pinned = pinned === k ? -1 : k; sayArm(); });
  });
  sayArm();

  // ---- 04: opening a slide sends the camera to it; the page stays where it is until you come back
  let opener = null;
  function setOpen(key) {
    open = key; document.body.classList.toggle('open', !!key);
    document.documentElement.style.overflow = key ? 'hidden' : '';
    details.forEach((d) => { const on = d.dataset.detail === key; d.hidden = !on; requestAnimationFrame(() => d.classList.toggle('on', on)); });
    closeBtn.hidden = !key;
    if (key) closeBtn.focus({ preventScroll: true }); else opener?.focus({ preventScroll: true });
  }
  slideBtns.forEach((b) => b.addEventListener('click', () => { opener = b; setOpen(b.dataset.slide); }));
  closeBtn.addEventListener('click', () => setOpen(null));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(null); });
  if (q.has('open')) setOpen(q.get('open'));

  // ---- a few motes of dust drifting over everything, nearer ones larger and faster: depth without another render
  const motes = $('.motes'), mctx = motes.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const dust = Array.from({ length: 46 }, (_, i) => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, vx: (rnd() - 0.5) * 0.006, vy: -0.002 - rnd() * 0.005, warm: i % 12 === 5 }));
  let lastY = scrollY, lastT = performance.now();
  function drawDust(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const dy = (scrollY - lastY) / innerHeight; lastY = scrollY;
    if (motes.width !== canvas.width || motes.height !== canvas.height) { motes.width = canvas.width; motes.height = canvas.height; }
    mctx.clearRect(0, 0, motes.width, motes.height);
    for (const p of dust) {
      if (!calm) { p.x += p.vx * dt * p.z; p.y += p.vy * dt * p.z - dy * 0.22 * p.z; }
      p.x = (p.x + 1) % 1; p.y = (p.y + 1) % 1;
      const x = (p.x * cw - mouse.sx * 14 * p.z) * dpr, y = (p.y * ch - mouse.sy * 10 * p.z) * dpr, r = (0.5 + p.z * 1.5) * dpr;
      mctx.globalAlpha = (p.warm ? 0.75 : 0.34) * (0.35 + p.z * 0.65);
      mctx.fillStyle = p.warm ? '#f5d547' : '#bba0ff';
      mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
    }
  }

  // ---- run
  size(); addEventListener('resize', size); phone.addEventListener('change', () => { sig = ''; place(); });
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  (function tick(now) {
    const want = held ?? scrollY / innerHeight;
    cur += (want - cur) * (calm || held !== null ? 1 : 0.1);
    if (Math.abs(want - cur) < 0.0005) cur = want;
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    render(cur, now ?? performance.now()); drawDust(now ?? performance.now()); requestAnimationFrame(tick);
  })();
  window.__ready = true;

  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); if (open) setOpen(null);
    scrollTo({ top: (startOf[a.dataset.go] + 0.05) * innerHeight, behavior: calm ? 'auto' : 'smooth' });
  }));
})();
