// LAB ONLY (throwaway). The robot beat, round 50: the robot is a coin machine, so a coin makes sense going in, and it
// all runs on scroll. You pull back out through the coin (the works were on its screen: it was watching); the coin
// drops into the slot on its shelf, comes out behind the window in its body and rolls down brass rails, rail to rail,
// into the CPU socket at the bottom, where the brain sits in its square hole; the brain lights, the screen switches
// off, its eyes come on. Keep scrolling and the four study coins fall in from above, one by one: each rolls the same
// rails and drops into its own bay beside the CPU, and the screen reads it. Then you go in through the glass, into the
// coin's square hole, to the brain. Cabinet: tools/lab/blender/machine.py. Original design.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { coin } from './kit.js';
import { STUDIES, PATHS, studyCoin, brain, socketTexture } from './stage.js';

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const io = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the screen: the works exactly at first, then LED eyes
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
  const U = { uTex: { value: pageTexture() }, uFace: { value: tex }, uSize: { value: size }, uRect: { value: rect }, uDots: { value: 0 }, uSqueeze: { value: 0 }, uFaceOn: { value: 0 }, uTime: { value: 0 }, uKick: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    toneMapped: false, fog: false,
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex, uFace; uniform vec2 uSize, uRect; uniform float uDots, uSqueeze, uFaceOn, uTime, uKick; varying vec2 vUv;
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
        gl_FragColor = vec4(col, 1.0);
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
      x.save(); x.translate(CW * 0.12, CH * 0.26); x.scale(0.8, 0.8); x.fill(glyph[st.read.glyph], 'evenodd'); x.restore();
      x.font = '700 64px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText(st.read.n, CW * 0.52, CH * 0.46);
      x.strokeStyle = lv(a * 0.6); x.lineWidth = 3; x.strokeRect(CW * 0.15, CH * 0.78, CW * 0.7, 12);
      x.fillStyle = lv(a); x.fillRect(CW * 0.15 + 3, CH * 0.78 + 3, (CW * 0.7 - 6) * st.read.bar, 6);
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

/** INSERT COIN, in amber LEDs, on the plate under the slot. */
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

/** The board behind the mechanism: traces running to the bays and the CPU. */
function boardTex() {
  const c = document.createElement('canvas'); c.width = 1100; c.height = 1000;
  const x = c.getContext('2d');
  x.fillStyle = '#110a1d'; x.fillRect(0, 0, 1100, 1000);
  let sd = 21; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const a = Math.floor(r() * 4) * (Math.PI / 2) + (r() < 0.3 ? Math.PI / 4 : 0), len = 40 + r() * 180, x0 = r() * 1100, y0 = r() * 1000;
    x.strokeStyle = `rgba(214,162,83,${0.07 + r() * 0.12})`; x.lineWidth = 2 + r() * 2;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); x.stroke();
    x.fillStyle = x.strokeStyle; x.beginPath(); x.arc(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, 4, 0, Math.PI * 2); x.fill();
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

export const MACHINE_END = 4.4;   // how far the stage runs, in its own scroll units

export async function createMachine(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
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
  machine.position.copy(node('visor_c').getWorldPosition(V()).negate());   // its screen where the works were
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
  vis.layers.set(1);
  const S = node('slot').getWorldPosition(V());
  const WIN = node('window').getWorldPosition(V());
  const lab = node('coin_label').getWorldPosition(V());
  const ic = insertCoin();
  const label = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.85), new THREE.MeshBasicMaterial({ map: ic.tex, toneMapped: false }));
  label.position.copy(lab).add(V(0, 0, 0.02));
  scene.add(label);
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1200, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 160, (rnd() - 0.6) * 110, -10 - rnd() * 90], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.1, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ---------------------------------------------------------------- the mechanism behind the window
  const R = 1.3, ZM = WIN.z;                     // coin size; the plane the coins roll in
  const mech = new THREE.Group();
  scene.add(mech);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(17, 15.5), new THREE.MeshStandardMaterial({ map: boardTex(), color: '#8a80a0', roughness: 0.8, metalness: 0.1, envMapIntensity: 0.3 }));
  board.position.set(WIN.x, WIN.y, ZM - 0.95);
  mech.add(board);
  const rail = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.7), M.trim);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, ZM);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    mech.add(m);
    return { x0, y0, x1, y1, at: (x) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) };
  };
  const OY = WIN.y + 17.4;   // the window's centre is at -17.4 in the cabinet's own numbers
  const A = rail(-2.0, OY - 12.0, 6.6, OY - 12.8);
  const B = rail(7.4, OY - 15.8, -6.6, OY - 16.8);
  const Cr = rail(-7.4, OY - 19.8, -0.6, OY - 20.6);
  // stops at the rail ends, the chute the coins come out of
  [[6.85, A.at(6.6) + 0.55], [-6.85, B.at(-6.6) + 0.55]].forEach(([x, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.7), M.trim); m.position.set(x, y, ZM); mech.add(m); });
  const chute = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.2), M.dark);
  chute.position.set(-1.2, OY - 9.7, ZM);
  mech.add(chute);
  const chuteLip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.3), M.trim);
  chuteLip.position.set(-1.2, OY - 10.25, ZM);
  mech.add(chuteLip);
  // the bottom row: two bays, the CPU, two bays
  const CY = OY - 23.4, BX = [-7.0, -3.5, 3.5, 7.0];
  const bayLights = [];
  const cradle = (x, gold = true) => {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(R + 0.16, 0.12, 12, 48, Math.PI), M.trim);
    arc.rotation.z = Math.PI;
    g.add(arc);
    const lamp = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.05 });
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), lamp);
    dot.position.set(0, -R - 0.75, 0.1);
    g.add(dot);
    g.position.set(x, CY, ZM);
    mech.add(g);
    return lamp;
  };
  BX.forEach((x) => bayLights.push(cradle(x)));
  const cpuLamp = cradle(0);
  const sock = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshStandardMaterial({ map: socketTexture(), roughness: 0.5, metalness: 0.4 }));
  sock.position.set(0, CY, ZM - 0.6);
  mech.add(sock);
  const theBrain = brain();
  theBrain.scale.setScalar(0.52);
  theBrain.position.set(0, CY, ZM - 0.2);
  mech.add(theBrain);
  // the bay numbers
  BX.forEach((x, i) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = '#c99a4a'; g.font = '600 40px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(STUDIES[i].n, 64, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
    m.position.set(x, CY + R + 0.75, ZM - 0.5);
    mech.add(m);
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(17, 15.5), new THREE.MeshBasicMaterial({ color: '#b9a6ff', transparent: true, opacity: 0.025, depthWrite: false }));
  glass.position.set(WIN.x, WIN.y, ZM + 1.0);
  scene.add(glass);
  const winLight = new THREE.PointLight('#ffcf8a', 9, 26, 2);
  winLight.position.set(0, OY - 17, ZM + 4);
  scene.add(winLight);

  // ---------------------------------------------------------------- a coin's way: down the slot, out of the chute, rail to rail, into its bay
  /** Where a coin is, `u` 0..1 of the way from the chute to bay x `bx`, and how far it has turned. */
  function route(bx) {
    const top = (rl, x) => rl.at(x) + 0.1 + R;
    const pts = [];   // [x, y, kind] kind: 'roll' along a rail or 'fall'
    const seg = (kind, path, w) => pts.push({ kind, path, w });
    seg('fall', (t) => V(-1.2, lerp(OY - 9.6, top(A, -1.2), t * t), ZM), 0.35);
    seg('roll', (t) => { const x = lerp(-1.2, 6.5 - R * 0.2, t); return V(x, top(A, x), ZM); }, 1.0);
    seg('fall', (t) => { const x = lerp(6.5 - R * 0.2, 6.9 - R * 0.1, t); return V(x, lerp(top(A, 6.5), top(B, 6.9), t * t), ZM); }, 0.4);
    seg('roll', (t) => { const x = lerp(6.9 - R * 0.1, -6.5 + R * 0.2, t); return V(x, top(B, x), ZM); }, 1.5);
    seg('fall', (t) => { const x = lerp(-6.5 + R * 0.2, -6.9 + R * 0.1, t); return V(x, lerp(top(B, -6.5), top(Cr, -6.9), t * t), ZM); }, 0.4);
    seg('roll', (t) => { const x = lerp(-6.9 + R * 0.1, -0.4, t); return V(x, top(Cr, x), ZM); }, 0.85);
    const x0 = -0.4, y0 = top(Cr, -0.4);
    seg('fall', (t) => V(lerp(x0, bx, t), lerp(y0, CY, t * t) + Math.sin(t * Math.PI) * (Math.abs(bx) > 1 ? 1.4 : 0.2), ZM), 0.55);
    const total = pts.reduce((a, s) => a + s.w, 0);
    return (u) => {
      let k = clamp(u) * total, i = 0;
      while (i < pts.length - 1 && k > pts[i].w) { k -= pts[i].w; i++; }
      const t = clamp(k / pts[i].w);
      const p = pts[i].path(t);
      // turning as it rolls: the distance along the rails over its radius (sign by direction)
      let turn = 0;
      for (let j = 0; j <= i; j++) {
        const s = pts[j], tt = j === i ? t : 1;
        if (s.kind !== 'roll') continue;
        const a = s.path(0), b = s.path(tt);
        turn += -(b.x - a.x) / R;
      }
      return { p, turn };
    };
  }
  const routes = { cpu: route(0), bays: BX.map(route) };

  // ---------------------------------------------------------------- the coins: the one you came out of, and the four studies
  const R0 = 1.3, CZ = D - 0.9;
  const big = coin();
  big.scale.setScalar(R0);
  big.position.set(0, 0, CZ);
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
  const winTop = new THREE.Plane(V(0, -1, 0), OY - 9.75);   // in the window, nothing shows above its top edge
  const studyStart = (i) => 1.42 + 0.55 * i;

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

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; opacity: 0; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 40px); right: var(--gutter, 30px); margin: 0; padding: 0; list-style: none; display: grid; gap: 18px; text-align: right; }
    .st-tag { margin: 0; white-space: nowrap; opacity: 0.35; transition: opacity .5s; }
    .st-tag span { display: block; color: #efb53d; margin-bottom: 3px; }
    .st-tag b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-tag.next { opacity: 1; }
    .st-tag.in { opacity: 0.75; }
    .st-tag.in b::after { content: ' · in'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-fly { position: fixed; left: var(--gutter, 30px); top: 44%; margin: 0; max-width: 300px; transition: opacity .3s; }
    .st-fly span { display: block; color: #efb53d; }
    .st-fly b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-fly em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-state { position: fixed; left: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); line-height: 1.8; }
    .st-state b { color: #efb53d; font-weight: 500; }
    .st-hint { position: fixed; left: 50%; bottom: var(--gutter, 30px); transform: translateX(-50%); margin: 0; color: rgb(242 239 232 / 0.55); transition: opacity .4s; }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #000; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4 in</p>
  <ol class="st-list">${STUDIES.map((s) => `<li class="st-tag m"><span>${s.n}</span><b>${s.name}</b></li>`).join('')}</ol>
  <p class="st-fly"><span class="m"></span><b></b><em></em></p>
  <p class="st-state m">Power <b>00</b> %</p>
  <p class="st-hint m">Keep scrolling</p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const tags = [...hud.querySelectorAll('.st-tag')], fly = hud.querySelector('.st-fly'), hint = hud.querySelector('.st-hint'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');
  let lastT = null;

  return {
    scene, camera,
    press() { return false; },
    update({ r, time }) {
      lastT = time;
      // ================================================================ the first coin: out through it; it drops in; it rolls to the CPU
      const pull = io(r / 0.55);
      const fall = clamp((r - 0.46) / 0.26);
      const yIn = S.y - R0 * 2.6;
      const landSlot = 0.46 + 0.26 * Math.sqrt((0 - (S.y - R0)) / (0 - yIn));
      const rollMain = clamp((r - 0.74) / 0.4);
      const seated = r >= 1.14;
      scr.U.uTex.value = pageTexture();
      scr.U.uTime.value = time;
      scr.U.uDots.value = ease((r - 0.1) / 0.32);
      scr.U.uSqueeze.value = ease((r - 1.12) / 0.1);
      scr.U.uFaceOn.value = ease((r - 1.22) / 0.12);
      vis.layers.set(r < 1.2 ? 1 : 0);
      let bigPos;
      if (r < 0.74) {
        const cy = fall > 0 ? yIn * fall * fall : 0;
        const cz = lerp(CZ, S.z, out(fall / 0.66));
        bigPos = V(0, cy + Math.sin(time * 1.1) * 0.05 * (1 - fall) * ease((r - 0.3) / 0.1), cz);
        big.rotation.set(Math.sin(time * 0.7) * 0.05 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(time * 0.5) * 0.12 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(fall * Math.PI) * 0.1);
        bigMats.forEach((m) => (m.clippingPlanes = fall > 0 ? [slotPlane] : null));
      } else {
        const { p, turn } = routes.cpu(rollMain);
        bigPos = p;
        big.rotation.set(0, 0, turn);
        bigMats.forEach((m) => (m.clippingPlanes = [winTop]));
      }
      big.position.copy(bigPos);
      big.visible = !(r > 0.7 && r < 0.75);

      // ================================================================ the study coins, by scroll
      let inCount = 0, active = -1, activeK = 0;
      coins.forEach((c, i) => {
        const r0 = studyStart(i), k = (r - r0) / 0.5;   // 0..1: from the sky into the slot (0..0.32), then the rails (0.36..1)
        c.visible = k > 0;
        if (k <= 0) return;
        if (k >= 1) inCount++;
        if (k > 0 && k < 1.15) { active = i; activeK = k; }
        if (k < 0.34) {
          const f = clamp(k / 0.34);
          c.position.set(0, lerp(S.y + 24, S.y - R * 2.6, f * f), S.z);
          c.rotation.set(0, 0, Math.sin(f * 7 + i) * 0.15 * (1 - f));
          c.userData.clip(slotPlane);
          c.visible = f < 0.999;
        } else {
          const { p, turn } = routes.bays[i](clamp((k - 0.36) / 0.64));
          c.position.copy(p);
          c.rotation.set(0, 0, turn);
          c.userData.clip(winTop);
          c.visible = k > 0.36;
        }
        tags[i].classList.toggle('in', k >= 1);
        tags[i].classList.toggle('next', k > 0 && k < 1);
        bayLights[i].emissiveIntensity = k >= 1 ? 3 + Math.sin(time * 3 + i) * 0.4 : 0.05;
      });
      cpuLamp.emissiveIntensity = seated ? 3 : 0.05;
      theBrain.material.uniforms.uA.value = (seated ? 0.55 + 0.12 * inCount : 0.12) + Math.max(0, 1 - Math.abs(r - 1.14) / 0.06) * 0.8;
      theBrain.rotation.y = time * 0.3;

      // ================================================================ the camera
      camera.up.set(0, 1, 0);
      const endA = V(0, -1.6, 20.5);
      const MPOS = V(0, OY - 11.8, 44), MLOOK = V(0, OY - 11.8, 0);
      const toM = io((r - 0.66) / 0.42);
      const follow = Math.sin(clamp((r - 0.5) / 0.3) * Math.PI) * 2.4 * (1 - toM);
      const pos = V(0, 0, D).lerp(endA, pull).lerp(MPOS, toM);
      const look = V(0, -1.3 * pull - follow, 0).lerp(MLOOK, toM);
      // leaning a little toward whatever coin is on its way
      const tgt = active >= 0 ? coins[active].position : r > 0.74 && r < 1.16 ? big.position : null;
      const lean = tgt ? 0.22 * Math.sin(clamp(active >= 0 ? activeK : rollMain) * Math.PI) : 0;
      if (tgt) { look.lerp(V(look.x, tgt.y, 0), lean); pos.lerp(V(pos.x, tgt.y, pos.z - 9), lean); }
      // in at the end: through the glass, into the coin's square hole, to the brain
      const dive = io((r - 3.62) / 0.66);
      pos.lerp(V(0, CY, ZM + 0.9), dive);
      look.lerp(V(0, CY, ZM - 2), dive);
      camera.position.copy(pos);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      coinLight.position.copy(camera.position).add(V(-3, 4, -2));
      coinLight.intensity = 0;
      const lit = active >= 0 ? coins[active] : r < 1.2 ? big : null;
      if (lit) { coinLight.position.copy(lit.position).add(V(-1.5, 2.5, 4)); coinLight.intensity = 16; }

      // ================================================================ its screen and its shelf
      const blinkPh = (time + 0.4) % 3.6;
      const landed = coins.map((_, i) => r - (studyStart(i) + 0.5));
      const readI = landed.findIndex((d) => d > -0.02 && d < 0.2);
      const happy = landed.some((d) => d > 0.2 && d < 0.3) || (r > 1.32 && r < 1.4);
      const eyeTo = tgt ? tgt.clone().project(camera) : null;
      const boot = ease((r - 1.24) / 0.14);
      scr.draw({
        read: readI >= 0 ? { a: ease((landed[readI] + 0.02) / 0.04) * (1 - ease((landed[readI] - 0.16) / 0.04)), n: STUDIES[readI].n, glyph: STUDIES[readI].glyph, bar: out((landed[readI] + 0.02) / 0.16) } : null,
        level: 1,
        open: lerp(0.2, 1, boot) * (1 + (active >= 0 ? 0.1 : 0)),
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: happy ? 1 : 0,
        lookX: eyeTo ? clamp((eyeTo.x + 1) / 2) * 2 - 1 : Math.sin(time * 0.37) * 0.25,
        lookY: eyeTo ? -THREE.MathUtils.clamp(eyeTo.y * 1.2, -1, 1) : Math.sin(time * 0.29) * 0.15,
      });
      const waiting = r > 1.3 && r < 3.6 && active < 0;
      ic.draw((waiting || (r > 0.3 && r < 0.62)) && Math.sin(time * 5) > -0.2);
      M.lamp.emissiveIntensity = seated ? 2.2 : 0.4;
      const kickAt = [landSlot, 1.14, ...coins.map((_, i) => studyStart(i) + 0.5)];
      const kick = kickAt.reduce((a, t) => Math.max(a, Math.max(0, 1 - Math.abs(r - t) / 0.025)), 0);
      scr.U.uKick.value = kick * 0.5;
      glitch.uniforms.uKick.value = kick * 0.4;
      glitch.uniforms.uTime.value = time;
      glitch.uniforms.uVig.value = ease((r - 0.05) / 0.3);
      glitch.uniforms.uFade.value = ease((r - 4.05) / 0.25);
      bloom.strength = 0.45 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      const label = active >= 0 ? active : -1;
      if (label >= 0) {
        const s = STUDIES[label];
        fly.querySelector('span').textContent = `${s.n} / 05`;
        fly.querySelector('b').textContent = s.name;
        fly.querySelector('em').textContent = s.line;
        fly.style.opacity = String(Math.min(1, Math.sin(clamp(activeK / 1.1) * Math.PI) * 2.2));
      } else if (r > 1.26 && r < 1.42) {
        fly.querySelector('span').textContent = 'The coin goes in';
        fly.querySelector('b').textContent = 'It was watching';
        fly.querySelector('em').textContent = 'It saw everything I built. Now it learns what I studied.';
        fly.style.opacity = String(Math.sin(clamp((r - 1.26) / 0.16) * Math.PI) * 1.5);
      } else fly.style.opacity = '0';
      countEl.textContent = String(inCount);
      sigEl.textContent = String(Math.round((seated ? 20 : 0) + inCount * 20)).padStart(2, '0');
      hud.style.opacity = String(ease((r - 1.2) / 0.15) * (1 - ease((r - 3.62) / 0.2)));
      hint.style.opacity = waiting ? '1' : '0';
      endEl.style.opacity = String(ease((r - 4.15) / 0.2));
      this._top = r < 1.2;
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
