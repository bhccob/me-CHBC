// LAB ONLY (throwaway). Round 71, "Digital DNA: Inside the Living Machine". Scroll scrubs one rendered camera move
// through the machine; each stop's words show while the camera rests there. The first view turns a little by itself and
// under the pointer. Opening a project keeps the camera at its installation and gives the left half to a readable page.
// Lengths are in screen heights.
(async () => {
  const q = new URLSearchParams(location.search);
  const DIR = '/proof-out/lab/mock/' + (q.get('dir') ?? 'r71');
  const json = (u) => fetch(u).then((r) => r.json());
  const [info, spin, lay] = await Promise.all([json(`${DIR}/seq/frames.json`), json(`${DIR}/spin/spin.json`).catch(() => ({ count: 0 })), json(`${DIR}/layout.json`)]);
  const WORKS = ['jontai', 'lumo', 'locked', 'cookies'];
  const ORDER = ['hero', 'origin', 'foundation', 'development', 'works', ...WORKS.map((k) => `w-${k}`), 'identity', 'connection'];
  const HOLD = { hero: 0.5, origin: 0.9, foundation: 1.2, development: 1.3, works: 0.9, identity: 1.0, connection: 0.9 };
  WORKS.forEach((k) => (HOLD[`w-${k}`] = 0.9));
  const MOVE = [0.8, 1.4, 1.6, 0.8, 0.7, 0.8, 0.8, 0.8, 1.3, 1.1];
  const CHAPTER = { origin: 'origin', foundation: 'foundation', development: 'development', works: 'works', identity: 'identity', connection: 'connection' };
  WORKS.forEach((k) => (CHAPTER[`w-${k}`] = 'works'));
  // where the subject sits across the frame at each stop (for the crop on narrow screens)
  const FOCUS = { hero: 0.5, origin: 0.6, foundation: 0.5, development: 0.5, works: 0.5, identity: 0.62, connection: 0.6 };
  WORKS.forEach((k) => (FOCUS[`w-${k}`] = lay.installations?.[k]?.c?.[0] ?? 0.62));

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
  const scrim = $('.scrim'), chapters = $('.chapters'), say = $('.say');
  const sysBtns = $$('.systems button'), tags = $$('.tags a');
  const sheet = $('.sheet'), sheetBody = $('.sheet-body'), articles = $$('.project'), pagerB = $('.pager b');
  const list = $('.list');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = matchMedia('(max-aspect-ratio: 1/1)');
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

  // ---- pictures
  // pictures are asked for in order, the first stretch before the rest, so the first impression never waits on the end
  const img = (src, go = true) => { const im = new Image(); im.dataset.src = src; if (go) im.src = src; return im; };
  const pad = (n, w) => String(n).padStart(w, '0');
  const MID = Math.max(0, (spin.count - 1) / 2);
  const firstN = info.stops.foundation + 1;
  const spins = Array.from({ length: spin.count }, (_, i) => img(`${DIR}/spin/s${pad(i, 2)}.jpg`));
  const frames = Array.from({ length: info.count }, (_, i) => (i === 0 && spins.length ? spins[MID] : img(`${DIR}/seq/f${pad(i, 3)}.jpg`, i < firstN)));
  const hovers = sysBtns.map((_, k) => img(`${DIR}/hover/h${k}.jpg`, false));
  const tall = img(`${DIR}/phone-hero.jpg`);
  const first = [...new Set([...spins, ...frames.slice(0, firstN)])];
  const all = [...new Set([...spins, ...frames, ...hovers])]; let loaded = 0;
  const count = $('.loader b');
  const wait = (im) => im.decode().catch(() => {}).then(() => { count.textContent = Math.round((++loaded / all.length) * 100); });
  await Promise.all(first.map(wait));
  document.body.classList.remove('loading');
  (async () => {                                    // the rest, eight at a time, in the order the journey needs them
    const rest = [...frames.slice(firstN), ...hovers].filter((im) => !im.src);
    for (let i = 0; i < rest.length; i += 8) {
      const batch = rest.slice(i, i + 8); batch.forEach((im) => (im.src = im.dataset.src));
      await Promise.all(batch.map(wait));
    }
  })();

  // ---- state
  let cw = 0, ch = 0, dpr = 1, sig = '';
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let sys = -1, pinned = q.has('sys') ? Number(q.get('sys')) : -1, open = null, pin = null;
  const hoverA = sysBtns.map(() => 0);
  const held = q.has('p') ? Number(q.get('p')) * T : null;
  const heldTurn = q.has('a') ? Number(q.get('a')) : null;
  let cur = held ?? scrollY / innerHeight;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); cw = innerWidth; ch = innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); sig = '';
    ctx.fillStyle = '#100b19'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    place();
  }
  // the frame's cover crop, in CSS pixels; on wide screens it never loses more than 6% a side or 10% top and bottom
  function crop(fx) {
    let s = Math.max(cw / 16, ch / 9);
    if (!phone.matches) s = Math.min(s, cw / (0.88 * 16), ch / (0.80 * 9));
    const w = 16 * s, h = 9 * s;
    return { x: w >= cw ? Math.min(0, Math.max(cw - w, cw / 2 - fx * w)) : (cw - w) / 2, y: (ch - h) / 2, w, h };
  }
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
    if (!im || !im.complete || !im.naturalWidth || alpha <= 0.001) return false;
    const c = crop(fx); ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(im, c.x * dpr, c.y * dpr, c.w * dpr, c.h * dpr); return true;
  }
  function drawTall(alpha) {
    if (!tall.naturalWidth || alpha <= 0.001) return;
    const s = Math.max(cw / tall.naturalWidth, ch / tall.naturalHeight), w = tall.naturalWidth * s, h = tall.naturalHeight * s;
    ctx.globalAlpha = Math.min(1, alpha); ctx.drawImage(tall, ((cw - w) / 2) * dpr, ((ch - h) / 2) * dpr, w * dpr, h * dpr);
  }
  // a frame still loading falls back to the nearest one that has
  function nearest(list, i) {
    for (let d = 0; d < list.length; d++) for (const j of [i - d, i + d]) if (list[j]?.complete && list[j].naturalWidth) return list[j];
    return null;
  }
  function blend(list, f, fx) {
    const i = Math.floor(clamp(f, 0, list.length - 1)), k = f - i;
    if (!draw(list[i], 1, fx)) draw(nearest(list, i), 1, fx);
    if (k > 0.002 && list[i + 1]) draw(list[i + 1], k, fx);
  }

  // names over the six systems and the four installations, from the render's own coordinates
  function place() {
    if (phone.matches) { [...sysBtns, ...tags].forEach((b) => b.removeAttribute('style')); return; }
    let c = crop(FOCUS.development);
    sysBtns.forEach((b, k) => {
      const p = lay.systems[k].top;
      b.style.setProperty('--x', `${c.x + p[0] * c.w}px`); b.style.setProperty('--y', `${c.y + p[1] * c.h - 6}px`);
    });
    c = crop(FOCUS.works);
    tags.forEach((a) => {
      const p = lay.works[a.dataset.tag].top;
      a.style.setProperty('--x', `${c.x + p[0] * c.w}px`); a.style.setProperty('--y', `${c.y + p[1] * c.h - 4}px`);
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

    // the first view's slow turn, nudged by the pointer, settling to the middle frame as the scroll begins
    let turn = null;
    if (spins.length && seg.kind === 'hold' && seg.i === 0) {
      const amount = clamp(1 - u / (HOLD.hero * 0.7));
      const idle = calm ? 0 : Math.sin((now / 1000) * (Math.PI * 2 / 30)) * 0.75;
      const a = heldTurn ?? clamp(idle + (calm ? 0 : mouse.sx * 0.3), -1, 1) * amount;
      turn = MID + a * MID;
    }
    const dev = pres.development ?? 0;
    sysBtns.forEach((_, k) => { const want = (sys === k || (sys < 0 && pinned === k)) && dev > 0.5 ? 1 : 0; hoverA[k] += (want - hoverA[k]) * (calm ? 1 : 0.14); if (Math.abs(want - hoverA[k]) < 0.004) hoverA[k] = want; });

    const tallA = phone.matches && tall.naturalWidth ? (seg.i === 0 ? (seg.kind === 'hold' ? 1 : clamp(1 - t / 0.35)) : 0) : 0;
    if (tallA > 0) turn = null;
    const s = `${tallA.toFixed(3)}|${f.toFixed(3)}|${turn === null ? '' : turn.toFixed(3)}|${hoverA.map((v) => v.toFixed(3))}|${fx.toFixed(3)}|${loaded}`;
    if (s !== sig) {
      sig = s; ctx.globalAlpha = 1;
      if (turn !== null) blend(spins, turn, fx); else blend(frames, f, fx);
      hoverA.forEach((a, k) => draw(hovers[k], a, fx));
      drawTall(tallA);
      if (!phone.matches) feather(fx);
      ctx.globalAlpha = 1;
    }

    let side = 0, corner = 0;
    for (const [name, el] of Object.entries(beats)) {
      const a = pres[name] ?? 0;
      el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * 14}px)`;
      el.classList.toggle('live', a > 0.01);
      if (el.classList.contains('col')) side = Math.max(side, a);
      if (el.classList.contains('free') && (phone.matches || !el.classList.contains('top'))) corner = Math.max(corner, a);
    }
    scrim.style.setProperty('--side', open ? 1 : side); scrim.style.setProperty('--corner', open ? 0 : corner);
    chapters.style.setProperty('--progress', (u / T).toFixed(4));
    const chap = CHAPTER[at];
    $$('a', chapters).forEach((a) => { if (a.dataset.ch === chap) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
  }

  // ---- 03: light a system by pointing at it; selecting it keeps it lit and keeps its line of text
  function saySys() {
    const k = sys >= 0 ? sys : pinned;
    say.textContent = k >= 0 ? sysBtns[k].dataset.text : say.dataset.idle;
    say.classList.toggle('lit', k >= 0);
    sysBtns.forEach((b, i) => { b.classList.toggle('on', i === k); b.setAttribute('aria-pressed', String(i === pinned)); });
  }
  sysBtns.forEach((b, k) => {
    b.addEventListener('pointerenter', () => { sys = k; saySys(); });
    b.addEventListener('pointerleave', () => { sys = -1; saySys(); });
    b.addEventListener('focus', () => { sys = k; saySys(); });
    b.addEventListener('blur', () => { sys = -1; saySys(); });
    b.addEventListener('click', () => { pinned = pinned === k ? -1 : k; saySys(); });
  });
  saySys();

  // ---- 04: a project opens where its installation stands; the page under it holds still until it closes
  let opener = null;
  const stopAt = (name) => (startOf[name] + HOLD[name] * 0.5);
  function setOpen(key, from) {
    if (key && from) opener = from;
    open = key; document.body.classList.toggle('open', !!key);
    if (key) {
      pin = stopAt(`w-${key}`); if (calm || Math.abs(pin - cur) > 2.5) cur = pin;     // far away: cut, do not fly
      document.documentElement.style.overflow = 'hidden';
      sheet.hidden = false;
      articles.forEach((a) => (a.hidden = a.dataset.project !== key));
      pagerB.textContent = `${pad(WORKS.indexOf(key) + 1, 2)} / ${pad(WORKS.length, 2)}`;
      sheetBody.scrollTop = 0;
      requestAnimationFrame(() => sheetBody.focus({ preventScroll: true }));
    } else {
      const back = pin; pin = null;
      document.documentElement.style.overflow = '';
      if (back !== null) scrollTo({ top: back * innerHeight, behavior: 'auto' });
      setTimeout(() => { if (!open) sheet.hidden = true; }, calm ? 0 : 450);
      opener?.focus({ preventScroll: true });
    }
  }
  const step = (d) => { const i = (WORKS.indexOf(open) + d + WORKS.length) % WORKS.length; setOpen(WORKS[i]); };
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => { closeList(); setOpen(b.dataset.open, b); }));
  $('.back').addEventListener('click', () => setOpen(null));
  $('.prev').addEventListener('click', () => step(-1));
  $('.next').addEventListener('click', () => step(1));

  function openList(from) { opener = from; list.hidden = false; $('.list-close').focus(); }
  function closeList() { if (!list.hidden) { list.hidden = true; } }
  $('[data-list]').addEventListener('click', (e) => openList(e.currentTarget));
  $('.list-close').addEventListener('click', () => { closeList(); opener?.focus(); });
  list.addEventListener('click', (e) => { if (e.target === list) { closeList(); opener?.focus(); } });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!list.hidden) { closeList(); opener?.focus(); } else if (open) setOpen(null); }
    if (open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
  });
  if (q.has('open')) setOpen(q.get('open'));
  if (q.has('list')) openList(null);

  // ---- a few motes of dust drifting over everything, nearer ones larger and faster
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
    const want = pin ?? held ?? scrollY / innerHeight;
    cur += (want - cur) * (calm || held !== null ? 1 : 0.1);
    if (Math.abs(want - cur) < 0.0005) cur = want;
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    render(cur, now ?? performance.now()); drawDust(now ?? performance.now()); requestAnimationFrame(tick);
  })();
  window.__ready = true;
  window.__T = T; window.__startOf = startOf; window.__HOLD = HOLD;

  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); if (open) setOpen(null); closeList();
    scrollTo({ top: (startOf[a.dataset.go] + HOLD[a.dataset.go] * 0.4) * innerHeight, behavior: calm ? 'auto' : 'smooth' });
  }));
})();
