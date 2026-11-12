// LAB ONLY (throwaway). Round 60: what the three whole-site ideas share. The scroll (one frame per screen of wheel, or
// ?f=N to fix frame N for stills), eased keyframes, the site's purple paper, the five works' pictures, a picture
// material (prints, screens, plain pictures) and a bloom pass. Code art only.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { canvasTex, lockedScreen, lockedGame } from './kit.js';

export { THREE };
export const GOLD = '#cf9a62', GOLD_HI = '#e7b877', VIOLET = '#b47ed4', INK = '#f2efe8';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const out = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const mix = (a, b, t) => a + (b - a) * t;
/** 0 to 1 while p runs from a to b. */
export const span = (p, a, b) => ease((p - a) / (b - a));

export async function fonts() {
  const faces = ['300 40px Barlow', '400 17px Barlow', '500 20px Barlow', '600 40px Barlow', '700 40px Barlow', '800 100px Barlow', '500 20px "IBM Plex Mono"', '400 40px "Ma Shan Zheng"'];
  await Promise.all(faces.map((f) => document.fonts.load(f)));
}

export function ready() {
  window.__ready = true;
  document.documentElement.dataset.ready = '';
}

/** A value per frame (p = 0, 1, 2 ...), eased between them. Arrays ease element by element. */
export function key(values, p) {
  const n = values.length - 1;
  const i = clamp(Math.floor(p), 0, n), j = Math.min(n, i + 1), f = ease(p - i);
  const a = values[i], b = values[j];
  return Array.isArray(a) ? a.map((v, k) => mix(v, b[k], f)) : mix(a, b, f);
}

/** The scroll. p runs 0 .. n-1, about one frame per screen of wheel; ?f=N fixes frame N (1-based), ?p= any point. */
export function scroller(n) {
  const q = new URLSearchParams(location.search);
  const fixed = q.has('f') ? Number(q.get('f')) - 1 : q.has('p') ? Number(q.get('p')) : null;
  let goal = fixed ?? 0, shown = goal, last = performance.now();
  if (fixed === null) {
    addEventListener('wheel', (e) => { e.preventDefault(); goal = clamp(goal + e.deltaY / innerHeight * 0.45, 0, n - 1); }, { passive: false });
    addEventListener('keydown', (e) => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goal = clamp(Math.round(goal) + 1, 0, n - 1); }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goal = clamp(Math.round(goal) - 1, 0, n - 1); }
    });
    let drag = null;
    addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') drag = { y: e.clientY, g: goal }; });
    addEventListener('pointerup', () => { drag = null; });
    addEventListener('pointermove', (e) => { if (drag) goal = clamp(drag.g - (e.clientY - drag.y) / innerHeight * 1.2, 0, n - 1); });
  }
  return {
    fixed: fixed !== null,
    get goal() { return goal; },
    tick(now) {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (fixed === null) shown += (goal - shown) * (1 - Math.exp(-dt / 0.38));
      return shown;
    },
  };
}

/** The pointer in pixels, eased. For stills it rests where `rest` says (shares of the screen). */
export function pointer(rest = [0.62, 0.62]) {
  const q = new URLSearchParams(location.search);
  const still = q.has('f') || q.has('p');
  const at = { x: innerWidth * rest[0], y: innerHeight * rest[1] }, to = { ...at };
  if (!still) addEventListener('pointermove', (e) => { to.x = e.clientX; to.y = e.clientY; });
  return {
    get x() { return at.x; }, get y() { return at.y; },
    tick(k = 0.08) { if (still) return; at.x += (to.x - at.x) * k; at.y += (to.y - at.y) * k; },
  };
}

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The site's purple paper: a soft pool of light and fibres. Drawn once, in CSS pixels times dpr. */
export function paper(W, H, dpr, { inner = '#23103b', outer = '#110620', at = [0.45, 0.4], fibres = 1, s = 11 } = {}) {
  seed = s;
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const g = x.createRadialGradient(W * at[0], H * at[1], 0, W * at[0], H * at[1], Math.max(W, H) * 0.85);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const n = (W * H) / 110 * fibres;
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(${rnd() < 0.5 ? '184,170,216' : '0,0,0'},${rnd() * 0.05})`;
    x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1);
  }
  return c;
}

/** Puts a paper canvas in an element as its background layer. */
export function paperLayer(el, W, H, dpr, opts) {
  const c = paper(W, H, dpr, opts);
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  el.prepend(c);
  return c;
}

const img = (src) => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.src = src; });

/** The five works, as 16:10 pictures. */
export async function loadWorks(renderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const card = (draw) => { const t = canvasTex(2048, 1280, draw); t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const cover = (im) => card((x, w, h) => { const s = Math.max(w / im.width, h / im.height); x.imageSmoothingQuality = 'high'; x.drawImage(im, (w - im.width * s) / 2, (h - im.height * s) / 2, im.width * s, im.height * s); });
  const phone = (bg, im) => card((x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const ph = h * 0.86, pw = ph * (im.width / im.height);
    x.imageSmoothingQuality = 'high';
    x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 60; x.shadowOffsetY = 24; x.beginPath(); x.roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 40); x.fillStyle = '#000'; x.fill(); x.restore();
    x.save(); x.beginPath(); x.roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 40); x.clip(); x.drawImage(im, (w - pw) / 2, (h - ph) / 2, pw, ph); x.restore();
  });
  const [lumo, jontai, cookies] = await Promise.all([img('img/lumo.webp'), img('/public/flight/jontai.webp'), img('/public/flight/cookies.webp')]);
  return [
    { title: 'Lumo', meta: 'Android app · 2026', tex: phone(['#1f7a34', '#0b3b17'], lumo) },
    { title: 'Locked', meta: 'Android app · 2026', tex: phone(['#2a1a12', '#0d0b0f'], lockedScreen().image) },
    { title: 'Jontai Energy', meta: 'Website · 2025', tex: cover(jontai) },
    { title: 'Cookies Clicker', meta: 'Browser game · 2025', tex: cover(cookies) },
    { title: 'Roblox game', meta: 'In development', tex: card((x, w, h) => x.drawImage(lockedGame().image, 0, 0, w, h)) },
  ];
}

/**
 * A picture on a plane: a work, optionally on matte paper with a border, printed out of halftone dots below a print
 * head, blurred (mip bias) and dimmed. Plane units: width `w`, height `h`.
 */
export function pictureMaterial(tex, { w = 1.6, h = 1, border = 0, paper = '#efe9df', glow = 0, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    side, transparent: true,
    uniforms: {
      uTex: { value: tex }, uBorder: { value: border }, uSize: { value: new THREE.Vector2(w, h) }, uPaper: { value: new THREE.Color(paper) },
      uBlur: { value: 0 }, uDim: { value: 1 }, uGlow: { value: glow }, uHead: { value: 1e6 }, uDots: { value: 0.45 }, uAlpha: { value: 1 }, uBlank: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform sampler2D uTex; uniform float uBorder, uBlur, uDim, uGlow, uHead, uDots, uAlpha, uBlank; uniform vec2 uSize; uniform vec3 uPaper;
      varying vec2 vUv; varying vec3 vW;
      void main(){
        if (vW.y > uHead) discard;
        vec2 p = vUv * uSize;
        vec2 inner = uSize - 2.0 * uBorder;
        vec2 q = (p - uBorder) / inner;
        bool inPic = all(greaterThanEqual(q, vec2(0.0))) && all(lessThanEqual(q, vec2(1.0)));
        vec3 col = uPaper;
        if (inPic && uBlank < 0.5) {
          vec3 sharp = texture(uTex, q, uBlur).rgb;
          // Halftone: just under the head the ink is still dots; further out it is the picture.
          float since = uHead - vW.y;
          float settle = smoothstep(0.0, uDots, since);
          if (settle < 1.0) {
            float cell = 0.026;
            vec2 c = (floor(p / cell) + 0.5) * cell;
            vec3 s = texture(uTex, (c - uBorder) / inner, 2.0).rgb;
            float lum = dot(s, vec3(0.3, 0.55, 0.15));
            float r = sqrt(1.0 - lum) * 0.62 * cell * (0.35 + 0.65 * settle);
            float dotIn = 1.0 - smoothstep(r - 0.002, r + 0.002, length(p - c));
            vec3 ht = mix(uPaper, s * 0.92, dotIn);
            col = mix(ht, sharp, settle * settle);
          } else col = sharp;
        }
        // Matte paper: a little tooth.
        float n = fract(sin(dot(floor(p * 900.0), vec2(12.9898, 78.233))) * 43758.5453);
        col *= 0.985 + 0.03 * n;
        col = col * uDim + col * uGlow;
        gl_FragColor = vec4(col, uAlpha);
        #include <colorspace_fragment>
      }`,
  });
}

/** A bloom pass over one scene and camera. */
export function bloom(renderer, scene, camera, W, H, { strength = 0.8, radius = 0.55, threshold = 0.72 } = {}) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const pass = new UnrealBloomPass(new THREE.Vector2(W, H), strength, radius, threshold);
  composer.addPass(pass);
  composer.addPass(new OutputPass());
  return { composer, pass, render: () => composer.render() };
}

export function renderer(canvas, W, H, { alpha = false, exposure = 1 } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(2, devicePixelRatio));
  r.setSize(W, H, false);
  r.toneMapping = THREE.AgXToneMapping;
  r.toneMappingExposure = exposure;
  return r;
}

/** A soft round glow, for sprites. */
export function glowSprite(color = [239, 181, 61], core = [255, 236, 190]) {
  const t = canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(${core.join(',')},1)`);
    g.addColorStop(0.12, `rgba(${core.join(',')},0.85)`);
    g.addColorStop(0.3, `rgba(${color.join(',')},0.35)`);
    g.addColorStop(1, `rgba(${color.join(',')},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
}

/** Catmull-Rom runs to one SVG path: each run is smooth, runs meet at sharp corners. Points are [x, y] in pixels. */
export function pathFromRuns(runs) {
  let d = '';
  runs.forEach((pts, ri) => {
    if (ri === 0) d += `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
  });
  return d;
}

/** The works' title (bottom left) and round button (bottom right), shared by the three ideas. */
export function worksChrome(parent) {
  const el = document.createElement('div');
  el.className = 'wk';
  el.innerHTML = '<p class="wt"><span class="k"></span><span class="n"></span><span class="m"></span></p><p class="wb"><span class="c">→</span><span class="l mono">Open</span></p>';
  parent.append(el);
  const k = el.querySelector('.k'), n = el.querySelector('.n'), m = el.querySelector('.m');
  let shown = -1;
  return {
    el,
    set(i, works) { if (i === shown) return; shown = i; k.textContent = `${String(i + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`; n.textContent = works[i].title; m.textContent = works[i].meta; },
  };
}
