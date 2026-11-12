// LAB ONLY (throwaway). The robot beat, round 51: the coin machine, quicker, the studies plain, the brain in its head.
// You pull back out through the coin (the works were on its screen); the coin drops into the slot and the machine
// switches on (screen off, eyes on). Then the four study coins come in quick, one after another, each with its name
// beside it: into the slot, the screen says what it is, and the coin drops into its own named tube in the window.
// When all four are in it smiles, its screen clears, and behind it, inside its head, is its brain: sitting in the
// square hole of the coin you came through, fed by four lines from the studies. You go in to it.
// Cabinet: tools/lab/blender/machine.py. Original design.
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
        float clr = smoothstep(uClear * 1.3 - 0.3, uClear * 1.3, length(p / uSize) * 1.2 + hash(cc) * 0.15);
        float a = mix(1.0, 0.0, 1.0 - clr * (1.0 - step(0.999, uClear)));
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const rr = (x0, y0, w, h, r) => { x.beginPath(); x.roundRect(x0, y0, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); x.fill(); };
  function draw(st) {
    x.fillStyle = '#000';
    x.fillRect(0, 0, CW, CH);
    const lv = (v) => { const k = Math.round(255 * clamp(v)); return `rgb(${k},${k},${k})`; };
    if (st.read) {
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
/** A study's name, written up the side of its tube. */
function tubeLabel(n, name) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 112;
  const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  let last = -1;
  return {
    tex: t,
    draw(lit) {
      const k = Math.round(lit * 20);
      if (k === last) return;
      last = k;
      x.clearRect(0, 0, 1024, 112);
      x.textBaseline = 'middle';
      x.font = '600 52px "IBM Plex Mono", monospace'; x.fillStyle = lit > 0.5 ? '#ffd28a' : 'rgba(201,154,74,0.55)';
      x.fillText(n, 8, 58);
      x.font = '800 64px Barlow, sans-serif'; x.fillStyle = lit > 0.5 ? '#fff4dd' : 'rgba(242,239,232,0.42)';
      x.fillText(name.toUpperCase(), 120, 60);
      t.needsUpdate = true;
    },
  };
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

export const MACHINE2_END = 2.75;

export async function createMachine2(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#06030c');
  scene.fog = new THREE.FogExp2('#0a0416', 0.005);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pm.dispose();
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 900);
  const tanF = Math.tan((20 * Math.PI) / 180);
  const D = 10, PH_ = 2 * D * tanF, PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); l.layers.enableAll(); return l; };
  const amb = new THREE.HemisphereLight('#5a4688', '#07040c', 0.8); amb.layers.enableAll();
  scene.add(dir('#ffe9d2', 2.2, -14, 18, 26), dir('#a582ff', 2.6, 20, 8, -18), dir('#ffcf9a', 0.6, 0, -20, 20), amb);
  const both = (o) => o.traverse((c) => c.layers.enable(1));

  // ---------------------------------------------------------------- the machine
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
  machine.traverse((o) => { if (o.isMesh && o.name !== 'visor') o.material = M[baseName(o.material)] ?? M.body; });
  const vis = node('visor');
  const scr = screen(new THREE.Vector2(15.5, 12.4), new THREE.Vector2(PW_, PH_), pageTexture);
  vis.material = scr.mat;
  vis.renderOrder = 2;
  vis.layers.set(1);
  const S = node('slot').getWorldPosition(V());
  const WIN = node('window').getWorldPosition(V());
  const lab = node('coin_label').getWorldPosition(V());
  const ic = insertCoin();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.85), new THREE.MeshBasicMaterial({ map: ic.tex, toneMapped: false }));
  plate.position.copy(lab).add(V(0, 0, 0.02));
  scene.add(plate);
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1200, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 160, (rnd() - 0.6) * 110, -10 - rnd() * 90], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.1, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ---------------------------------------------------------------- its head: a chamber behind the screen, the brain inside
  const R = 1.3, CHZ = -2.6;
  const chamber = new THREE.Group();
  scene.add(chamber);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), new THREE.MeshStandardMaterial({ map: boardTex(1100, 900, 5), color: '#9a90b0', roughness: 0.8, metalness: 0.1 }));
  back.position.set(0, 0, -4.5);
  chamber.add(back);
  const theBrain = brain();
  theBrain.scale.setScalar(0.52);
  theBrain.position.set(0, 0.3, CHZ - 0.1);
  chamber.add(theBrain);
  const headLight = new THREE.PointLight('#ffcf8a', 0, 18, 2);
  headLight.position.set(0, 2, -0.8);
  chamber.add(headLight);
  // four lines up from the studies into the brain
  const feeds = [-1, -0.33, 0.33, 1].map((u, i) => {
    const a = V(u * 6.6, -6.0, -4.3), b = V(u * 3.0, -2.5, -3.6), c = V(0, 0.3, CHZ - 0.4);
    const curve = new THREE.CatmullRomCurve3([a, b, c]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.06, 8), new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.05 }));
    chamber.add(m);
    return m.material;
  });

  // ---------------------------------------------------------------- the window: four named tubes
  const ZM = WIN.z, OY = WIN.y + 17.4;
  const TX = [-6.0, -2.0, 2.0, 6.0], TT = OY - 13.0, TB = OY - 23.0;
  const win = new THREE.Group();
  scene.add(win);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(17, 15.5), new THREE.MeshStandardMaterial({ map: boardTex(), color: '#8a80a0', roughness: 0.8, metalness: 0.1, envMapIntensity: 0.3 }));
  board.position.set(WIN.x, WIN.y, ZM - 0.95);
  win.add(board);
  const chute = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.2), M.dark);
  chute.position.set(0, OY - 9.7, ZM);
  win.add(chute);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.3), M.trim);
  lip.position.set(0, OY - 10.25, ZM);
  win.add(lip);
  const tubeLamps = [], labels = [], traces = [];
  TX.forEach((x, i) => {
    // a cage of brass: two rods, a ring top and bottom, a cup at the foot
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, TT - TB + 0.6, 12), M.trim); rod.position.set(x + sx * (R + 0.18), (TT + TB) / 2 - R, ZM); win.add(rod); }
    const cup = new THREE.Mesh(new THREE.TorusGeometry(R + 0.16, 0.11, 12, 48, Math.PI), M.trim);
    cup.rotation.z = Math.PI; cup.position.set(x, TB + R - 0.02, ZM); win.add(cup);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(2 * R + 0.6, 0.14, 0.7), M.trim);
    ring.position.set(x, TT - 0.05, ZM); win.add(ring);
    const lamp = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.05 });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), lamp);
    dot.position.set(x, TB - 0.55, ZM + 0.1); win.add(dot);
    tubeLamps.push(lamp);
    // the study's name up the side of its tube
    const l = tubeLabel(STUDIES[i].n, NAMES[i]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 0.98), new THREE.MeshBasicMaterial({ map: l.tex, transparent: true, toneMapped: false }));
    m.rotation.z = Math.PI / 2;
    m.position.set(x + R + 0.62, (TT + TB) / 2 - 0.3, ZM - 0.5);
    win.add(m);
    labels.push(l);
    // a lit line up the board from the tube to the head
    const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, TT - (OY - 9.9)), new THREE.MeshBasicMaterial({ color: '#ffc46a', transparent: true, opacity: 0.1, toneMapped: false }));
    tr.position.set(x * 0.98, (TT + OY - 9.9) / 2 + 0.2, ZM - 0.9); win.add(tr);
    traces.push(tr.material);
  });
  const winLight = new THREE.PointLight('#ffcf8a', 9, 26, 2);
  winLight.position.set(0, OY - 17, ZM + 4);
  scene.add(winLight);

  // ---------------------------------------------------------------- the coins
  const R0 = 1.3, CZ = D - 0.9;
  const big = coin();
  big.scale.setScalar(R0);
  scene.add(big);
  both(big);
  const bigMats = [];
  big.traverse((o) => { if (o.isMesh && !bigMats.includes(o.material)) bigMats.push(o.material); });
  const coins = STUDIES.map((s) => {
    const c = studyCoin(s);
    c.scale.setScalar(R);
    const mats = [];
    c.traverse((o) => { if (o.isMesh && !mats.includes(o.material)) mats.push(o.material); });
    c.userData.clip = (plane) => mats.forEach((m) => (m.clippingPlanes = plane ? [plane] : null));
    scene.add(c);
    return c;
  });
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 22, 2);
  coinLight.layers.enableAll();
  scene.add(coinLight);
  const slotPlane = new THREE.Plane(V(0, 1, 0), -S.y);
  const winTop = new THREE.Plane(V(0, -1, 0), OY - 9.75);
  const START = (i) => 0.95 + 0.17 * i, LEN = 0.32;

  // ---------------------------------------------------------------- the picture
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.5, 0.85);
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
    .st-tagc { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; transform: translate(0, -50%); }
    .st-tagc span { display: block; color: #efb53d; }
    .st-tagc b { display: block; font: 800 22px/1 Barlow; letter-spacing: 0.01em; text-transform: uppercase; margin-top: 4px; }
    .st-tagc i { position: absolute; right: 100%; top: 50%; width: 40px; height: 1px; margin-right: 8px; background: rgb(239 181 61 / 0.7); }
    .st-big { position: fixed; left: var(--gutter, 30px); top: 44%; margin: 0; max-width: 300px; }
    .st-big span { display: block; color: #efb53d; }
    .st-big b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-big em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-state { position: fixed; left: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); line-height: 1.8; }
    .st-state b { color: #efb53d; font-weight: 500; }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #000; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <div class="st-frame"><p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4 in</p><p class="st-state m">Power <b>00</b> %</p></div>
  ${STUDIES.map((s, i) => `<p class="st-tagc" data-i="${i}"><i></i><span class="m">${s.n} / 05 · a study</span><b>${NAMES[i]}</b></p>`).join('')}
  <p class="st-big"><span class="m"></span><b></b><em></em></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const frame = hud.querySelector('.st-frame'), tagEls = [...hud.querySelectorAll('.st-tagc')], bigEl = hud.querySelector('.st-big'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');

  return {
    scene, camera,
    press() { return false; },
    update({ r, time }) {
      // ================================================================ the first coin: out through it; it drops in; the machine switches on
      const pull = io(r / 0.55);
      const fall = clamp((r - 0.46) / 0.26);
      const yIn = S.y - R0 * 2.6;
      const landSlot = 0.46 + 0.26 * Math.sqrt((S.y - R0) / yIn);
      scr.U.uTex.value = pageTexture();
      scr.U.uTime.value = time;
      scr.U.uDots.value = ease((r - 0.1) / 0.32);
      scr.U.uSqueeze.value = ease((r - 0.72) / 0.09);
      scr.U.uFaceOn.value = ease((r - 0.82) / 0.1);
      scr.U.uClear.value = ease((r - 1.86) / 0.2);
      vis.layers.set(r < 0.81 ? 1 : 0);
      if (r < 0.72) {
        const cy = fall > 0 ? yIn * fall * fall : 0;
        big.position.set(0, cy + Math.sin(time * 1.1) * 0.05 * (1 - fall) * ease((r - 0.3) / 0.1), lerp(CZ, S.z, out(fall / 0.66)));
        big.rotation.set(Math.sin(time * 0.7) * 0.05 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(time * 0.5) * 0.12 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(fall * Math.PI) * 0.1);
        bigMats.forEach((m) => (m.clippingPlanes = fall > 0 ? [slotPlane] : null));
      } else {
        // it went up into its head: it is the socket the brain sits in
        big.position.set(0, 0.3, CHZ);
        big.rotation.set(0, 0, 0);
        bigMats.forEach((m) => (m.clippingPlanes = null));
      }
      const on = r >= 0.8;

      // ================================================================ the study coins, quick, one after another
      let inCount = 0, active = -1, activeK = 0;
      const readK = [];
      coins.forEach((c, i) => {
        const k = (r - START(i)) / LEN;
        c.visible = false;
        c.userData.clip(null);
        readK[i] = k;
        if (k <= 0) return;
        if (k >= 0.95) inCount++;
        if (k < 1) { active = i; activeK = k; }
        if (k < 0.42) {
          // from above, into the slot
          const f = clamp(k / 0.42);
          c.position.set(0, lerp(S.y + 20, S.y - R * 2.6, f * f), S.z);
          c.rotation.set(0, 0, Math.sin(f * 6 + i) * 0.12 * (1 - f));
          c.userData.clip(slotPlane);
          c.visible = f < 0.999;
        } else if (k >= 0.5) {
          // out of the chute in the window, across to its tube and down it
          const g = clamp((k - 0.5) / 0.42);
          const x = TX[i];
          let p;
          if (g < 0.4) { const h = g / 0.4; p = V(lerp(0, x, ease(h)), lerp(OY - 9.4, TT + R + 0.2, h * h) + Math.sin(h * Math.PI) * 0.8, ZM); }
          else { const h = (g - 0.4) / 0.6; p = V(x, lerp(TT + R + 0.2, TB + R, h * h), ZM); }
          c.position.copy(p);
          c.rotation.set(0, 0, -x * 0.25 * ease(g / 0.4));
          c.userData.clip(winTop);
          c.visible = true;
        }
        const lit = ease((k - 0.9) / 0.1);
        tubeLamps[i].emissiveIntensity = 0.05 + lit * 3;
        traces[i].opacity = 0.1 + lit * 0.75 * (0.75 + 0.25 * Math.sin(time * 3 + i));
        labels[i].draw(lit);
        feeds[i].emissiveIntensity = 0.05 + lit * 3;
      });
      if (r < START(0)) labels.forEach((l) => l.draw(0));

      // ================================================================ the camera
      camera.up.set(0, 1, 0);
      const endA = V(0, -1.6, 20.5);
      const MPOS = V(0, OY - 10.8, 46), MLOOK = V(0, OY - 10.8, 0);
      const toM = io((r - 0.62) / 0.33);
      const follow = Math.sin(clamp((r - 0.5) / 0.3) * Math.PI) * 2.4 * (1 - toM);
      const pos = V(0, 0, D).lerp(endA, pull).lerp(MPOS, toM);
      const look = V(0, -1.3 * pull - follow, 0).lerp(MLOOK, toM);
      // after the four: up to the head, and in, through the cleared screen, to the brain in the coin's hole
      const up = io((r - 1.8) / 0.22), dive = io((r - 2.06) / 0.5);
      pos.lerp(V(0, 0.3, 24), up).lerp(V(0, 0.3, CHZ + 2.7), dive);
      look.lerp(V(0, 0.3, 0), up).lerp(V(0, 0.3, CHZ), dive);
      camera.position.copy(pos);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      coinLight.intensity = 0;
      const litCoin = active >= 0 ? coins[active] : r < 0.72 ? big : null;
      if (litCoin) { coinLight.position.copy(litCoin.position).add(V(-1.5, 2.5, 4)); coinLight.intensity = 16; }
      headLight.intensity = 30 * ease((r - 1.86) / 0.2);
      theBrain.material.uniforms.uA.value = (0.2 + 0.2 * inCount) * (on ? 1 : 0.3) + ease((r - 1.9) / 0.3) * 0.6;
      theBrain.rotation.y = time * 0.3;

      // ================================================================ its screen
      const blinkPh = (time + 0.4) % 3.6;
      const readI = readK.findIndex((k) => k > 0.38 && k < 1.12);
      const happy = (r > 0.92 && r < 0.97) || (r > 1.72 && r < 1.9);
      const eyeTo = active >= 0 ? coins[active].position.clone().project(camera) : null;
      scr.draw({
        read: readI >= 0 ? { a: ease((readK[readI] - 0.38) / 0.08) * (1 - ease((readK[readI] - 1.04) / 0.08)), n: STUDIES[readI].n, glyph: STUDIES[readI].glyph, name: NAMES[readI] } : null,
        level: 1,
        open: lerp(0.2, 1, ease((r - 0.83) / 0.1)),
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: happy ? 1 : 0,
        lookX: eyeTo ? THREE.MathUtils.clamp(eyeTo.x * 1.5, -1, 1) : Math.sin(time * 0.37) * 0.25,
        lookY: eyeTo ? -THREE.MathUtils.clamp(eyeTo.y * 1.2, -1, 1) : Math.sin(time * 0.29) * 0.15,
      });
      ic.draw(((r > 0.3 && r < 0.62) || (r > 0.9 && r < 1.62)) && Math.sin(time * 5) > -0.2);
      M.lamp.emissiveIntensity = on ? 2.2 : 0.4;
      const kickAt = [landSlot, ...coins.map((_, i) => START(i) + LEN * 0.42)];
      const kick = kickAt.reduce((a, t) => Math.max(a, Math.max(0, 1 - Math.abs(r - t) / 0.02)), 0);
      scr.U.uKick.value = kick * 0.5;
      glitch.uniforms.uKick.value = kick * 0.35;
      glitch.uniforms.uTime.value = time;
      glitch.uniforms.uVig.value = ease((r - 0.05) / 0.3);
      glitch.uniforms.uFade.value = ease((r - 2.42) / 0.18);
      bloom.strength = 0.45 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      tagEls.forEach((el, i) => {
        const k = readK[i];
        const show = k > 0 && k < 1.05;
        if (!show) { el.style.opacity = '0'; return; }
        const pp = coins[i].position.clone().project(camera);
        const px = ((pp.x + 1) / 2) * innerWidth, py = ((1 - pp.y) / 2) * innerHeight;
        el.style.transform = `translate(${Math.round(px + 70)}px, ${Math.round(py)}px) translate(0, -50%)`;
        el.style.opacity = String(Math.min(1, k / 0.08) * (1 - ease((k - 0.95) / 0.1)) * (coins[i].visible ? 1 : 0.85));
      });
      if (r > 0.86 && r < 0.98) {
        bigEl.querySelector('span').textContent = 'The coin goes in';
        bigEl.querySelector('b').textContent = 'It was watching';
        bigEl.querySelector('em').textContent = 'It saw everything I built. Now it learns what I studied.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 0.86) / 0.12) * Math.PI) * 1.5);
      } else if (r > 1.74 && r < 1.98) {
        bigEl.querySelector('span').textContent = 'Four studies in';
        bigEl.querySelector('b').textContent = 'Now it thinks';
        bigEl.querySelector('em').textContent = 'Everything I built and studied, wired to one brain.';
        bigEl.style.opacity = String(Math.sin(clamp((r - 1.74) / 0.24) * Math.PI) * 1.5);
      } else bigEl.style.opacity = '0';
      countEl.textContent = String(inCount);
      sigEl.textContent = String(Math.round((on ? 20 : 0) + inCount * 20)).padStart(2, '0');
      frame.style.opacity = String(ease((r - 0.85) / 0.1) * (1 - ease((r - 2.0) / 0.12)));
      endEl.style.opacity = String(ease((r - 2.5) / 0.18));
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
