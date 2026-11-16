// LAB ONLY (throwaway). Round 66: scroll through three frames. An eased value follows the scroll; each frame's still
// fades in around its own screen (with a slow push, as the camera would move), the location mark, the chapter rail and
// the nav follow, and a frame's words come in when it is reached. ?f=2 opens on frame 2; ?still skips the fades.
const q = new URLSearchParams(location.search);
const still = q.has('still');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still) document.body.classList.add('still');

const shots = [...document.querySelectorAll('.shot')];
const frames = [...document.querySelectorAll('.frame')];
const secNum = document.querySelector('.sec b');
const secName = document.querySelector('.sec-name');
const rail = [...document.querySelectorAll('.rail i')];
const links = [...document.querySelectorAll('.nav nav a')];
const root = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const f = Number(q.get('f') ?? 1) - 1;
let p = 0;
function tick() {
  const goal = still ? f : scrollY / innerHeight;
  p += (goal - p) * (still || reduce ? 1 : 0.09);
  shots.forEach((img, i) => {
    const d = p - Number(img.dataset.i);
    img.style.opacity = clamp(1.35 - Math.abs(d) * 1.6).toFixed(3);
    img.style.transform = reduce || still ? 'none' : `scale(${(1.05 - clamp(1 - Math.abs(d)) * 0.05 + clamp(d, 0, 1) * 0.04).toFixed(4)})`;
  });
  const near = Math.round(clamp(p, 0, frames.length - 1));
  const ch = Number(frames[near].dataset.ch);
  frames.forEach((fr, i) => fr.classList.toggle('on', i === near));
  rail.forEach((r, i) => r.classList.toggle('on', i === ch));
  links.forEach((a, i) => a.classList.toggle('on', i === ch));
  document.querySelector('.stage').style.setProperty('--shade', frames[near].dataset.shade || 'none');
  if (secNum) { secNum.textContent = frames[near].dataset.num; secName.textContent = frames[near].dataset.sec; }
  root.style.setProperty('--progress', ((ch + 1) / 7).toFixed(3));
  requestAnimationFrame(tick);
}

addEventListener('load', () => {
  // stills move the frames, not the page: headless screenshots misplace fixed layers on a scrolled page
  if (f > 0 && still) { document.querySelector('main').style.transform = `translateY(${-f * 100}vh)`; p = f; }
  else if (f > 0) { scrollTo(0, f * innerHeight); p = f; }
  requestAnimationFrame(tick);
  Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]).then(() => { window.__ready = true; });
});
