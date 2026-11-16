// LAB ONLY (throwaway). Round 62, "Through the Coin": Bob's coin is a door into his mind.
//   Outside: a night world. A reflective grid floor, data towers on the horizon, dust in the air, a low sun behind the
//   coin. BOB stands on the floor in engine-turned gold; the coin is the O. Its square hole shows another world.
//   Inside (through the hole): the brain, wired in gold circuits, in a purple nebula, with rings and a projector plate.
//   One region lights per study. The works come out of the brain and circle it. You back out through the coin to HELLO.
//   ?p=0 front · 1..4 studies · 5..9 works · 10 hello   (?f=N is p = N - 1). Code art only.
import { THREE, clamp, ease, mix, span, scroller, pointer, loadWorks, ready, worksChrome } from './r60.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const W = innerWidth, H = innerHeight, ASPECT = W / H, DPR = Math.min(2, devicePixelRatio);
const phone = W < 700;
const FOV = phone ? 42 : 30, TAN = Math.tan((FOV * Math.PI) / 360);
document.body.classList.toggle('phone', phone);
const HOLE = 0.27;

await Promise.all(['900 400px Barlow', '400 16px Barlow', '600 17px Barlow', '700 60px Barlow', '500 11px "IBM Plex Mono"'].map((f) => document.fonts.load(f)));
await document.fonts.load('400 60px "Ma Shan Zheng"', 'Chung码戏安机');

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ------------------------------------------------------------------ the name, measured (as round 61)

const m2 = document.createElement('canvas').getContext('2d');
m2.font = '900 1000px Barlow';
const glyph = (ch) => {
  const g = m2.measureText(ch);
  return { adv: g.width / 1000, l: g.actualBoundingBoxLeft / 1000, r: g.actualBoundingBoxRight / 1000, a: g.actualBoundingBoxAscent / 1000, d: g.actualBoundingBoxDescent / 1000 };
};
const gO = glyph('O');
const D_EM = (gO.a + gO.d) * 1.06;
const EMU = 2 / D_EM;
const O_CY = (gO.a - gO.d) / 2;
const GAP = 0.06;
const BASE_Y = 0.14; // the letters float a hand above the floor
const C = new THREE.Vector3(0, BASE_Y + O_CY * EMU, 0); // the coin's middle

function layout(left, right) {
  const set = (text) => { let pen = 0; return [...text].map((ch) => { const g = glyph(ch), l = { ch, x: pen, g }; pen += g.adv - 0.01; return l; }); };
  const L = set(left), R = set(right);
  if (L.length) { const last = L.at(-1), shift = -(D_EM / 2 + GAP) - (last.x + last.g.r); L.forEach((l) => { l.x += shift; }); }
  if (R.length) { const first = R[0], shift = D_EM / 2 + GAP - (first.x - first.g.l); R.forEach((l) => { l.x += shift; }); }
  return [...L, ...R];
}

/** A letter's outline, traced from Barlow 900 on a canvas: loops of [x, y] in em, y up, pen at 0. */
function traceGlyph(ch) {
  const S = 520, pad = 6, g = glyph(ch);
  const w = Math.ceil((g.l + g.r) * S) + pad * 2, h = Math.ceil((g.a + g.d) * S) + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const ox = pad + g.l * S, oy = pad + g.a * S;
  x.font = `900 ${S}px Barlow`; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
  x.fillText(ch, ox, oy);
  const data = x.getImageData(0, 0, w, h).data;
  const v = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : data[(j * w + i) * 4 + 3] / 255);
  const pts = new Map(), adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); };
  const at = (id, xa, ya, va, xb, yb, vb) => { if (!pts.has(id)) { const t = (0.5 - va) / (vb - va); pts.set(id, [xa + (xb - xa) * t, ya + (yb - ya) * t]); } return id; };
  for (let j = -1; j < h; j++) {
    for (let i = -1; i < w; i++) {
      const tl = v(i, j), tr = v(i + 1, j), br = v(i + 1, j + 1), bl = v(i, j + 1);
      const c = (tl >= 0.5 ? 8 : 0) | (tr >= 0.5 ? 4 : 0) | (br >= 0.5 ? 2 : 0) | (bl >= 0.5 ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => at(`h${i},${j}`, i, j, tl, i + 1, j, tr);
      const R = () => at(`v${i + 1},${j}`, i + 1, j, tr, i + 1, j + 1, br);
      const B = () => at(`h${i},${j + 1}`, i, j + 1, bl, i + 1, j + 1, br);
      const L = () => at(`v${i},${j}`, i, j, tl, i, j + 1, bl);
      if (c === 5) { link(T(), R()); link(L(), B()); continue; }
      if (c === 10) { link(L(), T()); link(B(), R()); continue; }
      const e = [];
      if ((tl >= 0.5) !== (tr >= 0.5)) e.push(T());
      if ((tr >= 0.5) !== (br >= 0.5)) e.push(R());
      if ((bl >= 0.5) !== (br >= 0.5)) e.push(B());
      if ((tl >= 0.5) !== (bl >= 0.5)) e.push(L());
      link(e[0], e[1]);
    }
  }
  const seen = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const [px, py] = pts.get(cur);
      loop.push([(px + 0.5 - ox) / S, (oy - py - 0.5) / S]);
      const nb = adj.get(cur).find((n) => n !== prev && !seen.has(n));
      prev = cur; cur = nb;
    }
    if (loop.length > 8) loops.push(simplify(loop, 0.5 / S));
  }
  return loops;
}
function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len; if (d > best) { best = d; bi = i; } }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

/** Letters round the coin as THREE.Shapes in world units. */
function wordShapes(letters) {
  const shapes = [];
  for (const l of letters) {
    const loops = traceGlyph(l.ch).map((loop) => loop.map(([x, y]) => [(x + l.x) * EMU, (y - O_CY) * EMU + C.y]));
    const depth = loops.map((lp) => loops.filter((o) => o !== lp && inside(lp[0], o)).length);
    loops.forEach((lp, i) => {
      if (depth[i] % 2) return;
      const s = new THREE.Shape(lp.map(([x, y]) => new THREE.Vector2(x, y)));
      loops.forEach((h, k) => { if (depth[k] % 2 && depth[k] === depth[i] + 1 && inside(h[0], lp)) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))); });
      shapes.push(s);
    });
  }
  return shapes;
}

// ------------------------------------------------------------------ renderer, two scenes, one camera

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const outside = new THREE.Scene(), mind = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.01, 900);
const RW_ = Math.round(W * DPR), RH_ = Math.round(H * DPR);
const rtMind = new THREE.WebGLRenderTarget(RW_, RH_, { type: THREE.HalfFloatType, samples: 4 });

const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR);
composer.setSize(W, H);
const pass = new RenderPass(outside, camera);
composer.addPass(pass);
// keep a stray NaN or overflow from one pixel out of the bloom, which would spread it over the whole screen
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = min(c, vec4(32.0)); }',
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.45, 1.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const tex = (w, h, draw, srgb = false) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const blurred = (src, px) => tex(src.image.width, src.image.height, (x) => { x.filter = `blur(${px}px)`; x.drawImage(src.image, 0, 0); });

// ------------------------------------------------------------------ shading shared by everything

const GL = /* glsl */ `
  #define PI 3.14159265
  const vec3 GOLD = vec3(0.92, 0.53, 0.22);
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise3(p); p *= 2.03; a *= 0.5; } return s; }
  // What the gold reflects: the night sky, a violet horizon, the low sun behind the coin, a soft light above, a warm
  // card behind the viewer, the dark floor below.
  vec3 env(vec3 R) {
    float up = R.y;
    vec3 c = mix(vec3(0.03, 0.012, 0.05), vec3(0.006, 0.003, 0.016), smoothstep(0.0, 0.7, up));
    c += vec3(0.30, 0.13, 0.46) * 0.35 * exp(-abs(up) * 8.0);
    c += vec3(1.0, 0.66, 0.36) * 0.95 * exp(-pow(R.x / 0.3, 2.0) - pow((up - 0.04) / 0.15, 2.0)) * smoothstep(0.1, -0.6, R.z);
    c += vec3(1.0, 0.84, 0.64) * 0.6 * smoothstep(0.45, 0.92, up);
    c += vec3(0.40, 0.25, 0.15) * smoothstep(0.35, 1.0, R.z) * (0.5 + 0.45 * up);
    c = mix(c, vec3(0.012, 0.006, 0.022), smoothstep(0.0, -0.3, up));
    return c;
  }
  vec3 envD(vec3 N) { return mix(vec3(0.04, 0.02, 0.07), vec3(0.40, 0.30, 0.23), N.y * 0.5 + 0.5) * (0.55 + 0.45 * max(N.z, 0.0)); }
  float kk(vec3 T, vec3 H, float e) { float d = dot(T, H); return pow(sqrt(max(0.0, 1.0 - d * d)), e); }
  vec3 fresnel(vec3 n, vec3 V) { return GOLD + (1.0 - GOLD) * pow(1.0 - max(dot(n, V), 0.0), 5.0); }
  void rose(vec2 p, float N, float A, float m, float tw, out float f1, out float f2, out vec2 g1, out vec2 g2) {
    float r = max(length(p), 1e-4), a = atan(p.y, p.x);
    vec2 er = p / r, ea = vec2(-er.y, er.x);
    float s1 = m * a + tw * r, s2 = m * a - tw * r + PI;
    f1 = r * N + A * sin(s1);
    f2 = r * N + A * sin(s2);
    g1 = er * (N + A * cos(s1) * tw) + ea * (A * cos(s1) * m / r);
    g2 = er * (N - A * cos(s2) * tw) + ea * (A * cos(s2) * m / r);
  }
  vec3 turned(vec3 N, vec3 V, vec3 L, vec3 X, vec3 Y, float f1, float f2, vec2 g1, vec2 g2, float depth, vec3 lc) {
    float k1 = 1.0 - smoothstep(0.16, 0.45, fwidth(f1)), k2 = 1.0 - smoothstep(0.16, 0.45, fwidth(f2));
    vec2 dh = depth * PI * (cos(2.0 * PI * f1) * g1 * k1 + cos(2.0 * PI * f2) * g2 * k2);
    vec3 n = normalize(N - (X * dh.x + Y * dh.y));
    vec3 Hv = normalize(L + V);
    vec3 t1 = normalize(X * -g1.y + Y * g1.x), t2 = normalize(X * -g2.y + Y * g2.x);
    float sheen = 0.5 * (kk(t1, Hv, 60.0) + kk(t2, Hv, 60.0));
    float cut = 1.0 - 0.4 * (k1 * smoothstep(-0.55, -1.0, sin(2.0 * PI * f1)) + k2 * smoothstep(-0.55, -1.0, sin(2.0 * PI * f2)));
    return fresnel(n, V) * (env(reflect(-V, n)) * 0.78 + sheen * lc * 1.15) * cut;
  }
  vec3 polished(vec3 n, vec3 V, vec3 L, vec3 lc, float gloss) {
    float spec = pow(max(dot(n, normalize(L + V)), 0.0), gloss);
    return fresnel(n, V) * (env(reflect(-V, n)) + spec * lc * 2.2);
  }
  vec3 matte(vec3 n, vec3 V, vec3 L, vec3 lc) {
    float spec = pow(max(dot(n, normalize(L + V)), 0.0), 10.0);
    return GOLD * (envD(n) * 0.75 + max(dot(n, L), 0.0) * lc * 0.22 + spec * lc * 0.3);
  }
  vec3 fogged(vec3 col, vec3 w, vec3 fogC, float dens) { float d = length(w - cameraPosition); return mix(col, fogC, 1.0 - exp(-d * dens)); }
`;
const FOG_OUT = new THREE.Color(0.016, 0.007, 0.03);
const light = new THREE.Vector3(0, 2, 5);
const shared = { uLight: { value: light }, uLightI: { value: 1.25 }, uTime: { value: 0 } };
const pointsVert = /* glsl */ `
  attribute float aSeed; uniform float uTime, uSize, uDpr; varying float vSeed; varying vec3 vW;
  void main() {
    vSeed = aSeed;
    vec3 p = position + vec3(sin(uTime * 0.3 + aSeed * 40.0), sin(uTime * 0.21 + aSeed * 17.0) + uTime * 0.06, cos(uTime * 0.27 + aSeed * 29.0)) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vW = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_PointSize = uSize * uDpr * (0.4 + aSeed) / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }`;

// ================================================================== OUTSIDE

// the sky: night gradient, a violet horizon, faint nebula, stars, and a low sun that always sits behind the coin
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { uSun: { value: new THREE.Vector3(0, 0, -1) } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }',
  fragmentShader: GL + /* glsl */ `
    uniform vec3 uSun; varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float up = d.y;
      vec3 col = mix(vec3(0.016, 0.007, 0.03), vec3(0.002, 0.001, 0.006), smoothstep(0.0, 0.45, up));
      col += vec3(0.30, 0.12, 0.45) * exp(-max(up, 0.0) * 12.0) * 0.12;
      float n = fbm(d * 3.2 + vec3(0.0, 0.0, 1.7));
      col += vec3(0.24, 0.08, 0.36) * smoothstep(0.5, 0.86, n) * 0.12 * smoothstep(0.02, 0.35, up);
      vec3 sd = d * 380.0; float h = hash3(floor(sd));
      col += vec3(1.0, 0.86, 0.7) * step(0.9975, h) * smoothstep(0.5, 0.1, length(fract(sd) - 0.5)) * 1.2 * smoothstep(0.03, 0.25, up);
      // the sun: a soft gold disc low on the horizon, ringed like the coin
      vec3 s = normalize(vec3(uSun.x, 0.035, uSun.z));
      float r = acos(clamp(dot(d, s), -1.0, 1.0));
      col += vec3(1.0, 0.56, 0.24) * exp(-r * r / 0.005) * 0.9 + vec3(0.5, 0.18, 0.7) * exp(-r * r / 0.05) * 0.16;
      col += vec3(1.0, 0.66, 0.36) * smoothstep(0.75, 1.0, sin(r * 520.0)) * smoothstep(0.26, 0.04, r) * 0.1;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}));
sky.frustumCulled = false;
sky.renderOrder = -20;
outside.add(sky);

// the floor: a dark mirror with a gold grid, pulses running along a few of its lines, fog to the horizon
const floorShader = {
  name: 'Floor',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 }, uFog: { value: FOG_OUT } },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main() { vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: GL + /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uFog; varying vec4 vUv; varying vec3 vW;
    void main() {
      float dist = length(vW - cameraPosition);
      float rough = 0.004 + 0.0007 * dist;
      vec3 refl = texture2DProj(tDiffuse, vUv).rgb * 0.36;
      refl += texture2DProj(tDiffuse, vUv + vec4(rough, 0.0, 0.0, 0.0) * vUv.w).rgb * 0.16;
      refl += texture2DProj(tDiffuse, vUv - vec4(rough, 0.0, 0.0, 0.0) * vUv.w).rgb * 0.16;
      refl += texture2DProj(tDiffuse, vUv + vec4(0.0, rough * 2.0, 0.0, 0.0) * vUv.w).rgb * 0.16;
      refl += texture2DProj(tDiffuse, vUv - vec4(0.0, rough * 2.0, 0.0, 0.0) * vUv.w).rgb * 0.16;
      vec3 col = vec3(0.004, 0.002, 0.009) + refl * 0.42;
      vec2 gp = vW.xz;
      vec2 gl = abs(fract(gp - 0.5) - 0.5) / fwidth(gp);
      float line = 1.0 - min(min(gl.x, gl.y), 1.0);
      vec2 g5 = gp / 6.0, gl5 = abs(fract(g5 - 0.5) - 0.5) / fwidth(g5);
      float major = 1.0 - min(min(gl5.x, gl5.y), 1.0);
      float fade = exp(-dist * 0.03);
      col += vec3(0.85, 0.52, 0.26) * (line * 0.07 + major * 0.22) * fade;
      float lane = floor(gp.x + 0.5), hz = hash(vec2(lane, 3.0));
      float head = fract(-gp.y * 0.025 + uTime * 0.15 + hz);
      col += vec3(1.0, 0.68, 0.32) * smoothstep(0.965, 1.0, head) * step(0.84, hz) * (1.0 - min(gl.x, 1.0)) * 3.0 * fade;
      float laneZ = floor(gp.y + 0.5), hz2 = hash(vec2(laneZ, 9.0));
      float head2 = fract(gp.x * 0.025 + uTime * 0.11 + hz2);
      col += vec3(0.75, 0.45, 1.0) * smoothstep(0.97, 1.0, head2) * step(0.88, hz2) * (1.0 - min(gl.y, 1.0)) * 2.2 * fade;
      col = mix(col, uFog, 1.0 - exp(-dist * 0.016));
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
};
const floor = new Reflector(new THREE.PlaneGeometry(900, 900), { shader: floorShader, textureWidth: Math.round(W * DPR * 0.6), textureHeight: Math.round(H * DPR * 0.6), clipBias: 0.002 });
floor.rotation.x = -Math.PI / 2;
outside.add(floor);

// data towers on the horizon
{
  const N = 170;
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: FOG_OUT }, uTime: shared.uTime },
    vertexShader: 'attribute float aSeed; varying vec3 vW; varying vec3 vL; varying float vSeed; void main(){ vSeed = aSeed; vL = position; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GL + /* glsl */ `
      uniform vec3 uFog; uniform float uTime; varying vec3 vW; varying vec3 vL; varying float vSeed;
      void main() {
        // not buildings: dark monoliths with thin vertical light strips and a lit top edge, data running up them
        vec3 col = vec3(0.004, 0.002, 0.009);
        float lane = floor((vL.x + vL.z + 1.0) * 6.0);
        float strip = step(0.88, fract((vL.x + vL.z + 1.0) * 6.0)) * step(0.6, hash(vec2(lane, vSeed * 37.0)));
        float run = pow(fract(vL.y * 2.0 - uTime * (0.08 + 0.1 * vSeed) + hash(vec2(lane, 2.0))), 6.0);
        col += mix(vec3(1.0, 0.6, 0.28), vec3(0.6, 0.34, 1.0), step(0.5, vSeed)) * strip * (0.12 + 1.2 * run);
        col += vec3(1.0, 0.62, 0.3) * smoothstep(0.992, 1.0, vL.y) * 1.2;
        float d = length(vW - cameraPosition);
        col = mix(col, uFog, 1.0 - exp(-d * 0.0085));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const towers = new THREE.InstancedMesh(g, mat, N);
  const seeds = new Float32Array(N), o = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const a = (rnd() - 0.5) * Math.PI * 1.4, r = 120 + rnd() * 160;
    o.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
    const h = 14 + Math.pow(rnd(), 1.6) * 60;
    o.scale.set(0.8 + rnd() * 2.2, h, 0.8 + rnd() * 2.2);
    o.rotation.y = a;
    o.updateMatrix();
    towers.setMatrixAt(i, o.matrix);
    seeds[i] = rnd();
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  outside.add(towers);
}

// dust in the air
function dust(scene, n, box, size, fogC, dens) {
  const pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = mix(box[0], box[3], rnd()); pos[i * 3 + 1] = mix(box[1], box[4], rnd()); pos[i * 3 + 2] = mix(box[2], box[5], rnd()); sd[i] = rnd(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: shared.uTime, uSize: { value: size }, uDpr: { value: DPR }, uFog: { value: fogC }, uDens: { value: dens } },
    vertexShader: pointsVert,
    fragmentShader: GL + /* glsl */ `
      uniform float uTime, uDens; uniform vec3 uFog; varying float vSeed; varying vec3 vW;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r);
        vec3 c = mix(vec3(1.0, 0.66, 0.32), vec3(0.62, 0.38, 1.0), step(0.55, vSeed));
        float tw = 0.55 + 0.45 * sin(uTime * 1.7 + vSeed * 60.0);
        float d = length(vW - cameraPosition);
        gl_FragColor = vec4(c * a * tw * 0.55 * exp(-d * uDens), 1.0);
      }`,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
dust(outside, 2600, [-16, 0.05, -30, 16, 8, 10], 34, FOG_OUT, 0.03);

// ------------------------------------------------------------------ the coin (round 61's, thicker), and the hole as a door

const FACE = 2048;
const relief = tex(FACE, FACE, (x, w) => {
  const u = w / 2;
  x.fillStyle = '#000'; x.fillRect(0, 0, w, w);
  x.globalCompositeOperation = 'lighter';
  const ring = (text, colour, size) => {
    x.save(); x.translate(u, u);
    x.font = `700 ${size * u}px Barlow`; x.fillStyle = colour; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...text], widths = chars.map((c) => x.measureText(c).width), total = widths.reduce((a, b) => a + b, 0);
    const R = 0.8465 * u, track = (2 * Math.PI * R - total) / chars.length;
    let at = 0;
    chars.forEach((c, i) => { const mid = at + widths[i] / 2; x.save(); x.rotate(mid / R); x.translate(0, -R); x.fillText(c, 0, 0); x.restore(); at += widths[i] + track; });
    x.restore();
  };
  ring('BOB CHUNG · SOFTWARE ENGINEER · ARUBA · ROTTERDAM · EST. 2006 · ', '#f00', 0.056);
  x.save(); x.translate(u, u);
  x.font = `400 ${0.33 * u}px "Ma Shan Zheng"`; x.fillStyle = '#f00'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['码', '戏', '安', '机'].forEach((c, i) => { x.save(); x.rotate((i * Math.PI) / 2); x.fillText(c, 0, -0.56 * u); x.restore(); });
  x.restore();
  x.save(); x.translate(w, 0); x.scale(-1, 1);
  ring('SAY HELLO · LET’S TALK · SAY HELLO · LET’S TALK · ', '#0f0', 0.056);
  x.fillStyle = '#0f0';
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; x.beginPath(); x.arc(u + Math.cos(a) * 0.56 * u, u + Math.sin(a) * 0.56 * u, 0.028 * u, 0, Math.PI * 2); x.fill(); }
  x.restore();
});
relief.wrapS = relief.wrapT = THREE.ClampToEdgeWrapping;
const reliefSoft = blurred(relief, 9);
reliefSoft.wrapS = reliefSoft.wrapT = THREE.ClampToEdgeWrapping;

const coinVert = /* glsl */ `
  varying vec3 vO, vW, vN, vNo, vX, vY;
  void main() {
    vO = position; vNo = normal;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
    vX = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0)); vY = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const faceMat = new THREE.ShaderMaterial({
  uniforms: { ...shared, uRelief: { value: relief }, uSoft: { value: reliefSoft }, uHole: { value: HOLE }, uN: { value: 34 }, uDepth: { value: 0.0036 } },
  vertexShader: coinVert,
  fragmentShader: GL + /* glsl */ `
    uniform sampler2D uRelief, uSoft; uniform vec3 uLight; uniform float uLightI, uHole, uN, uDepth;
    varying vec3 vO, vW, vN, vNo, vX, vY;
    float soft(vec2 uv, bool front) { vec2 s = texture2D(uSoft, uv).rg; return front ? s.r : s.g; }
    void main() {
      bool front = vO.z > 0.0;
      vec2 p = vO.xy;
      float r = length(p), c = max(abs(p.x), abs(p.y));
      vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
      vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
      vec3 X = normalize(vX), Y = normalize(vY);
      vec2 uv = p * 0.5 + 0.5;
      vec2 rl = texture2D(uRelief, uv).rg;
      float raised = front ? rl.r : rl.g;
      float e = 2.0 / 2048.0;
      float sC = soft(uv, front);
      vec2 g = vec2(soft(uv + vec2(e, 0.0), front) - soft(uv - vec2(e, 0.0), front), soft(uv + vec2(0.0, e), front) - soft(uv - vec2(0.0, e), front)) / (4.0 * e);
      vec3 nR = normalize(N - (X * g.x + Y * g.y) * 0.035);
      float f1, f2; vec2 g1, g2;
      if (front) rose(p, uN, 0.42, 12.0, 7.0, f1, f2, g1, g2);
      else rose(p, uN * 0.85, 0.32, 36.0, -3.0, f1, f2, g1, g2);
      vec3 field = turned(N, V, L, X, Y, f1, f2, g1, g2, uDepth, lc);
      field *= 1.0 - 0.6 * sC * (1.0 - raised);
      vec3 chars = polished(nR, V, L, lc, 80.0);
      vec3 band = mix(matte(N, V, L, lc) * 0.8, polished(nR, V, L, lc, 70.0), raised);
      vec3 plain = polished(N, V, L, lc, 140.0);
      float aa = fwidth(r) * 1.3, ac = fwidth(c) * 1.3;
      vec3 col = mix(field, chars, raised * step(r, 0.79));
      col = mix(col, band, smoothstep(0.80 - aa, 0.80 + aa, r));
      col = mix(col, plain, smoothstep(0.905 - aa, 0.905 + aa, r));
      col = mix(col, plain, 1.0 - smoothstep(uHole + 0.075 - ac, uHole + 0.075 + ac, c));
      float cutR = min(abs(r - 0.795), abs(r - 0.9)), cutC = abs(c - (uHole + 0.08));
      col *= 0.3 + 0.7 * smoothstep(0.0, 0.006 + aa, cutR);
      col *= 0.3 + 0.7 * smoothstep(0.0, 0.006 + ac, cutC);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const goldSide = new THREE.ShaderMaterial({
  uniforms: { ...shared, uReed: { value: 1 } },
  vertexShader: coinVert,
  fragmentShader: GL + /* glsl */ `
    uniform vec3 uLight; uniform float uLightI, uReed;
    varying vec3 vO, vW, vN, vNo, vX, vY;
    void main() {
      vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
      vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
      float r = length(vO.xy);
      if (uReed > 0.5 && r > 0.6) {
        float a = atan(vO.y, vO.x);
        float wall = 1.0 - smoothstep(0.15, 0.5, abs(vNo.z));
        float fr = a * 180.0 / (2.0 * PI);
        float fade = 1.0 - smoothstep(0.2, 0.5, fwidth(fr));
        N = normalize(N + normalize(-sin(a) * vX + cos(a) * vY) * cos(2.0 * PI * fr) * 0.5 * wall * fade);
      }
      vec3 col = polished(N, V, L, lc, 60.0) * (uReed > 0.5 && r < 0.6 ? 0.8 : 1.0);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});

const coinShape = new THREE.Shape();
coinShape.absarc(0, 0, 1, 0, Math.PI * 2, false);
const holePath = new THREE.Path();
holePath.moveTo(-HOLE, -HOLE); holePath.lineTo(-HOLE, HOLE); holePath.lineTo(HOLE, HOLE); holePath.lineTo(HOLE, -HOLE); holePath.lineTo(-HOLE, -HOLE);
coinShape.holes.push(holePath);
let coinGeo = new THREE.ExtrudeGeometry(coinShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.026, bevelSegments: 6, curveSegments: 200 });
coinGeo.translate(0, 0, -0.06);
coinGeo = toCreasedNormals(coinGeo, 0.6);
const coin = new THREE.Mesh(coinGeo, [faceMat, goldSide]);
// the door: the hole shows the mind, drawn from its own render
const door = new THREE.Mesh(new THREE.PlaneGeometry(HOLE * 2, HOLE * 2), new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uRT: { value: rtMind.texture }, uRes: { value: new THREE.Vector2(RW_, RH_) } },
  vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D uRT; uniform vec2 uRes; void main(){ gl_FragColor = vec4(texture2D(uRT, gl_FragCoord.xy / uRes).rgb, 1.0); }',
}));
coin.add(door);
const pivot = new THREE.Group();
pivot.position.copy(C);
pivot.add(coin);
outside.add(pivot);
const hideDoor = floor.onBeforeRender;
floor.onBeforeRender = (...a) => { door.visible = false; hideDoor.apply(floor, a); door.visible = true; };

// ------------------------------------------------------------------ the words: real 3D letters, engine-turned faces

const letterFace = new THREE.ShaderMaterial({
  uniforms: { ...shared, uC: { value: C }, uN: { value: 21 }, uDepth: { value: 0.0068 } },
  vertexShader: coinVert,
  fragmentShader: GL + /* glsl */ `
    uniform vec3 uLight, uC; uniform float uLightI, uN, uDepth;
    varying vec3 vO, vW, vN, vNo, vX, vY;
    void main() {
      vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
      vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
      float f1, f2; vec2 g1, g2;
      rose(vO.xy - uC.xy, uN, 0.34, 24.0, 2.0, f1, f2, g1, g2);
      vec3 col = turned(N, V, L, normalize(vX), normalize(vY), f1, f2, g1, g2, uDepth, lc);
      if (vO.z < 0.0) col = polished(N, V, L, lc, 40.0) * 0.6;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const letterSide = goldSide.clone();
letterSide.uniforms = { ...shared, uReed: { value: 0 } };
function word3d(text, right = '') {
  let g = new THREE.ExtrudeGeometry(wordShapes(layout(text, right)), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.034, bevelSegments: 5, curveSegments: 4 });
  g.translate(0, 0, -0.17);
  g = toCreasedNormals(g, 0.55);
  g.computeBoundingBox();
  const mesh = new THREE.Mesh(g, [letterFace, letterSide]);
  outside.add(mesh);
  return { mesh, x0: g.boundingBox.min.x, x1: g.boundingBox.max.x };
}
const BOB = word3d('B', 'B');
const HELLO = word3d('HELL');
HELLO.mesh.visible = false;

// ================================================================== INSIDE: the mind

const BRAIN_C = new THREE.Vector3(0, 1.55, phone ? -18 : -12);
const SB = 3.5;
const nebulaMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }',
  fragmentShader: GL + /* glsl */ `
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float n = fbm(d * 2.4 + vec3(1.3, 0.2, 0.0)), n2 = fbm(d * 5.5 - vec3(0.0, 1.1, 2.0));
      vec3 col = vec3(0.002, 0.001, 0.006) + vec3(0.01, 0.004, 0.02) * (1.0 - abs(d.y));
      col += vec3(0.26, 0.08, 0.42) * smoothstep(0.42, 0.95, n) * 0.22;
      col += vec3(0.62, 0.22, 0.58) * smoothstep(0.62, 0.98, n * n2 * 1.7) * 0.1;
      col += vec3(0.95, 0.56, 0.24) * smoothstep(0.8, 1.0, n2) * 0.035;
      vec3 sd = d * 300.0; float h = hash3(floor(sd));
      col += mix(vec3(1.0, 0.8, 0.55), vec3(0.75, 0.6, 1.0), step(0.5, fract(h * 13.0))) * step(0.996, h) * smoothstep(0.5, 0.1, length(fract(sd) - 0.5)) * 1.3;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const nebula = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), nebulaMat);
nebula.frustumCulled = false;
nebula.renderOrder = -20;
mind.add(nebula);

// --- the brain: the site's own brain field (src/journey/head/shape.ts), meshed with surface nets
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz, k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / rx, qy = py / ry, qz = pz / rz, k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
function cone(x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
  const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - mix(r1, r2, h);
}
// The site's brain (src/journey/head/shape.ts), reshaped for being seen whole from the side: a temporal lobe low at
// each side, the cerebellum tucked under the back, a short stem. The fine folds are drawn in the shader.
function brainSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0.25, 0.5, -0.06, 0.29, 0.34, 0.62);
  d = smin(d, ell(ax, y, z, 0.3, 0.25, 0.08, 0.22, 0.16, 0.36), 0.12);
  d = smax(d, 0.016 - ax, 0.03);
  d = smin(d, ell(x, y, z, 0, 0.12, -0.5, 0.33, 0.15, 0.2), 0.1);
  d = smin(d, cone(x, y, z, 0, 0.16, -0.24, 0, -0.12, -0.22, 0.075, 0.06), 0.08);
  const f = Math.sin(x * 23 + 1.7 * Math.sin(z * 14)) * Math.sin(z * 20 + 1.5 * Math.sin(y * 16)) * Math.sin(y * 18 + 1.2 * Math.sin(x * 12));
  return d + 0.007 * f;
}
function surfaceNets(f, lo, hi, n) {
  const step = (hi[0] - lo[0]) / n, nx = n, ny = Math.ceil((hi[1] - lo[1]) / step), nz = Math.ceil((hi[2] - lo[2]) / step);
  const X = nx + 1, Y = ny + 1;
  const V = new Float32Array(X * Y * (nz + 1));
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[i + X * (j + Y * k)] = f(lo[0] + i * step, lo[1] + j * step, lo[2] + k * step);
  const cell = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const off = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const v8 = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { v8[c] = V[i + off[c][0] + X * (j + off[c][1] + Y * (k + off[c][2]))]; if (v8[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if ((v8[a] < 0) === (v8[b] < 0)) continue;
      const t = v8[a] / (v8[a] - v8[b]);
      sx += off[a][0] + (off[b][0] - off[a][0]) * t; sy += off[a][1] + (off[b][1] - off[a][1]) * t; sz += off[a][2] + (off[b][2] - off[a][2]) * t; cnt++;
    }
    cell[i + nx * (j + ny * k)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / cnt) * step, lo[1] + (j + sy / cnt) * step, lo[2] + (k + sz / cnt) * step);
  }
  const idx = [];
  const C_ = (i, j, k) => cell[i + nx * (j + ny * k)];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = V[i + X * (j + Y * k)], b = V[i + 1 + X * (j + Y * k)];
    if ((a < 0) === (b < 0)) continue;
    quad(C_(i, j - 1, k - 1), C_(i, j, k - 1), C_(i, j, k), C_(i, j - 1, k), a < 0);
  }
  for (let k = 1; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
    const a = V[i + X * (j + Y * k)], b = V[i + X * (j + 1 + Y * k)];
    if ((a < 0) === (b < 0)) continue;
    quad(C_(i - 1, j, k - 1), C_(i - 1, j, k), C_(i, j, k), C_(i, j, k - 1), a < 0);
  }
  for (let k = 0; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const a = V[i + X * (j + Y * k)], b = V[i + X * (j + Y * (k + 1))];
    if ((a < 0) === (b < 0)) continue;
    quad(C_(i - 1, j - 1, k), C_(i, j - 1, k), C_(i, j, k), C_(i - 1, j, k), a < 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // normals from the field itself
  const nrm = new Float32Array(pos.length), h = step * 0.5;
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p], y = pos[p + 1], z = pos[p + 2];
    const gx = f(x + h, y, z) - f(x - h, y, z), gy = f(x, y + h, z) - f(x, y - h, z), gz = f(x, y, z + h) - f(x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[p] = gx / l; nrm[p + 1] = gy / l; nrm[p + 2] = gz / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  // make every triangle face outward, whatever the quad order gave
  const ix = g.index.array, P = g.attributes.position.array, va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let t = 0; t < ix.length; t += 3) {
    va.fromArray(P, ix[t] * 3); vb.fromArray(P, ix[t + 1] * 3); vc.fromArray(P, ix[t + 2] * 3);
    nn.subVectors(vb, va).cross(vc.sub(va));
    const n0 = ix[t] * 3;
    if (nn.x * nrm[n0] + nn.y * nrm[n0 + 1] + nn.z * nrm[n0 + 2] < 0) { const s = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s; }
  }
  return g;
}
const brainGeo = surfaceNets(brainSdf, [-0.62, -0.4, -0.8], [0.62, 0.9, 0.64], phone ? 84 : 112);

// gold circuits, drawn once and wrapped round the brain three ways
const pcb = tex(1024, 1024, (x, w) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, w);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  const G = 16;
  for (let n = 0; n < 230; n++) {
    let px = Math.round((rnd() * w) / G) * G, py = Math.round((rnd() * w) / G) * G, dir = Math.floor(rnd() * 4) * 2;
    x.lineWidth = 2 + rnd() * 2.5;
    x.beginPath(); x.moveTo(px, py);
    x.save(); x.beginPath(); x.arc(px, py, 5.5, 0, Math.PI * 2); x.fill(); x.restore();
    x.beginPath(); x.moveTo(px, py);
    const steps = 2 + Math.floor(rnd() * 7);
    for (let s = 0; s < steps; s++) {
      const len = G * (1 + Math.floor(rnd() * 5));
      if (rnd() < 0.45) dir = (dir + (rnd() < 0.5 ? 1 : 7)) % 8;
      const a = (dir * Math.PI) / 4, k = dir % 2 ? Math.SQRT2 : 1;
      px += Math.round(Math.cos(a) * k) * len / k * (dir % 2 ? 1 : 1); py += Math.round(Math.sin(a) * k) * len / k;
      x.lineTo(px, py);
    }
    x.stroke();
    x.beginPath(); x.arc(px, py, 6, 0, Math.PI * 2); x.fill();
    x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(px, py, 2.4, 0, Math.PI * 2); x.fill(); x.restore();
  }
});
pcb.generateMipmaps = true;
pcb.minFilter = THREE.LinearMipmapLinearFilter;

// the four studies' regions, in the brain's own units (the face is +z): frontal, motor strip, temporal, cerebellum
const REGIONS = [new THREE.Vector3(-0.24, 0.56, 0.36), new THREE.Vector3(-0.2, 0.83, 0.0), new THREE.Vector3(-0.5, 0.24, 0.12), new THREE.Vector3(-0.2, 0.06, -0.62)];
const brainUniforms = { ...shared, uPcb: { value: pcb }, uRegion: { value: REGIONS }, uActive: { value: 0 }, uLitAmt: { value: 0 }, uNM: { value: new THREE.Matrix3() } };
const brainMat = new THREE.ShaderMaterial({
  uniforms: brainUniforms,
  vertexShader: /* glsl */ `
    varying vec3 vO, vW, vNo;
    void main() { vO = position; vNo = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: GL + /* glsl */ `
    uniform sampler2D uPcb; uniform vec3 uLight; uniform vec3 uRegion[4]; uniform float uTime, uActive, uLitAmt; uniform mat3 uNM;
    varying vec3 vO, vW, vNo;
    // the folds: the zero lines of a warped sum of waves wander like sulci
    float gyri(vec3 p) {
      vec3 q = p * 52.0 + 1.4 * vec3(sin(p.y * 19.0 + 1.3), sin(p.z * 21.0 + 0.4), sin(p.x * 17.0 + 2.1));
      return sin(q.x + 1.4 * sin(q.y * 0.7)) + sin(q.y * 1.1 + 1.6 * sin(q.z * 0.6)) + sin(q.z * 0.9 + 1.2 * sin(q.x * 0.8));
    }
    float bump(vec3 p) { return smoothstep(0.0, 1.1, abs(gyri(p))); }
    void main() {
      vec3 nO = normalize(vNo);
      float A = gyri(vO), hgt = smoothstep(0.0, 1.1, abs(A));
      float e = 0.0025;
      vec3 g = vec3(bump(vO + vec3(e, 0, 0)) - bump(vO - vec3(e, 0, 0)), bump(vO + vec3(0, e, 0)) - bump(vO - vec3(0, e, 0)), bump(vO + vec3(0, 0, e)) - bump(vO - vec3(0, 0, e))) / (2.0 * e);
      vec3 N = normalize(uNM * normalize(nO - (g - dot(g, nO) * nO) * 0.0075));
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
      float wA = fwidth(A);
      float sulcus = 1.0 - smoothstep(wA * 0.5, wA * 1.4 + 0.035, abs(A));
      vec3 w = pow(abs(nO), vec3(4.0)); w /= w.x + w.y + w.z;
      float s = 2.3;
      float tr = texture2D(uPcb, vO.zy * s).r * w.x + texture2D(uPcb, vO.xz * s + 0.37).r * w.y + texture2D(uPcb, vO.xy * s + 0.71).r * w.z;
      float lit = 0.0;
      for (int i = 0; i < 4; i++) { float d = length(vO - uRegion[i]); lit += (abs(float(i) - uActive) < 0.5 ? 1.0 : 0.0) * exp(-d * d / 0.028); }
      lit *= uLitAmt;
      float pulse = pow(0.5 + 0.5 * sin(dot(vO, vec3(9.0, 13.0, 7.0)) * 1.7 - uTime * 2.4), 18.0);
      vec3 L = normalize(uLight - vW), Hh = normalize(L + V);
      float spec = pow(max(dot(N, Hh), 0.0), 60.0);
      // dark violet glass, folds lit from the edges, the sulci drawn in gold
      vec3 col = mix(vec3(0.004, 0.002, 0.01), vec3(0.03, 0.012, 0.055), hgt);
      col += vec3(0.4, 0.18, 0.7) * fres * 0.55 * (0.4 + 0.6 * hgt);
      col += env(reflect(-V, N)) * 0.08 * hgt + vec3(1.0, 0.86, 0.7) * spec * 0.28 * hgt;
      col += GOLD * sulcus * (0.22 + pulse * 1.3 + lit * 2.4);
      col += GOLD * tr * hgt * (0.05 + lit * 0.5);
      col += GOLD * lit * 0.07;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const brainGroup = new THREE.Group();
brainGroup.position.copy(BRAIN_C);
brainGroup.rotation.y = Math.PI / 2;
brainGroup.scale.setScalar(SB);
const BRAIN_MID = new THREE.Vector3(0, 0.25, -0.08);
const brainMesh = new THREE.Mesh(brainGeo, brainMat);
brainMesh.position.copy(BRAIN_MID).negate();
brainGroup.add(brainMesh);
mind.add(brainGroup);
// a violet halo round it, so it stands off the nebula
const halo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: tex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(150,80,230,0.55)'); g.addColorStop(0.45, 'rgba(110,50,190,0.18)'); g.addColorStop(1, 'rgba(60,20,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }, true),
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
}));
halo.scale.setScalar(13);
halo.position.copy(BRAIN_C);
mind.add(halo);

// neurons: sparks on the surface, brighter in the lit region
{
  const P = brainGeo.attributes.position.array, Nn = brainGeo.attributes.normal.array, n = phone ? 3000 : 6500;
  const pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rnd() * (P.length / 3)) * 3;
    for (let c = 0; c < 3; c++) pos[i * 3 + c] = P[v + c] + Nn[v + c] * 0.008;
    sd[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const sparks = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: shared.uTime, uDpr: { value: DPR }, uRegion: { value: REGIONS }, uActive: brainUniforms.uActive, uLitAmt: brainUniforms.uLitAmt },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uDpr, uActive, uLitAmt; uniform vec3 uRegion[4]; varying float vSeed, vLit;
      void main() {
        vSeed = aSeed;
        float lit = 0.0;
        for (int i = 0; i < 4; i++) { float d = length(position - uRegion[i]); lit += (abs(float(i) - uActive) < 0.5 ? 1.0 : 0.0) * exp(-d * d / 0.03); }
        vLit = lit * uLitAmt;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (1.2 + 2.6 * aSeed * aSeed + vLit * 3.0) * uDpr * 12.0 / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying float vSeed, vLit;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r);
        float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.3 + vSeed * 80.0), 3.0);
        vec3 c = mix(vec3(0.62, 0.38, 1.0), vec3(1.0, 0.7, 0.34), step(0.45, vSeed));
        gl_FragColor = vec4(c * a * (tw * 0.55 + vLit * 2.0), 1.0);
      }`,
  }));
  sparks.position.copy(BRAIN_MID).negate();
  brainGroup.add(sparks);
}

// rings round the brain, slowly turning, and a projector plate beneath it
const ringMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: shared.uTime },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv;
    void main() {
      float tick = smoothstep(0.8, 1.0, sin(vUv.x * 6.2831 * 90.0)) * 0.5;
      float run = pow(fract(vUv.x - uTime * 0.05), 10.0);
      gl_FragColor = vec4(vec3(1.0, 0.66, 0.32) * (0.14 + tick * 0.22 + run * 1.3), 1.0);
    }`,
});
const rings = [];
[[3.2, 0.01, 1.25, 0.35], [3.6, 0.007, -0.45, 1.15], [4.05, 0.008, 0.25, -0.75]].forEach(([r, t, rx, rz]) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 360), ringMat);
  ring.position.copy(BRAIN_C);
  ring.rotation.set(rx, 0, rz);
  ring.userData.spin = rx;
  mind.add(ring);
  rings.push(ring);
});
const plate = new THREE.Mesh(new THREE.CircleGeometry(7.5, 128), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: shared.uTime },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vP;
    void main() {
      float r = length(vP), a = atan(vP.y, vP.x);
      float fw = max(fwidth(r), 1e-4);
      float dense = 1.0 - smoothstep(0.05, 0.16, fw);   // close up and edge-on the lines would fill in: fade them
      float rings = (1.0 - smoothstep(0.0, fw * 1.5, abs(fract(r * 2.0 + 0.5) - 0.5) / 2.0)) * dense;
      float major = (1.0 - smoothstep(0.0, fw * 1.5, abs(fract(r / 1.5 + 0.5) - 0.5) * 1.5)) * (1.0 - smoothstep(0.2, 0.5, fw));
      float ticks = smoothstep(0.7, 1.0, sin(a * 120.0)) * step(abs(r - 6.6), 0.18);
      float sweep = pow(fract((a / 6.2831) - uTime * 0.04), 60.0);
      float edge = smoothstep(7.5, 4.5, r);
      vec3 c = vec3(1.0, 0.62, 0.3) * (rings * 0.12 + major * 0.35 + ticks * 0.5) + vec3(0.6, 0.35, 1.0) * sweep * (rings + major) * 0.6;
      gl_FragColor = vec4(c * edge, 1.0);
    }`,
}));
plate.rotation.x = -Math.PI / 2;
plate.position.set(BRAIN_C.x, BRAIN_C.y - 2.9, BRAIN_C.z);
mind.add(plate);
dust(mind, 2400, [-14, -4, -26, 14, 8, 2], 30, new THREE.Color(0, 0, 0), 0.02);

// ------------------------------------------------------------------ the works, made by the brain, on an arc round it

const works = await loadWorks(renderer);
const RW = 5.9, ARC = 0.56, PW = 2.6, PH = 1.625;
const workMats = [];
const arc = new THREE.Group();
arc.position.copy(BRAIN_C);
mind.add(arc);
const panels = works.map((w, i) => {
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true,
    uniforms: { ...shared, uTex: { value: w.tex }, uSize: { value: new THREE.Vector2(PW, PH) }, uFocus: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GL + /* glsl */ `
      uniform sampler2D uTex; uniform vec2 uSize; uniform vec3 uLight; uniform float uLightI, uFocus, uAlpha;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        vec2 p = vUv * uSize;
        float b = 0.028;
        vec2 q = (p - b) / (uSize - 2.0 * b);
        vec3 V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
        vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
        vec3 col;
        if (any(lessThan(q, vec2(0.0))) || any(greaterThan(q, vec2(1.0)))) {
          vec2 d = min(p, uSize - p) / b;
          float t = min(d.x, d.y);
          vec2 dir = (d.x < d.y) ? vec2(p.x < uSize.x * 0.5 ? -1.0 : 1.0, 0.0) : vec2(0.0, p.y < uSize.y * 0.5 ? -1.0 : 1.0);
          col = polished(normalize(vec3(dir * (1.0 - t) * 0.8, 1.0)), V, L, lc, 70.0);
        } else {
          vec3 pic = texture2D(uTex, q).rgb;
          float lum = pow(dot(pic, vec3(0.2126, 0.7152, 0.0722)), 0.42);
          float y = q.y * 110.0 + lum * 0.45, wv = max(fwidth(y), 1e-4), th = 0.1 + 0.78 * lum;
          float ln = smoothstep(th * 0.5 + wv, th * 0.5 - wv, abs(fract(y) - 0.5));
          vec3 eng = mix(vec3(0.015, 0.006, 0.03), GOLD * (0.34 + 0.6 * lum), ln);
          col = mix(eng, pic * (0.92 + 0.08 * ln), smoothstep(0.0, 1.0, uFocus));
        }
        gl_FragColor = vec4(col, uAlpha);
        #include <colorspace_fragment>
      }`,
  });
  workMats.push(mat);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  arc.add(mesh);
  return mesh;
});

// ================================================================== the journey

const fitW = (width, share) => width / share / (2 * TAN * ASPECT);
const lookFrom = (pos, target) => target.clone().sub(pos).normalize();
const F_POS = new THREE.Vector3(0, phone ? 1.4 : 0.92, Math.max(fitW(BOB.x1 - BOB.x0, phone ? 0.86 : 0.6), phone ? 8 : 0));
const F_DIR = lookFrom(F_POS, new THREE.Vector3(0, C.y + (phone ? 0.05 : 0.16), 0));
const ABOUT = phone ? new THREE.Vector3(0, 0.6, 15.5) : new THREE.Vector3(-1.85, 0.12, 11.2); // offset from the brain
const YAW = [0.32, 0.05, 0.0, -0.42], PITCH = [0.0, 0.28, -0.05, -0.1];
const aboutPose = (s) => {
  const i = Math.min(3, Math.floor(s)), j = Math.min(3, i + 1), t = ease(s - i);
  const yaw = mix(YAW[i], YAW[j], t), pitch = mix(PITCH[i], PITCH[j], t);
  const off = ABOUT.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -pitch).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const pos = BRAIN_C.clone().add(off);
  const target = BRAIN_C.clone().add(new THREE.Vector3(ABOUT.x, phone ? -2.6 : 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  return { pos, dir: lookFrom(pos, target) };
};
const A0 = aboutPose(0);
const W_POS = BRAIN_C.clone().add(new THREE.Vector3(0, 0.75, RW + (phone ? 6.2 : 4.3)));
const W_DIR = lookFrom(W_POS, BRAIN_C.clone().add(new THREE.Vector3(0, 0.15, RW)));
const helloW = 1.05 - HELLO.x0;
const E_POS = new THREE.Vector3((HELLO.x0 + 1.05) / 2, phone ? 1.6 : 0.95, fitW(helloW, phone ? 0.78 : 0.7));
const E_DIR = lookFrom(E_POS, new THREE.Vector3(E_POS.x, C.y - (phone ? 1.6 : 1.15), 0));
const enter = new THREE.CatmullRomCurve3([F_POS, new THREE.Vector3(0, C.y, 2.6), new THREE.Vector3(0, C.y, 0), new THREE.Vector3(A0.pos.x * 0.45, mix(C.y, A0.pos.y, 0.5), A0.pos.z * 0.45 - 0.4), A0.pos], false, 'centripetal');
const leave = new THREE.CatmullRomCurve3([W_POS, new THREE.Vector3(0, C.y + 0.25, -1.4), new THREE.Vector3(0, C.y, 0), new THREE.Vector3(0, C.y, 2.8), E_POS], false, 'centripetal');
const STRAIGHT = new THREE.Vector3(0, 0, -1);
// the scroll points where the camera passes the coin, going in and coming out
let P_IN = 1, P_OUT = 9;
for (let i = 0; i <= 400; i++) { const p = i / 400; if (enter.getPointAt(ease(p)).z < 0) { P_IN = p; break; } }
for (let i = 400; i >= 0; i--) { const p = i / 400; if (leave.getPointAt(ease(p)).z < 0) { P_OUT = 9 + p; break; } }

// DOM
const $ = (s) => document.querySelector(s);
const secs = { intro: $('#intro'), about: $('#about'), works: $('#works'), end: $('#end') };
const lis = [...document.querySelectorAll('.studies li')];
const regionLabel = $('.region');
const NAMES = ['码 · Software Engineering', '戏 · Game & App Development', '安 · Cybersecurity', '机 · Mechatronics'];
const wk = worksChrome(secs.works);
const dot = $('.dot'), sig = $('.sig');
$('#end .below').style.top = `${H * (phone ? 0.6 : 0.7)}px`;
const project = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, p.z]; };

const scroll = scroller(11);
const ptr = pointer(phone ? [0.7, 0.3] : [0.63, 0.34]);
const live = !scroll.fixed;
const t0 = performance.now();
const steps = (x, n) => { x = clamp(x, 0, n); const i = Math.min(n, Math.floor(x)); return i + ease(x - i); };
addEventListener('click', (e) => {
  if (scroll.goal < 9.6) return;
  const [cx, cy] = project(C);
  if (Math.hypot(e.clientX - cx, e.clientY - cy) < 90) location.href = 'mailto:bhccob@gmail.com';
});
addEventListener('resize', () => location.reload());
const tmp = new THREE.Vector3(), dir = new THREE.Vector3();

function frame(now) {
  const p = scroll.tick(now);
  ptr.tick(0.09);
  const time = live ? (now - t0) / 1000 : 4.2;
  shared.uTime.value = time;
  floor.material.uniforms.uTime.value = time;

  // where the camera is
  let pos, look;
  if (p <= 1) {
    const u = ease(p);
    pos = enter.getPointAt(u);
    look = F_DIR.clone().lerp(STRAIGHT, clamp(u / 0.4)).lerp(A0.dir, clamp((u - 0.62) / 0.38)).normalize();
  } else if (p <= 4) {
    const a = aboutPose(p - 1); pos = a.pos; look = a.dir;
  } else if (p <= 5) {
    const a = aboutPose(3), t = ease(p - 4);
    pos = a.pos.clone().lerp(W_POS, t); look = a.dir.clone().lerp(W_DIR, t).normalize();
    pos.y += Math.sin(t * Math.PI) * 1.2;
  } else if (p <= 9) { pos = W_POS.clone(); look = W_DIR.clone(); }
  else {
    const u = ease(p - 9);
    pos = leave.getPointAt(u);
    look = W_DIR.clone().lerp(STRAIGHT, clamp(u / 0.3)).lerp(E_DIR, clamp((u - 0.6) / 0.4)).normalize();
  }
  // a little life from the pointer
  const px = ptr.x / W - 0.5, py = ptr.y / H - 0.5;
  const sway = (1 - span(p, 0.15, 0.5)) * (p < 1 ? 1 : 0) + (p > 1 ? 0.6 : 0) * (1 - span(p, 9.05, 9.5)) + span(p, 9.7, 10);
  camera.position.copy(pos).add(tmp.set(px * 0.35 * sway, -py * 0.2 * sway, 0));
  camera.lookAt(dir.copy(camera.position).add(look));
  camera.updateMatrixWorld();
  const isInside = p >= P_IN && p <= P_OUT;

  // the coin: tilts to the pointer on the front and the end, shows its back for hello
  const tilt = (1 - span(p, 0.1, 0.4)) + span(p, 9.6, 10);
  pivot.rotation.set(py * 0.25 * tilt, (p > 5 && p < 9.95 ? Math.PI : p >= 9.95 ? Math.PI : 0) + px * 0.4 * tilt, 0);
  BOB.mesh.visible = p < 5;
  HELLO.mesh.visible = p >= 5;
  sky.material.uniforms.uSun.value.copy(C).sub(camera.position).normalize();

  // the light rides above the pointer
  const nx = ptr.x / W * 2 - 1, ny = 1 - ptr.y / H * 2;
  const ray = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
  const planeZ = isInside ? (p > 4.5 && p < 9.2 ? BRAIN_C.z + RW : BRAIN_C.z + 2) : 0;
  const tHit = Math.abs(ray.z) > 1e-3 ? (planeZ - camera.position.z) / ray.z : 6;
  light.copy(camera.position).addScaledVector(ray, clamp(tHit, 1, 40)).add(tmp.set(0, 0, 0)).addScaledVector(ray, -Math.min(4, 0.45 * clamp(tHit, 1, 40)));

  // the mind
  const study = clamp(p - 1, 0, 3);
  brainUniforms.uActive.value = Math.round(study);
  brainUniforms.uLitAmt.value = span(p, 0.7, 1.0) * (1 - span(p, 4.1, 4.5));
  brainGroup.rotation.y = Math.PI / 2 + (live ? Math.sin(time * 0.15) * 0.05 : 0);
  brainGroup.updateMatrixWorld();
  brainUniforms.uNM.value.setFromMatrix4(brainMesh.matrixWorld);
  rings.forEach((r, i) => { r.rotation.y = time * (0.05 + i * 0.02) * (i % 2 ? -1 : 1); });

  // the works: out of the brain onto the arc, then the arc turns one work per step
  const out = span(p, 4.15, 4.95), back = 1 - span(p, 9.55, 9.85);
  const s = clamp(p - 5, 0, 4);
  const lean = live ? px * 0.8 * ARC * span(p, 4.9, 5.2) * (1 - span(p, 8.9, 9.2)) : 0;
  const turn = (0.7 * steps(s, 4) + 0.3 * s) * ARC + lean;
  panels.forEach((m, i) => {
    const a = i * ARC - turn, r = mix(0.4, RW, out);
    m.position.set(Math.sin(a) * r, mix(0, 0.05, out) + Math.sin(time * 0.6 + i) * 0.04, Math.cos(a) * r);
    m.rotation.set(0, a, 0);
    m.scale.setScalar(mix(0.15, 1, out));
    const off = Math.abs(a);
    workMats[i].uniforms.uFocus.value = (1 - clamp(off / (ARC * 0.6))) * span(p, 4.7, 5.1);
    workMats[i].uniforms.uAlpha.value = out * back * (1 - clamp((off - ARC * 2.2) / ARC));
  });
  arc.visible = p > 4.1 && p < 9.9;

  // DOM
  const op = (el, v) => { el.style.opacity = v.toFixed(3); };
  op(secs.intro, 1 - span(p, 0, 0.22));
  const [sx, sy] = project(new THREE.Vector3(D_EM / 2 * EMU + GAP * EMU, BASE_Y - 0.05, 0.3));
  const fontPx = Math.max(10, (project(new THREE.Vector3(0, C.y + 0.36, 0.3))[1] - project(new THREE.Vector3(0, C.y - 0.36, 0.3))[1]) * -1);
  Object.assign(sig.style, { left: `${sx - fontPx * 0.15}px`, top: `${sy - fontPx * 0.2}px`, fontSize: `${Math.abs(fontPx) * 0.9}px`, transform: 'rotate(-7deg)' });
  op(secs.about, span(p, 0.75, 1) * (1 - span(p, 4.0, 4.3)));
  const si = Math.round(study);
  lis.forEach((li, i) => li.classList.toggle('on', i === si));
  const rw = brainMesh.localToWorld(REGIONS[si].clone());
  const [rx, ry] = project(rw);
  regionLabel.textContent = NAMES[si];
  Object.assign(regionLabel.style, { left: `${rx}px`, top: `${ry}px`, opacity: (1 - Math.abs(study - si) * 2.2).toFixed(3) });
  op(secs.works, span(p, 4.75, 5.05) * (1 - span(p, 9.0, 9.2)));
  wk.set(Math.round(s), works);
  wk.el.style.opacity = secs.works.style.opacity;
  op(secs.end, span(p, 9.75, 10));
  dot.style.transform = `translate(${ptr.x}px, ${ptr.y}px)`;

  // draw: the mind (into the door, or straight to the screen once you are inside), then the world
  if (isInside) {
    pass.scene = mind;
  } else {
    renderer.setRenderTarget(rtMind);
    renderer.clear();
    renderer.render(mind, camera);
    renderer.setRenderTarget(null);
    pass.scene = outside;
  }
  composer.render();
}

document.body.dataset.on = '';
if (live) {
  const loop = (now) => { frame(now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  ready();
} else {
  frame(performance.now());
  requestAnimationFrame(() => { frame(performance.now()); ready(); });
}
