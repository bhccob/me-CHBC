// LAB ONLY (throwaway). Round 61, "Square Inside": the whole site is one gold coin, the O in BOB. You meet Bob on its
// face, turn it like a dial for his four studies (the four characters round the hole), go through its square hole to
// see the work, and come back out to say hello. One look: engine-turned gold and purple enamel, lit by the pointer.
// Round patterns outside the coin, straight lines inside it. Code art only.
//   ?p=0 front · 1..4 studies · 5..9 works · 10 hello      (?f=N is p = N - 1)
import { THREE, clamp, ease, mix, span, scroller, pointer, loadWorks, ready, worksChrome } from './r60.js';

const W = innerWidth, H = innerHeight, ASPECT = W / H, DPR = Math.min(2, devicePixelRatio);
const FOV = 30, TAN = Math.tan((FOV * Math.PI) / 360), PX = H / 2 / TAN; // a unit at distance d is PX / d pixels
const HOLE = 0.27; // half the square hole's side, in coin radii
const phone = W < 700;
const WORKS_Z = -7.5, INSIDE_Z = -1.5;
const WS = Math.min(1, (0.84 * W * (INSIDE_Z - WORKS_Z)) / PX / 2.88); // works shrink to fit narrow screens
const WORK_W = 2.88 * WS, WORK_H = 1.8 * WS, WORK_GAP = 0.36 * WS;
document.body.classList.toggle('phone', phone);
const q = new URLSearchParams(location.search);

await Promise.all(['900 400px Barlow', '400 16px Barlow', '600 17px Barlow', '700 60px Barlow', '500 11px "IBM Plex Mono"'].map((f) => document.fonts.load(f)));
await document.fonts.load('400 60px "Ma Shan Zheng"', 'Chung码戏安机外圆内方');

// ------------------------------------------------------------------ the name, measured

const m = document.createElement('canvas').getContext('2d');
m.font = '900 1000px Barlow';
const glyph = (ch) => {
  const g = m.measureText(ch);
  return { adv: g.width / 1000, l: g.actualBoundingBoxLeft / 1000, r: g.actualBoundingBoxRight / 1000, a: g.actualBoundingBoxAscent / 1000, d: g.actualBoundingBoxDescent / 1000 };
};
const gO = glyph('O');
const D_EM = (gO.a + gO.d) * 1.06; // the coin is the O, a little proud of it
const EMU = 2 / D_EM; // world units (coin radii) per em
const O_CY = (gO.a - gO.d) / 2; // the O's middle, above the baseline, in em
const GAP = 0.055; // em between the coin and its neighbours

/** Letters laid out round the coin (at the origin): `left` read towards the coin, `right` away from it. In em. */
function layout(left, right) {
  const set = (text) => { let pen = 0; return [...text].map((ch) => { const g = glyph(ch), l = { ch, x: pen, g }; pen += g.adv - 0.01; return l; }); };
  const L = set(left), R = set(right);
  if (L.length) { const last = L.at(-1), shift = -(D_EM / 2 + GAP) - (last.x + last.g.r); L.forEach((l) => { l.x += shift; }); }
  if (R.length) { const first = R[0], shift = D_EM / 2 + GAP - (first.x - first.g.l); R.forEach((l) => { l.x += shift; }); }
  return [...L, ...R];
}

// ------------------------------------------------------------------ renderer, scene, camera

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.01, 200);

const tex = (w, h, draw, srgb = false) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h, c);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};
const blurred = (src, px) => tex(src.image.width, src.image.height, (x) => { x.filter = `blur(${px}px)`; x.drawImage(src.image, 0, 0); });

// ------------------------------------------------------------------ shared shading

const GL = /* glsl */ `
  #define PI 3.14159265
  const vec3 GOLD = vec3(0.92, 0.53, 0.22);
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // The room the gold reflects: a softbox above, a strip on the left, a violet kicker on the right, a warm card behind
  // the viewer, purple dark everywhere else. World directions; the camera always looks down -z.
  vec3 env(vec3 R) {
    float up = R.y;
    vec3 c = mix(vec3(0.014, 0.006, 0.03), vec3(0.07, 0.034, 0.10), smoothstep(-0.7, 0.3, up));
    c += vec3(1.0, 0.84, 0.62) * 1.45 * smoothstep(0.3, 0.82, up) * smoothstep(-0.6, 0.4, R.z);
    c += vec3(1.0, 0.86, 0.68) * 0.85 * exp(-pow((R.x + 0.6) / 0.13, 2.0)) * smoothstep(-0.5, 0.3, up + 0.2);
    c += vec3(0.55, 0.32, 0.85) * 0.32 * exp(-pow((R.x - 0.7) / 0.18, 2.0));
    c += vec3(0.40, 0.26, 0.15) * smoothstep(0.5, 1.0, R.z) * (0.55 + 0.5 * up);
    return c;
  }
  vec3 envD(vec3 N) { return mix(vec3(0.04, 0.02, 0.07), vec3(0.40, 0.30, 0.23), N.y * 0.5 + 0.5) * (0.55 + 0.45 * max(N.z, 0.0)); }
  float kk(vec3 T, vec3 H, float e) { float d = dot(T, H); return pow(sqrt(max(0.0, 1.0 - d * d)), e); }
  vec3 fresnel(vec3 n, vec3 V) { return GOLD + (1.0 - GOLD) * pow(1.0 - max(dot(n, V), 0.0), 5.0); }

  // Two crossing families of waved rings round the origin (an engine-turned rose), with their gradients.
  void rose(vec2 p, float N, float A, float m, float tw, out float f1, out float f2, out vec2 g1, out vec2 g2) {
    float r = max(length(p), 1e-4), a = atan(p.y, p.x);
    vec2 er = p / r, ea = vec2(-er.y, er.x);
    float s1 = m * a + tw * r, s2 = m * a - tw * r + PI;
    f1 = r * N + A * sin(s1);
    f2 = r * N + A * sin(s2);
    g1 = er * (N + A * cos(s1) * tw) + ea * (A * cos(s1) * m / r);
    g2 = er * (N - A * cos(s2) * tw) + ea * (A * cos(s2) * m / r);
  }

  // Engine-turned gold: the cuts tilt the normal (faded out where they get finer than a pixel) and the pointer's light
  // runs along them as a sheen.
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
`;

const light = new THREE.Vector3(0, 0, 3);
const shared = { uLight: { value: light }, uLightI: { value: 1.6 } };

// ------------------------------------------------------------------ the ground: purple enamel over engine-turning

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uRes: { value: new THREE.Vector2(W, H) }, uDpr: { value: DPR }, uC: { value: new THREE.Vector2(W / 2, H / 2) }, uR: { value: 200 }, uPtr: { value: new THREE.Vector2() }, uInside: { value: 0 }, uShadow: { value: 1 } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: GL + /* glsl */ `
      uniform vec2 uRes, uC, uPtr; uniform float uDpr, uR, uInside, uShadow;
      void main() {
        vec2 px = gl_FragCoord.xy / uDpr;
        float toCoin = length(px - uC);
        vec3 deep = vec3(0.0052, 0.0021, 0.0125), pool = vec3(0.019, 0.0066, 0.043);
        float lift = exp(-pow(toCoin / (1.05 * uRes.y), 2.0));
        vec3 col = mix(deep, pool, lift * (1.0 - uInside) + 0.55 * uInside * exp(-pow(abs(px.y - uRes.y * 0.5) / (0.6 * uRes.y), 2.0)));

        vec3 L = normalize(vec3(uPtr - px, 0.42 * uRes.y)), Hv = normalize(L + vec3(0.0, 0.0, 1.0));
        float near = exp(-pow(length(uPtr - px) / (0.55 * uRes.y), 2.0));

        // Outside: a rose round the coin. Its rings scale with the coin, so diving in keeps them in step.
        float f1, f2; vec2 g1, g2;
        rose((px - uC) / uR, 15.0, 0.42, 24.0, 1.2, f1, f2, g1, g2);
        float k = 1.0 - smoothstep(0.18, 0.5, fwidth(f1));
        float ridge = smoothstep(0.86, 1.0, sin(2.0 * PI * f1)) + smoothstep(0.86, 1.0, sin(2.0 * PI * f2));
        float sh = 0.5 * (kk(vec3(normalize(vec2(-g1.y, g1.x)), 0.0), Hv, 26.0) + kk(vec3(normalize(vec2(-g2.y, g2.x)), 0.0), Hv, 26.0));
        float hidden = smoothstep(1.05, 1.3, toCoin / uR);   // under the coin nothing shows
        float outside = k * ridge * (0.07 + 0.85 * sh * near) * hidden * (1.0 - uInside);

        // Inside: straight waved lines, the square half of the saying.
        float fs = px.y / 11.0 + 0.55 * sin(px.x / 44.0);
        float ks = 1.0 - smoothstep(0.18, 0.5, fwidth(fs));
        float rs = smoothstep(0.84, 1.0, sin(2.0 * PI * fs));
        vec2 gs = vec2(0.55 / 44.0 * cos(px.x / 44.0), 1.0 / 11.0);
        float shs = kk(vec3(normalize(vec2(-gs.y, gs.x)), 0.0), Hv, 26.0);
        float inside = ks * rs * (0.06 + 0.8 * shs * near) * uInside;

        col += vec3(0.30, 0.15, 0.42) * 0.13 * (outside + inside);
        // the enamel's own gloss, a soft pool under the pointer
        col += vec3(0.16, 0.10, 0.22) * 0.05 * pow(near, 3.0);
        // the coin's shadow
        float cs = smoothstep(1.35, 0.92, length((px - uC - vec2(0.05, -0.11) * uR) / uR)) * uShadow;
        col *= 1.0 - 0.7 * cs;
        col *= 0.93 + 0.14 * hash(floor(px * uDpr));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
ground.frustumCulled = false;
ground.renderOrder = -10;
scene.add(ground);

// ------------------------------------------------------------------ the coin

const FACE = 2048;
/** Raised parts of both faces: red is the front (four characters, the ring of words), green the back (mirrored, as it
 * is seen from behind). */
const relief = tex(FACE, FACE, (x, w) => {
  const u = w / 2;
  x.fillStyle = '#000'; x.fillRect(0, 0, w, w);
  x.globalCompositeOperation = 'lighter';
  const ring = (text, colour, size) => {
    x.save(); x.translate(u, u);
    x.font = `700 ${size * u}px Barlow`;
    x.fillStyle = colour; x.textAlign = 'center'; x.textBaseline = 'middle';
    const chars = [...text];
    const widths = chars.map((c) => x.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    const R = 0.8465 * u, track = (2 * Math.PI * R - total) / chars.length;
    let at = 0;
    chars.forEach((c, i) => {
      const mid = at + widths[i] / 2;
      x.save(); x.rotate(mid / R); x.translate(0, -R); x.fillText(c, 0, 0); x.restore();
      at += widths[i] + track;
    });
    x.restore();
  };
  // front
  ring('BOB CHUNG · SOFTWARE ENGINEER · ARUBA · ROTTERDAM · EST. 2006 · ', '#f00', 0.056);
  x.save(); x.translate(u, u);
  x.font = `400 ${0.33 * u}px "Ma Shan Zheng"`; x.fillStyle = '#f00'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['码', '戏', '安', '机'].forEach((c, i) => { x.save(); x.rotate((i * Math.PI) / 2); x.fillText(c, 0, -0.56 * u); x.restore(); });
  x.restore();
  // back, mirrored
  x.save(); x.translate(w, 0); x.scale(-1, 1);
  ring('SAY HELLO · LET’S TALK · SAY HELLO · LET’S TALK · ', '#0f0', 0.056);
  x.fillStyle = '#0f0';
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; x.beginPath(); x.arc(u + Math.cos(a) * 0.56 * u, u + Math.sin(a) * 0.56 * u, 0.028 * u, 0, Math.PI * 2); x.fill(); }
  x.restore();
});
const reliefSoft = blurred(relief, 9);

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
  uniforms: { ...shared, uRelief: { value: relief }, uSoft: { value: reliefSoft }, uLit: { value: 0 }, uLitAmt: { value: 0 }, uHole: { value: HOLE }, uN: { value: 34 }, uDepth: { value: 0.0036 }, uTurn: { value: 0 } },
  vertexShader: coinVert,
  fragmentShader: GL + /* glsl */ `
    uniform sampler2D uRelief, uSoft; uniform vec3 uLight; uniform float uLightI, uLit, uLitAmt, uHole, uN, uDepth, uTurn;
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

      // the field: a rose on the front, a finer sunray rose on the back
      float f1, f2; vec2 g1, g2;
      float tq = uTurn;
      vec2 pr = mat2(cos(tq), sin(tq), -sin(tq), cos(tq)) * p;
      if (front) rose(pr, uN, 0.42, 12.0, 7.0, f1, f2, g1, g2);
      else rose(pr, uN * 0.85, 0.32, 36.0, -3.0, f1, f2, g1, g2);
      g1 = mat2(cos(tq), -sin(tq), sin(tq), cos(tq)) * g1; g2 = mat2(cos(tq), -sin(tq), sin(tq), cos(tq)) * g2;
      vec3 field = turned(N, V, L, X, Y, f1, f2, g1, g2, uDepth, lc);
      field *= 1.0 - 0.6 * sC * (1.0 - raised);

      // the four characters: the one being read is polished bright, the others stay matte
      float a = atan(p.y, p.x);
      float idx = mod(floor((PI * 0.5 - a) / (PI * 0.5) + 0.5), 4.0);
      float lit = front ? mix(1.0, (abs(idx - uLit) < 0.5 ? 1.3 : 0.5), uLitAmt) : 1.0;
      vec3 chars = mix(matte(nR, V, L, lc), polished(nR, V, L, lc, 80.0), front ? mix(1.0, (abs(idx - uLit) < 0.5 ? 1.0 : 0.35), uLitAmt) : 1.0) * lit;

      vec3 band = mix(matte(N, V, L, lc) * 0.8, polished(nR, V, L, lc, 70.0), raised);
      vec3 plain = polished(N, V, L, lc, 140.0);

      float aa = fwidth(r) * 1.3, ac = fwidth(c) * 1.3;
      vec3 col = mix(field, chars, raised * step(r, 0.79));
      col = mix(col, band, smoothstep(0.80 - aa, 0.80 + aa, r));
      col = mix(col, plain, smoothstep(0.905 - aa, 0.905 + aa, r));
      col = mix(col, plain, 1.0 - smoothstep(uHole + 0.075 - ac, uHole + 0.075 + ac, c));
      // cut lines between the zones
      float cutR = min(abs(r - 0.795), abs(r - 0.9));
      float cutC = abs(c - (uHole + 0.08));
      col *= 0.3 + 0.7 * smoothstep(0.0, 0.006 + aa, cutR);
      col *= 0.3 + 0.7 * smoothstep(0.0, 0.006 + ac, cutC);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const sideMat = new THREE.ShaderMaterial({
  uniforms: { ...shared },
  vertexShader: coinVert,
  fragmentShader: GL + /* glsl */ `
    uniform vec3 uLight; uniform float uLightI;
    varying vec3 vO, vW, vN, vNo, vX, vY;
    void main() {
      vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
      vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
      float r = length(vO.xy);
      if (r > 0.6) {
        float a = atan(vO.y, vO.x);
        float wall = 1.0 - smoothstep(0.15, 0.5, abs(vNo.z));
        float fr = a * 180.0 / (2.0 * PI);
        float fade = 1.0 - smoothstep(0.2, 0.5, fwidth(fr));
        vec3 Ta = normalize(-sin(a) * vX + cos(a) * vY);
        N = normalize(N + Ta * cos(2.0 * PI * fr) * 0.5 * wall * fade);
      }
      vec3 col = polished(N, V, L, lc, 60.0) * (r > 0.6 ? 1.0 : 0.8);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});

const shape = new THREE.Shape();
shape.absarc(0, 0, 1, 0, Math.PI * 2, false);
const hole = new THREE.Path();
hole.moveTo(-HOLE, -HOLE); hole.lineTo(-HOLE, HOLE); hole.lineTo(HOLE, HOLE); hole.lineTo(HOLE, -HOLE); hole.lineTo(-HOLE, -HOLE);
shape.holes.push(hole);
const coinGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.024, bevelSize: 0.022, bevelSegments: 6, curveSegments: 200 });
coinGeo.translate(0, 0, -0.035);
const coin = new THREE.Mesh(coinGeo, [faceMat, sideMat]);
// A wall you cannot see, just behind the coin, with a round opening the coin covers: from outside, the works show
// only through the square hole. It does not tilt or turn with the coin.
const wall = new THREE.Shape();
wall.moveTo(-400, -400); wall.lineTo(400, -400); wall.lineTo(400, 400); wall.lineTo(-400, 400); wall.lineTo(-400, -400);
const wallHole = new THREE.Path();
wallHole.absarc(0, 0, 0.62, 0, Math.PI * 2, true);
wall.holes.push(wallHole);
const occluder = new THREE.Mesh(new THREE.ShapeGeometry(wall, 64), new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
occluder.position.z = -0.12;
occluder.renderOrder = -5;
scene.add(occluder);
const pivot = new THREE.Group();
pivot.add(coin);
scene.add(pivot);

// ------------------------------------------------------------------ the words round the coin

function word(letters, em) {
  // ink box in em
  let x0 = Infinity, x1 = -Infinity;
  for (const l of letters) { x0 = Math.min(x0, l.x - l.g.l); x1 = Math.max(x1, l.x + l.g.r); }
  const base = -O_CY, top = base + Math.max(...letters.map((l) => l.g.a)), bot = base - Math.max(...letters.map((l) => l.g.d));
  const pad = 0.14;
  const bx0 = x0 - pad, bx1 = x1 + pad, by0 = bot - pad, by1 = top + pad;
  const S = Math.min(1100, 4096 / (bx1 - bx0)); // canvas px per em
  const cw = Math.round((bx1 - bx0) * S), ch = Math.round((by1 - by0) * S);
  const mask = tex(cw, ch, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch);
    x.font = `900 ${S}px Barlow`; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    for (const l of letters) x.fillText(l.ch, (l.x - bx0) * S, (by1 - base) * S);
  });
  const soft = blurred(mask, S * 0.022);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...shared, uMask: { value: mask }, uSoft: { value: soft }, uTexel: { value: new THREE.Vector2(1 / cw, 1 / ch) }, uAlpha: { value: 1 }, uN: { value: 21 }, uDepth: { value: 0.0068 }, uTurn: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GL + /* glsl */ `
      uniform sampler2D uMask, uSoft; uniform vec2 uTexel; uniform vec3 uLight; uniform float uLightI, uAlpha, uN, uDepth, uTurn;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        float mk = texture2D(uMask, vUv).r;
        float sh = texture2D(uSoft, vUv + vec2(-14.0, 30.0) * uTexel).r;
        if (mk < 0.002 && sh < 0.002) discard;
        float s = texture2D(uSoft, vUv).r;
        vec2 e = uTexel * 2.0;
        vec2 g = vec2(texture2D(uSoft, vUv + vec2(e.x, 0.0)).r - texture2D(uSoft, vUv - vec2(e.x, 0.0)).r,
                      texture2D(uSoft, vUv + vec2(0.0, e.y)).r - texture2D(uSoft, vUv - vec2(0.0, e.y)).r);
        vec3 N = vec3(0.0, 0.0, 1.0), V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
        vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
        vec3 nb = normalize(vec3(-g * 8.0, 1.0));
        float f1, f2; vec2 g1, g2;
        float tq = uTurn;
        vec2 pr = mat2(cos(tq), sin(tq), -sin(tq), cos(tq)) * vW.xy;
        rose(pr, uN, 0.34, 24.0, 2.0, f1, f2, g1, g2);
        g1 = mat2(cos(tq), -sin(tq), sin(tq), cos(tq)) * g1; g2 = mat2(cos(tq), -sin(tq), sin(tq), cos(tq)) * g2;
        vec3 inner = turned(N, V, L, vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), f1, f2, g1, g2, uDepth, lc);
        vec3 bevel = polished(nb, V, L, lc, 90.0);
        float edge = 1.0 - smoothstep(0.62, 0.97, s);
        vec3 col = mix(inner, bevel, edge);
        float a = mk + (1.0 - mk) * 0.6 * sh;
        col = col * mk / max(a, 1e-4);
        gl_FragColor = vec4(col, a * uAlpha);
        #include <colorspace_fragment>
      }`,
  });
  const u = EMU;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((bx1 - bx0) * u, (by1 - by0) * u), mat);
  mesh.position.set(((bx0 + bx1) / 2) * u, ((by0 + by1) / 2) * u, 0);
  mesh.renderOrder = 5;
  scene.add(mesh);
  return { mesh, mat, x0: x0 * u, x1: x1 * u, top: top * u, bot: bot * u };
}

const BOB = word(layout('B', 'B'));
const HELLO = word(layout('HELL', ''));
HELLO.mesh.visible = false;

// ------------------------------------------------------------------ the works, behind the coin

const works = await loadWorks(renderer);
const band = new THREE.Group();
band.position.z = WORKS_Z;
scene.add(band);
const workMats = works.map((w, i) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uTex: { value: w.tex }, uSize: { value: new THREE.Vector2(WORK_W, WORK_H) }, uFocus: { value: 0 }, uDim: { value: 0.3 }, uBend: { value: 0.012 } },
    vertexShader: /* glsl */ `
      uniform float uBend; varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); float dx = w.x - cameraPosition.x; w.z -= uBend * dx * dx; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GL + /* glsl */ `
      uniform sampler2D uTex; uniform vec2 uSize; uniform vec3 uLight; uniform float uLightI, uFocus, uDim;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        vec2 p = vUv * uSize;
        float b = 0.026;
        vec2 q = (p - b) / (uSize - 2.0 * b);
        vec3 V = normalize(cameraPosition - vW), L = normalize(uLight - vW);
        vec3 lc = vec3(1.0, 0.88, 0.72) * uLightI;
        vec3 col;
        if (any(lessThan(q, vec2(0.0))) || any(greaterThan(q, vec2(1.0)))) {
          // the frame: polished gold, a little rounded
          vec2 d = min(p, uSize - p) / b;
          float t = min(d.x, d.y);
          vec2 dir = (d.x < d.y) ? vec2(p.x < uSize.x * 0.5 ? -1.0 : 1.0, 0.0) : vec2(0.0, p.y < uSize.y * 0.5 ? -1.0 : 1.0);
          vec3 n = normalize(vec3(dir * (1.0 - t) * 0.8, 1.0));
          col = polished(n, V, L, lc, 70.0);
        } else {
          vec3 pic = texture2D(uTex, q).rgb;
          float lum = pow(dot(pic, vec3(0.2126, 0.7152, 0.0722)), 0.42);
          // an engraving: straight lines that swell with the picture's light
          float y = q.y * 118.0 + lum * 0.45;
          float w = fwidth(y);
          float th = 0.1 + 0.78 * lum;
          float ln = smoothstep(th * 0.5 + w, th * 0.5 - w, abs(fract(y) - 0.5));
          vec3 Hv = normalize(L + V);
          float sheen = kk(vec3(1.0, 0.0, 0.0), Hv, 40.0);
          vec3 eng = mix(vec3(0.012, 0.005, 0.026), GOLD * (0.32 + 0.55 * lum + 0.9 * sheen * lc.r * 0.5), ln);
          float fz = smoothstep(0.0, 1.0, uFocus);
          col = mix(eng, pic * (0.9 + 0.1 * ln), fz);
        }
        gl_FragColor = vec4(col * uDim, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORK_W, WORK_H, 40, 1), mat);
  mesh.position.x = i * (WORK_W + WORK_GAP);
  band.add(mesh);
  return mat;
});

// ------------------------------------------------------------------ where the camera stands

/** The camera that puts the coin's middle at (sx, sy) of the screen at `rpx` pixels of radius. */
const camFor = (sx, sy, rpx) => [-(sx - 0.5) * W / rpx, (sy - 0.5) * H / rpx, PX / rpx];
const bobW = BOB.x1 - BOB.x0; // world units at radius 1
const R0 = Math.min(0.205 * H, (phone ? 0.84 : 0.66) * W / bobW); // the coin's radius on the front, in px
const helloW = 1 + 0.06 - HELLO.x0; // from H's left edge to the coin's right edge
const R4 = Math.min(0.175 * H, (phone ? 0.86 : 0.74) * W / helloW);
const CAM = {
  front: camFor(0.5, phone ? 0.4 : 0.445, R0),
  about: phone ? camFor(0.5, 0.29, Math.min(0.36 * W, 0.24 * H)) : camFor(0.68, 0.5, 0.425 * H),
  end: [(HELLO.x0 + 1.03) / 2, camFor(0.5, 0.4, R4)[1], PX / R4],
};

// ------------------------------------------------------------------ DOM

const $ = (s) => document.querySelector(s);
const secs = { intro: $('#intro'), about: $('#about'), works: $('#works'), end: $('#end') };
const lis = [...document.querySelectorAll('.studies li')];
const wk = worksChrome(secs.works);
const dot = $('.dot');
// the signature under the name, and the line under hello, placed from the 3D layout
const sig = document.createElement('p');
sig.className = 'hand';
sig.textContent = 'Chung';
const emPx = EMU * R0; // px per em on the front
Object.assign(sig.style, { position: 'absolute', margin: '0', fontSize: `${0.3 * emPx}px`, lineHeight: '1', transform: 'rotate(-7deg)', transformOrigin: 'left bottom', whiteSpace: 'nowrap' });
secs.intro.append(sig);
const frontBase = H * (phone ? 0.4 : 0.445) + O_CY * emPx; // the name's baseline, px from the top
sig.style.left = `${W / 2 + (D_EM / 2 + GAP) * emPx - 0.04 * emPx}px`;
sig.style.top = `${frontBase - 0.04 * emPx}px`;
$('#end .below').style.top = `${H * 0.4 + R4 * 1.18 + 34}px`;

addEventListener('click', (e) => {
  if (scroll.goal < 9.6) return;
  const cx = W / 2 + (0 - camera.position.x) * (PX / camera.position.z), cy = H / 2 - (0 - camera.position.y) * (PX / camera.position.z);
  if (Math.hypot(e.clientX - cx, e.clientY - cy) < PX / camera.position.z) location.href = 'mailto:bhccob@gmail.com';
});
addEventListener('resize', () => location.reload());

// ------------------------------------------------------------------ the scroll

const scroll = scroller(11);
const ptr = pointer(phone ? [0.7, 0.3] : [0.63, 0.33]);
const steps = (x, n) => { x = clamp(x, 0, n); const i = Math.min(n, Math.floor(x)); return i + ease(x - i); };
const live = !scroll.fixed;
const t0 = performance.now();
let lastBand = 0, vel = 0;

function frame(now) {
  const p = scroll.tick(now);
  ptr.tick(0.09);
  const time = live ? (now - t0) / 1000 : 0;

  // camera
  let c;
  if (p <= 1) c = CAM.front.map((v, i) => mix(v, CAM.about[i], ease(p)));
  else if (p <= 4) c = [CAM.about[0], CAM.about[1], CAM.about[2] - 0.06 * (p - 1)];
  else if (p <= 5) {
    const t = p - 4, a = [CAM.about[0], CAM.about[1], CAM.about[2] - 0.18];
    const k = ease(Math.min(1, t * 1.75));
    c = [mix(a[0], 0, k), mix(a[1], 0, k), mix(a[2], INSIDE_Z, ease(t))];
  } else if (p <= 9) c = [0, 0, INSIDE_Z];
  else {
    const t = p - 9, k = ease((t - 0.42) / 0.58);
    c = [mix(0, CAM.end[0], k), mix(0, CAM.end[1], k), mix(INSIDE_Z, CAM.end[2], ease(t))];
  }
  camera.position.set(c[0], c[1], c[2]);
  camera.updateMatrixWorld();

  // the coin: a dial for the studies, flipped while you are inside it, tilting a little to the pointer
  const study = steps(p - 1, 3);
  const flip = span(p, 5.4, 6.0) * (1 - span(p, 11, 12));
  const behind = p > 5.2 && p < 9.2;
  coin.rotation.z = (behind || p >= 9.2 ? 0 : study) * Math.PI / 2;
  pivot.rotation.y = flip * Math.PI;
  const rpx = c[2] > 0.25 ? PX / c[2] : 1e5;
  const cx = W / 2 - c[0] * rpx, cy = H / 2 + c[1] * rpx; // the coin's middle, px from the top left
  const tx = clamp((ptr.x - cx) / W, -0.5, 0.5), ty = clamp((ptr.y - cy) / H, -0.5, 0.5);
  const tilt = 1 - span(p, 4.0, 4.45) + span(p, 9.5, 10);
  pivot.rotation.x = ty * 0.22 * tilt;
  pivot.rotation.y += tx * 0.3 * tilt;
  const turn = live ? time * 0.05 : 0;
  faceMat.uniforms.uTurn.value = turn;
  BOB.mat.uniforms.uTurn.value = turn * 0.5;
  HELLO.mat.uniforms.uTurn.value = turn * 0.5;
  faceMat.uniforms.uLit.value = Math.round(clamp(p - 1, 0, 3));
  faceMat.uniforms.uLitAmt.value = span(p, 0.45, 1) * (1 - span(p, 4.0, 4.4));

  // the light rides above the pointer, on the coin's plane outside and the works' plane inside
  const inside = span(p, 4.35, 4.8) * (1 - span(p, 9.1, 9.5));
  const nx = (ptr.x / W) * 2 - 1, ny = 1 - (ptr.y / H) * 2;
  const zt = mix(0, WORKS_Z, inside), d = c[2] - zt;
  light.set(c[0] + nx * TAN * ASPECT * d, c[1] + ny * TAN * d, zt + Math.max(0.7, 0.5 * d));

  // ground
  const gu = ground.material.uniforms;
  gu.uC.value.set(cx, H - cy);
  gu.uR.value = rpx;
  gu.uPtr.value.set(ptr.x, H - ptr.y);
  gu.uInside.value = inside;
  gu.uShadow.value = c[2] > 0.25 ? 1 - inside : 0;

  // the words
  BOB.mat.uniforms.uAlpha.value = 1 - span(p, 0.08, 0.55);
  BOB.mesh.visible = BOB.mat.uniforms.uAlpha.value > 0.002;
  HELLO.mat.uniforms.uAlpha.value = span(p, 9.6, 9.95);
  HELLO.mesh.visible = HELLO.mat.uniforms.uAlpha.value > 0.002;

  // the works: the band slides one picture per step; the pointer leans it; the one in front turns to colour
  const lean = live ? (ptr.x / W - 0.5) * 0.5 * (WORK_W + WORK_GAP) * span(p, 4.8, 5.2) * (1 - span(p, 8.9, 9.2)) : 0;
  const s = clamp(p - 5, 0, 4);
  const bx = -(0.7 * steps(s, 4) + 0.3 * s) * (WORK_W + WORK_GAP) - lean;
  vel = mix(vel, bx - lastBand, 0.2); lastBand = bx;
  band.position.x = bx;
  const dim = mix(0.2, 1, span(p, 3.9, 4.75));
  band.visible = p > 3.85;
  workMats.forEach((mat, i) => {
    const off = Math.abs(bx + i * (WORK_W + WORK_GAP));
    mat.uniforms.uFocus.value = (1 - clamp(off / ((WORK_W + WORK_GAP) * 0.55))) * span(p, 4.55, 5.05);
    mat.uniforms.uDim.value = dim * mix(0.55, 1, 1 - clamp(off / (WORK_W + WORK_GAP)));
    mat.uniforms.uBend.value = 0.012 + clamp(Math.abs(vel) * 0.5, 0, 0.04);
  });

  // DOM
  const op = (el, v) => { el.style.opacity = v.toFixed(3); };
  op(secs.intro, 1 - span(p, 0, 0.3));
  sig.style.translate = `${span(p, 0, 0.3) * 60}px 0`;
  op(secs.about, span(p, 0.6, 1) * (1 - span(p, 4.0, 4.3)));
  lis.forEach((li, i) => li.classList.toggle('on', i === Math.round(clamp(p - 1, 0, 3))));
  op(secs.works, span(p, 4.75, 5.05) * (1 - span(p, 9.0, 9.25)));
  wk.set(Math.round(s), works);
  wk.el.style.opacity = secs.works.style.opacity;
  op(secs.end, span(p, 9.7, 10));
  dot.style.transform = `translate(${ptr.x}px, ${ptr.y}px)`;

  renderer.render(scene, camera);
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
