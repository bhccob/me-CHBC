// LAB ONLY (throwaway). The robot beat, round 48: idea A again, "Built from what I built", with a better-shaped head and
// no hands. After the last work the picture breaks into pixels that fly back and build a robot of light, close and huge:
// an egg-shaped glass dome with gold seams, a wide visor that wraps round its face (LED eyes), its brain faintly in the
// dome, and its mouth is the coin slot. Each press flies the next coin to the mouth: the visor reads it, it tips flat
// and slides in. The last coin is you: you ride it into the mouth, through the head, to the CPU where the brain sits.
// Original design (tools/lab/blender/head4.py), drawn as light.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { C } from './kit.js';
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

// ------------------------------------------------------------------ when each cell of the picture lets go (shared by the page and its pixels)
const NX = 200, NY = 112, FLY = 0.38;
const DELAY = `
  float hcell(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  // From the middle out, with a scatter, so the works go first and the dark around them last.
  float delayOf(vec2 cellUv){ vec2 c = (cellUv - 0.5) * vec2(1.78, 1.0); return 0.04 + 0.42 * smoothstep(0.0, 0.95, length(c)) + 0.16 * hcell(floor(cellUv * vec2(${NX}.0, ${NY}.0))); }`;

// ------------------------------------------------------------------ the robot's light: a glass shell, gold edges, scanlines; it builds in blocks
function holoMat(U, color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { ...U, uC: { value: color.clone() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uC; uniform float uBuild, uY0, uY1, uSig, uTime, uCell, uScan, uA; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        float hn = clamp((vW.y - uY0) / (uY1 - uY0), 0.0, 1.0);
        float edge = uBuild * 1.12 - mix(hn, h(floor(vW * uCell)), 0.55);
        if (edge < 0.0) discard;
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float scan = 0.62 + 0.38 * step(0.5, fract(vW.y * uScan - uTime * 0.5));
        float flick = 1.0 - (1.0 - uSig) * 0.45 * step(0.93, h(vec3(floor(uTime * 12.0), floor(vW.y * 0.6), 3.0)));
        vec3 c = uC * (0.03 + f * 0.8) * scan * (0.55 + 0.45 * uSig) * flick;
        c += vec3(1.0, 0.76, 0.36) * (1.0 - smoothstep(0.0, 0.05, edge)) * 1.6;
        gl_FragColor = vec4(c * uA, 1.0);
      }`,
  });
}
function holoify(root, U, { color = VIOLET, edges = 0.5, angle = 30, skip = () => false }) {
  const lines = [];
  root.traverse((o) => {
    if (!o.isMesh || skip(o)) return;
    o.material = holoMat(U, color);
    if (edges > 0) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, angle), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: edges, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      e.userData.base = edges;
      o.add(e);
      lines.push(e);
    }
  });
  return lines;
}
const holoUniforms = (cell, scan) => ({ uBuild: { value: 0 }, uY0: { value: 0 }, uY1: { value: 1 }, uSig: { value: 0 }, uTime: { value: 0 }, uCell: { value: cell }, uScan: { value: scan }, uA: { value: 1 } });

// ------------------------------------------------------------------ the visor: LED dots; eyes, blinks, looks, what it read
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
function visor() {
  const CW = 320, CH = 90, GX = 176, GY = 50;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const glyph = Object.fromEntries(STUDIES.map((s) => [s.glyph, s.glyph === 'gear' ? gearPath() : new Path2D(PATHS[s.glyph])]));
  const mat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uFace: { value: tex }, uTime: { value: 0 }, uSig: { value: 0 }, uKick: { value: 0 }, uOn: { value: 0 }, uGrid: { value: new THREE.Vector2(GX, GY) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uFace; uniform float uTime, uSig, uKick, uOn; uniform vec2 uGrid; varying vec2 vUv;
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec2 g = vUv * uGrid, cell = floor(g), f = fract(g) - 0.5;
        float bad = clamp((1.0 - uSig) * 0.5 + uKick, 0.0, 1.0), tick = floor(uTime * 12.0);
        float slip = step(1.0 - 0.1 * bad, hash(vec2(cell.y, tick))) * floor((hash(vec2(cell.y + 3.0, tick)) - 0.5) * 10.0 * bad + 0.5);
        vec2 sc = (cell + vec2(slip, 0.0) + 0.5) / uGrid;
        float v = texture2D(uFace, vec2(sc.x, 1.0 - sc.y)).r;
        // the visor switches on line by line
        float on = step(1.0 - uOn, 1.0 - vUv.y + hash(vec2(cell.y, 1.0)) * 0.08);
        float d = length(f);
        float dotM = smoothstep(0.4, 0.26, d);
        vec3 lit = mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.93, 0.8), clamp(v, 0.0, 1.0));
        vec3 col = vec3(0.09, 0.06, 0.16) * dotM + lit * v * (dotM * 1.5 + exp(-d * d * 9.0) * 0.3);
        gl_FragColor = vec4(col * on, 1.0);
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
      x.save(); x.translate(CW * 0.3, CH * 0.12); x.scale(0.56, 0.56); x.fill(glyph[st.read.glyph], 'evenodd'); x.restore();
      x.font = '700 40px "IBM Plex Mono", monospace'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText(st.read.n, CW * 0.53, CH * 0.44);
      x.strokeStyle = lv(a * 0.6); x.lineWidth = 2; x.strokeRect(CW * 0.3, CH * 0.84, CW * 0.4, 7);
      x.fillStyle = lv(a); x.fillRect(CW * 0.3 + 2, CH * 0.84 + 2, (CW * 0.4 - 4) * out((t - 0.1) / 0.8), 3);
    } else {
      x.fillStyle = lv(st.level);
      const ew = CW * 0.085, eh = CH * 0.6 * st.open * (1 - 0.92 * st.blink);
      for (const sx of [-1, 1]) {
        const cx = CW * 0.5 + sx * CW * 0.12 + st.lookX * 14, cy = CH * 0.48 + st.lookY * 12;
        if (st.happy > 0.5) {
          x.strokeStyle = lv(st.level); x.lineWidth = ew * 0.42; x.lineCap = 'round';
          x.beginPath(); x.arc(cx, cy + ew * 0.45, ew * 0.55, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
        } else rr(cx - ew / 2, cy - eh / 2, ew, Math.max(3, eh), ew / 2);
      }
      if (st.hint > 0.01) {
        x.fillStyle = x.strokeStyle = lv(st.hint);
        x.lineWidth = 3;
        x.beginPath(); x.arc(CW / 2, CH * 0.78, 5, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(CW / 2 - 5, CH * 0.88); x.lineTo(CW / 2 + 5, CH * 0.88); x.lineTo(CW / 2, CH * 0.97); x.fill();
      }
    }
    tex.needsUpdate = true;
  }
  return { mat, draw };
}

const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uKick: { value: 0 }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmt, uTime, uKick, uFade; varying vec2 vUv;
    float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main(){
      vec2 uv = vUv;
      float a = uAmt + uKick;
      float row = floor(uv.y * 64.0), tick = floor(uTime * 14.0);
      uv.x += step(0.84, hash(vec2(row * 0.7, tick))) * (hash(vec2(row, tick + 1.0)) - 0.5) * 0.04 * a;
      float s = 0.006 * a;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(s, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(s, 0.0)).b);
      c *= 1.0 - smoothstep(0.5, 1.25, length((vUv - 0.5) * vec2(1.7, 1.0))) * 0.6;
      c += (hash(floor(vUv * vec2(720.0, 405.0)) + tick * 3.1) - 0.5) * 0.035;
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
    }`,
};

const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));

export async function createLight2(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05030b');
  scene.fog = new THREE.FogExp2('#0a0416', 0.006);
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.02, 900);
  const tanF = Math.tan((20 * Math.PI) / 180);
  const D = 10, PH_ = 2 * D * tanF, PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); return l; };
  [dir('#ffe8cc', 1.6, -4, 7, 9), dir('#a582ff', 2.0, 6, 3, -8), new THREE.HemisphereLight('#4a3576', '#05030a', 0.9)].forEach((l) => { l.layers.enableAll(); scene.add(l); });
  const onTop = (o) => o.traverse((c) => c.layers.set(1));

  // ---------------------------------------------------------------- the page: the works, letting go cell by cell
  const pageU = { uTex: { value: pageTexture() }, uT: { value: 0 }, uTime: { value: 0 } };
  const page = new THREE.Mesh(new THREE.PlaneGeometry(PW_, PH_), new THREE.ShaderMaterial({
    fog: false, transparent: true,
    uniforms: pageU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uTex; uniform float uT, uTime; varying vec2 vUv;
      ${DELAY}
      void main(){
        vec2 cellUv = (floor(vUv * vec2(${NX}.0, ${NY}.0)) + 0.5) / vec2(${NX}.0, ${NY}.0);
        float d = delayOf(cellUv);
        if (uT > d) discard;
        vec3 col = texture2D(uTex, vUv).rgb;
        // A moment before a cell goes, it charges: a gold edge round it, a little lift in brightness.
        float pre = smoothstep(d - 0.06, d, uT) * step(0.001, uT);
        vec2 f = abs(fract(vUv * vec2(${NX}.0, ${NY}.0)) - 0.5);
        col = mix(col, vec3(1.0, 0.75, 0.35), pre * 0.7 * step(0.36, max(f.x, f.y))) * (1.0 + 0.12 * pre);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  page.frustumCulled = false;
  onTop(page);
  scene.add(page);

  // ---------------------------------------------------------------- the robot of light
  const headSrc = await loadGlb('models/head4.glb');
  const HEAD = 4.6;
  const head = headSrc;
  head.scale.setScalar(HEAD);
  head.updateMatrixWorld(true);
  const node = (n) => head.getObjectByName(n);
  const dispLocal = node('face_c').getWorldPosition(V()).divideScalar(HEAD);
  const headBase = V(0, 3.5, -26).sub(dispLocal.clone().multiplyScalar(HEAD));
  head.position.copy(headBase);
  scene.add(head);
  const headU = holoUniforms(0.85, 1.25);
  const isGold = (o) => /^(seam_|lip_|pod_ring|pip_|halo)/.test(o.name);
  const headLines = holoify(head, headU, { edges: 0.35, skip: (o) => o.name === 'visor' || isGold(o) });
  const goldM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a').multiplyScalar(1.2), toneMapped: false, transparent: true });
  const pips = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46a'), toneMapped: false, transparent: true }));
  head.traverse((o) => {
    if (!o.isMesh || !isGold(o)) return;
    const pip = /^pip_(\d)/.exec(o.name);
    o.material = pip ? pips[Number(pip[1])] : goldM;
  });
  const face = visor();
  node('visor').material = face.mat;
  // Its brain, faintly, inside the glass.
  const inBrain = brain();
  inBrain.position.set(0, 2.75, 0.1);
  inBrain.scale.setScalar(1.35);
  head.add(inBrain);
  const hands = [];
  scene.updateMatrixWorld(true);
  // The build runs bottom to top over the robot's own height.
  const box = new THREE.Box3().setFromObject(node('dome'));
  headU.uY0.value = box.min.y; headU.uY1.value = box.max.y;
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 140, (rnd() - 0.45) * 90, -6 - rnd() * 90], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.09, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ---------------------------------------------------------------- the pixels: one per cell of the picture, each with a place on the robot
  const N = NX * NY;
  const targets = new Float32Array(N * 3), seeds = new Float32Array(N * 4), uvs = new Float32Array(N * 2);
  {
    const samplerFor = (m) => ({ m, s: new MeshSurfaceSampler(m).build(), w: m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count });
    const headMeshes = [], handMeshes = [];
    head.traverse((o) => { if (o.isMesh && /^(dome|pod_|visor|seam_)/.test(o.name)) headMeshes.push(samplerFor(o)); });
    const pick = (list, total) => { let r = Math.random() * total; for (const it of list) { r -= it.w; if (r <= 0) return it; } return list[list.length - 1]; };
    const tH = headMeshes.reduce((a, b) => a + b.w, 0);
    const p = V();
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) {
      const it = pick(headMeshes, tH);
      it.s.sample(p);
      p.applyMatrix4(it.m.matrixWorld);
      targets.set([p.x, p.y, p.z], i * 3);
      seeds.set([rnd(), rnd(), rnd(), rnd()], i * 4);
      uvs.set([((i % NX) + 0.5) / NX, (Math.floor(i / NX) + 0.5) / NY], i * 2);
    }
  }
  const pixGeo = new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1));
  pixGeo.instanceCount = N;
  pixGeo.setAttribute('aTarget', new THREE.InstancedBufferAttribute(targets, 3));
  pixGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  pixGeo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvs, 2));
  const pixU = { uTex: pageU.uTex, uT: pageU.uT, uW: { value: PW_ }, uH: { value: PH_ }, uCellW: { value: PW_ / NX } };
  const pix = new THREE.Mesh(pixGeo, new THREE.ShaderMaterial({
    uniforms: pixU, fog: false,
    vertexShader: `
      uniform sampler2D uTex; uniform float uT, uW, uH, uCellW;
      attribute vec3 aTarget; attribute vec4 aSeed; attribute vec2 aUv;
      varying vec3 vCol;
      ${DELAY}
      vec3 bz(vec3 a, vec3 b, vec3 c, vec3 d, float t){ float u = 1.0 - t; return a*u*u*u + b*3.0*u*u*t + c*3.0*u*t*t + d*t*t*t; }
      void main(){
        float d = delayOf(aUv);
        float k = clamp((uT - d) / ${FLY.toFixed(2)}, 0.0, 1.0);
        float e = k < 0.5 ? 4.0 * k * k * k : 1.0 - pow(-2.0 * k + 2.0, 3.0) / 2.0;
        vec3 img = texture2D(uTex, aUv).rgb;
        float lum = dot(img, vec3(0.3, 0.59, 0.11));
        vec3 start = vec3((aUv.x - 0.5) * uW, (aUv.y - 0.5) * uH, 0.0);
        vec3 lift = start + vec3((aSeed.x - 0.5) * 1.2, (aSeed.y - 0.5) * 1.2, 0.4 + aSeed.z * 0.6);
        vec3 swing = aTarget + vec3((aSeed.y - 0.5) * 12.0, 4.0 + aSeed.x * 8.0, 7.0 + aSeed.w * 6.0);
        vec3 p = bz(start, lift, swing, aTarget, e);
        float alive = step(0.0001, k) * (1.0 - step(0.999, k)) * step(0.13, lum + aSeed.w * 0.05);
        float s = mix(uCellW, 0.2 + aSeed.z * 0.16, smoothstep(0.0, 0.6, e)) * alive * (1.0 - smoothstep(0.85, 1.0, k) * 0.7);
        // tumbling as it flies
        float a = e * 6.2831 * (aSeed.x - 0.5) * 2.0;
        mat3 R = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a));
        vec3 pos = R * (position * s) + p;
        vec3 holo = mix(vec3(0.62, 0.45, 1.0), vec3(1.0, 0.76, 0.36), step(0.72, aSeed.w)) * (1.1 + aSeed.z * 0.6);
        vCol = mix(img * (1.0 + 0.6 * smoothstep(0.0, 0.15, k)), holo, smoothstep(0.12, 0.6, k));
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.0); }',
  }));
  pix.frustumCulled = false;
  onTop(pix);
  scene.add(pix);

  // ---------------------------------------------------------------- the coins
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
  const COIN_IN = 1.9, COIN_TRAY = 0.15;
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float y = abs(vUv.y - 0.5) * 2.0, x = abs(vUv.x - 0.5) * 2.0; float a = (exp(-y * y * 40.0) * 1.6 + exp(-y * 6.0) * 0.25) * (1.0 - x * x) * uA; gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * 1.6, a); }',
  }));
  scene.add(scan);

  // ---------------------------------------------------------------- inside: the shaft below the slot, the socket, the brain
  const inside = new THREE.Group();
  inside.rotation.x = Math.PI / 2;   // its "down" runs straight on, away from you
  inside.visible = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 46, 64, 1, true), circuitMaterial());
  shaft.position.y = -23;
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.8);
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
  <p class="st-built"><span class="m" style="color:#efb53d">Built from what I built</span><b>Five works, one mind</b><em>Feed it what I studied and it thinks.</em></p>
  <p class="st-fly"><span class="m"></span><b></b><em></em></p>
  <p class="st-state m">Signal <b>00</b> %</p>
  <p class="st-press"><i></i><b>Press to insert a coin</b><span class="m">Click or space</span></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const tags = [...hud.querySelectorAll('.st-tag')], fly = hud.querySelector('.st-fly'), built = hud.querySelector('.st-built'), press = hud.querySelector('.st-press'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');

  const FLYC = 0.95, HOVER = 0.7, DROP = 0.7, FLIGHT = FLYC + HOVER + DROP, POVT = 11;
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
      // ================================================================ the break-up and the build (scroll)
      const uT = clamp(r / 1.0);
      pageU.uTex.value = pageTexture();
      pageU.uT.value = uT;
      pageU.uTime.value = time;
      page.visible = uT < 0.66;
      pix.visible = uT > 0 && uT < 0.999;
      const build = ease((uT - 0.3) / 0.62);
      headU.uBuild.value = build;
      headU.uTime.value = time;
      headLines.forEach((l) => (l.material.opacity = l.userData.base * ease((build - 0.35) / 0.65)));
      goldM.opacity = ease((build - 0.75) / 0.25);

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
      headU.uSig.value = clamp(0.35 + sigShown * 0.65 + awake * 0.3);
      head.position.set(headBase.x, headBase.y + Math.sin(time * 0.35) * 0.15 * build, headBase.z);
      head.rotation.set(Math.sin(time * 0.27) * 0.008 * build, Math.sin(time * 0.21) * 0.012 * build, 0);
      head.updateMatrixWorld(true);
      inBrain.material.uniforms.uA.value = (0.25 + sigShown * 0.6 + awake * 0.6 + kick * 0.6) * build;
      inBrain.rotation.y = time * 0.15;
      pips.forEach((m, i) => (m.opacity = goldM.opacity * (i < inserted ? 1 : 0.15)));
      const S = node('slot').getWorldPosition(V());
      slotLight.position.copy(S).add(V(0, 0.6, 3.0));
      slotLight.intensity = ((flyI >= 0 && flyT > FLYC * 0.8 ? 40 : 10) + kick * 200) * build * (riding ? 1 - ease((pT - 2.4) / 0.5) : 1);

      // ================================================================ the camera
      const inF = ease((r - 0.62) / 0.5);
      camera.up.set(0, 1, 0);
      const camEnd = V(0, 0.8, -1.5), lookEnd = V(0, 0.7, -26);
      camera.position.set(0, 0, D).lerp(camEnd, inF);
      const look0 = V(0, 0, -26).lerp(lookEnd, inF);
      const want = flyI >= 0 || (since < 1.3 && inserted < 4) ? 1 : 0.15 * inserted;
      approach += (want - approach) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 1.7));
      if (fixed) approach = flyI >= 0 ? 1 : 0.15 * inserted;
      const camSlot = S.clone().add(V(0, 5.6, 27)), lookSlot = S.clone().add(V(0, 5.6, 0));
      const ready = ease((r - 1.0) / 0.2);
      camera.position.lerp(camSlot, approach * ready);
      const lookAt = look0.clone().lerp(lookSlot, approach * ready);
      camera.lookAt(lookAt);
      camera.updateMatrixWorld();

      // ================================================================ the coins
      const back = ease((r - 1.0) / 0.22);
      const waiting = [0, 1, 2, 3].filter((i) => i >= inserted && i !== flyI && !(riding && i === 3));
      const byTag = (i) => {
        const rc = tags[i].getBoundingClientRect(), Z = 8, hh = tanF * Z, ww = hh * (innerWidth / innerHeight);
        const px = rc.right + 30, py = rc.top + rc.height / 2;
        return camera.localToWorld(V(((px / innerWidth) * 2 - 1) * ww + (1 - back) * 0.6, (1 - (py / innerHeight) * 2) * hh, -Z));
      };
      const Hm = S.clone().add(V(0, 0.6, 8.5)), E = S.clone().add(V(0, 0, 1.0));
      const qFace = head.quaternion.clone();
      const qFlat = qFace.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
      const mouthPlane = new THREE.Plane(V(0, 0, 1), -(S.z - 0.15));
      scan.material.uniforms.uA.value = 0;
      coins.forEach((c, i) => {
        c.visible = false;
        c.userData.clip(null);
        if (i < inserted && !(riding && i === 3)) return;
        if (i === flyI) {
          if (flyT < FLYC) {
            const P0 = byTag(i), e = io(flyT / FLYC);
            c.position.copy(bez(P0, P0.clone().add(V(-0.6, 0.3, -1.5)), Hm.clone().add(V(5, 4, 6)), Hm, e));
            c.quaternion.copy(camera.quaternion).slerp(qFace, e);
            c.rotateY(Math.sin(e * Math.PI) * 0.5);
            c.scale.setScalar(lerp(COIN_TRAY * 1.15, COIN_IN, e));
            c.userData.glow(0.25);
          } else {
            const h = flyT - FLYC;
            const tip = io((h - HOVER) / (DROP * 0.55)), slide = (h - HOVER - DROP * 0.55) / (DROP * 0.45);
            const P = Hm.clone().lerp(E, tip);
            if (slide > 0) P.z -= inn(slide) * (COIN_IN * 2 + 3);
            P.y += Math.sin(time * 3.5) * 0.05 * (1 - tip);
            c.position.copy(P);
            c.quaternion.copy(qFace).slerp(qFlat, tip);
            c.scale.setScalar(COIN_IN);
            c.userData.clip(mouthPlane);
            const sr = clamp(h / (HOVER - 0.1));
            scan.position.copy(Hm).add(V(0, COIN_IN * (1 - 2 * io(sr)), COIN_IN * 0.12));
            scan.scale.set(COIN_IN * 2.6, COIN_IN * 0.5, 1);
            scan.quaternion.copy(qFace);
            scan.material.uniforms.uA.value = Math.sin(sr * Math.PI) * (1 - tip);
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
      built.style.opacity = String(ease((r - 0.95) / 0.15) * (inserted === 0 && flyI < 0 && !riding ? 1 : 0) * (fixed && fixed.inserted > 0 ? 0 : 1));

      // ================================================================ the last coin: you ride it to the slot and drop in after it
      glitch.uniforms.uFade.value = 0;
      let inHead = false;
      if (riding) {
        const c = coins[3];
        c.visible = true;
        c.userData.clip(null);
        const lead = V(0, -0.85, -4.0);
        if (pT < 4.1) {
          const start = byTag(3);
          const ride = io((pT - 0.2) / 3.6);
          const camFrom = camera.position.clone();
          const camTo = E.clone().add(V(0, 0.55, 2.8));
          const camP = bez(camFrom, camFrom.clone().add(V(0, -1, -6)), camTo.clone().add(V(0, 1.2, 8)), camTo, ride);
          const sink = io((pT - 3.3) / 0.8);
          camP.lerp(S.clone().add(V(0, 0.08, -2.5)), sink);
          camera.position.copy(camP);
          const lookTarget = lookAt.clone().lerp(S.clone().add(V(0, 0.8, 0)), ease(ride * 1.3)).lerp(S.clone().add(V(0, 0, -10)), sink);
          camera.lookAt(lookTarget);
          camera.updateMatrixWorld();
          const front = camera.localToWorld(lead.clone());
          const rise = io(pT / 0.7);
          const ahead = camera.localToWorld(lead.clone().lerp(V(0, -0.35, -2.2), ease((pT - 2.4) / 1.0)));
          c.position.copy(start.lerp(front, rise)).lerp(ahead, ease((pT - 0.5) / 0.4));
          if (pT > 3.3) c.position.lerp(S.clone().add(V(0, 0, -4.5)), io((pT - 3.3) / 0.8));
          c.quaternion.copy(camera.quaternion).slerp(qFlat, io((pT - 2.4) / 0.9));
          c.scale.setScalar(lerp(COIN_TRAY, 0.55, rise));
          c.userData.glow(0.4 + awake * 0.6);
          coinLight.position.copy(camera.position).add(V(0, 0.6, 0));
          coinLight.intensity = 6;
          glitch.uniforms.uFade.value = 0.97 * ease((pT - 3.7) / 0.35);
        } else {
          inHead = true;
          inside.visible = true;
          inside.position.copy(S).add(V(0, 0, -1.5));
          inside.updateMatrixWorld(true);
          const q = clamp((pT - 4.1) / 4.2);
          const along = lerp(-1.0, -43.2, ease(q));
          camera.position.copy(inside.localToWorld(V(0, along, 0.001)));
          camera.up.set(0, 1, 0);
          camera.lookAt(inside.localToWorld(V(0, along - 5, 0)));
          camera.updateMatrixWorld();
          c.position.copy(inside.localToWorld(V(0, lerp(along - 2.4, -44.86, Math.min(1, ease(q * 1.15))), 0)));
          c.quaternion.copy(inside.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (1 - Math.min(1, q * 1.15)) * 6)));
          c.scale.setScalar(0.4 + 0.2 * (1 - q));
          shaft.material.uniforms.uTime.value = time;
          brainMesh.material.uniforms.uA.value = ease((pT - 7.6) / 1.0);
          brainMesh.rotation.y = time * 0.4;
          glitch.uniforms.uFade.value = 0.97 * (1 - ease((pT - 4.1) / 0.4));
        }
        endEl.style.opacity = String(ease((pT - 9.2) / 1.0));
      } else { inside.visible = false; endEl.style.opacity = '0'; }
      head.visible = !inHead;

      // ================================================================ the visor
      face.mat.uniforms.uTime.value = time;
      face.mat.uniforms.uSig.value = clamp(0.5 + sigShown * 0.5 + awake);
      face.mat.uniforms.uKick.value = kick * 0.4;
      face.mat.uniforms.uOn.value = ease((uT - 0.82) / 0.16);
      const blinkPh = (time + 0.4) % 3.6;
      const reading = inserted > 0 && since < 1.4 && !riding ? { t: since, n: STUDIES[inserted - 1].n, glyph: STUDIES[inserted - 1].glyph } : null;
      const watching = flyI >= 0 ? ease(flyT / FLYC) : 0;
      face.draw({
        read: reading,
        level: 0.85 + 0.15 * sigShown,
        open: lerp(0.7, 1, sigShown) * (1 + watching * 0.12) + awake * 0.1,
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy: (since > 1.25 && since < 1.9 && inserted > 0 && !riding) || (riding && pT > 1.2 && pT < 2.6) ? 1 : 0,
        lookX: riding ? 0 : Math.sin(time * 0.37) * 0.25 * (1 - watching),
        lookY: riding ? 0.2 : lerp(Math.sin(time * 0.29) * 0.15, 0.95, watching),
        hint: r >= 1.2 && flyI < 0 && inserted < 4 && !riding && since > 1.4 ? 0.5 + 0.5 * (Math.sin(time * 5) > 0 ? 1 : 0.2) : 0,
      });
      glitch.uniforms.uAmt.value = (1 - sigShown) * 0.12 * ease((r - 0.9) / 0.2);
      glitch.uniforms.uKick.value = kick * 0.25;
      glitch.uniforms.uTime.value = time;
      bloom.strength = 0.6 * ease((r - 0.15) / 0.5);

      // ================================================================ HUD
      countEl.textContent = String(inserted + (riding && pT > 3.5 ? 1 : 0));
      sigEl.textContent = String(Math.round(sigShown * 100)).padStart(2, '0');
      hud.style.opacity = String(ease((r - 0.95) / 0.25) * (1 - ease((pT - 3.4) / 0.5)) + ease((pT - 9.2) / 1.0));
      press.style.opacity = r >= 1.2 && flyI < 0 && inserted < 4 && !riding ? '1' : '0';
      this._top = page.visible || pix.visible;
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
