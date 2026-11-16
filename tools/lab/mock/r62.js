// LAB ONLY (throwaway). Round 63: the parts the three ideas share. The engine (renderer, glow, a NaN guard, portals), the
// outside world from round 62 (night grid, monoliths, dust, the low sun, 3D gold BOB, the coin with a door in its hole)
// and the brain (the site's own brain field, wired in gold). Code art only.
import { THREE, clamp, ease, mix, span, scroller, pointer, ready, worksChrome } from './r60.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, clamp, ease, mix, span, scroller, pointer, ready, worksChrome };
export const W = innerWidth, H = innerHeight, ASPECT = W / H, DPR = Math.min(2, devicePixelRatio);
export const phone = W < 700;
export const FOV = phone ? 42 : 30, TAN = Math.tan((FOV * Math.PI) / 360);
document.body.classList.toggle('phone', phone);
export const HOLE = 0.27;

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
export const EMU = 2 / D_EM;
const O_CY = (gO.a - gO.d) / 2;
const GAP = 0.06;
const BASE_Y = 0.14; // the letters float a hand above the floor
export const C = new THREE.Vector3(0, BASE_Y + O_CY * EMU, 0); // the coin's middle

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
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
export const outside = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.01, 900);
camera.matrixAutoUpdate = false;
const RW_ = Math.round(W * DPR), RH_ = Math.round(H * DPR);
export const makeRT = (w = RW_, h = RH_) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
export const RES = new THREE.Vector2(RW_, RH_);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR);
composer.setSize(W, H);
const pass = new RenderPass(outside, camera);
composer.addPass(pass);

// ------------------------------------------------------------------ poses, portals, drawing

/** A camera pose: where it stands, which way it looks, its vertical field of view. */
export const pose = (pos, target, fov = FOV) => {
  const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0));
  return { pos: pos.clone(), q: new THREE.Quaternion().setFromRotationMatrix(m), fov };
};
export const lerpPose = (a, b, t) => ({ pos: a.pos.clone().lerp(b.pos, t), q: a.q.clone().slerp(b.q, t), fov: mix(a.fov, b.fov, t) });
/** Puts a camera at a pose. */
export function place(cam, p, aspect = ASPECT, near = 0.01) {
  cam.position.copy(p.pos); cam.quaternion.copy(p.q); cam.scale.set(1, 1, 1);
  cam.fov = p.fov; cam.aspect = aspect; cam.near = near; cam.updateProjectionMatrix();
  cam.updateMatrix(); cam.matrixWorld.copy(cam.matrix); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
}
/** A frame for a portal: an origin, a rotation, a size. Its +z points out of the portal toward you. */
export const frame = (pos, quat = new THREE.Quaternion(), scale = 1) => new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(scale, scale, scale));
/**
 * A portal from frame A in one scene to frame B in another: a pose seen through A maps to a pose in B. Going through A
 * (crossing its plane from +z to -z) puts you in B. `clip`: cut away what lies behind B's plane, for portals set in a wall.
 */
export function portal(A, B, { clip = false } = {}) {
  const M = B.clone().multiply(A.clone().invert());
  const Ainv = A.clone().invert();
  const s = new THREE.Vector3(), q = new THREE.Quaternion(), t = new THREE.Vector3();
  M.decompose(t, q, s);
  const bPos = new THREE.Vector3(), bQ = new THREE.Quaternion(), bS = new THREE.Vector3();
  B.decompose(bPos, bQ, bS);
  const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(bQ);
  return {
    scale: s.x,
    plane: clip ? new THREE.Plane().setFromNormalAndCoplanarPoint(normal, bPos) : null,
    /** A pose in A mapped into B. */
    map: (p) => ({ pos: p.pos.clone().applyMatrix4(M), q: q.clone().multiply(p.q), fov: p.fov }),
    /** How far in front of A's plane a point is (negative once through). */
    side: (v) => v.clone().applyMatrix4(Ainv).z,
  };
}
const pcam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.01, 900);
pcam.matrixAutoUpdate = false;
/** Renders `scene` from pose `p` into a target (for a portal or a screen). */
export function renderTo(rt, scene, p, { aspect = ASPECT, near = 0.01, clip = null } = {}) {
  place(pcam, p, aspect, near);
  renderer.clippingPlanes = clip ? [clip] : [];
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, pcam);
  renderer.setRenderTarget(null);
  renderer.clippingPlanes = [];
}
/** The final picture: one scene, the camera, the glow. */
export function present(scene, p, near = 0.01) {
  place(camera, p, ASPECT, near);
  pass.scene = scene;
  composer.render();
}
// keep a stray NaN or overflow from one pixel out of the bloom, which would spread it over the whole screen
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = min(c, vec4(32.0)); }',
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.45, 1.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());

export const tex = (w, h, draw, srgb = false) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
export const blurred = (src, px) => tex(src.image.width, src.image.height, (x) => { x.filter = `blur(${px}px)`; x.drawImage(src.image, 0, 0); });

// ------------------------------------------------------------------ shading shared by everything

export const GL = /* glsl */ `
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
export const FOG_OUT = new THREE.Color(0.016, 0.007, 0.03);
export const light = new THREE.Vector3(0, 2, 5);
export const shared = { uLight: { value: light }, uLightI: { value: 1.25 }, uTime: { value: 0 } };
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
export const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), new THREE.ShaderMaterial({
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
export const floor = new Reflector(new THREE.PlaneGeometry(900, 900), { shader: floorShader, textureWidth: Math.round(W * DPR * 0.6), textureHeight: Math.round(H * DPR * 0.6), clipBias: 0.002 });
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
export function dust(scene, n, box, size, fogC, dens) {
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
export const faceMat = new THREE.ShaderMaterial({
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
export const goldSide = new THREE.ShaderMaterial({
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
export let coinGeo = new THREE.ExtrudeGeometry(coinShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.026, bevelSegments: 6, curveSegments: 200 });
coinGeo.translate(0, 0, -0.06);
coinGeo = toCreasedNormals(coinGeo, 0.6);
export const coin = new THREE.Mesh(coinGeo, [faceMat, goldSide]);
// the door: the hole shows the mind, drawn from its own render
export const door = new THREE.Mesh(new THREE.PlaneGeometry(HOLE * 2, HOLE * 2), new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uRT: { value: null }, uRes: { value: RES } },
  vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D uRT; uniform vec2 uRes; void main(){ gl_FragColor = vec4(texture2D(uRT, gl_FragCoord.xy / uRes).rgb, 1.0); }',
}));
coin.add(door);
export const pivot = new THREE.Group();
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
export function word3d(text, right = '') {
  let g = new THREE.ExtrudeGeometry(wordShapes(layout(text, right)), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.034, bevelSegments: 5, curveSegments: 4 });
  g.translate(0, 0, -0.17);
  g = toCreasedNormals(g, 0.55);
  g.computeBoundingBox();
  const mesh = new THREE.Mesh(g, [letterFace, letterSide]);
  outside.add(mesh);
  return { mesh, x0: g.boundingBox.min.x, x1: g.boundingBox.max.x };
}
export const BOB = word3d('B', 'B');
export const HELLO = word3d('HELL');
HELLO.mesh.visible = false;


// ================================================================== the brain (built on request)

export function makeBrain(BRAIN_C, SB, scene) {
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
scene.add(brainGroup);
// a violet halo round it, so it stands off the nebula
const halo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: tex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(150,80,230,0.55)'); g.addColorStop(0.45, 'rgba(110,50,190,0.18)'); g.addColorStop(1, 'rgba(60,20,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }, true),
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
}));
halo.scale.setScalar(SB * 3.7);
halo.position.copy(BRAIN_C);
scene.add(halo);

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

  return { group: brainGroup, mesh: brainMesh, uniforms: brainUniforms, regions: REGIONS, halo };
}
