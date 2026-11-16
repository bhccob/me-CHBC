// LAB ONLY (throwaway). Round 68: turns the sculpture with the pointer by crossfading 17 pre-rendered orbit frames
// (-8° to +8° round the sculpture) on a canvas over the static plate. Desktop only; off under reduced motion.
(() => {
  const q = new URLSearchParams(location.search);
  const fv = document.querySelector('.fv');
  if (q.has('still')) fv.classList.add('still');

  const N = 17, MID = (N - 1) / 2;
  const canvas = document.querySelector('.orbit');
  const ctx = canvas.getContext('2d');
  const desk = matchMedia('(min-width: 768px), (orientation: landscape)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const hold = q.has('f') ? Math.max(0, Math.min(N - 1, Number(q.get('f')))) : null;

  const frames = Array.from({ length: N }, (_, i) => {
    const img = new Image();
    img.src = `/proof-out/lab/mock/r68/r68-desk-${String(i).padStart(2, '0')}.jpg`;
    img.ok = false;
    img.decode().then(() => { img.ok = true; if (frames.every((f) => f.ok)) { start(); window.__ready = true; } }).catch(() => {});
    return img;
  });

  let f = hold ?? MID, target = f, running = false;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    draw(true);
  }

  function cover(img, alpha) {
    const cw = canvas.width, ch = canvas.height, s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  let last = -1;
  function draw(force) {
    if (!running) return;
    if (!force && Math.abs(f - last) < 0.002) return;
    last = f;
    const i = Math.floor(f), t = f - i;
    cover(frames[i], 1);
    if (t > 0.002 && i + 1 < N) cover(frames[i + 1], t);
    ctx.globalAlpha = 1;
  }

  function tick() {
    f += (target - f) * 0.07;
    if (Math.abs(target - f) < 0.001) f = target;
    draw(false);
    requestAnimationFrame(tick);
  }

  function start() {
    if (!desk.matches || (calm.matches && hold === null)) return;
    running = true; size(); canvas.classList.add('on');
    requestAnimationFrame(tick);
  }

  addEventListener('resize', size);
  addEventListener('pointermove', (e) => {
    if (hold !== null || calm.matches || e.pointerType === 'touch') return;
    target = Math.max(0, Math.min(N - 1, MID + (e.clientX / innerWidth - 0.5) * 2 * MID));
  });
  document.documentElement.addEventListener('pointerleave', () => { if (hold === null) target = MID; });
})();
