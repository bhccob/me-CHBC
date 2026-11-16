// LAB ONLY (throwaway). Round 63: the scroll, the pointer and the page's words, shared by the three ideas. Each idea
// gives `frame(ctx)`, which draws and returns what the words need: the camera pose and, in the studies, a point to label.
//   ?p= any point (0 front · 1..4 studies · 5..9 works · 10 the end), ?f=N (p = N - 1), ?hover=phone|side|main
import { THREE, W, H, ASPECT, TAN, phone, clamp, span, scroller, pointer, ready, worksChrome, place, camera, shared, floor, light, C, EMU } from './r62.js';

const WORKS = [
  { title: 'Lumo', meta: 'Android app · 2026' },
  { title: 'Locked', meta: 'Android app · 2026' },
  { title: 'Jontai Energy', meta: 'Website · 2025' },
  { title: 'Cookies Clicker', meta: 'Browser game · 2025' },
  { title: 'Roblox game', meta: 'In development' },
];
const NAMES = ['码 · Software Engineering', '戏 · Game & App Development', '安 · Cybersecurity', '机 · Mechatronics'];

/** A light hanging in front of the camera, pushed toward the pointer: the gold always has something to catch. */
export function lightFrom(p, nx, ny, dist) {
  const dir = new THREE.Vector3(nx * TAN * ASPECT, ny * TAN, -1).normalize().applyQuaternion(p.q);
  light.copy(p.pos).addScaledVector(dir, dist);
}

export function run(frame) {
  const $ = (s) => document.querySelector(s);
  const secs = { intro: $('#intro'), about: $('#about'), works: $('#works'), end: $('#end') };
  const lis = [...document.querySelectorAll('.studies li')];
  const region = $('.region'), press = $('.press'), sig = $('.sig'), dot = $('.dot'), open = $('.open');
  const wk = worksChrome(secs.works);
  const q = new URLSearchParams(location.search);
  const forced = { phone: 0, side: 1, main: 2 }[q.get('hover')] ?? -1;
  const scroll = scroller(11);
  const ptr = pointer(forced >= 0 ? [0.56, 0.45] : phone ? [0.7, 0.3] : [0.63, 0.34]);
  const live = !scroll.fixed;
  const t0 = performance.now();
  let last = t0;
  const project = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, p.z]; };

  function tick(now) {
    const p = scroll.tick(now);
    ptr.tick(0.09);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = live ? (now - t0) / 1000 : 4.2;
    shared.uTime.value = time;
    floor.material.uniforms.uTime.value = time;
    const nx = (ptr.x / W) * 2 - 1, ny = 1 - (ptr.y / H) * 2;
    const out = frame({ p, time, dt: live ? dt : 1, nx, ny, ptr, live, forced, tilt: [ptr.x / W - 0.5, ptr.y / H - 0.5] });

    // words
    const op = (el, v) => { if (el) el.style.opacity = v.toFixed(3); };
    op(secs.intro, 1 - span(p, 0, 0.22));
    if (sig && p < 0.3) {
      place(camera, out.pose);
      const [sx, sy] = project(new THREE.Vector3(0.62 * EMU, C.y - 1.0, 0.3));
      const [, ty] = project(new THREE.Vector3(0, C.y + 0.36, 0.3)), [, by] = project(new THREE.Vector3(0, C.y - 0.36, 0.3));
      Object.assign(sig.style, { left: `${sx}px`, top: `${sy}px`, fontSize: `${Math.abs(by - ty) * 0.9}px`, transform: 'rotate(-7deg)' });
    }
    op(secs.about, span(p, 0.75, 1) * (1 - span(p, 4.0, 4.3)));
    const study = clamp(p - 1, 0, 3), si = Math.round(study);
    lis.forEach((li, i) => li.classList.toggle('on', i === si));
    if (region) {
      if (out.regionPoint) {
        place(camera, out.pose);
        const [rx, ry, rz] = project(out.regionPoint);
        region.textContent = NAMES[si];
        Object.assign(region.style, { left: `${rx}px`, top: `${ry}px`, opacity: rz < 1 ? (1 - Math.abs(study - si) * 2.2).toFixed(3) : '0' });
      } else region.style.opacity = '0';
    }
    if (press) press.style.opacity = (span(p, 3.9, 4.1) * (1 - span(p, 4.35, 4.45)) * (live ? 0.55 + 0.45 * Math.sign(Math.sin(time * 6)) : 1)).toFixed(3);
    op(secs.works, span(p, 4.75, 5.05) * (1 - span(p, 9.0, 9.25)));
    const w = clamp(p - 5, 0, 4);
    wk.set(Math.round(w), WORKS);
    wk.el.style.opacity = secs.works.style.opacity;
    op(secs.end, span(p, 9.7, 10));
    dot.style.transform = `translate(${ptr.x}px, ${ptr.y}px)`;
    if (open) {
      open.style.opacity = out.hover >= 0 ? '1' : '0';
      open.style.transform = `translate(${ptr.x + 22}px, ${ptr.y + 14}px)`;
    }
  }

  document.body.dataset.on = '';
  if (live) {
    const loop = (now) => { tick(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    ready();
  } else {
    tick(performance.now());
    requestAnimationFrame(() => { tick(performance.now()); requestAnimationFrame(() => { tick(performance.now()); ready(); }); });
  }
}
