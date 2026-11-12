// LAB ONLY (throwaway). The robot beat, round 55: the robot is a slot machine, so the coins make sense. One pull back
// out of the works (they were on its screen) to the whole machine while the coin drops into its slot; it switches on,
// its lever-arm pulls, the reels land on three coins. Three studies: in, the lever, the reels land on the study, its
// name on the screen. The last coin is yours: it comes up in front of you, you follow it up and over and down into
// the slot, which opens into a portal; it goes through, and you after it, into the brain's gold shaft as the site has
// it now (the brain itself is not redesigned). Model: tools/lab/blender/slotbot.py. Original design.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { C, coin } from './kit.js';
import { STUDIES, PATHS, studyCoin } from './stage.js';

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const io = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const DOT = 0.17; // the robot's LED pitch; the works' dots are laid out to match it
const NAMES = ['Software engineering', 'Game & app development', 'Cybersecurity', 'Mechatronics'];

// ------------------------------------------------------------------ the screen: the works exactly at first, then LED eyes; at the end it clears
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
function screen(size, rect, pageTexture) {
  const CW = 250, CH = 200;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const glyph = Object.fromEntries(STUDIES.map((s) => [s.glyph, s.glyph === 'gear' ? gearPath() : new Path2D(PATHS[s.glyph])]));
  const U = { uTex: { value: pageTexture() }, uFace: { value: tex }, uSize: { value: size }, uRect: { value: rect }, uDots: { value: 0 }, uSqueeze: { value: 0 }, uFaceOn: { value: 0 }, uClear: { value: 0 }, uTime: { value: 0 }, uKick: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    toneMapped: false, fog: false, transparent: true,
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex, uFace; uniform vec2 uSize, uRect; uniform float uDots, uSqueeze, uFaceOn, uClear, uTime, uKick; varying vec2 vUv;
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec2 p = (vUv - 0.5) * uSize;
        float cell = ${DOT};
        vec2 g = p / cell, cc = floor(g) + 0.5, f = fract(g) - 0.5;
        vec2 q = mix(p, cc * cell, uDots);
        float led = smoothstep(0.5, 0.32, length(f));
        float dotM = mix(1.0, led, uDots);
        float sy = mix(1.0, 0.034, smoothstep(0.0, 0.55, uSqueeze)), sx = 1.0 - smoothstep(0.55, 0.95, uSqueeze);
        vec2 r = uRect * vec2(max(sx, 0.0001), sy);
        vec2 wuv = q / r + 0.5;
        float inside = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0) * step(0.0001, sx);
        vec3 works = texture2D(uTex, clamp(vec2(wuv.x, 1.0 - wuv.y), 0.0, 1.0)).rgb * inside * (1.0 + 2.5 * smoothstep(0.2, 0.9, uSqueeze));
        vec3 col = works * dotM;
        vec2 fuv = q / uSize + 0.5;
        float v = texture2D(uFace, vec2(fuv.x, 1.0 - fuv.y)).r;
        float on = step(1.0 - uFaceOn, 1.0 - fuv.y + hash(vec2(floor(g.y), 1.0)) * 0.06);
        float slip = uKick * step(0.7, hash(vec2(floor(g.y), floor(uTime * 14.0))));
        vec3 lit = mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.94, 0.82), clamp(v, 0.0, 1.0));
        col += lit * v * (led * 1.1 + exp(-dot(f, f) * 9.0) * 0.22) * on * (1.0 - slip * 0.6);
        col += vec3(0.08, 0.055, 0.14) * led * uDots;
        // clearing: the dots go out from the middle, leaving glass you can see the brain through
        float gone = 1.0 - smoothstep(uClear * 1.3 - 0.3, uClear * 1.3, length(p / uSize) * 1.2 + hash(cc) * 0.15);
        gone = max(gone, step(0.999, uClear));
        float keep = clamp(v * 1.6, 0.0, 1.0) * on;
        float a = mix(1.0, keep, gone);
        // a faint sheen so the glass still reads as glass
        float sheen = smoothstep(0.02, 0.0, abs(fuv.x - fuv.y * 0.6 - 0.18)) * 0.05 + smoothstep(0.03, 0.0, abs(fuv.x - fuv.y * 0.6 - 0.3)) * 0.03;
        a = max(a, sheen * gone);
        gl_FragColor = vec4(col * a + vec3(0.8, 0.75, 1.0) * sheen * gone, a);
      }`,
  });
  const rr = (x0, y0, w, h, r) => { x.beginPath(); x.roundRect(x0, y0, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); x.fill(); };
  function draw(st) {
    x.fillStyle = '#000';
    x.fillRect(0, 0, CW, CH);
    const lv = (v) => { const k = Math.round(255 * clamp(v)); return `rgb(${k},${k},${k})`; };
    if (st.words) {
      const a = st.words.a;
      x.fillStyle = lv(a);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '700 26px "IBM Plex Mono", monospace';
      x.fillText(st.words.top, CW / 2, CH * 0.1);
      x.font = '700 22px "IBM Plex Mono", monospace';
      st.words.lines.forEach((l, i) => x.fillText(l, CW / 2, CH * (0.82 + i * 0.12)));
    } else if (st.read) {
      const a = st.read.a;
      x.fillStyle = lv(a);
      x.save(); x.translate(CW * 0.15, CH * 0.2); x.scale(0.56, 0.56); x.fill(glyph[st.read.glyph], 'evenodd'); x.restore();
      x.font = '700 58px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText(st.read.n, CW * 0.52, CH * 0.34);
      x.font = '700 25px "IBM Plex Mono", monospace'; x.textAlign = 'center';
      const words = st.read.name.toUpperCase().split(' ');
      const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : words.length === 2 && words.join(' ').length > 14 ? words : [words.join(' ')];
      lines.forEach((l, i) => x.fillText(l, CW / 2, CH * (lines.length === 1 ? 0.74 : 0.66 + i * 0.15)));
    } else {
      x.fillStyle = lv(st.level);
      const ew = CW * 0.16, eh = CH * 0.46 * st.open * (1 - 0.92 * st.blink);
      for (const sx of [-1, 1]) {
        const cx = CW * 0.5 + sx * CW * 0.2 + st.lookX * 16, cy = CH * 0.44 + st.lookY * 22;
        if (st.happy > 0.5) {
          x.strokeStyle = lv(st.level); x.lineWidth = ew * 0.42; x.lineCap = 'round';
          x.beginPath(); x.arc(cx, cy + ew * 0.45, ew * 0.55, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
        } else rr(cx - ew / 2, cy - eh / 2, ew, Math.max(4, eh), ew / 2);
      }
    }
    tex.needsUpdate = true;
  }
  return { mat, U, draw };
}
function insertCoin() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 84;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  let last = -1;
  return {
    tex,
    draw(on) {
      const k = on ? 1 : 0;
      if (k === last) return;
      last = k;
      x.fillStyle = '#0c0812'; x.fillRect(0, 0, 512, 84);
      x.font = '700 50px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = on ? '#ffc46a' : '#3a2a1a';
      x.fillText('INSERT COIN', 256, 44);
      tex.needsUpdate = true;
    },
  };
}
function boardTex(w = 1100, h = 1000, seed = 21) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#110a1d'; x.fillRect(0, 0, w, h);
  let sd = seed; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const a = Math.floor(r() * 4) * (Math.PI / 2) + (r() < 0.3 ? Math.PI / 4 : 0), len = 40 + r() * 180, x0 = r() * w, y0 = r() * h;
    x.strokeStyle = `rgba(214,162,83,${0.07 + r() * 0.12})`; x.lineWidth = 2 + r() * 2;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uKick: { value: 0 }, uTime: { value: 0 }, uFade: { value: 0 }, uVig: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uKick, uTime, uFade, uVig; varying vec2 vUv;
    float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main(){
      vec2 uv = vUv;
      float row = floor(uv.y * 64.0), tick = floor(uTime * 14.0);
      uv.x += step(0.84, hash(vec2(row * 0.7, tick))) * (hash(vec2(row, tick + 1.0)) - 0.5) * 0.03 * uKick;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      c *= 1.0 - smoothstep(0.5, 1.25, length((vUv - 0.5) * vec2(1.7, 1.0))) * 0.6 * uVig;
      c += (hash(floor(vUv * vec2(720.0, 405.0)) + tick * 3.1) - 0.5) * 0.03 * uVig;
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
    }`,
};

const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));
const baseName = (m) => (m?.name || '').replace(/\.\d+$/, '');

export const SLOTBOT_END = 3.0;

/** C1 keyframes: keys are [r, value, rate]; between two keys a cubic Hermite, so speed never jumps. */
function track(r, keys) {
  if (r <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [r0, p0, m0] = keys[i], [r1, p1, m1] = keys[i + 1];
    if (r > r1) continue;
    const h = r1 - r0, t = (r - r0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
  }
  return keys[keys.length - 1][1];
}
const smoother = (v) => { v = clamp(v); return v * v * v * (v * (v * 6 - 15) + 10); };
const bump = (v) => { v = clamp(v); return Math.sin(v * Math.PI) ** 2; };

// ------------------------------------------------------------------ the reels: ivory bands of symbols; blurred while they spin
const SYMBOLS = ['coin', 'software', 'game', 'security', 'gear', 'bc', 'coin', 'spark'];
function reelTexture() {
  const CW = 256, CH = 420, c = document.createElement('canvas');
  c.width = CW * SYMBOLS.length; c.height = CH;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, '#d9cdb6'); g.addColorStop(0.5, '#f4ecdc'); g.addColorStop(1, '#d9cdb6');
  x.fillStyle = g; x.fillRect(0, 0, c.width, CH);
  const gear = gearPath();
  SYMBOLS.forEach((s, i) => {
    x.save();
    // the reel turns about the window's horizontal: a symbol drawn upright on screen is turned a quarter in its cell
    x.translate(CW * i + CW / 2, CH / 2);
    x.rotate(Math.PI / 2);
    x.fillStyle = '#2a1546';
    if (s === 'coin') {
      x.fillStyle = '#c99a4a'; x.beginPath(); x.arc(0, 0, 92, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e7c27e'; x.beginPath(); x.arc(0, 0, 80, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f4ecdc'; x.fillRect(-36, -36, 72, 72);
      x.strokeStyle = '#8a5a2f'; x.lineWidth = 7; x.strokeRect(-42, -42, 84, 84);
    } else if (s === 'bc') {
      x.font = '800 118px Barlow'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BC', 0, 6);
    } else if (s === 'spark') {
      x.fillStyle = '#c99a4a'; x.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 26 : 92; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      x.closePath(); x.fill();
    } else {
      x.translate(-80, -80); x.scale(1.6, 1.6);
      x.fill(s === 'gear' ? gear : new Path2D(PATHS[s]), 'evenodd');
    }
    x.restore();
    x.fillStyle = 'rgba(42,21,70,0.12)'; x.fillRect(CW * i, 0, 3, CH);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
  return t;
}
function reelMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uBlur: { value: 0 }, uLit: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform sampler2D uMap; uniform float uBlur, uLit; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 c = vec3(0.0);
        for (int i = -5; i <= 5; i++) c += texture2D(uMap, vec2(vUv.x + float(i) * uBlur / 10.0, vUv.y)).rgb;
        c /= 11.0;
        float shade = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 2.2);
        gl_FragColor = vec4(c * (0.06 + 0.9 * shade) * (0.8 + 0.45 * uLit), 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ past the portal: the gold shaft into the brain, as the site has it now
function brainShaft(top) {
  const g = new THREE.Scene();
  g.background = new THREE.Color('#06050a');
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.36), toneMapped: false, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 18; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.035, 6, 8), gold);
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 8);
    ring.position.set(top.x, top.y - 5 - i * 7, top.z);
    g.add(ring);
  }
  // rails down the octagon's corners, and streaks of light in the dark round it
  const pts = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; pts.push(top.x + Math.cos(a) * 6.2, top.y - 3, top.z + Math.sin(a) * 6.2, top.x + Math.cos(a) * 6.2, top.y - 130, top.z + Math.sin(a) * 6.2); }
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 120; k++) {
    const a = rnd() * Math.PI * 2, rr = 9 + rnd() * 26, y0 = top.y - rnd() * 130, len = 2 + rnd() * 9;
    pts.push(top.x + Math.cos(a) * rr, y0, top.z + Math.sin(a) * rr, top.x + Math.cos(a) * rr * 1.04, y0 - len, top.z + Math.sin(a) * rr * 1.04);
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(0.62, 0.42, 0.2), transparent: true, opacity: 0.55 })));
  const sp = new Float32Array(2600 * 3);
  for (let i = 0; i < 2600; i++) { const a = rnd() * Math.PI * 2, rr = 12 + rnd() * 60; sp.set([top.x + Math.cos(a) * rr, top.y - rnd() * 160, top.z + Math.sin(a) * rr], i * 3); }
  g.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: '#d9c7ff', size: 0.12, transparent: true, opacity: 0.7, depthWrite: false })));
  // the orb's glow far below
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), rg = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,236,200,1)'); rg.addColorStop(0.18, 'rgba(240,200,140,0.55)'); rg.addColorStop(0.5, 'rgba(160,110,60,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  orb.scale.setScalar(26);
  orb.position.set(top.x, top.y - 120, top.z);
  g.add(orb);
  return g;
}

export async function createSlotbot(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06030c');
  scene.fog = new THREE.FogExp2('#0a0416', 0.004);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pm.dispose();
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 900);
  camera.rotation.order = 'YXZ';
  const D = 10, PH_ = 2 * D * Math.tan((20 * Math.PI) / 180), PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); l.layers.enableAll(); return l; };
  const amb = new THREE.HemisphereLight('#5a4688', '#07040c', 0.8); amb.layers.enableAll();
  scene.add(dir('#ffe9d2', 2.2, -14, 18, 26), dir('#a582ff', 2.6, 20, 8, -18), dir('#ffcf9a', 0.7, 0, -20, 20), amb);
  const both = (o) => o.traverse((c) => c.layers.enable(1));

  // ---------------------------------------------------------------- the slot machine: its screen is its face, the lever is its arm
  const machine = await loadGlb('models/slotbot.glb');
  scene.add(machine);
  machine.updateMatrixWorld(true);
  const node = (n) => machine.getObjectByName(n);
  machine.position.copy(node('visor_c').getWorldPosition(V()).negate());
  machine.updateMatrixWorld(true);
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: '#2b1e48', roughness: 0.42, metalness: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.25 }),
    trim: new THREE.MeshPhysicalMaterial({ color: '#c99a4a', roughness: 0.28, metalness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0e0a14', roughness: 0.55, metalness: 0.3 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: '#e6e2ee', roughness: 0.14, metalness: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.4 }),
  };
  const bulbs = [];
  machine.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'visor') return;
    if (/^bulbm_/.test(o.name)) {
      o.material = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffd79a'), emissiveIntensity: 0.3 });
      bulbs.push(o);
      return;
    }
    const b = baseName(o.material);
    o.material = M[b === 'bulb' ? 'lamp' : b] ?? M.body;
  });
  bulbs.sort((a, b) => a.getWorldPosition(V()).x - b.getWorldPosition(V()).x);
  const vis = node('visor');
  const scr = screen(new THREE.Vector2(15.5, 12.4), new THREE.Vector2(PW_, PH_), pageTexture);
  vis.material = scr.mat;
  vis.renderOrder = 2;
  vis.layers.set(1);
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 13.4), new THREE.MeshBasicMaterial({ color: '#05030a' }));
  blind.position.set(0, 0, -0.25);
  scene.add(blind);
  const S = node('slot').getWorldPosition(V());
  const ic = insertCoin();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.85), new THREE.MeshBasicMaterial({ map: ic.tex, toneMapped: false }));
  plate.position.copy(node('coin_label').getWorldPosition(V())).add(V(0, 0, 0.02));
  scene.add(plate);
  {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 180;
    const x = c.getContext('2d');
    x.fillStyle = '#0c0812'; x.fillRect(0, 0, 1200, 180);
    x.font = '800 112px Barlow'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffc46a';
    x.fillText('BC — 2006', 600, 96);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const crown = new THREE.Mesh(new THREE.PlaneGeometry(11.8, 1.77), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    crown.position.copy(node('crown_label').getWorldPosition(V())).add(V(0, 0, 0.02));
    scene.add(crown);
  }
  const pivot = node('lever_pivot');
  // the reels, in the window under its face
  const reelsAt = node('reels').getWorldPosition(V());
  const rtex = reelTexture();
  const reels = [-1, 0, 1].map((k) => {
    const g = new THREE.CylinderGeometry(3.6, 3.6, 4.5, 128, 1, true);
    g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, reelMaterial(rtex));
    m.position.copy(reelsAt).add(V(k * 4.84, 0, 0));
    scene.add(m);
    return m;
  });
  const payline = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 0.05), new THREE.MeshBasicMaterial({ color: '#ffc46a', toneMapped: false, transparent: true, opacity: 0.5 }));
  payline.position.set(reelsAt.x, reelsAt.y, reelsAt.z + 3.75);
  scene.add(payline);
  const symAngle = (s) => (Math.PI * 2 * (s + 0.5)) / SYMBOLS.length;

  // ---------------------------------------------------------------- the coins
  const R = 1.3, R0 = 1.3, CZ = D - 0.5;
  const coinOf = (c) => {
    const mats = [];
    c.traverse((o) => { if (o.isMesh && !mats.includes(o.material)) mats.push(o.material); });
    c.userData.clip = (planes) => mats.forEach((m) => (m.clippingPlanes = planes));
    return c;
  };
  const big = coinOf(coin());
  big.scale.setScalar(R0);
  scene.add(big);
  both(big);
  const coins = STUDIES.map((s) => { const c = coinOf(studyCoin(s)); c.scale.setScalar(R); scene.add(c); return c; });
  const last = coins[3];
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 26, 2);
  coinLight.layers.enableAll();
  scene.add(coinLight);
  const reelLight = new THREE.PointLight('#ffd9a0', 0, 18, 2);
  reelLight.position.copy(reelsAt).add(V(0, 0, 7));
  scene.add(reelLight);
  const slotPlane = new THREE.Plane(V(0, 1, 0), -S.y);
  const portalPlane = new THREE.Plane(V(0, 1, 0), -(S.y + 0.14));
  const START = (i) => 1.04 + 0.24 * i, LEN = 0.32;

  // ---------------------------------------------------------------- the portal: the slot opens, and the brain's shaft is through it
  const shaft = brainShaft(S);
  const shaftRT = new THREE.WebGLRenderTarget(Math.round(W * dpr), Math.round(H * dpr), { type: THREE.HalfFloatType, samples: 4 });
  const portalU = { uTex: { value: shaftRT.texture }, uRes: { value: new THREE.Vector2(W * dpr, H * dpr) }, uOpen: { value: 0 }, uTime: { value: 0 }, uSize: { value: new THREE.Vector2(6.4, 3.6) } };
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.6), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, uniforms: portalU,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uTex; uniform vec2 uRes, uSize; uniform float uOpen, uTime; varying vec2 vP;
      float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main(){
        // from the slot's slit to a doorway the shape of the coin's hole, rounded a touch
        vec2 hb = mix(vec2(1.7, 0.25), uSize * 0.5, smoothstep(0.0, 1.0, uOpen));
        float d = rbox(vP, hb, 0.12);
        float inside = 1.0 - smoothstep(-0.02, 0.02, d);
        vec3 through = texture2D(uTex, gl_FragCoord.xy / uRes).rgb;
        float rim = exp(-abs(d) * 9.0) * (0.6 + 0.4 * sin(atan(vP.y, vP.x) * 6.0 - uTime * 5.0));
        vec3 col = through * inside + vec3(1.0, 0.74, 0.36) * rim * 1.6 * smoothstep(0.0, 0.15, uOpen);
        float a = max(inside, clamp(rim * 1.4, 0.0, 1.0)) * smoothstep(0.0, 0.05, uOpen);
        gl_FragColor = vec4(col, a);
      }`,
  }));
  portal.rotation.x = -Math.PI / 2;
  portal.position.copy(S).add(V(0, 0.14, 0));
  portal.renderOrder = 3;
  scene.add(portal);

  // ---------------------------------------------------------------- the last coin's ride, and yours behind it: up and over, then straight down the slot
  const HPOS = V(0, -4.4, 48.5), HLOOK = V(0, -4.4, 0);
  const P0 = V(0, -6.2, 41.5);
  const ride = new THREE.CatmullRomCurve3([HPOS, P0, V(0, -6.2, 30), V(0, -7.5, 18), V(0, -11.5, 9.5), V(0, S.y + 7.5, S.z + 0.6), V(0, S.y + 4, S.z), V(0, S.y, S.z), V(0, S.y - 12, S.z), V(0, S.y - 70, S.z)], false, 'centripetal');
  ride.arcLengthDivisions = 3000;
  const RL = ride.getLength();
  const sAt = (p) => { let best = 0, bd = Infinity; for (let i = 0; i <= 3000; i++) { const d = ride.getPointAt(i / 3000).distanceToSquared(p); if (d < bd) { bd = d; best = (i / 3000) * RL; } } return best; };
  const s0 = sAt(P0), sSlot = sAt(V(0, S.y, S.z));
  const xSlot = sSlot - s0, X = RL - s0;
  const LAG = 3.4, C0 = s0 - LAG, TAU = 4;
  const F0 = 1.92, FS = 2.34, F1 = 2.9;
  // the coin: from in front of you to the slot, falling faster as it goes in; then on, unseen, through the portal
  const flight = [[F0, 0, 0], [FS, xSlot, 75], [F1, X - 6, 0]];
  const at = (s) => ride.getPointAt(clamp(s / RL));

  // ---------------------------------------------------------------- the picture
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.5, 0.82);
  composer.addPass(bloom);
  const glitch = new ShaderPass(GLITCH);
  composer.addPass(glitch);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-frame { opacity: 0; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-tagc { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; opacity: 0; }
    .st-tagc span { display: block; color: #efb53d; }
    .st-tagc b { display: block; font: 800 22px/1 Barlow; letter-spacing: 0.01em; text-transform: uppercase; margin-top: 4px; }
    .st-tagc em { display: block; margin-top: 6px; font: 400 14px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-big { position: fixed; left: var(--gutter, 30px); top: 44%; margin: 0; max-width: 300px; opacity: 0; }
    .st-big span { display: block; color: #efb53d; }
    .st-big b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-big em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 40px); right: var(--gutter, 30px); margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; text-align: right; }
    .st-list li { opacity: 0.35; transition: opacity .4s; }
    .st-list li span { display: block; color: #efb53d; }
    .st-list li b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-list li.in { opacity: 1; }
    .st-list li.in b::after { content: ' · in'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-list li.next { opacity: 1; }
    .st-list li.next b::after { content: ' · yours'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-state { position: fixed; left: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); line-height: 1.8; }
    .st-state b { color: #efb53d; font-weight: 500; }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #06050a; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <div class="st-frame"><p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4</p>
  <ol class="st-list m">${STUDIES.map((s, i) => `<li><span>${s.n}</span><b>${NAMES[i]}</b></li>`).join('')}</ol>
  <p class="st-state m">Credits <b>00</b></p></div>
  ${STUDIES.map((s, i) => `<p class="st-tagc" data-i="${i}"><span class="m">${i === 3 ? '05 / 05 · the last coin' : `${s.n} / 05 · a study`}</span><b>${NAMES[i]}</b>${i === 3 ? '<em>Still being minted. This one is yours.</em>' : ''}</p>`).join('')}
  <p class="st-big"><span class="m"></span><b></b><em></em></p>
  <div class="st-end"><p class="m">Into the brain, as it is now</p></div>`;
  hudParent.append(hud);
  const frame = hud.querySelector('.st-frame'), tagEls = [...hud.querySelectorAll('.st-tagc')], listEls = [...hud.querySelectorAll('.st-list li')], bigEl = hud.querySelector('.st-big'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');
  // The camera only ever pitches (everything happens in the x = 0 plane): no roll, no flip when it looks straight down.
  const pitchTo = (from, to) => { const d = to.clone().sub(from); return Math.atan2(d.y, -d.z); };
  // Each pull: the coin is in at `t`; the lever goes down and back; the reels spin and stop, one, two, three, on `sym`.
  const pulls = [{ t: 0.74, sym: 0, len: 0.3 }, ...[0, 1, 2].map((i) => ({ t: START(i) + LEN * 0.36, sym: i + 1, len: 0.17 }))];
  const reelState = (r) => {
    let p = null;
    for (const q of pulls) if (r >= q.t - 0.001) p = q;
    if (!p) return { ang: [0.3, 0.3, 0.3].map((a, i) => a + i * 1.7), blur: [0, 0, 0], lever: 0, win: 0 };
    const k = (r - p.t) / p.len;
    const prev = pulls[pulls.indexOf(p) - 1];
    const from = prev ? symAngle(prev.sym) : 0.3;
    const lever = Math.sin(clamp(k / 0.28) * Math.PI * 0.5) * (1 - ease((k - 0.28) / 0.3)) + Math.sin(clamp((k - 0.28) / 0.3) * Math.PI) * -0.06;
    const ang = [], blur = [];
    for (let j = 0; j < 3; j++) {
      const stop = 0.45 + j * 0.15;
      const u = clamp((k - 0.1) / (stop - 0.1));
      // spins up, runs several turns, and settles on the symbol with a small bounce
      const turns = 3 + j;
      const target = symAngle(p.sym) + Math.PI * 2 * turns;
      const base = from + (target - from) * (u < 1 ? 1 - Math.pow(1 - u, 2.6) : 1);
      const settle = k > stop ? Math.sin(clamp((k - stop) / 0.08) * Math.PI) * -0.06 : 0;
      ang.push(base + settle);
      const speed = u < 1 && u > 0 ? 2.6 * Math.pow(1 - u, 1.6) : 0;
      blur.push(Math.min(0.05, speed * 0.02));
    }
    const win = k > 0.76 ? bump((k - 0.76) / 0.7) : 0;
    return { ang, blur, lever, win, k };
  };

  return {
    scene, camera,
    press() { return false; },
    update({ r, time }) {
      // ================================================================ out of the works: one pull back to the whole machine, the coin drops in on the way
      const pull = smoother(r / 0.95);
      const fall = clamp((r - 0.42) / 0.3);
      const yIn = S.y - R0 * 2.6;
      const landSlot = 0.42 + 0.3 * Math.sqrt((S.y - R0) / yIn);
      scr.U.uTex.value = pageTexture();
      scr.U.uTime.value = time;
      scr.U.uDots.value = ease((r - 0.08) / 0.34);
      scr.U.uSqueeze.value = ease((r - 0.72) / 0.08);
      scr.U.uFaceOn.value = ease((r - 0.82) / 0.1);
      scr.U.uClear.value = 0;
      vis.layers.set(r < 0.81 ? 1 : 0);
      if (r < 0.76) {
        const settle = ease((r - 0.26) / 0.14) * (1 - fall);
        big.position.set(0, (fall > 0 ? yIn * fall * fall : 0) + Math.sin(time * 1.1) * 0.05 * settle, lerp(CZ, S.z, smoother(fall / 0.6)));
        big.rotation.set(Math.sin(time * 0.7) * 0.05 * settle, Math.sin(time * 0.5) * 0.12 * settle, Math.sin(fall * Math.PI) * 0.08);
        big.userData.clip(fall > 0 ? [slotPlane] : null);
        big.visible = true;
      } else big.visible = false;
      const on = r >= 0.8;

      // ================================================================ three studies: in, the lever, the reels land on it
      let inCount = 0, active = -1;
      const kOf = [];
      for (let i = 0; i < 3; i++) {
        const c = coins[i];
        const k = (r - START(i)) / LEN;
        kOf[i] = k;
        c.visible = false;
        if (k > 0) {
          if (k >= 0.36) inCount++;
          if (k < 1.05) active = i;
          if (k < 0.36) {
            const f = clamp(k / 0.36);
            c.position.set(0, lerp(S.y + 34, S.y - R * 2.6, f * f), S.z);
            c.rotation.set(0, 0, Math.sin(f * 6 + i) * 0.12 * (1 - f));
            c.userData.clip([slotPlane]);
            c.visible = f < 0.999;
          }
        }
        listEls[i].classList.toggle('in', k >= 0.36);
      }
      const rs = reelState(r);
      reels.forEach((m, j) => { m.rotation.x = rs.ang[j]; m.material.uniforms.uBlur.value = rs.blur[j]; m.material.uniforms.uLit.value = on ? 0.6 + rs.win * 0.8 : 0.15; });
      pivot.rotation.x = rs.lever * 1.05;
      payline.material.opacity = 0.25 + rs.win * 0.75;
      reelLight.intensity = on ? 10 + rs.win * 30 : 2;
      bulbs.forEach((b, i) => {
        const chase = 0.5 + 0.5 * Math.sin(time * 7 - i * 0.85);
        b.material.emissiveIntensity = on ? 0.6 + 2.2 * Math.max(chase * chase, rs.win * (0.5 + 0.5 * Math.sin(time * 22))) : 0.12;
      });

      // ================================================================ the last one is yours: it comes up in front of you; you follow it through the portal
      const rise = out((r - 1.78) / 0.14);
      const x = track(r, flight);
      const sc = s0 + x, sCam = x + C0 * (1 - Math.exp(-x / TAU));
      last.visible = r > 1.78 && r < FS + 0.04;
      last.userData.clip([portalPlane]);
      if (r < F0) {
        last.position.copy(P0).add(V(0, (1 - rise) * -8, (1 - rise) * 1.0));
        last.rotation.set(0, (1 - rise) * 1.6 + Math.sin(time * 0.8) * 0.06 * rise, Math.sin(time * 0.6) * 0.03 * rise);
      } else {
        last.position.copy(at(sc));
        last.rotation.set(0, Math.PI * 2 * ease(x / (xSlot * 0.7)), 0);
      }
      listEls[3].classList.toggle('next', r > 1.8 && r < FS);
      listEls[3].classList.toggle('in', r >= FS);
      if (r >= FS) inCount = 4;
      portalU.uOpen.value = ease((r - 2.14) / 0.12);
      portalU.uTime.value = time;

      // ================================================================ the camera: the whole machine; then behind the coin, on its curve, through
      const lookDip = bump((r - 0.4) / 0.48) * 1.6;
      const pos = V(0, HPOS.y * pull, D + (HPOS.z - D) * pull);
      const look = V(0, HLOOK.y * pull - lookDip, 0);
      if (r > F0) pos.copy(at(sCam));
      const coinLook = last.position.clone().add(V(0, -0.4, 0));
      if (r > 1.78) look.lerp(coinLook, ease((r - 1.78) / 0.16) * 0.55 + ease((r - F0) / 0.16) * 0.45);
      // past the portal, look on down the shaft
      if (r > FS) look.copy(pos).add(V(0, -10, 0));
      camera.position.copy(pos);
      camera.rotation.set(pitchTo(pos, look), 0, 0);
      camera.updateMatrixWorld();
      const through = pos.y < portal.position.y;
      renderPass.scene = through ? shaft : scene;
      this._shaft = portalU.uOpen.value > 0 && !through;
      coinLight.intensity = 0;
      const litCoin = active >= 0 && coins[active].visible ? coins[active] : r < 0.74 ? big : last.visible ? last : null;
      if (litCoin) { coinLight.position.copy(litCoin.position).add(V(-1.5, 2.5, 4)); coinLight.intensity = litCoin === last ? 5 : 22; }

      // ================================================================ its screen: its eyes, and the study it just played
      const blinkPh = (time + 0.4) % 3.6;
      const lastRead = r > 1.8 && r < 1.98 ? ease((r - 1.8) / 0.04) * (1 - ease((r - 1.94) / 0.04)) : 0;
      const readI = lastRead > 0 ? 3 : kOf.findIndex((k) => k > 0.68 && k < 1.12);
      const happy = (r > 0.9 && r < 1.0) || rs.win > 0.3;
      const seen = active >= 0 && coins[active].visible ? coins[active] : last.visible && !through ? last : null;
      const eyeTo = seen ? seen.position.clone().project(camera) : null;
      scr.draw({
        read: readI >= 0 ? { a: readI === 3 ? lastRead : ease((kOf[readI] - 0.68) / 0.06) * (1 - ease((kOf[readI] - 1.04) / 0.08)), n: STUDIES[readI].n, glyph: STUDIES[readI].glyph, name: NAMES[readI] } : null,
        level: 1,
        open: lerp(0.2, 1, ease((r - 0.83) / 0.1)),
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: happy ? 1 : 0,
        lookX: eyeTo ? THREE.MathUtils.clamp(eyeTo.x * 1.5, -1, 1) : Math.sin(time * 0.37) * 0.25,
        lookY: eyeTo ? -THREE.MathUtils.clamp(eyeTo.y * 1.2, -1, 1) : Math.sin(time * 0.29) * 0.15,
      });
      ic.draw(((r > 0.3 && r < 0.62) || (r > 0.98 && r < 2.06)) && Math.sin(time * 5) > -0.2);
      M.lamp.emissiveIntensity = on ? 2.2 : 0.4;
      const kickAt = [landSlot, ...[0, 1, 2].map((i) => START(i) + LEN * 0.36), FS];
      const kick = kickAt.reduce((m, t) => Math.max(m, Math.max(0, 1 - Math.abs(r - t) / 0.02)), 0);
      scr.U.uKick.value = kick * 0.4;
      glitch.uniforms.uKick.value = kick * 0.2;
      glitch.uniforms.uTime.value = time;
      // the brain's shaft has no vignette or grain: they go as you go through
      glitch.uniforms.uVig.value = ease((r - 0.05) / 0.3) * (1 - ease((r - FS - 0.04) / 0.2));
      glitch.uniforms.uFade.value = 0;
      bloom.strength = 0.5 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      tagEls.forEach((el, i) => {
        if (i === 3) {
          const a = ease((r - 1.82) / 0.05) * (1 - ease((r - 1.92) / 0.05));
          if (a <= 0) { el.style.opacity = '0'; return; }
          const pp = last.position.clone().add(V(R * 1.15, 0.4, 0)).project(camera);
          el.style.transform = `translate(${Math.round(((pp.x + 1) / 2) * innerWidth)}px, ${Math.round(((1 - pp.y) / 2) * innerHeight - 30)}px)`;
          el.style.opacity = String(a);
          return;
        }
        const k = kOf[i];
        const show = k > 0 && k < 1.0;
        if (!show) { el.style.opacity = '0'; return; }
        const pp = coins[i].visible ? coins[i].position.clone().project(camera) : S.clone().project(camera);
        const px = ((pp.x + 1) / 2) * innerWidth, py = ((1 - pp.y) / 2) * innerHeight;
        el.style.transform = `translate(${Math.round(px + 50)}px, ${Math.round(py - 24)}px)`;
        el.style.opacity = String(Math.min(1, k / 0.08) * (1 - ease((k - 0.8) / 0.15)));
      });
      if (r > 0.88 && r < 1.04) {
        bigEl.querySelector('span').textContent = 'The coin goes in';
        bigEl.querySelector('b').textContent = 'It was watching';
        bigEl.querySelector('em').textContent = 'It saw everything I built. Now, what I studied.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 0.88) / 0.16) * Math.PI) * 1.4);
      } else bigEl.style.opacity = '0';
      countEl.textContent = String(inCount);
      sigEl.textContent = String((on ? 1 : 0) + inCount).padStart(2, '0');
      frame.style.opacity = String(ease((r - 0.86) / 0.1) * (1 - ease((r - 1.86) / 0.08)));
      endEl.style.opacity = String(ease((r - 2.86) / 0.12));
      this._top = r < 0.81;
      return { inserted: inCount, pov: clamp(x / X) };
    },
    render() {
      const tm = renderer.toneMapping, ex = renderer.toneMappingExposure, ac = renderer.autoClear;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      camera.layers.set(0);
      if (this._shaft) {
        renderer.setRenderTarget(shaftRT);
        renderer.render(shaft, camera);
        renderer.setRenderTarget(null);
      }
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
