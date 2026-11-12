// LAB ONLY (throwaway). The robot beat, round 49: "It was watching", with the coin. No break-up, one continuous move.
// You pull straight back from the works: first the edges of the coin's square hole come into view (you came in
// through it, you are going out through it), then the coin, hanging in the dark; and behind it the works are playing
// on a big squared visor. It was watching. The coin drops: it falls, drifting back, into the slot in the robot's jaw;
// the head takes the knock; the works on the visor shut off like an old screen, and its eyes come on. Then the study
// coins go in by press, the last one is your ride down the slot to the brain. Original design (tools/lab/blender/
// head5.py), drawn as light.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { C, coin } from './kit.js';
import { STUDIES, PATHS, studyCoin, circuitMaterial, socketTexture, brain } from './stage.js';

const GOLD = new THREE.Color('#efb53d'), VIOLET = new THREE.Color('#9b74ff');
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const io = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const inn = (v) => Math.pow(clamp(v), 3);
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const bez = (a, b, c, d, t) => { const u = 1 - t; return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };

// ------------------------------------------------------------------ the robot's light: a glass shell, gold edges, scanlines
function holoMat(U, color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { ...U, uC: { value: color.clone() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uC; uniform float uSig, uTime, uScan, uA; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float scan = 0.62 + 0.38 * step(0.5, fract(vW.y * uScan - uTime * 0.5));
        float flick = 1.0 - (1.0 - uSig) * 0.4 * step(0.94, h(vec3(floor(uTime * 12.0), floor(vW.y * 0.6), 3.0)));
        vec3 c = uC * (0.03 + f * 0.8) * scan * (0.55 + 0.45 * uSig) * flick;
        gl_FragColor = vec4(c * uA, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ the visor: first the works (exactly as you saw them), then LED eyes
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
function visor(size, rect, pageTexture) {
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
      float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec2 p = (vUv - 0.5) * uSize;
        if (rbox(p, uSize * 0.5, 1.5) > 0.0) discard;
        // LED cells: as you pull back the screen shows itself as dots; at first it is the picture, exactly.
        float cell = 0.17;
        vec2 g = p / cell, cc = floor(g) + 0.5, f = fract(g) - 0.5;
        vec2 q = mix(p, cc * cell, uDots);
        float led = smoothstep(0.5, 0.32, length(f));
        float dotM = mix(1.0, led, uDots);
        // The works, shutting off like an old screen: squeezed to a line, the line to a point.
        float sy = mix(1.0, 0.034, smoothstep(0.0, 0.55, uSqueeze)), sx = 1.0 - smoothstep(0.55, 0.95, uSqueeze);
        vec2 r = uRect * vec2(max(sx, 0.0001), sy);
        vec2 wuv = q / r + 0.5;
        float inside = step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0) * step(0.0001, sx);
        vec3 works = texture2D(uTex, clamp(vec2(wuv.x, 1.0 - wuv.y), 0.0, 1.0)).rgb * inside * (1.0 + 2.5 * smoothstep(0.2, 0.9, uSqueeze));
        vec3 col = works * dotM;
        // The eyes come on, a line at a time from the top.
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
      const t = st.read.t, a = ease(t / 0.15) * (1 - ease((t - 1.15) / 0.2));
      x.fillStyle = lv(a);
      x.save(); x.translate(CW * 0.12, CH * 0.26); x.scale(0.8, 0.8); x.fill(glyph[st.read.glyph], 'evenodd'); x.restore();
      x.font = '700 64px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText(st.read.n, CW * 0.52, CH * 0.46);
      x.strokeStyle = lv(a * 0.6); x.lineWidth = 3; x.strokeRect(CW * 0.15, CH * 0.78, CW * 0.7, 12);
      x.fillStyle = lv(a); x.fillRect(CW * 0.15 + 3, CH * 0.78 + 3, (CW * 0.7 - 6) * out((t - 0.1) / 0.8), 6);
    } else {
      x.fillStyle = lv(st.level);
      const ew = CW * 0.17, eh = CH * 0.5 * st.open * (1 - 0.92 * st.blink);
      for (const sx of [-1, 1]) {
        const cx = CW * 0.5 + sx * CW * 0.2 + st.lookX * 14, cy = CH * 0.44 + st.lookY * 18;
        if (st.happy > 0.5) {
          x.strokeStyle = lv(st.level); x.lineWidth = ew * 0.42; x.lineCap = 'round';
          x.beginPath(); x.arc(cx, cy + ew * 0.45, ew * 0.55, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
        } else rr(cx - ew / 2, cy - eh / 2, ew, Math.max(4, eh), ew / 2);
      }
      if (st.hint > 0.01) {
        x.fillStyle = x.strokeStyle = lv(st.hint);
        x.lineWidth = 4;
        x.beginPath(); x.arc(CW / 2, CH * 0.8, 8, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(CW / 2 - 8, CH * 0.88); x.lineTo(CW / 2 + 8, CH * 0.88); x.lineTo(CW / 2, CH * 0.96); x.fill();
      }
    }
    tex.needsUpdate = true;
  }
  return { mat, U, draw };
}

const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uKick: { value: 0 }, uFade: { value: 0 }, uVig: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmt, uTime, uKick, uFade, uVig; varying vec2 vUv;
    float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main(){
      vec2 uv = vUv;
      float a = uAmt + uKick;
      float row = floor(uv.y * 64.0), tick = floor(uTime * 14.0);
      uv.x += step(0.84, hash(vec2(row * 0.7, tick))) * (hash(vec2(row, tick + 1.0)) - 0.5) * 0.04 * a;
      float s = 0.006 * a;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(s, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(s, 0.0)).b);
      c *= 1.0 - smoothstep(0.5, 1.25, length((vUv - 0.5) * vec2(1.7, 1.0))) * 0.6 * uVig;
      c += (hash(floor(vUv * vec2(720.0, 405.0)) + tick * 3.1) - 0.5) * 0.035 * uVig;
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
    }`,
};

const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));

export async function createLight3(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05030b');
  scene.fog = new THREE.FogExp2('#0a0416', 0.006);
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 900);
  const tanF = Math.tan((20 * Math.PI) / 180);
  const D = 10, PH_ = 2 * D * tanF, PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); return l; };
  [dir('#ffe8cc', 1.8, -4, 7, 12), dir('#a582ff', 2.0, 6, 3, -8), new THREE.HemisphereLight('#4a3576', '#05030a', 0.9)].forEach((l) => { l.layers.enableAll(); scene.add(l); });
  const both = (o) => o.traverse((c) => c.layers.enable(1));

  // ---------------------------------------------------------------- the robot: the squared head, drawn as light; its visor is where the works were
  const head = await loadGlb('models/head5.glb');
  scene.add(head);
  head.updateMatrixWorld(true);
  const node = (n) => head.getObjectByName(n);
  // Placed so the visor's middle is the middle of the picture you were looking at (z = 0).
  const headBase = V(0, 0, 0).sub(node('visor_c').getWorldPosition(V()));
  head.position.copy(headBase);
  const headU = { uSig: { value: 0 }, uTime: { value: 0 }, uScan: { value: 1.2 }, uA: { value: 0 } };
  const isGold = (o) => /^(seam_|pip_|halo)/.test(o.name);
  const lines = [];
  const goldM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(1.15), toneMapped: false, transparent: true });
  const pips = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a'), toneMapped: false, transparent: true }));
  head.traverse((o) => {
    if (!o.isMesh || o.name === 'visor') return;
    const pip = /^pip_(\d)/.exec(o.name);
    if (pip) { o.material = pips[Number(pip[1])]; return; }
    if (isGold(o)) { o.material = goldM; return; }
    o.material = holoMat(headU, VIOLET);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    o.add(e); lines.push(e);
  });
  const vis = node('visor');
  const VW = vis.parent.getObjectByName('visor_c').userData.width ?? 15.5, VH = vis.parent.getObjectByName('visor_c').userData.height ?? 12.4;
  const face = visor(new THREE.Vector2(VW, VH), new THREE.Vector2(PW_, PH_), pageTexture);
  vis.material = face.mat;
  vis.layers.set(1);
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 140, (rnd() - 0.45) * 90, -6 - rnd() * 90], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.09, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ---------------------------------------------------------------- the coin you came in through: its hole round the whole picture at first
  const R = 1.8, CZ = D - 1.2;
  const big = coin();
  big.scale.setScalar(R);
  big.position.set(0, 0, CZ);
  scene.add(big);
  both(big);
  const bigMats = [];
  big.traverse((o) => { if (o.isMesh && !bigMats.includes(o.material)) bigMats.push(o.material); });
  const bigLight = new THREE.PointLight('#ffd9a0', 0, 0, 2);
  bigLight.layers.enableAll();
  scene.add(bigLight);

  // ---------------------------------------------------------------- the study coins
  const coins = STUDIES.map((s) => {
    const c = studyCoin(s);
    const glow = [], mats = [];
    c.traverse((o) => { if (!o.isMesh) return; if (!mats.includes(o.material)) mats.push(o.material); if (o.material.emissive && o.material.emissiveIntensity > 0 && !glow.includes(o.material)) glow.push(o.material); });
    c.userData.glow = (v) => glow.forEach((m) => (m.emissiveIntensity = v));
    c.userData.clip = (plane) => mats.forEach((m) => (m.clippingPlanes = plane ? [plane] : null));
    scene.add(c);
    return c;
  });
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 0, 2);
  scene.add(coinLight);
  const slotLight = new THREE.PointLight('#ffc477', 0, 0, 2);
  scene.add(slotLight);
  const COIN_IN = 1.45, COIN_TRAY = 0.15;
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float y = abs(vUv.y - 0.5) * 2.0, x = abs(vUv.x - 0.5) * 2.0; float a = (exp(-y * y * 40.0) * 1.6 + exp(-y * 6.0) * 0.25) * (1.0 - x * x) * uA; gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * 1.6, a); }',
  }));
  scene.add(scan);

  // ---------------------------------------------------------------- inside: the shaft below the slot, the socket, the brain
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

  // ---------------------------------------------------------------- the picture
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.5, 0.8);
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
    .st-built { position: fixed; left: var(--gutter, 30px); top: calc(var(--gutter, 30px) + 40px); margin: 0; max-width: 300px; transition: opacity .3s; }
    .st-built b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-built em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #000; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4 read</p>
  <ol class="st-list">${STUDIES.map((s) => `<li class="st-tag m"><span>${s.n}</span><b>${s.name}</b></li>`).join('')}</ol>
  <p class="st-built"><span class="m" style="color:#efb53d">The coin goes in</span><b>It was watching</b><em>It saw everything I built. Now feed it what I studied.</em></p>
  <p class="st-fly"><span class="m"></span><b></b><em></em></p>
  <p class="st-state m">Signal <b>00</b> %</p>
  <p class="st-press"><i></i><b>Press to insert a coin</b><span class="m">Click or space</span></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const tags = [...hud.querySelectorAll('.st-tag')], fly = hud.querySelector('.st-fly'), built = hud.querySelector('.st-built'), press = hud.querySelector('.st-press'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');

  const FLYC = 0.95, HOVER = 0.65, DROP = 0.3, FLIGHT = FLYC + HOVER + DROP, POVT = 10.5;
  let presses = [], lastT = null, sigShown = 0, approach = 0;

  return {
    scene, camera,
    press(now) {
      const busy = presses.length && now - presses[presses.length - 1] < FLIGHT;
      if (presses.length >= 4 || busy) return false;
      presses.push(now);
      return true;
    },
    update({ r, time, fixed = null }) {
      const dt = lastT === null || fixed ? 0 : Math.min(0.1, time - lastT);
      lastT = time;
      const S = node('slot').getWorldPosition(V());
      // ================================================================ the pull-back, the drop, the switch (scroll)
      const pull = io(r / 0.55);
      const fall = clamp((r - 0.46) / 0.32);
      const landR = 0.46 + 0.32 * 0.67, land = Math.max(0, 1 - Math.abs(r - landR) / 0.05) * (r > landR - 0.01 ? 1 : 0);
      face.U.uTex.value = pageTexture();
      face.U.uTime.value = time;
      face.U.uDots.value = ease((r - 0.1) / 0.32);
      face.U.uSqueeze.value = ease((r - 0.8) / 0.12);
      face.U.uFaceOn.value = ease((r - 0.93) / 0.14);
      headU.uA.value = ease((r - 0.04) / 0.3);
      headU.uTime.value = time;
      lines.forEach((l) => (l.material.opacity = 0.3 * headU.uA.value));
      goldM.opacity = ease((r - 0.08) / 0.3);
      vis.layers.set(r < 0.86 ? 1 : 0);
      // The coin: out of its hole you come; it hangs there; then it drops, drifting back, into the slot.
      const yIn = S.y - R * 2.6;
      const cy = fall > 0 ? -(0 - yIn) * fall * fall : 0;
      const cz = lerp(CZ, S.z, out(fall / 0.66));
      big.position.set(0, cy + Math.sin(time * 1.1) * 0.06 * (1 - fall) * ease((r - 0.3) / 0.1), cz);
      big.rotation.set(Math.sin(time * 0.7) * 0.05 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(time * 0.5) * 0.12 * ease((r - 0.3) / 0.15) * (1 - fall), Math.sin(fall * Math.PI) * 0.12);
      big.visible = r < 0.8;
      const slotPlane = new THREE.Plane(V(0, 1, 0), -S.y);
      bigMats.forEach((m) => (m.clippingPlanes = fall > 0 ? [slotPlane] : null));
      bigLight.position.copy(big.position).add(V(-2, 3, 5));
      bigLight.intensity = 30 * ease((r - 0.05) / 0.2);

      // ================================================================ presses
      let inserted = 0, flyI = -1, flyT = 0, pov = 0, pT = 0;
      if (fixed) { inserted = fixed.inserted; flyI = fixed.fly >= 0 && inserted < 3 ? inserted : -1; flyT = fixed.fly * FLIGHT; pov = fixed.pov; pT = pov * POVT; }
      else presses.forEach((t0, i) => { const d = time - t0; if (i === 3) { pov = clamp(d / POVT); pT = d; } else if (d >= FLIGHT) inserted = i + 1; else { flyI = i; flyT = d; } });
      const riding = pov > 0;
      const landedAt = inserted > 0 ? (fixed ? time - (fixed.since ?? 9) : presses[inserted - 1] + FLIGHT) : -99;
      const since = time - landedAt;
      const awake = ease((pT - 0.6) / 1.4);
      const sig = riding ? 0.75 + 0.25 * awake : inserted / 4;
      sigShown += (sig - sigShown) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.2));
      if (fixed) sigShown = sig;
      const kick = Math.max(0, 1 - since / 0.45);
      headU.uSig.value = clamp(0.4 + sigShown * 0.6 + awake * 0.3);
      // The head takes the knock of the coin landing, and every coin after.
      const knock = land * Math.sin((r - landR + 0.05) * 60) * 0.12 + kick * Math.sin(since * 40) * 0.06;
      head.position.set(headBase.x, headBase.y + Math.sin(time * 0.35) * 0.12 * ease((r - 0.3) / 0.3) - Math.abs(knock), headBase.z);
      head.rotation.set(knock * 0.05, Math.sin(time * 0.21) * 0.008 * ease((r - 0.3) / 0.3), 0);
      head.updateMatrixWorld(true);
      face.U.uKick.value = kick * 0.5 + land * 0.6;
      pips.forEach((m, i) => (m.opacity = goldM.opacity * (i < inserted ? 1 : 0.18)));
      slotLight.position.copy(S).add(V(0, 1.2, 2.5));
      slotLight.intensity = ((flyI >= 0 && flyT > FLYC * 0.8) || (fall > 0.5 && r < landR + 0.05) ? 40 : 6) + (kick + land) * 220;
      slotLight.intensity *= riding ? 1 - ease((pT - 2.4) / 0.5) : 1;

      // ================================================================ the camera
      camera.up.set(0, 1, 0);
      const camEnd = V(0, -1.6, 20.5);
      camera.position.set(0, 0, D).lerp(camEnd, pull);
      // While the coin falls the eye follows it down a little.
      const follow = Math.sin(clamp((r - 0.5) / 0.4) * Math.PI) * 2.6;
      const look0 = V(0, -1.3 * pull - follow, 0);
      const want = flyI >= 0 || (since < 1.3 && inserted < 4) ? 1 : 0.15 * inserted;
      approach += (want - approach) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 1.7));
      if (fixed) approach = flyI >= 0 ? 1 : 0.15 * inserted;
      const camSlot = S.clone().add(V(0, 5.2, 17)), lookSlot = S.clone().add(V(0, 4.4, 0));
      const ready = ease((r - 1.0) / 0.2);
      camera.position.lerp(camSlot, approach * ready);
      const lookAt = look0.clone().lerp(lookSlot, approach * ready);
      camera.lookAt(lookAt);
      camera.updateMatrixWorld();

      // ================================================================ the study coins
      const back = ease((r - 1.0) / 0.22);
      const waiting = [0, 1, 2, 3].filter((i) => i >= inserted && i !== flyI && !(riding && i === 3));
      const byTag = (i) => {
        const rc = tags[i].getBoundingClientRect(), Z = 8, hh = tanF * Z, ww = hh * (innerWidth / innerHeight);
        const px = rc.right + 30, py = rc.top + rc.height / 2;
        return camera.localToWorld(V(((px / innerWidth) * 2 - 1) * ww + (1 - back) * 0.6, (1 - (py / innerHeight) * 2) * hh, -Z));
      };
      const Hc = S.clone().add(V(0, COIN_IN + 0.35, 0));
      scan.material.uniforms.uA.value = 0;
      coins.forEach((c, i) => {
        c.visible = false;
        c.userData.clip(null);
        if (i < inserted && !(riding && i === 3)) return;
        if (i === flyI) {
          if (flyT < FLYC) {
            const P0 = byTag(i), e = io(flyT / FLYC);
            c.position.copy(bez(P0, P0.clone().add(V(-0.6, 0.3, -1.5)), Hc.clone().add(V(3, 4, 6)), Hc, e));
            c.quaternion.copy(camera.quaternion).slerp(head.quaternion, e);
            c.rotateY(Math.sin(e * Math.PI) * 0.5);
            c.scale.setScalar(lerp(COIN_TRAY * 1.15, COIN_IN, e));
            c.userData.glow(0.25);
          } else {
            const h = flyT - FLYC, d = inn((h - HOVER) / DROP);
            const lift = Math.sin(clamp((h - HOVER + 0.16) / 0.16) * Math.PI * 0.5) * 0.15 * (1 - d);
            c.position.copy(Hc).add(V(0, Math.sin(time * 4) * 0.03 * (1 - d) + lift - d * (COIN_IN * 2 + 0.6), 0));
            c.quaternion.copy(head.quaternion);
            c.scale.setScalar(COIN_IN);
            c.userData.clip(slotPlane);
            const sr = clamp(h / (HOVER - 0.1));
            scan.position.copy(Hc).add(V(0, COIN_IN * (1 - 2 * io(sr)), COIN_IN * 0.12));
            scan.scale.set(COIN_IN * 2.6, COIN_IN * 0.5, 1);
            scan.quaternion.copy(head.quaternion);
            scan.material.uniforms.uA.value = Math.sin(sr * Math.PI) * (1 - d);
            c.userData.glow(0.25 + 1.2 * ease(sr * 1.5));
          }
          c.visible = true;
        } else if (!(riding && i === 3)) {
          const k = waiting.indexOf(i);
          c.position.copy(byTag(i));
          c.userData.glow(k === 0 && flyI < 0 ? 0.45 + 0.25 * Math.sin(time * 4) : 0.15);
          c.quaternion.copy(camera.quaternion);
          c.rotateY(Math.sin(time * 0.8 + i * 1.7) * 0.35);
          c.rotateX(-0.18);
          c.scale.setScalar(COIN_TRAY * (k === 0 && flyI < 0 ? 1.15 : 1) * back);
          c.visible = back > 0.01 && !riding;
        }
        tags[i].classList.toggle('in', i < inserted || (riding && i === 3 && pT > 3.5));
        tags[i].classList.toggle('next', (i === inserted && !riding) || i === flyI || (riding && i === 3 && pT < 3.5));
      });
      if (flyI >= 0) {
        const c = coins[flyI];
        coinLight.position.copy(c.position).add(camera.position.clone().sub(c.position).setLength(2.2 + c.scale.x)).add(V(0, 0.8, 0));
        coinLight.intensity = 20 + 40 * c.scale.x;
      } else { coinLight.position.copy(camera.localToWorld(V(-2, 2, 1))); coinLight.intensity = 1.2 * back; }
      const label = flyI >= 0 ? flyI : riding && pT < 3.4 ? 3 : -1;
      if (label >= 0) {
        const s = STUDIES[label];
        fly.querySelector('span').textContent = `${s.n} / 05`;
        fly.querySelector('b').textContent = s.name;
        fly.querySelector('em').textContent = s.line;
        fly.style.opacity = String(flyI >= 0 ? Math.min(1, Math.sin(clamp(flyT / FLIGHT) * Math.PI) * 2.2) : Math.min(1, Math.sin(clamp(pT / 3.4) * Math.PI) * 2.2));
      } else fly.style.opacity = '0';
      built.style.opacity = String(ease((r - 0.98) / 0.15) * (inserted === 0 && flyI < 0 && !riding ? 1 : 0));

      // ================================================================ the last coin: you ride it to the slot and drop in after it
      glitch.uniforms.uFade.value = 0;
      let inHead = false;
      if (riding) {
        const c = coins[3];
        c.visible = true;
        c.userData.clip(null);
        const lead = V(0, -0.7, -3.2);
        if (pT < 3.95) {
          const start = byTag(3);
          const ride = io((pT - 0.3) / 2.9);
          const camFrom = camera.position.clone(), lookFrom = lookAt.clone();
          const camTo = S.clone().add(V(0, 2.8, 4.4));
          const camP = bez(camFrom, camFrom.clone().add(V(0, -1, -6)), camTo.clone().add(V(0, 2, 6)), camTo, ride);
          const over = io((pT - 3.0) / 0.5), down = inn((pT - 3.5) / 0.45);
          camP.lerp(S.clone().add(V(0, 5.0, 1.2)), over).lerp(S.clone().add(V(0, -0.6, 0.02)), down);
          camera.position.copy(camP);
          const lookT = lookFrom.lerp(S.clone().add(V(0, 1.4, 0)), ease(ride * 1.2)).lerp(S.clone().add(V(0, -6, -0.4)), over);
          const dn = clamp(over);
          camera.up.set(0, 1 - dn, -dn).normalize();
          camera.lookAt(lookT);
          camera.updateMatrixWorld();
          const ahead = camera.localToWorld(lead.clone());
          const rise = io(pT / 0.6);
          if (pT < 3.0) {
            c.position.copy(start.lerp(ahead, rise));
            c.quaternion.copy(camera.quaternion);
            if (pT > 2.4) c.quaternion.slerp(head.quaternion, io((pT - 2.4) / 0.6));
            c.scale.setScalar(lerp(COIN_TRAY, 0.5, rise));
          } else {
            const from = camera.localToWorld(lead.clone());
            c.position.copy(from.lerp(Hc, io((pT - 3.0) / 0.4)));
            if (pT > 3.4) c.position.y -= inn((pT - 3.4) / 0.4) * (COIN_IN * 2 + 1);
            c.quaternion.copy(head.quaternion);
            c.scale.setScalar(lerp(0.5, COIN_IN, io((pT - 3.0) / 0.4)));
            c.userData.clip(slotPlane);
          }
          c.userData.glow(0.4 + awake * 0.6);
          coinLight.position.copy(camera.position).add(V(0, 0.6, 0));
          coinLight.intensity = 8;
          glitch.uniforms.uFade.value = 0.97 * ease((pT - 3.6) / 0.35);
        } else {
          inHead = true;
          inside.visible = true;
          const q = clamp((pT - 3.95) / 3.6);
          const yCam = lerp(-302, -343.4, ease(q));
          camera.position.set(0, yCam, 0.001);
          camera.up.set(0, 0, -1);
          camera.lookAt(0, yCam - 5, 0);
          camera.updateMatrixWorld();
          c.position.set(0, lerp(-303.2, -344.86, Math.min(1, ease(q * 1.12))), 0);
          c.rotation.set(-Math.PI / 2, 0, (1 - Math.min(1, q * 1.12)) * 8);
          c.scale.setScalar(0.4);
          shaft.material.uniforms.uTime.value = time;
          brainMesh.material.uniforms.uA.value = ease((pT - 7.0) / 1.0);
          brainMesh.rotation.y = time * 0.4;
          glitch.uniforms.uFade.value = 0.97 * (1 - ease((pT - 3.95) / 0.4));
        }
        endEl.style.opacity = String(ease((pT - 8.4) / 1.0));
      } else { inside.visible = false; endEl.style.opacity = '0'; }
      head.visible = !inHead;

      // ================================================================ its eyes
      const blinkPh = (time + 0.4) % 3.6;
      const reading = inserted > 0 && since < 1.4 && !riding ? { t: since, n: STUDIES[inserted - 1].n, glyph: STUDIES[inserted - 1].glyph } : null;
      const watching = flyI >= 0 ? ease(flyT / FLYC) : 0;
      const boot = ease((r - 0.95) / 0.2);
      face.draw({
        read: reading,
        level: 0.85 + 0.15 * sigShown,
        open: lerp(0.15, 1, boot) * lerp(0.75, 1, sigShown) * (1 + watching * 0.12) + awake * 0.1,
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: (since > 1.25 && since < 1.9 && inserted > 0 && !riding) || (riding && pT > 1.2 && pT < 2.6) ? 1 : 0,
        lookX: riding ? 0 : Math.sin(time * 0.37) * 0.25 * (1 - watching),
        lookY: riding ? 0.2 : lerp(Math.sin(time * 0.29) * 0.15, 0.95, watching),
        hint: r >= 1.2 && flyI < 0 && inserted < 4 && !riding && since > 1.4 ? 0.5 + 0.5 * (Math.sin(time * 5) > 0 ? 1 : 0.2) : 0,
      });
      glitch.uniforms.uAmt.value = (1 - sigShown) * 0.1 * ease((r - 0.95) / 0.2);
      glitch.uniforms.uKick.value = kick * 0.25 + land * 0.3;
      glitch.uniforms.uTime.value = time;
      glitch.uniforms.uVig.value = ease((r - 0.05) / 0.3);
      bloom.strength = 0.55 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      countEl.textContent = String(inserted + (riding && pT > 3.5 ? 1 : 0));
      sigEl.textContent = String(Math.round(sigShown * 100)).padStart(2, '0');
      hud.style.opacity = String(ease((r - 0.95) / 0.25) * (1 - ease((pT - 3.3) / 0.5)) + ease((pT - 8.4) / 1.0));
      press.style.opacity = r >= 1.2 && flyI < 0 && inserted < 4 && !riding ? '1' : '0';
      this._top = r < 0.86;
      return { inserted, pov };
    },
    render() {
      const tm = renderer.toneMapping, ex = renderer.toneMappingExposure, ac = renderer.autoClear;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      camera.layers.set(0);
      composer.render();
      if (this._top) {
        // The visor (while it still shows the works, exactly) and the coin in front of it, straight to the screen.
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
