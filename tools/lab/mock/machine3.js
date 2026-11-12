// LAB ONLY (throwaway). The robot beat, round 52: only the head, and the coins go into its brain. You pull back out
// through the coin (the works were on its screen: it was watching); the coin drops into the slot under the screen;
// the works switch off, the screen clears to glass, and inside the head is its brain: the coin you came through rises
// up inside and goes into it, and it lights. Then the four study coins, quick, each named: down in front of the glass
// into the slot, up inside and into the brain, its name lit on the glass. Then you go into the brain.
// Head: tools/lab/blender/machine.py (its body is not shown). Original design.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { coin } from './kit.js';
import { STUDIES, PATHS, studyCoin, brain } from './stage.js';

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const io = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
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
        float cell = 0.17;
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

export const MACHINE3_END = 2.75;

export async function createMachine3(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06030c');
  scene.fog = new THREE.FogExp2('#0a0416', 0.005);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pm.dispose();
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 900);
  const D = 10, PH_ = 2 * D * Math.tan((20 * Math.PI) / 180), PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); l.layers.enableAll(); return l; };
  const amb = new THREE.HemisphereLight('#5a4688', '#07040c', 0.8); amb.layers.enableAll();
  scene.add(dir('#ffe9d2', 2.2, -14, 18, 26), dir('#a582ff', 2.6, 20, 8, -18), dir('#ffcf9a', 0.6, 0, -20, 20), amb);
  const both = (o) => o.traverse((c) => c.layers.enable(1));

  // ---------------------------------------------------------------- the head (the cabinet's body is left out)
  const machine = await loadGlb('models/machine.glb');
  scene.add(machine);
  machine.updateMatrixWorld(true);
  const node = (n) => machine.getObjectByName(n);
  machine.position.copy(node('visor_c').getWorldPosition(V()).negate());
  machine.updateMatrixWorld(true);
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: '#2b1e48', roughness: 0.42, metalness: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.25 }),
    trim: new THREE.MeshPhysicalMaterial({ color: '#c99a4a', roughness: 0.28, metalness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0e0a14', roughness: 0.55, metalness: 0.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.4 }),
  };
  machine.traverse((o) => {
    if (!o.isMesh) return;
    if (/^(body|frame_|base|vent_)/.test(o.name)) { o.visible = false; return; }
    if (o.name !== 'visor') o.material = M[baseName(o.material)] ?? M.body;
  });
  const vis = node('visor');
  const scr = screen(new THREE.Vector2(15.5, 12.4), new THREE.Vector2(PW_, PH_), pageTexture);
  vis.material = scr.mat;
  vis.renderOrder = 2;
  vis.layers.set(1);
  const S = node('slot').getWorldPosition(V());
  const lab = node('coin_label').getWorldPosition(V());
  const ic = insertCoin();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.85), new THREE.MeshBasicMaterial({ map: ic.tex, toneMapped: false }));
  plate.position.copy(lab).add(V(0, 0, 0.02));
  scene.add(plate);
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1200, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 160, (rnd() - 0.5) * 110, -10 - rnd() * 90], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.1, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ---------------------------------------------------------------- inside the head: its brain
  const BZ = -2.4, BC = V(0, 0.4, BZ);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ map: boardTex(1100, 900, 5), color: '#9a90b0', roughness: 0.8, metalness: 0.1 }));
  back.position.set(0, 0, -4.5);
  scene.add(back);
  const theBrain = brain();
  theBrain.scale.setScalar(3.0);
  theBrain.position.copy(BC);
  scene.add(theBrain);
  // a ring of light round the brain that flares as each coin goes in
  const halo = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.86, 96), new THREE.MeshBasicMaterial({ color: '#ffc46a', transparent: true, opacity: 0.0, toneMapped: false, side: THREE.DoubleSide }));
  halo.position.copy(BC).add(V(0, 0, -0.6));
  scene.add(halo);
  const headLight = new THREE.PointLight('#ffcf8a', 0, 18, 2);
  headLight.position.set(0, 1.5, -0.6);
  scene.add(headLight);
  const floorY = -6.4;

  // ---------------------------------------------------------------- the coins
  const R = 1.3, R0 = 1.3, CZ = D - 0.9;
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
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 22, 2);
  coinLight.layers.enableAll();
  scene.add(coinLight);
  const slotPlane = new THREE.Plane(V(0, 1, 0), -S.y);
  const floorPlane = new THREE.Plane(V(0, 1, 0), -floorY);
  /** Up from the floor of the head into the brain: where the coin is, how big, `g` 0..1. */
  const intoBrain = (g, side) => {
    const h = io(g);
    const p0 = V(side * 1.2, floorY - R, BZ + 0.6), p1 = V(side * 4.5, -2.5, BZ + 0.9), p2 = BC.clone().add(V(side * 3.0, 0.9, 1.0)), p3 = BC.clone();
    const u = 1 - h;
    const p = p0.clone().multiplyScalar(u * u * u).addScaledVector(p1, 3 * u * u * h).addScaledVector(p2, 3 * u * h * h).addScaledVector(p3, h * h * h);
    const s = 1 - 0.85 * ease((g - 0.6) / 0.4);
    return { p, s };
  };
  const START = (i) => 1.12 + 0.16 * i, LEN = 0.3;
  const SIDES = [-1, 1, -1, 1];

  // ---------------------------------------------------------------- the picture
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.5, 0.82);
  composer.addPass(bloom);
  const glitch = new ShaderPass(GLITCH);
  composer.addPass(glitch);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- HUD: a name beside each coin as it comes in
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-frame { opacity: 0; transition: opacity .3s; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-tagc { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; }
    .st-tagc span { display: block; color: #efb53d; }
    .st-tagc b { display: block; font: 800 22px/1 Barlow; letter-spacing: 0.01em; text-transform: uppercase; margin-top: 4px; }
    .st-big { position: fixed; left: var(--gutter, 30px); top: 44%; margin: 0; max-width: 300px; }
    .st-big span { display: block; color: #efb53d; }
    .st-big b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-big em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 40px); right: var(--gutter, 30px); margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; text-align: right; }
    .st-list li { opacity: 0.35; transition: opacity .4s; }
    .st-list li span { display: block; color: #efb53d; }
    .st-list li b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-list li.in { opacity: 1; }
    .st-list li.in b::after { content: ' · in its brain'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-state { position: fixed; left: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); line-height: 1.8; }
    .st-state b { color: #efb53d; font-weight: 500; }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #000; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <div class="st-frame"><p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4</p>
  <ol class="st-list m">${STUDIES.map((s, i) => `<li><span>${s.n}</span><b>${NAMES[i]}</b></li>`).join('')}</ol>
  <p class="st-state m">Power <b>00</b> %</p></div>
  ${STUDIES.map((s, i) => `<p class="st-tagc" data-i="${i}"><span class="m">${s.n} / 05 · a study</span><b>${NAMES[i]}</b></p>`).join('')}
  <p class="st-big"><span class="m"></span><b></b><em></em></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const frame = hud.querySelector('.st-frame'), tagEls = [...hud.querySelectorAll('.st-tagc')], listEls = [...hud.querySelectorAll('.st-list li')], bigEl = hud.querySelector('.st-big'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');
  const flashAt = [];

  return {
    scene, camera,
    press() { return false; },
    update({ r, time }) {
      // ================================================================ the first coin: out through it; it drops in; the screen clears; it goes into the brain
      const pull = io(r / 0.55);
      const fall = clamp((r - 0.46) / 0.26);
      const yIn = S.y - R0 * 2.6;
      const landSlot = 0.46 + 0.26 * Math.sqrt((S.y - R0) / yIn);
      scr.U.uTex.value = pageTexture();
      scr.U.uTime.value = time;
      scr.U.uDots.value = ease((r - 0.1) / 0.32);
      scr.U.uSqueeze.value = ease((r - 0.72) / 0.08);
      scr.U.uFaceOn.value = r > 0.8 ? 1 : 0;
      scr.U.uClear.value = ease((r - 0.8) / 0.12);
      vis.layers.set(r < 0.8 ? 1 : 0);
      const mainIn = clamp((r - 0.9) / 0.2);
      if (r < 0.72) {
        const cy = fall > 0 ? yIn * fall * fall : 0;
        big.position.set(0, cy + Math.sin(time * 1.1) * 0.05 * (1 - fall) * ease((r - 0.3) / 0.1), lerp(CZ, S.z, out(fall / 0.66)));
        big.rotation.set(Math.sin(time * 0.7) * 0.05 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(time * 0.5) * 0.12 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(fall * Math.PI) * 0.1);
        big.scale.setScalar(R0);
        big.userData.clip(fall > 0 ? [slotPlane] : null);
        big.visible = true;
      } else {
        const { p, s } = intoBrain(mainIn, 1);
        big.position.copy(p);
        big.rotation.set(0, 0, -mainIn * 3);
        big.scale.setScalar(R0 * s);
        big.userData.clip([floorPlane]);
        big.visible = mainIn > 0 && mainIn < 1;
      }
      const powered = r >= 1.1;

      // ================================================================ the study coins, quick: down in front, up inside, into the brain
      let inCount = 0, active = -1;
      const kOf = [];
      coins.forEach((c, i) => {
        const k = (r - START(i)) / LEN;
        kOf[i] = k;
        c.visible = false;
        if (k <= 0) return;
        if (k >= 0.96) inCount++;
        if (k < 1) active = i;
        if (k < 0.4) {
          const f = clamp(k / 0.4);
          c.position.set(0, lerp(S.y + 22, S.y - R * 2.6, f * f), S.z);
          c.rotation.set(0, 0, Math.sin(f * 6 + i) * 0.12 * (1 - f));
          c.scale.setScalar(R);
          c.userData.clip([slotPlane]);
          c.visible = f < 0.999;
        } else if (k >= 0.46 && k < 0.98) {
          const g = clamp((k - 0.46) / 0.52);
          const { p, s } = intoBrain(g, SIDES[i]);
          c.position.copy(p);
          c.rotation.set(0, 0, SIDES[i] * g * 2.5);
          c.scale.setScalar(R * s);
          c.userData.clip([floorPlane]);
          c.visible = true;
        }
        listEls[i].classList.toggle('in', k >= 0.96);
      });
      // each time a coin goes in, the brain flares
      const ins = [1.1, ...coins.map((_, i) => START(i) + LEN * 0.98)];
      const flare = ins.reduce((a, t) => Math.max(a, Math.max(0, 1 - Math.abs(r - t) / 0.05) * (r > t - 0.02 ? 1 : 0)), 0);
      theBrain.material.uniforms.uA.value = (powered ? 0.45 + 0.17 * inCount : 0.1 * ease((r - 0.8) / 0.1)) + flare * 0.9;
      theBrain.rotation.y = time * 0.25;
      halo.material.opacity = flare * 0.8 + (powered ? 0.12 + 0.05 * inCount : 0);
      halo.scale.setScalar(1 + flare * 0.25);
      headLight.intensity = (powered ? 14 + 5 * inCount : 4 * ease((r - 0.8) / 0.1)) + flare * 30;

      // ================================================================ the camera: the head, big
      camera.up.set(0, 1, 0);
      const endA = V(0, -1.6, 20.5);
      const HPOS = V(0, -1.4, 27), HLOOK = V(0, -1.2, 0);
      const toH = io((r - 0.62) / 0.3);
      const follow = Math.sin(clamp((r - 0.5) / 0.3) * Math.PI) * 2.4 * (1 - toH);
      const pos = V(0, 0, D).lerp(endA, pull).lerp(HPOS, toH);
      const look = V(0, -1.3 * pull - follow, 0).lerp(HLOOK, toH);
      // in at the end: through the glass, into the brain
      const dive = io((r - 1.98) / 0.5);
      pos.lerp(BC.clone().add(V(0, 0, 3.4)), dive);
      look.lerp(BC.clone().add(V(0, 0, -3)), dive);
      camera.position.copy(pos);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      coinLight.intensity = 0;
      const litCoin = active >= 0 ? coins[active] : r < 1.1 ? big : null;
      if (litCoin && litCoin.visible) { coinLight.position.copy(litCoin.position).add(V(-1.5, 2.5, 4)); coinLight.intensity = 16; }

      // ================================================================ the glass: what it is taking in, in lit dots
      const say = active >= 0 && kOf[active] > 0.3 ? active : -1;
      const a = say >= 0 ? ease((kOf[say] - 0.3) / 0.08) * (1 - ease((kOf[say] - 0.98) / 0.06)) : 0;
      const name = say >= 0 ? NAMES[say].toUpperCase().split(' ') : [];
      scr.draw(say >= 0
        ? { words: { a, top: `${STUDIES[say].n} · STUDY`, lines: name.length > 2 ? [name.slice(0, 2).join(' '), name.slice(2).join(' ')] : name.join(' ').length > 14 ? name : [name.join(' ')] } }
        : r > 0.92 && r < 1.12 ? { words: { a: Math.sin(clamp((r - 0.92) / 0.2) * Math.PI), top: 'BUILT', lines: ['EVERYTHING', 'I MADE'] } } : { words: { a: 0, top: '', lines: [] } });
      ic.draw(((r > 0.3 && r < 0.62) || (r > 1.05 && r < 1.7)) && Math.sin(time * 5) > -0.2);
      M.lamp.emissiveIntensity = powered ? 2.2 : 0.4;
      const kickAt = [landSlot, ...coins.map((_, i) => START(i) + LEN * 0.4)];
      const kick = kickAt.reduce((m, t) => Math.max(m, Math.max(0, 1 - Math.abs(r - t) / 0.02)), 0);
      scr.U.uKick.value = kick * 0.4;
      glitch.uniforms.uKick.value = kick * 0.3;
      glitch.uniforms.uTime.value = time;
      glitch.uniforms.uVig.value = ease((r - 0.05) / 0.3);
      glitch.uniforms.uFade.value = ease((r - 2.38) / 0.16);
      bloom.strength = 0.5 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      tagEls.forEach((el, i) => {
        const k = kOf[i];
        const show = k > 0 && k < 0.98;
        if (!show) { el.style.opacity = '0'; return; }
        const pp = coins[i].position.clone().project(camera);
        const px = ((pp.x + 1) / 2) * innerWidth, py = ((1 - pp.y) / 2) * innerHeight;
        const right = k < 0.4 || SIDES[i] > 0;
        el.style.transform = right ? `translate(${Math.round(px + 60)}px, ${Math.round(py - 24)}px)` : `translate(calc(${Math.round(px - 60)}px - 100%), ${Math.round(py - 24)}px)`;
        el.style.textAlign = right ? 'left' : 'right';
        el.style.opacity = String(Math.min(1, k / 0.08) * (1 - ease((k - 0.9) / 0.08)));
      });
      if (r > 0.98 && r < 1.12) {
        bigEl.querySelector('span').textContent = 'The coin goes in';
        bigEl.querySelector('b').textContent = 'It was watching';
        bigEl.querySelector('em').textContent = 'Everything I built, into its brain. Now what I studied.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 0.98) / 0.14) * Math.PI) * 1.4);
      } else if (r > 1.8 && r < 2.02) {
        bigEl.querySelector('span').textContent = 'Four studies in';
        bigEl.querySelector('b').textContent = 'Now it thinks';
        bigEl.querySelector('em').textContent = 'Everything I built and studied, in one brain.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 1.8) / 0.22) * Math.PI) * 1.4);
      } else bigEl.style.opacity = '0';
      countEl.textContent = String(inCount);
      sigEl.textContent = String(Math.round((powered ? 20 : 0) + inCount * 20)).padStart(2, '0');
      frame.style.opacity = String(ease((r - 0.95) / 0.1) * (1 - ease((r - 2.0) / 0.12)));
      endEl.style.opacity = String(ease((r - 2.5) / 0.18));
      this._top = r < 0.8;
      return { inserted: inCount, pov: 0 };
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
