// LAB ONLY (throwaway). Round 69: scroll scrubs one rendered camera move round the sculpture; each page's words show
// while the camera rests at its stop. Lengths are in screen heights.
(async () => {
  const q = new URLSearchParams(location.search);
  const DIR = '/proof-out/lab/mock/r69/seq';
  const info = await (await fetch(`${DIR}/frames.json`)).json();
  const ORDER = ['first', 'about', 'soft', 'game', 'sec', 'mech', 'work', 'talk'];
  const HOLD = { first: 0.45, about: 0.9, soft: 0.7, game: 0.7, sec: 0.7, mech: 0.7, work: 2.6, talk: 0.9 };
  const MOVE = [1.0, 0.6, 0.6, 0.6, 0.6, 1.0, 1.0];
  // where the subject sits across the frame at each stop (for the crop on tall screens)
  const FOCUS = { first: 0.5, about: 0.7, soft: 0.68, game: 0.68, sec: 0.68, mech: 0.68, work: 0.72, talk: 0.7 };

  // the timeline: hold, move, hold, ...
  const segs = []; let T = 0;
  ORDER.forEach((name, i) => {
    segs.push({ kind: 'hold', i, from: T, len: HOLD[name] }); T += HOLD[name];
    if (i < MOVE.length) { segs.push({ kind: 'move', i, from: T, len: MOVE[i] }); T += MOVE[i]; }
  });
  const startOf = Object.fromEntries(segs.filter((s) => s.kind === 'hold').map((s) => [ORDER[s.i], s.from]));
  document.querySelector('.runway').style.height = `${(T + 1) * 100}vh`;

  const canvas = document.querySelector('.film'), ctx = canvas.getContext('2d');
  const beats = Object.fromEntries([...document.querySelectorAll('.beat')].map((el) => [el.dataset.beat, el]));
  const scrim = document.querySelector('.scrim'), studies = document.querySelector('.studies'), track = document.querySelector('.track');
  const frames = Array.from({ length: info.count }, (_, i) => { const im = new Image(); im.src = `${DIR}/f${String(i).padStart(3, '0')}.jpg`; return im; });
  await Promise.all(frames.map((im) => im.decode().catch(() => {})));

  function size() { const d = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(innerWidth * d); canvas.height = Math.round(innerHeight * d); last = -1; }
  function cover(im, alpha, fx) {
    if (!im.naturalWidth) return;
    const cw = canvas.width, ch = canvas.height, s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    const x = Math.min(0, Math.max(cw - w, cw / 2 - fx * w));
    ctx.globalAlpha = alpha; ctx.drawImage(im, x, (ch - h) / 2, w, h);
  }
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const stopFrame = (i) => info.stops[ORDER[i]];

  let last = -1;
  function render(u) {
    u = Math.max(0, Math.min(T, u));
    const seg = segs.findLast((s) => u >= s.from) ?? segs[0];
    const t = seg.len ? clamp((u - seg.from) / seg.len) : 0;
    const pres = {}; let f, fx, workT = 0;
    if (seg.kind === 'hold') { pres[ORDER[seg.i]] = 1; f = stopFrame(seg.i); fx = FOCUS[ORDER[seg.i]]; }
    else {
      pres[ORDER[seg.i]] = clamp(1 - t / 0.3); pres[ORDER[seg.i + 1]] = clamp((t - 0.7) / 0.3);
      f = stopFrame(seg.i) + (stopFrame(seg.i + 1) - stopFrame(seg.i)) * t;
      fx = FOCUS[ORDER[seg.i]] + (FOCUS[ORDER[seg.i + 1]] - FOCUS[ORDER[seg.i]]) * t;
    }
    if (u >= startOf.work) workT = clamp((u - startOf.work) / HOLD.work);
    if (Math.abs(f - last) > 0.002) {
      last = f; const i = Math.floor(f), k = f - i;
      cover(frames[i], 1, fx); if (k > 0.002 && frames[i + 1]) cover(frames[i + 1], k, fx);
      ctx.globalAlpha = 1;
    }
    let side = 0, study = 0;
    for (const [name, el] of Object.entries(beats)) {
      const a = pres[name] ?? 0;
      el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * 18}px)`;
      el.classList.toggle('live', a > 0.01);
      if (name !== 'first' && name !== 'work') side = Math.max(side, a);
      if (['soft', 'game', 'sec', 'mech'].includes(name)) study = Math.max(study, a);
      if (a > 0.5) studies.querySelectorAll('li').forEach((li) => li.classList.toggle('on', li.dataset.s === name));
    }
    scrim.style.opacity = side; studies.style.opacity = study;
    const room = track.scrollWidth - (innerWidth - 2 * parseFloat(getComputedStyle(track.parentElement).paddingLeft));
    track.style.transform = `translateX(${-Math.max(0, room) * workT}px)`;
  }

  size(); addEventListener('resize', () => { size(); });
  const held = q.has('p') ? Number(q.get('p')) * T : null;
  let cur = held ?? scrollY / innerHeight;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function tick() {
    const want = held ?? scrollY / innerHeight;
    cur += (want - cur) * (calm || held !== null ? 1 : 0.1);
    if (Math.abs(want - cur) < 0.0005) cur = want;
    render(cur); requestAnimationFrame(tick);
  })();
  window.__ready = true;

  document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); scrollTo({ top: (startOf[a.dataset.go] + 0.05) * innerHeight, behavior: calm ? 'auto' : 'smooth' });
  }));
  // panes lean toward the pointer
  document.querySelectorAll('.pane').forEach((p) => {
    p.addEventListener('pointermove', (e) => {
      const r = p.getBoundingClientRect();
      p.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 7}deg`);
      p.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 5}deg`);
    });
    p.addEventListener('pointerleave', () => { p.style.setProperty('--ry', '0deg'); p.style.setProperty('--rx', '0deg'); });
  });
})();
