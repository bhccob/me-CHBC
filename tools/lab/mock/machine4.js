// LAB ONLY (throwaway). The robot beat, round 53: only the head, its screen stays a screen (no brain behind it). You
// pull back out through the coin (the works were on its screen); the coin drops into the slot; it switches on, eyes
// and all. The four study coins come in quick, each named on its screen and beside it as it falls into the slot.
// Then you go over the slot and down it, after them: down the shaft inside its head to the socket where its brain
// sits, in the square hole of the first coin, the four studies plugged in round it. Head: tools/lab/blender/machine.py.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { C, coin } from './kit.js';
import { STUDIES, PATHS, studyCoin, brain, circuitMaterial, socketTexture } from './stage.js';

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

export const MACHINE4_END = 2.95;

export async function createMachine4(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
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

  // ---------------------------------------------------------------- the head (the cabinet's body is left out); its screen stays a screen
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
  // behind the screen: a wall, so nothing of the inside ever shows through it
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 13.4), new THREE.MeshBasicMaterial({ color: '#05030a' }));
  blind.position.set(0, 0, -0.25);
  scene.add(blind);
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

  // ---------------------------------------------------------------- inside its head, down the slot: the shaft, the socket, the brain, the coins in it
  const inside = new THREE.Group();
  inside.position.set(0, -300, 0);
  inside.visible = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 46, 64, 1, true), circuitMaterial());
  shaft.position.y = -22;
  inside.add(shaft);
  const sock = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 3.4), [0, 0, new THREE.MeshStandardMaterial({ map: socketTexture(), roughness: 0.5, metalness: 0.4 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: '#0b0a10' })));
  sock.position.y = -45;
  inside.add(sock);
  const theBrain = brain();
  theBrain.scale.setScalar(0.13);
  theBrain.position.set(0, -44.9, 0);
  inside.add(theBrain);
  const inLight = new THREE.PointLight(C.glow, 6, 0, 2);
  inLight.position.set(0, -42, 0);
  inside.add(inLight);
  // the coin you came through, the socket round the brain; the four studies plugged in round it, lines of light to it
  const seat = coin();
  seat.scale.setScalar(0.4);
  seat.position.set(0, -44.86, 0);
  seat.rotation.set(-Math.PI / 2, 0, 0);
  inside.add(seat);
  const seated = STUDIES.map((s, i) => {
    const c = studyCoin(s);
    c.scale.setScalar(0.3);
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    c.position.set(Math.cos(a) * 1.15, -44.86, Math.sin(a) * 1.15);
    c.rotation.set(-Math.PI / 2, 0, -a);
    inside.add(c);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.62), new THREE.MeshBasicMaterial({ color: '#ffc46a', transparent: true, opacity: 0, toneMapped: false }));
    line.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
    line.position.set(Math.cos(a) * 0.62, -44.83, Math.sin(a) * 0.62);
    inside.add(line);
    return line.material;
  });
  scene.add(inside);

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
  const START = (i) => 0.98 + 0.16 * i, LEN = 0.28;

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

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-frame { opacity: 0; transition: opacity .3s; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-tagc { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; opacity: 0; }
    .st-tagc span { display: block; color: #efb53d; }
    .st-tagc b { display: block; font: 800 22px/1 Barlow; letter-spacing: 0.01em; text-transform: uppercase; margin-top: 4px; }
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

  return {
    scene, camera,
    press() { return false; },
    update({ r, time }) {
      // ================================================================ the first coin: out through it; it drops in; the screen switches on
      const pull = io(r / 0.55);
      const fall = clamp((r - 0.46) / 0.26);
      const yIn = S.y - R0 * 2.6;
      const landSlot = 0.46 + 0.26 * Math.sqrt((S.y - R0) / yIn);
      scr.U.uTex.value = pageTexture();
      scr.U.uTime.value = time;
      scr.U.uDots.value = ease((r - 0.1) / 0.32);
      scr.U.uSqueeze.value = ease((r - 0.72) / 0.08);
      scr.U.uFaceOn.value = ease((r - 0.82) / 0.1);
      scr.U.uClear.value = 0;
      vis.layers.set(r < 0.81 ? 1 : 0);
      if (r < 0.72) {
        const cy = fall > 0 ? yIn * fall * fall : 0;
        big.position.set(0, cy + Math.sin(time * 1.1) * 0.05 * (1 - fall) * ease((r - 0.3) / 0.1), lerp(CZ, S.z, out(fall / 0.66)));
        big.rotation.set(Math.sin(time * 0.7) * 0.05 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(time * 0.5) * 0.12 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(fall * Math.PI) * 0.1);
        big.userData.clip(fall > 0 ? [slotPlane] : null);
        big.visible = true;
      } else big.visible = false;
      const on = r >= 0.8;

      // ================================================================ the study coins, quick, each named
      let inCount = 0, active = -1;
      const kOf = [];
      coins.forEach((c, i) => {
        const k = (r - START(i)) / LEN;
        kOf[i] = k;
        c.visible = false;
        if (k <= 0) return;
        if (k >= 0.45) inCount++;
        if (k < 1.05) active = i;
        if (k < 0.45) {
          const f = clamp(k / 0.45);
          c.position.set(0, lerp(S.y + 22, S.y - R * 2.6, f * f), S.z);
          c.rotation.set(0, 0, Math.sin(f * 6 + i) * 0.12 * (1 - f));
          c.userData.clip([slotPlane]);
          c.visible = f < 0.999;
        }
        listEls[i].classList.toggle('in', k >= 0.45);
      });

      // ================================================================ the camera: the head, big; then over the slot and down it
      const endA = V(0, -1.6, 20.5);
      const HPOS = V(0, -1.4, 27), HLOOK = V(0, -1.2, 0);
      const toH = io((r - 0.62) / 0.3);
      const follow = Math.sin(clamp((r - 0.5) / 0.3) * Math.PI) * 2.4 * (1 - toH);
      const pos = V(0, 0, D).lerp(endA, pull).lerp(HPOS, toH);
      const look = V(0, -1.3 * pull - follow, 0).lerp(HLOOK, toH);
      const over = io((r - 1.8) / 0.26), down = Math.pow(clamp((r - 2.06) / 0.2), 3);
      pos.lerp(S.clone().add(V(0, 6.5, 2.2)), over).lerp(S.clone().add(V(0, -0.7, 0.02)), down);
      look.lerp(S.clone().add(V(0, -6, -0.5)), over);
      const dn = clamp(over);
      camera.up.set(0, 1 - dn, -dn).normalize();
      camera.position.copy(pos);
      camera.lookAt(look);
      let fade = ease((r - 2.14) / 0.12);
      const inT = clamp((r - 2.28) / 0.45);
      if (r >= 2.28) {
        inside.visible = true;
        machine.visible = false;
        const yCam = lerp(-302, -340.2, ease(inT));
        camera.position.set(0, yCam, 0.001);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, yCam - 5, 0);
        fade = 1 - ease((r - 2.28) / 0.1);
        shaft.material.uniforms.uTime.value = time;
        theBrain.material.uniforms.uA.value = 0.5 + ease((inT - 0.6) / 0.4) * 0.9;
        theBrain.rotation.y = time * 0.4;
        seated.forEach((m, i) => (m.opacity = ease((inT - 0.55 - i * 0.08) / 0.15) * 0.9));
      } else { inside.visible = false; machine.visible = true; }
      camera.updateMatrixWorld();
      coinLight.intensity = 0;
      const litCoin = active >= 0 && coins[active].visible ? coins[active] : r < 0.72 ? big : null;
      if (litCoin) { coinLight.position.copy(litCoin.position).add(V(-1.5, 2.5, 4)); coinLight.intensity = 16; }

      // ================================================================ its screen: its eyes, and the name of each study as it goes in
      const blinkPh = (time + 0.4) % 3.6;
      const readI = kOf.findIndex((k) => k > 0.38 && k < 1.12);
      const happy = (r > 0.92 && r < 0.98) || (r > 1.62 && r < 1.84);
      const eyeTo = active >= 0 && coins[active].visible ? coins[active].position.clone().project(camera) : null;
      scr.draw({
        read: readI >= 0 ? { a: ease((kOf[readI] - 0.38) / 0.08) * (1 - ease((kOf[readI] - 1.04) / 0.08)), n: STUDIES[readI].n, glyph: STUDIES[readI].glyph, name: NAMES[readI] } : null,
        level: 1,
        open: lerp(0.2, 1, ease((r - 0.83) / 0.1)),
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: happy ? 1 : 0,
        lookX: eyeTo ? THREE.MathUtils.clamp(eyeTo.x * 1.5, -1, 1) : over > 0 ? 0 : Math.sin(time * 0.37) * 0.25,
        lookY: eyeTo ? -THREE.MathUtils.clamp(eyeTo.y * 1.2, -1, 1) : over > 0 ? 0.9 : Math.sin(time * 0.29) * 0.15,
      });
      ic.draw(((r > 0.3 && r < 0.62) || (r > 0.92 && r < 1.55)) && Math.sin(time * 5) > -0.2);
      M.lamp.emissiveIntensity = on ? 2.2 : 0.4;
      const kickAt = [landSlot, ...coins.map((_, i) => START(i) + LEN * 0.45)];
      const kick = kickAt.reduce((m, t) => Math.max(m, Math.max(0, 1 - Math.abs(r - t) / 0.02)), 0);
      scr.U.uKick.value = kick * 0.4;
      glitch.uniforms.uKick.value = kick * 0.3;
      glitch.uniforms.uTime.value = time;
      glitch.uniforms.uVig.value = ease((r - 0.05) / 0.3);
      glitch.uniforms.uFade.value = Math.max(fade, ease((r - 2.76) / 0.12));
      bloom.strength = 0.5 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      tagEls.forEach((el, i) => {
        const k = kOf[i];
        const show = k > 0 && k < 1.0 && r < 1.8;
        if (!show) { el.style.opacity = '0'; return; }
        const pp = coins[i].visible ? coins[i].position.clone().project(camera) : S.clone().project(camera);
        const px = ((pp.x + 1) / 2) * innerWidth, py = ((1 - pp.y) / 2) * innerHeight;
        el.style.transform = `translate(${Math.round(px + 60)}px, ${Math.round(py - 24)}px)`;
        el.style.opacity = String(Math.min(1, k / 0.08) * (1 - ease((k - 0.8) / 0.15)));
      });
      if (r > 0.86 && r < 1.0) {
        bigEl.querySelector('span').textContent = 'The coin goes in';
        bigEl.querySelector('b').textContent = 'It was watching';
        bigEl.querySelector('em').textContent = 'It saw everything I built. Now what I studied.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 0.86) / 0.14) * Math.PI) * 1.4);
      } else if (r > 1.6 && r < 1.84) {
        bigEl.querySelector('span').textContent = 'Four studies in';
        bigEl.querySelector('b').textContent = 'Now it thinks';
        bigEl.querySelector('em').textContent = 'Everything I built and studied, in one brain. Go in.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 1.6) / 0.24) * Math.PI) * 1.4);
      } else bigEl.style.opacity = '0';
      countEl.textContent = String(inCount);
      sigEl.textContent = String(Math.round((on ? 20 : 0) + inCount * 20)).padStart(2, '0');
      frame.style.opacity = String(ease((r - 0.85) / 0.1) * (1 - ease((r - 1.82) / 0.1)));
      endEl.style.opacity = String(ease((r - 2.78) / 0.14));
      this._top = r < 0.81;
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
