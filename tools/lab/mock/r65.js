// LAB ONLY (throwaway). Round 65: scroll through three frames. An eased value follows the scroll; each frame's still
// fades in around its own screen, the section mark follows, and a frame's words come in when it is reached.
// ?f=2 opens on frame 2; ?still skips the fades (for stills). On Cutaway's works, the pointer is the cut.
const q = new URLSearchParams(location.search);
const still = q.has('still');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still) document.body.classList.add('still');

const shots = [...document.querySelectorAll('.shot')];
const frames = [...document.querySelectorAll('.frame')];
const secNum = document.querySelector('.sec b');
const secName = document.querySelector('.sec-name');
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const f = Number(q.get('f') ?? 1) - 1;
let p = 0;
function tick() {
  const goal = still ? f : scrollY / innerHeight;
  p += (goal - p) * (still || reduce ? 1 : 0.1);
  shots.forEach((img, i) => {
    const d = Math.abs(p - Number(img.dataset.i));
    img.style.opacity = clamp(1.35 - d * 1.6).toFixed(3);
    img.style.transform = `scale(${(1.04 - clamp(1 - d) * 0.04).toFixed(4)})`;
  });
  const near = Math.round(clamp(p, 0, frames.length - 1));
  frames.forEach((f, i) => f.classList.toggle('on', i === near));
  if (secNum) { secNum.textContent = frames[near].dataset.num; secName.textContent = frames[near].dataset.sec; }
  root.style.setProperty('--progress', ((near + 1) / frames.length * 0.6 + 0.1).toFixed(3));
  requestAnimationFrame(tick);
}

// the cut on the works
for (const work of document.querySelectorAll('.work')) {
  let cut = 1, goal = 1, seam = 0, raf = 0;
  const step = () => {
    cut += (goal - cut) * 0.18; seam += ((goal < 0.995 ? 1 : 0) - seam) * 0.2;
    work.style.setProperty('--cut', cut.toFixed(4)); work.style.setProperty('--seam', seam.toFixed(3));
    raf = Math.abs(goal - cut) > 0.001 || (seam > 0.01 && goal >= 0.995) ? requestAnimationFrame(step) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  work.addEventListener('pointermove', (e) => {
    const r = work.querySelector('.pic').getBoundingClientRect();
    goal = clamp((e.clientX - r.left) / r.width, 0.02, 0.98); go();
  });
  work.addEventListener('pointerleave', () => { goal = 1; go(); });
  if (still && work.dataset.stillCut) {
    work.style.setProperty('--cut', work.dataset.stillCut); work.style.setProperty('--seam', '1');
  }
}

addEventListener('load', () => {
  // stills move the frames, not the page: headless screenshots misplace fixed layers on a scrolled page
  if (f > 0 && still) { document.querySelector('main').style.transform = `translateY(${-f * 100}vh)`; p = f; }
  else if (f > 0) { scrollTo(0, f * innerHeight); p = f; }
  requestAnimationFrame(tick);
  Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]).then(() => { window.__ready = true; });
});
