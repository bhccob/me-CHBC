// LAB ONLY (throwaway). The robot beat, round 44: a digital colossus. Two huge gauntlets come down from above, press
// their fingers on the works and push the whole page down out of the picture; their wrists end in data, falling apart
// into voxels. Behind: a giant helmet whose face is one dot-matrix screen. It is not all there yet: parts of it are
// loose voxels, and the face flickers. The four study coins wait in a tray at the foot of the picture; each press
// flies the next one over the slot in its jaw, the slot reads it, and it drops in. The face shows what it read, the
// voxels click back, the face clears. After the last, it wakes, and you follow the coin down the slot to the brain.
// Original designs (Blender: tools/lab/blender/hand.py, head2.py), not any existing character.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { C } from './kit.js';
import { STUDIES, PATHS, studyCoin, circuitMaterial, socketTexture, brain } from './stage.js';

const GLOW = new THREE.Color(C.glow);
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const io = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const inn = (v) => Math.pow(clamp(v), 3);
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HASH = 'float vhash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }';

// ------------------------------------------------------------------ materials that fall apart into voxels
/** The hand ends in data: below `uCut` (along its own axis, toward the cuff) it breaks into blocks with a lit edge. */
function handDigital(mat, U) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uToHand = U.uToHand; sh.uniforms.uCut = U.uCut;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uToHand; varying vec3 vHand;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHand = (uToHand * modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uCut; varying vec3 vHand;\n${HASH}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float dd = vHand.y - uCut + (vhash(floor(vHand * 9.0)) - 0.5) * 0.55;
        if (dd < 0.0) discard;
        totalEmissiveRadiance += vec3(0.7, 0.5, 1.0) * (1.0 - smoothstep(0.0, 0.08, dd)) * 5.0;`);
  };
  mat.customProgramCacheKey = () => 'hand-digital';
}
/** The head is missing blocks, from the back and the edges in, until the coins bring it back (`uSig` 0..1). */
function headDigital(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uToHead: U.uToHead, uSig: U.uSig, uCenter: U.uCenter });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uToHead; varying vec3 vHead;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHead = (uToHead * modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uSig; uniform vec3 uCenter; varying vec3 vHead;\n${HASH}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rr = length((vHead - uCenter) * vec3(1.0, 0.85, 0.6)) / 6.0;
        float dd = (uSig * 1.1 + 0.6) - (rr + (vhash(floor(vHead * 3.2)) - 0.5) * 0.45);
        if (dd < 0.0) discard;
        totalEmissiveRadiance += vec3(0.62, 0.42, 1.0) * (1.0 - smoothstep(0.0, 0.025, dd)) * 0.55;`);
  };
  mat.customProgramCacheKey = () => 'head-digital';
}
const headGap = (p, center, h, sig) => (sig * 1.1 + 0.6) - (Math.hypot(p.x - center.x, (p.y - center.y) * 0.85, (p.z - center.z) * 0.6) / 6 + (h - 0.5) * 0.45);

// ------------------------------------------------------------------ the Blender models
const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));
const baseName = (m) => (m?.name || '').replace(/\.\d+$/, '');
function handFromGlb(src) {
  const hand = src.clone(true);
  const U = { uToHand: { value: new THREE.Matrix4() }, uCut: { value: -0.7 } };
  const M = {
    armor: new THREE.MeshPhysicalMaterial({ color: '#3d3846', metalness: 1, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
    shell: new THREE.MeshPhysicalMaterial({ color: '#6b6475', metalness: 1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    joint: new THREE.MeshStandardMaterial({ color: '#0d0b11', metalness: 0.8, roughness: 0.42 }),
    gold: new THREE.MeshPhysicalMaterial({ color: '#d6a352', metalness: 1, roughness: 0.22 }),
    glow: new THREE.MeshStandardMaterial({ color: '#140c04', emissive: GLOW.clone(), emissiveIntensity: 2.0 }),
  };
  Object.values(M).forEach((m) => handDigital(m, U));
  hand.traverse((o) => { if (o.isMesh) o.material = M[baseName(o.material)] ?? M.armor; });
  const node = (n) => hand.getObjectByName(n);
  hand.userData = {
    U,
    fingers: [0, 1, 2, 3].map((f) => ({ base: node(`f${f}_base`), joints: [0, 1, 2].map((s) => node(`f${f}_s${s}`)) })),
    thumb: { base: node('thumb_base'), joints: [0, 1, 2].map((s) => node(`thumb_s${s}`)) },
  };
  // Data falling off the wrist: thin blocks streaming away from the cut, in the hand's own space.
  const N = 90;
  const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  bits.frustumCulled = false;
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  bits.userData.seed = Array.from({ length: N }, () => ({ a: rnd() * Math.PI * 2, r: 0.15 + rnd() * 0.35, ph: rnd(), sp: 0.35 + rnd() * 0.5, s: 0.02 + rnd() * 0.04, hot: rnd() }));
  bits.userData.seed.forEach((b, i) => bits.setColorAt(i, new THREE.Color(b.hot > 0.75 ? '#ffd28a' : b.hot > 0.3 ? '#a98bff' : '#5a4a8a').multiplyScalar(b.hot > 0.75 ? 1.6 : 1.1)));
  hand.add(bits);
  hand.userData.bits = bits;
  return hand;
}
function updateBits(hand, time) {
  const { bits, U } = hand.userData;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), s = V();
  bits.userData.seed.forEach((b, i) => {
    const t = (time * b.sp + b.ph) % 1;
    const rr = b.r * (1 + t * 0.9);
    p.set(Math.cos(b.a + t * 0.6) * rr, U.uCut.value - 0.05 - t * 2.4, Math.sin(b.a + t * 0.6) * rr);
    const k = (1 - t) * (t < 0.08 ? t / 0.08 : 1);
    s.set(b.s * k, b.s * k * (1 + t * 4), b.s * k);
    bits.setMatrixAt(i, m.compose(p, q, s));
  });
  bits.instanceMatrix.needsUpdate = true;
}
/** Moves a hand's joints toward a pose with weight; a breath of motion always, a tremor while it strains. */
function animator(hand) {
  const cur = { f: [0, 1, 2, 3].map(() => [0.3, 0.3, 0.25]), spread: 0.08 };
  return (pose, dt, time, strain = 0) => {
    const k = dt <= 0 ? 1 : 1 - Math.exp(-dt * 11);
    const { fingers, thumb } = hand.userData;
    cur.spread += (pose.spread - cur.spread) * k;
    fingers.forEach((fg, i) => {
      fg.base.rotation.z = (1.5 - i) * cur.spread + Math.sin(time * 0.9 + i) * 0.012;
      fg.joints.forEach((j, s) => {
        cur.f[i][s] += (pose.f[i][s] - cur.f[i][s]) * k;
        j.rotation.x = cur.f[i][s] + Math.sin(time * 1.7 + i * 1.3 + s * 0.8) * 0.02 + strain * Math.sin(time * 31 + i * 2.3 + s * 1.1) * 0.018;
      });
    });
    thumb.joints.forEach((j, s) => (j.rotation.x = pose.t[s]));
  };
}
const REACH = [0.32, 0.36, 0.3], PRESS = [-0.06, 0.3, 0.3], LIFT = [0.75, 0.8, 0.6];
const mix3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

function headFromGlb(src) {
  const g = src;
  const U = { uToHead: { value: new THREE.Matrix4() }, uSig: { value: 0 }, uCenter: { value: V() } };
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: '#16141c', metalness: 0.9, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
    plate: new THREE.MeshPhysicalMaterial({ color: '#040307', metalness: 0.4, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.35 }),
    trim: new THREE.MeshPhysicalMaterial({ color: '#2e2a36', metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }),
    seam: new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#a57cff'), emissiveIntensity: 0.3 }),
    rim: new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 1.2 }),
    slotglow: new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 2.0 }),
  };
  [M.shell, M.trim, M.seam].forEach((m) => headDigital(m, U));
  const pips = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 0.05 }));
  let screen = null;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const pip = /^pip_(\d)/.exec(o.name);
    if (pip) o.material = pips[Number(pip[1])];
    else if (o.name.startsWith('screen')) screen = o;
    else o.material = M[baseName(o.material)] ?? M.shell;
  });
  const node = (n) => g.getObjectByName(n);
  return { group: g, M, U, pips, screen, shell: node('shell'), display: node('display'), slot: node('slot') };
}

// ------------------------------------------------------------------ the face: a dot-matrix screen
function gearPath() {
  const p = new Path2D(), teeth = 8;
  for (let i = 0; i <= teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2, r = i % 4 < 2 ? 46 : 34;
    const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  p.moveTo(65, 50); p.arc(50, 50, 15, 0, Math.PI * 2, true);
  return p;
}
function faceScreen() {
  const CW = 192, CH = 112, NX = 96, NY = 56;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const glyph = Object.fromEntries(STUDIES.map((s) => [s.glyph, s.glyph === 'gear' ? gearPath() : new Path2D(PATHS[s.glyph])]));
  const mat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uFace: { value: tex }, uTime: { value: 0 }, uSig: { value: 0 }, uKick: { value: 0 }, uOn: { value: 1 }, uGrid: { value: new THREE.Vector2(NX, NY) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uFace; uniform float uTime, uSig, uKick, uOn; uniform vec2 uGrid; varying vec2 vUv;
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec2 g = vUv * uGrid, cell = floor(g), f = fract(g) - 0.5;
        float bad = clamp(1.0 - uSig + uKick, 0.0, 1.0), tick = floor(uTime * 12.0);
        // Interference: rows slip sideways, dots drop out, static, a band rolling down.
        float slip = step(1.0 - 0.18 * bad, hash(vec2(cell.y, tick))) * floor((hash(vec2(cell.y + 3.0, tick)) - 0.5) * 14.0 * bad + 0.5);
        float big = step(0.86, hash(vec2(floor(uTime * 3.0), 7.0))) * step(abs(vUv.y - hash(vec2(floor(uTime * 3.0), 9.0))), 0.12) * floor(8.0 * bad);
        vec2 sc = (cell + vec2(slip + big, 0.0) + 0.5) / uGrid;
        float v = texture2D(uFace, vec2(sc.x, 1.0 - sc.y)).r;
        v *= 1.0 - step(1.0 - 0.2 * bad, hash(cell * 1.31 + floor(uTime * 5.0)));
        v = max(v, step(1.0 - 0.025 * bad, hash(cell + tick * 1.7)) * 0.6);
        float roll = fract(vUv.y + uTime * 0.21);
        v += smoothstep(0.0, 0.06, roll) * (1.0 - smoothstep(0.06, 0.16, roll)) * 0.22 * bad;
        float d = length(f);
        float dotM = smoothstep(0.38, 0.26, d);
        vec3 lit = mix(vec3(1.0, 0.62, 0.26), vec3(1.0, 0.92, 0.78), clamp(v, 0.0, 1.0));
        vec3 col = vec3(0.06, 0.04, 0.1) * dotM * 0.9;
        col += lit * v * (dotM * 1.2 + exp(-d * d * 9.0) * 0.22);
        gl_FragColor = vec4(col * uOn, 1.0);
      }`,
  });
  const rr = (x0, y0, w, h, r) => { x.beginPath(); x.roundRect(x0, y0, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); x.fill(); };
  function draw(st) {
    x.fillStyle = '#000';
    x.fillRect(0, 0, CW, CH);
    const lv = (v) => { const k = Math.round(255 * clamp(v)); return `rgb(${k},${k},${k})`; };
    if (st.read) {
      // What it read: the coin's mark, its number, and a bar filling.
      const t = st.read.t, a = ease(t / 0.15) * (1 - ease((t - 1.15) / 0.2));
      x.fillStyle = lv(a);
      x.save(); x.translate(CW * 0.2, CH * 0.2); x.scale(0.62, 0.62); x.fill(glyph[st.read.glyph], 'evenodd'); x.restore();
      x.font = '700 40px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText(st.read.n, CW * 0.54, CH * 0.47);
      x.strokeStyle = lv(a * 0.6); x.lineWidth = 2; x.strokeRect(CW * 0.2, CH * 0.82, CW * 0.6, 8);
      x.fillStyle = lv(a); x.fillRect(CW * 0.2 + 2, CH * 0.82 + 2, (CW * 0.6 - 4) * out((t - 0.1) / 0.8), 4);
      tex.needsUpdate = true;
      return;
    }
    x.fillStyle = lv(st.level);
    const ew = CW * 0.15, eh = CH * 0.56 * st.open * (1 - 0.92 * st.blink);
    for (const sx of [-1, 1]) {
      const cx = CW * 0.5 + sx * CW * 0.18 + st.lookX * 12, cy = CH * 0.44 + st.lookY * 14;
      if (st.happy > 0.5) {
        x.strokeStyle = lv(st.level); x.lineWidth = ew * 0.42; x.lineCap = 'round';
        x.beginPath(); x.arc(cx, cy + ew * 0.45, ew * 0.55, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
      } else rr(cx - ew / 2, cy - eh / 2, ew, Math.max(3, eh), ew / 2);
    }
    if (st.hint > 0.01) {
      // Insert coin: a coin over an arrow pointing down at the slot, blinking.
      x.fillStyle = x.strokeStyle = lv(st.hint);
      x.lineWidth = 3;
      x.beginPath(); x.arc(CW / 2, CH * 0.8, 6, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(CW / 2 - 6, CH * 0.9); x.lineTo(CW / 2 + 6, CH * 0.9); x.lineTo(CW / 2, CH * 0.97); x.fill();
    }
    tex.needsUpdate = true;
  }
  return { mat, draw };
}

// ------------------------------------------------------------------ interference over the picture while it is not powered
const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uKick: { value: 0 }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmt, uTime, uKick, uFade; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float a = uAmt + uKick;
      float row = floor(uv.y * 64.0), tick = floor(uTime * 14.0);
      uv.x += step(0.8, hash(vec2(row * 0.7, tick))) * (hash(vec2(row, tick + 1.0)) - 0.5) * 0.06 * a;
      float s = 0.01 * a;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(s, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(s, 0.0)).b);
      c += (hash(floor(vUv * vec2(640.0, 360.0)) + tick * 3.1) - 0.5) * 0.1 * a;
      c *= 1.0 - 0.14 * a * step(0.5, fract(vUv.y * 180.0));
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
    }`,
};

export async function createDigital(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030206');
  scene.fog = new THREE.FogExp2('#07040e', 0.008);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 700);
  const D = 10, PH_ = 2 * D * Math.tan((20 * Math.PI) / 180), PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); return l; };
  const lights = [dir('#e9e4ff', 0.8, -8, 14, 10), dir('#9a74ff', 3.0, 10, 6, -20), dir('#ffe2c0', 1.4, 3, 6, 9), new THREE.HemisphereLight('#2e2148', '#040208', 0.5)];
  lights.forEach((l) => { l.layers.enableAll(); scene.add(l); });
  // Layer 1: what is drawn straight to the screen over the picture (the page and the hands); layer 0 goes through bloom.
  const onTop = (o) => o.traverse((c) => c.layers.set(1));

  // ---------------------------------------------------------------- the page: the works, pushed down out of the picture
  const page = new THREE.Mesh(new THREE.PlaneGeometry(PW_, PH_, 160, 90), new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false,
    uniforms: { uTex: { value: pageTexture() }, uY: { value: 0 }, uTilt: { value: 0 }, uPress: { value: 0 }, uC: { value: new THREE.Vector4() }, uS: { value: new THREE.Vector4() }, uShade: { value: 0 }, uVig: { value: 0 }, uW: { value: PW_ }, uH: { value: PH_ }, uTime: { value: 0 }, uAsp: { value: W / H } },
    vertexShader: `
      uniform float uY, uTilt, uPress, uW, uH; uniform vec4 uC;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        vec2 d0 = p.xy - uC.xy, d1 = p.xy - uC.zw;
        float dent = exp(-dot(d0, d0) * 0.9) + exp(-dot(d1, d1) * 0.9);
        float bow = 1.0 - pow(p.x / (uW * 0.5), 2.0);
        p.z -= uPress * (0.2 * dent + 0.14 * bow * smoothstep(-uH * 0.5, uH * 0.5, p.y));
        float c = cos(uTilt), s = sin(uTilt);
        p = vec3(p.x, p.y * c + p.z * s, p.z * c - p.y * s);
        p.y -= uY;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uTime, uAsp, uVig, uShade, uW, uH; uniform vec4 uS;
      varying vec2 vUv;
      void main(){
        vec3 col = texture2D(uTex, vUv).rgb;
        vec2 c = vUv - 0.5;
        col *= 1.0 - smoothstep(0.45, 1.15, length(c * vec2(uAsp, 1.0))) * 0.7 * uVig;
        // The hands' shadow on it, soft, above where they press.
        vec2 q = c * vec2(uW, uH);
        float sh = exp(-dot((q - uS.xy) * vec2(0.8, 0.45), (q - uS.xy) * vec2(0.8, 0.45))) + exp(-dot((q - uS.zw) * vec2(0.8, 0.45), (q - uS.zw) * vec2(0.8, 0.45)));
        col *= 1.0 - uShade * min(1.0, sh) * 0.6;
        // Its edge catches the light once it moves.
        col += vec3(0.75, 0.62, 1.0) * smoothstep(0.994, 1.0, max(vUv.y, max(vUv.x, 1.0 - vUv.x))) * 0.5 * uVig;
        float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
        col += (g - 0.5) * 0.028 * uVig;
        if (!gl_FrontFacing) col = vec3(0.02, 0.016, 0.03);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  page.frustumCulled = false;
  onTop(page);
  scene.add(page);
  const pageAt = (x, y, z, Y, tilt) => V(x, y * Math.cos(tilt) + z * Math.sin(tilt) - Y, z * Math.cos(tilt) - y * Math.sin(tilt));

  // ---------------------------------------------------------------- the colossus
  const [handSrc, headSrc] = await Promise.all([loadGlb('models/hand.glb'), loadGlb('models/head2.glb')]);
  const head = headFromGlb(headSrc);
  const HEAD = 4.6;
  head.group.scale.setScalar(HEAD);
  head.group.updateMatrixWorld(true);
  const toLocal = (o) => o.getWorldPosition(V()).divideScalar(HEAD);
  const dispLocal = toLocal(head.display), slotLocal = toLocal(head.slot);
  head.U.uCenter.value.copy(dispLocal);
  // Placed so its screen is high in the picture, the jaw and its slot below the middle.
  const headBase = V(0, 6.4, -42).sub(dispLocal.clone().multiplyScalar(HEAD));
  head.group.position.copy(headBase);
  scene.add(head.group);
  const face = faceScreen();
  head.screen.material = face.mat;
  const slotLight = new THREE.PointLight('#ffc477', 0, 0, 2);
  scene.add(slotLight);
  // The loose voxels: points on its shell that are not there yet float off it, and click back as the signal comes.
  const NV = 520;
  const vox = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), NV);
  vox.frustumCulled = false;
  {
    head.group.updateMatrixWorld(true);
    const toHead = new THREE.Matrix4().copy(head.group.matrixWorld).invert().multiply(head.shell.matrixWorld);
    const sampler = new MeshSurfaceSampler(head.shell).build();
    const p = V(), n = V();
    let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    vox.userData.seed = [];
    for (let i = 0; i < NV; i++) {
      sampler.sample(p, n);
      p.applyMatrix4(toHead); n.transformDirection(toHead);
      const b = { p: p.clone(), n: n.clone(), h: rnd(), k: rnd(), off: 1, s: 0.035 + rnd() * 0.07 };
      vox.userData.seed.push(b);
      vox.setColorAt(i, new THREE.Color(b.k > 0.93 ? '#ffcf86' : b.k > 0.6 ? '#7a5fd0' : '#2a2242').multiplyScalar(b.k > 0.93 ? 1.3 : 0.75));
    }
  }
  head.group.add(vox);
  // Dust between you and it: it is far, and huge.
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1100, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 70, (rnd() - 0.4) * 46, -4 - rnd() * 44], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.06, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  const camEnd = V(0, 1.6, -7), lookEnd = V(0, 2.4, -42);

  // ---------------------------------------------------------------- the hands
  const HS = 1.55;
  const right = handFromGlb(handSrc);
  const leftRoot = new THREE.Group();
  leftRoot.scale.x = -1;
  const left = handFromGlb(handSrc);
  leftRoot.add(left);
  scene.add(right, leftRoot);
  onTop(right); onTop(leftRoot);
  const animR = animator(right), animL = animator(left);
  const Zax = V(0, 0, 1);

  // ---------------------------------------------------------------- the coins: a tray at the foot of the picture
  const coins = STUDIES.map((s) => {
    const c = studyCoin(s);
    const glow = [];
    c.traverse((o) => { if (o.isMesh && o.material.emissive && o.material.emissiveIntensity > 0 && !glow.includes(o.material)) glow.push(o.material); });
    c.userData.glow = (v) => glow.forEach((m) => (m.emissiveIntensity = v));
    scene.add(c);
    return c;
  });
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 0, 2);
  scene.add(coinLight);
  const COIN_IN = 0.36 * HEAD, COIN_TRAY = 0.15;
  // The reader's light: a line that runs down the coin before it goes in.
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float y = abs(vUv.y - 0.5) * 2.0, x = abs(vUv.x - 0.5) * 2.0; float a = (exp(-y * y * 40.0) * 1.6 + exp(-y * 6.0) * 0.25) * (1.0 - x * x) * uA; gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * 2.0, a); }',
  }));
  scene.add(scan);

  // ---------------------------------------------------------------- inside: the shaft, the socket, the brain
  const inside = new THREE.Group();
  inside.position.set(0, -300, 0);
  inside.visible = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 46, 64, 1, true), circuitMaterial());
  shaft.position.y = -22;
  inside.add(shaft);
  const socket = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 3.4), [0, 0, new THREE.MeshStandardMaterial({ map: socketTexture(), roughness: 0.5, metalness: 0.4 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: '#0b0a10' })));
  socket.position.y = -45;
  inside.add(socket);
  const brainMesh = brain();
  brainMesh.scale.setScalar(0.13);
  brainMesh.position.set(0, -44.9, 0);
  inside.add(brainMesh);
  const insideLight = new THREE.PointLight(C.glow, 6, 0, 2);
  insideLight.position.set(0, -42, 0);
  inside.add(insideLight);
  scene.add(inside);

  // ---------------------------------------------------------------- the picture: bloom and interference behind; page and hands straight on top
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.5, 0.98);
  composer.addPass(bloom);
  const glitch = new ShaderPass(GLITCH);
  composer.addPass(glitch);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; opacity: 0; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 40px); right: var(--gutter, 30px); margin: 0; padding: 0 58px 0 0; list-style: none; display: grid; gap: 24px; text-align: right; }
    .st-tag { margin: 0; white-space: nowrap; opacity: 0.4; transition: opacity .5s; }
    .st-tag span { display: block; color: #efb53d; margin-bottom: 3px; }
    .st-tag b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-tag.next { opacity: 1; }
    .st-tag.in { opacity: 0.7; }
    .st-tag.in b::after { content: ' · read'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-press { position: fixed; left: 50%; bottom: calc(var(--gutter, 30px) + 6px); transform: translateX(-50%); margin: 0; display: flex; align-items: center; gap: 14px; transition: opacity .4s; }
    .st-press i { width: 34px; height: 34px; border-radius: 50%; border: 1px solid #efb53d; display: grid; place-items: center; animation: stp 1.6s infinite; }
    .st-press i::after { content: ''; width: 9px; height: 9px; border: 1.5px solid #efb53d; }
    .st-press b { font: 700 15px Barlow; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-press span { color: rgb(242 239 232 / 0.55); }
    @keyframes stp { 0%, 100% { box-shadow: 0 0 0 0 rgb(239 181 61 / 0.5); } 50% { box-shadow: 0 0 0 10px rgb(239 181 61 / 0); } }
    .st-fly { position: fixed; left: var(--gutter, 30px); top: 44%; margin: 0; max-width: 300px; transition: opacity .3s; }
    .st-fly span { display: block; color: #efb53d; }
    .st-fly b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-fly em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-state { position: fixed; left: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); line-height: 1.8; }
    .st-state b { color: #efb53d; font-weight: 500; }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #000; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4 read</p>
  <ol class="st-list">${STUDIES.map((s) => `<li class="st-tag m"><span>${s.n}</span><b>${s.name}</b></li>`).join('')}</ol>
  <p class="st-fly"><span class="m"></span><b></b><em></em></p>
  <p class="st-state m">Signal <b>00</b> %</p>
  <p class="st-press"><i></i><b>Press to insert a coin</b><span class="m">Click or space</span></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const tags = [...hud.querySelectorAll('.st-tag')], fly = hud.querySelector('.st-fly'), press = hud.querySelector('.st-press'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');

  const bez = (a, b, c, d, t) => { const u = 1 - t; return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
  // A coin's turn: it flies over the slot, is read, drops in.
  const FLY = 0.95, HOVER = 0.65, DROP = 0.3, FLIGHT = FLY + HOVER + DROP, POVT = 10.0;
  let presses = [], lastT = null, sigShown = 0, approach = 0;
  const offs = new Float32Array(NV).fill(1);

  return {
    scene, camera,
    press(now) {
      const flying = presses.length && now - presses[presses.length - 1] < FLIGHT;
      if (presses.length >= 4 || flying) return false;
      presses.push(now);
      return true;
    },
    update({ r, time, fixed = null }) {
      const dt = lastT === null || fixed ? 0 : Math.min(0.1, time - lastT);
      lastT = time;
      // ---- the push (scroll): the hands come down from above, press, and push the page down and out
      const pu = page.material.uniforms;
      pu.uTex.value = pageTexture(); pu.uTime.value = time;
      const Yp = PH_ * 1.6 * io((r - 0.27) / 0.62), tilt = 0.42 * ease((r - 0.36) / 0.5);
      const press_ = ease((r - 0.2) / 0.1) * (1 - 0.4 * ease((r - 0.74) / 0.12));
      pu.uY.value = Yp; pu.uTilt.value = tilt; pu.uPress.value = press_; pu.uVig.value = ease(r / 0.12);
      page.visible = Yp < PH_ * 1.55;
      const CX = PW_ * 0.2, CY = PH_ * 0.16;
      pu.uC.value.set(CX, CY, -CX, CY);
      const handAt = (hand, anim, lag, phase) => {
        const a = out((r - 0.02 - lag) / 0.21);
        const lift = ease((r - 0.72 - lag) / 0.14);
        const T = pageAt(CX, CY, -0.2 * press_, Yp, tilt).add(V(0, 0, 0.05 + lift * 1.1));
        T.add(V(0.7, PH_ * 1.05, 2.4).multiplyScalar(1 - a));
        T.y += Math.sin(time * 1.3 + phase) * 0.03 * (1 - press_);
        const pitch = lerp(0.18, 0.55, a) - 0.12 * press_ + lift * 0.25, roll = -0.16 - 0.1 * (1 - a);
        const f = V(0, -Math.cos(pitch), -Math.sin(pitch)).applyAxisAngle(Zax, roll);
        const nz = V(0, Math.sin(pitch), -Math.cos(pitch)).applyAxisAngle(Zax, roll);
        const W_ = T.clone().addScaledVector(f, -2.32 * HS).addScaledVector(nz, -0.16 * HS);
        const strain = r > 0.3 && r < 0.72 ? 1 : 0;
        W_.x += strain * Math.sin(time * 23 + phase) * 0.008;
        hand.position.copy(W_);
        hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V().crossVectors(f, nz), f, nz));
        hand.scale.setScalar(HS);
        const reach = mix3([0.55, 0.5, 0.4], REACH, a);
        const fpose = [0, 1, 2, 3].map((i) => mix3(mix3(reach, PRESS, ease((r - 0.19 - lag - i * 0.012) / 0.08)), LIFT, ease((r - 0.73 - lag - i * 0.015) / 0.12)));
        anim({ f: fpose, t: [0.35, 0.3, 0.25], spread: lerp(0.05, 0.13, a) - 0.04 * lift }, dt, time + phase, strain);
        hand.userData.U.uCut.value = -0.62 + Math.sin(time * 2.1 + phase) * 0.05;
        // Where its palm is, over the page, for the shadow.
        const palm = W_.clone().addScaledVector(f, 1.0 * HS);
        return { a, palm };
      };
      const sR = handAt(right, animR, 0, 0), sL = handAt(left, animL, 0.03, 1.7);
      const toPage = (p, sx) => [sx * p.x, (p.y + Yp) / Math.max(0.3, Math.cos(tilt))];
      const [x0, y0] = toPage(sR.palm, 1), [x1, y1] = toPage(sL.palm, -1);
      pu.uS.value.set(x0, y0, x1, y1);
      pu.uShade.value = 0.85 * Math.max(sR.a, sL.a) * (1 - ease((r - 0.7) / 0.15));
      right.visible = leftRoot.visible = r > 0.015 && r < 0.98;
      for (const h of [right, left]) { h.updateMatrixWorld(true); h.userData.U.uToHand.value.copy(h.matrixWorld).invert(); updateBits(h, time); }
      // ---- the camera: holds the page; once it is gone, it settles on the face
      const inF = ease((r - 0.58) / 0.55);
      camera.up.set(0, 1, 0);
      camera.position.set(0, 0, D).lerp(camEnd, inF);
      const look0 = V(0, 0, 0).lerp(lookEnd, inF);
      // ---- presses
      let inserted = 0, flyI = -1, flyT = 0, pov = 0;
      if (fixed) { inserted = fixed.inserted; flyI = fixed.fly >= 0 ? inserted : -1; flyT = fixed.fly * FLIGHT; pov = fixed.pov; }
      else {
        presses.forEach((t0, i) => { const d = time - t0; if (d >= FLIGHT) inserted = i + 1; else { flyI = i; flyT = d; } });
        if (presses.length === 4) pov = clamp((time - presses[3] - FLIGHT) / POVT);
      }
      const landedAt = inserted > 0 ? (fixed ? time - (fixed.since ?? 9) : presses[inserted - 1] + FLIGHT) : -99;
      const since = time - landedAt;
      const P = pov * POVT;
      const awake = ease(P / 0.8);
      // ---- the colossus: signal and body come back a coin at a time
      const sig = inserted / 4;
      sigShown += (sig - sigShown) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.2));
      const kick = Math.max(0, 1 - since / 0.45);
      head.U.uSig.value = sigShown + awake * 0.3;
      head.group.position.set(headBase.x, headBase.y + Math.sin(time * 0.35) * 0.15 + awake * 0.5, headBase.z);
      head.group.rotation.set(Math.sin(time * 0.27) * 0.008 - awake * 0.03, Math.sin(time * 0.21) * 0.012, 0);
      head.group.updateMatrixWorld(true);
      head.U.uToHead.value.copy(head.group.matrixWorld).invert();
      const flick = (k) => (Math.sin(time * 37 + k) * Math.sin(time * 13.7 + k * 2.1) > 0.2 ? 1 : 0.3);
      head.M.seam.emissiveIntensity = lerp(0.35 * flick(3), 3.0, sigShown) + awake * 2;
      head.M.rim.emissiveIntensity = 1.2 + kick * 6 + (flyI >= 0 && flyT > FLY ? 2.5 : 0);
      head.M.slotglow.emissiveIntensity = 2 + kick * 10;
      head.pips.forEach((m, i) => (m.emissiveIntensity = i < inserted ? 3.2 : 0.06));
      const S = head.slot.getWorldPosition(V());
      slotLight.position.copy(S).add(V(0, 1.2, 2.5));
      slotLight.intensity = (flyI >= 0 && flyT > FLY * 0.8 ? 30 : 12) + kick * 260;
      // The loose voxels: off their places while the signal is low; back in with every coin.
      {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), s = V();
        const kk = dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.6);
        vox.userData.seed.forEach((b, i) => {
          const gap = headGap(b.p, dispLocal, b.h, sigShown + awake * 0.3);
          const want = gap < 0 ? Math.min(1, -gap * 3.5) : 0;
          offs[i] += (want - offs[i]) * kk;
          const o = offs[i];
          p.copy(b.p).addScaledVector(b.n, o * (0.15 + b.k * 0.75) + Math.sin(time * 0.7 + b.h * 40) * 0.04 * o);
          p.y += Math.sin(time * 0.5 + b.k * 30) * 0.06 * o;
          const sz = b.s * clamp(o / 0.12) * (b.k > 0.95 ? flick(i) : 1);
          s.set(sz, sz, sz);
          vox.setMatrixAt(i, m.compose(p, q, s));
        });
        vox.instanceMatrix.needsUpdate = true;
      }
      // ---- the coins
      const H_ = S.clone().add(V(0, COIN_IN + 0.3, 0));
      const back = ease((r - 1.0) / 0.22);
      const waiting = [0, 1, 2, 3].filter((i) => i >= inserted && i !== flyI);
      // The camera leans in on the slot while a coin goes in; a little closer with each.
      const want = flyI >= 0 || (since < 1.3 && inserted < 4) ? 1 : 0.18 * inserted;
      approach += (want - approach) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 1.7));
      if (fixed) approach = flyI >= 0 ? 1 : 0.18 * inserted;
      const camSlot = S.clone().add(V(0, 7.5, 29)), lookSlot = S.clone().add(V(0, 5.4, 0));
      camera.position.lerp(camSlot, approach * ease((r - 1.0) / 0.2));
      const look = look0.clone().lerp(lookSlot, approach * ease((r - 1.0) / 0.2));
      camera.lookAt(look);
      camera.updateMatrixWorld();
      const tanF = Math.tan((20 * Math.PI) / 180);
      const byTag = (i) => {
        const rc = tags[i].getBoundingClientRect(), Z = 8, hh = tanF * Z, ww = hh * (innerWidth / innerHeight);
        const px = rc.right + 30, py = rc.top + rc.height / 2;
        return camera.localToWorld(V(((px / innerWidth) * 2 - 1) * ww + (1 - back) * 0.6, (1 - (py / innerHeight) * 2) * hh, -Z));
      };
      scan.material.uniforms.uA.value = 0;
      coins.forEach((c, i) => {
        c.visible = false;
        if (i < inserted) return;
        if (i === flyI) {
          const P0 = byTag(i);
          if (flyT < FLY) {
            const e = io(flyT / FLY);
            c.position.copy(bez(P0, P0.clone().add(V(-0.6, 0.3, -1.5)), H_.clone().add(V(4, 5, 7)), H_, e));
            c.quaternion.copy(camera.quaternion).slerp(head.group.quaternion, e);
            c.rotateX(Math.sin(e * Math.PI) * 0.55);
            c.scale.setScalar(lerp(COIN_TRAY * 1.15, COIN_IN, e));
            c.userData.glow(0.25);
          } else {
            const h = flyT - FLY, d = inn((h - HOVER) / DROP);
            const lift = Math.sin(clamp((h - HOVER + 0.16) / 0.16) * Math.PI * 0.5) * 0.18 * (1 - d);
            c.position.copy(H_).add(V(0, Math.sin(time * 4) * 0.03 * (1 - d) + lift - d * (COIN_IN * 2 + 0.6), 0));
            c.quaternion.copy(head.group.quaternion);
            c.scale.setScalar(COIN_IN);
            // The read: a line of light runs down the coin.
            const sr = clamp(h / (HOVER - 0.1));
            scan.position.copy(H_).add(V(0, COIN_IN * (1 - 2 * io(sr)), COIN_IN * 0.12));
            scan.scale.set(COIN_IN * 2.6, COIN_IN * 0.5, 1);
            scan.quaternion.copy(head.group.quaternion);
            scan.material.uniforms.uA.value = Math.sin(sr * Math.PI) * (1 - d);
            c.userData.glow(0.25 + 1.4 * ease(sr * 1.5));
          }
          c.visible = true;
        } else {
          const k = waiting.indexOf(i);
          c.position.copy(byTag(i));
          c.userData.glow(k === 0 && flyI < 0 ? 0.45 + 0.25 * Math.sin(time * 4) : 0.15);
          c.quaternion.copy(camera.quaternion);
          c.rotateY(Math.sin(time * 0.8 + i * 1.7) * 0.35);
          c.rotateX(-0.18);
          c.scale.setScalar(COIN_TRAY * (k === 0 && flyI < 0 ? 1.15 : 1) * back);
          c.visible = back > 0.01 && pov === 0;
        }
        tags[i].classList.toggle('in', i < inserted);
        tags[i].classList.toggle('next', i === inserted || i === flyI);
      });
      coins.forEach((c, i) => { if (i < inserted) { tags[i].classList.add('in'); tags[i].classList.remove('next'); } });
      // A light that keeps the coin in hand readable: soft on the tray, closer on the one in flight.
      if (flyI >= 0) {
        const c = coins[flyI];
        coinLight.position.copy(c.position).add(camera.position.clone().sub(c.position).setLength(2.2 + c.scale.x)).add(V(0, 0.8, 0));
        coinLight.intensity = 20 + 40 * c.scale.x;
      } else {
        coinLight.position.copy(camera.localToWorld(V(-2, 2, 1)));
        coinLight.intensity = 1.2 * back;
      }
      if (flyI >= 0) {
        const s = STUDIES[flyI];
        fly.querySelector('span').textContent = `${s.n} / 05`;
        fly.querySelector('b').textContent = s.name;
        fly.querySelector('em').textContent = s.line;
        fly.style.opacity = String(Math.min(1, Math.sin(clamp(flyT / FLIGHT) * Math.PI) * 2.2));
      } else fly.style.opacity = '0';
      // ---- the face
      face.mat.uniforms.uTime.value = time;
      face.mat.uniforms.uSig.value = clamp(sigShown * 0.85 + 0.12 + awake);
      face.mat.uniforms.uKick.value = kick * 0.5;
      face.mat.uniforms.uOn.value = ease((r - 0.3) / 0.3);
      const blinkPh = (time + 0.4) % 3.6;
      const reading = inserted > 0 && since < 1.4 && P < 0.01 ? { t: since, n: STUDIES[inserted - 1].n, glyph: STUDIES[inserted - 1].glyph } : null;
      const watching = flyI >= 0 ? ease(flyT / FLY) : 0;
      face.draw({
        read: reading,
        level: lerp(0.55 * flick(1), 1, ease(sigShown)) * (1 + awake * 0.2),
        open: lerp(0.5, 1, sigShown) * (1 + watching * 0.18) + awake * 0.1,
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: (since > 1.25 && since < 1.9 && inserted > 0) || (P > 0.5 && P < 1.9) ? 1 : 0,
        lookX: Math.sin(time * 0.37) * 0.25 * (1 - watching),
        lookY: lerp(Math.sin(time * 0.29) * 0.15, 0.95, watching),
        hint: r >= 1.2 && flyI < 0 && inserted < 4 && pov === 0 && since > 1.4 ? 0.5 + 0.5 * (Math.sin(time * 5) > 0 ? 1 : 0.2) : 0,
      });
      glitch.uniforms.uAmt.value = (1 - sigShown) * 0.2 * ease((r - 0.85) / 0.2);
      glitch.uniforms.uKick.value = kick * 0.35;
      glitch.uniforms.uTime.value = time;
      bloom.strength = 0.5 * ease((r - 0.2) / 0.5);
      // ---- awake: then you follow the coin down the slot to the brain
      glitch.uniforms.uFade.value = 0;
      if (pov > 0) {
        if (P < 4.2) {
          const g = io((P - 2.0) / 1.4), g2 = inn((P - 3.2) / 0.9);
          if (g > 0) {
            const above = S.clone().add(V(0, 7.5, 6.5));
            const from = camera.position.clone();
            camera.position.copy(from).lerp(above, g).lerp(S.clone().add(V(0, 0.4, 0.06)), g2);
            const la = look.clone().lerp(S.clone().add(V(0, -1, -0.4)), ease((P - 2.0) / 1.1));
            camera.lookAt(la);
          }
          glitch.uniforms.uFade.value = ease((P - 3.75) / 0.45);
          inside.visible = false;
        } else {
          inside.visible = true;
          const q = clamp((P - 4.2) / 3.6);
          const yCam = lerp(-302, -344.6 + 1.2, ease(q));
          camera.position.set(0, yCam, 0.001);
          camera.up.set(0, 0, -1);
          camera.lookAt(0, yCam - 5, 0);
          const last = coins[3];
          last.visible = true;
          last.position.set(0, lerp(-303.2, -344.86, Math.min(1, ease(q * 1.12))), 0);
          last.rotation.set(-Math.PI / 2, 0, (1 - Math.min(1, q * 1.12)) * 8);
          last.scale.setScalar(0.4);
          shaft.material.uniforms.uTime.value = time;
          brainMesh.material.uniforms.uA.value = ease((P - 7.2) / 1.0);
          brainMesh.rotation.y = time * 0.4;
          glitch.uniforms.uFade.value = 1 - ease((P - 4.2) / 0.5);
        }
        endEl.style.opacity = String(ease((P - 8.6) / 1.0));
        head.group.visible = P < 4.2;
      } else { inside.visible = false; endEl.style.opacity = '0'; head.group.visible = true; }
      camera.updateMatrixWorld();
      // ---- HUD
      countEl.textContent = String(inserted);
      sigEl.textContent = String(Math.round(sigShown * 100)).padStart(2, '0');
      hud.style.opacity = String(ease((r - 0.95) / 0.25) * (1 - ease((P - 3.2) / 0.6)) + ease((P - 8.6) / 1.0));
      press.style.opacity = r >= 1.2 && flyI < 0 && inserted < 4 && pov === 0 ? '1' : '0';
      this._top = page.visible || right.visible;
      return { inserted, pov };
    },
    render() {
      const tm = renderer.toneMapping, ex = renderer.toneMappingExposure, ac = renderer.autoClear;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      camera.layers.set(0);
      composer.render();
      if (this._top) {
        camera.layers.set(1);
        renderer.setRenderTarget(null);
        renderer.autoClear = false;
        renderer.clearDepth();
        const bg = scene.background;
        scene.background = null;
        renderer.render(scene, camera);
        scene.background = bg;
        renderer.autoClear = ac;
        camera.layers.set(0);
      }
      renderer.toneMapping = tm;
      renderer.toneMappingExposure = ex;
    },
  };
}
