// LAB ONLY (throwaway). Round 64: the first view's motion. Scroll eases a 0..1 value (never raw scroll per frame) that
// moves the camera in, opens the instrument (cross-fade to the open still) and lifts the words away. The pointer adds a
// few pixels of parallax. ?still skips the intro animation (for stills); ?f=2 pins the open state.
const root = document.documentElement;
const body = document.body;
const q = new URLSearchParams(location.search);
const still = q.has('still');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still) body.classList.add('still');

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => v * v * (3 - 2 * v);
const fixed = q.get('f') === '2' ? 1 : 0;

let p = fixed;
let px = 0, py = 0, tx = 0, ty = 0;

addEventListener('pointermove', (e) => {
  if (reduce || still || e.pointerType === 'touch') return;
  tx = (e.clientX / innerWidth - 0.5) * -14;
  ty = (e.clientY / innerHeight - 0.5) * -8;
});

// calibration read-out: counts up once, as if the instrument were zeroing itself, then follows the scroll
const out = document.querySelector('[data-read]');
const target = Number(out?.dataset.read ?? 0);
const unit = out?.dataset.unit ?? '°';
const born = performance.now();
const fmt = (v) => (unit === '°' ? v.toFixed(1).padStart(5, '0') + '°' : v.toFixed(3) + ' ' + unit);

function tick(now) {
  const goal = q.has('f') ? fixed : clamp(scrollY / (innerHeight * 0.9));
  p += (goal - p) * (reduce || still ? 1 : 0.085);
  px += (tx - px) * 0.06;
  py += (ty - py) * 0.06;
  root.style.setProperty('--p', p.toFixed(4));
  root.style.setProperty('--open', smooth(clamp((p - 0.12) / 0.66)).toFixed(4));
  root.style.setProperty('--px', `${px.toFixed(2)}px`);
  root.style.setProperty('--py', `${py.toFixed(2)}px`);
  if (out) {
    const intro = still || reduce ? 1 : smooth(clamp((now - born - 900) / 1500));
    out.textContent = fmt(target * intro + p * (unit === '°' ? 41.5 : 0.32));
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]).then(() => {
  window.__ready = true;
  root.dataset.ready = '';
});
