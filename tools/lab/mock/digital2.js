// LAB ONLY (throwaway). The robot beat, round 45. A colossus with no body: a head and two hands, all in the same black,
// gold and violet. Its hands (armoured gauntlets, tools/lab/blender/hand3.py) reach over the top of the works from
// behind, turn, lay their palms flat on the page and push it down with weight; they let go, the page falls on by
// itself, and the hands float back to rest beside the head. The head (head3.py) has a face you can read: a sculpted
// faceplate, two LED eyes in their sockets, and the mouth is the coin slot. Each press flies the next study coin to
// the mouth: the eyes read it (they turn into its mark), it tips flat and slides in, a pip lights, the eyes smile.
// The last coin is you: you ride it into the mouth, through the head, down to the CPU where the brain sits.
// Original designs, in the spirit of a modern armoured suit; not any existing character.
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
const VIOLET = new THREE.Color('#a57cff');
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const io = (v) => { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const inn = (v) => Math.pow(clamp(v), 3);
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const bez = (a, b, c, d, t) => { const u = 1 - t; return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
/** A hand's rotation from where its fingers point and where its palm faces. */
const handQ = (fingers, palm) => {
  const f = fingers.clone().normalize();
  const n = palm.clone().addScaledVector(f, -palm.dot(f)).normalize();
  return basis(V().crossVectors(f, n), f, n);
};
const HASH = 'float vhash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }';

// ------------------------------------------------------------------ the head comes back block by block with the signal
function headDigital(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uToHead: U.uToHead, uSig: U.uSig, uCenter: U.uCenter });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uToHead; varying vec3 vHead;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHead = (uToHead * modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uSig; uniform vec3 uCenter; varying vec3 vHead;\n${HASH}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rr = length((vHead - uCenter) * vec3(1.0, 0.85, 0.6)) / 6.0;
        float dd = (uSig * 1.1 + 0.62) - (rr + (vhash(floor(vHead * 3.2)) - 0.5) * 0.45);
        if (dd < 0.0) discard;
        totalEmissiveRadiance += vec3(0.62, 0.42, 1.0) * (1.0 - smoothstep(0.0, 0.025, dd)) * 0.55;`);
  };
  mat.customProgramCacheKey = () => 'head-digital';
}
const headGap = (p, c, h, sig) => (sig * 1.1 + 0.62) - (Math.hypot(p.x - c.x, (p.y - c.y) * 0.85, (p.z - c.z) * 0.6) / 6 + (h - 0.5) * 0.45);

// ------------------------------------------------------------------ the Blender models
const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));
const baseName = (m) => (m?.name || '').replace(/\.\d+$/, '');
/** The robot's own materials, shared in look by head and hands. */
const look = {
  shell: () => new THREE.MeshPhysicalMaterial({ color: '#17151d', metalness: 0.9, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.65 }),
  plate: () => new THREE.MeshPhysicalMaterial({ color: '#2e2a37', metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
  under: () => new THREE.MeshPhysicalMaterial({ color: '#77737f', metalness: 1, roughness: 0.3 }),
  gold: () => new THREE.MeshPhysicalMaterial({ color: '#c89443', metalness: 1, roughness: 0.24 }),
  seam: () => new THREE.MeshStandardMaterial({ color: '#000', emissive: VIOLET.clone(), emissiveIntensity: 0.4 }),
  glow: () => new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 1.6 }),
};
function handFromGlb(src) {
  const hand = src.clone(true);
  const M = { armor: look.shell(), plate: look.plate(), under: look.under(), gold: look.gold(), glow: look.glow(), seam: look.seam() };
  hand.traverse((o) => { if (o.isMesh) o.material = M[baseName(o.material)] ?? M.armor; });
  const node = (n) => hand.getObjectByName(n);
  hand.userData = {
    M,
    fingers: [0, 1, 2, 3].map((f) => ({ base: node(`f${f}_base`), joints: [0, 1, 2].map((s) => node(`f${f}_s${s}`)), rest: node(`f${f}_base`).rotation.clone() })),
    thumb: { base: node('thumb_base'), joints: [0, 1, 2].map((s) => node(`thumb_s${s}`)) },
  };
  return hand;
}
/** Joints ease toward a pose with weight; a breath of motion always, a tremor while they press. */
function animator(hand) {
  const cur = { f: [0, 1, 2, 3].map(() => [0.3, 0.3, 0.25]), t: [0.2, 0.2, 0.2], spread: 0.05 };
  return (pose, dt, time, strain = 0) => {
    const k = dt <= 0 ? 1 : 1 - Math.exp(-dt * 9);
    const { fingers, thumb } = hand.userData;
    cur.spread += (pose.spread - cur.spread) * k;
    fingers.forEach((fg, i) => {
      fg.base.rotation.z = fg.rest.z + (i - 1.5) * cur.spread * -1 + Math.sin(time * 0.9 + i) * 0.01;
      fg.joints.forEach((j, s) => {
        const want = pose.f[i][s] + (pose.wave ? Math.sin(time * 1.4 - i * 0.6 - s * 0.4) * pose.wave : 0);
        cur.f[i][s] += (want - cur.f[i][s]) * k * (1 - s * 0.18);
        j.rotation.x = cur.f[i][s] + Math.sin(time * 1.7 + i * 1.3 + s * 0.8) * 0.015 + strain * Math.sin(time * 31 + i * 2.3 + s * 1.1) * 0.012;
      });
    });
    thumb.joints.forEach((j, s) => { cur.t[s] += (pose.t[s] - cur.t[s]) * k; j.rotation.x = cur.t[s]; });
  };
}
const mix3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const FLAT = [0.1, 0.0, 0.0], RELAX = [0.28, 0.34, 0.26], REACH = [0.12, 0.16, 0.12];

function headFromGlb(src) {
  const g = src;
  const U = { uToHead: { value: new THREE.Matrix4() }, uSig: { value: 0 }, uCenter: { value: V() } };
  const M = {
    shell: look.shell(), trim: look.plate(), seam: look.seam(),
    mask: new THREE.MeshPhysicalMaterial({ color: '#25222d', metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 }),
    rim: new THREE.MeshPhysicalMaterial({ color: '#c89443', metalness: 1, roughness: 0.22, emissive: GLOW.clone(), emissiveIntensity: 0.2 }),
    slotglow: new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 2.0 }),
  };
  [M.shell, M.trim, M.seam].forEach((m) => headDigital(m, U));
  const pips = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 0.05 }));
  const eyes = {};
  g.traverse((o) => {
    if (!o.isMesh) return;
    const pip = /^pip_(\d)/.exec(o.name);
    if (pip) o.material = pips[Number(pip[1])];
    else if (/^eye_[lr]$/.test(o.name)) eyes[o.name.slice(4)] = o;
    else o.material = M[baseName(o.material)] ?? M.shell;
  });
  const node = (n) => g.getObjectByName(n);
  return { group: g, M, U, pips, eyes, shell: node('shell'), face: node('face'), slot: node('slot') };
}

// ------------------------------------------------------------------ the eyes: LED panels; shapes, blinks, looks, and the mark they read
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
function ledEye(side) {
  const CW = 185, CH = 86, NX = 72, NY = 34;
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const glyph = Object.fromEntries(STUDIES.map((s) => [s.glyph, s.glyph === 'gear' ? gearPath() : new Path2D(PATHS[s.glyph])]));
  const mat = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { uEye: { value: tex }, uTime: { value: 0 }, uSig: { value: 0 }, uKick: { value: 0 }, uGrid: { value: new THREE.Vector2(NX, NY) }, uSeed: { value: side } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uEye; uniform float uTime, uSig, uKick, uSeed; uniform vec2 uGrid; varying vec2 vUv;
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){
        vec2 g = vUv * uGrid, cell = floor(g), f = fract(g) - 0.5;
        float bad = clamp(1.0 - uSig + uKick, 0.0, 1.0), tick = floor(uTime * 10.0);
        float slip = step(1.0 - 0.12 * bad, hash(vec2(cell.y + uSeed * 9.0, tick))) * floor((hash(vec2(cell.y, tick + 3.0)) - 0.5) * 8.0 * bad + 0.5);
        vec2 sc = (cell + vec2(slip, 0.0) + 0.5) / uGrid;
        float v = texture2D(uEye, vec2(sc.x, 1.0 - sc.y)).r;
        v *= 1.0 - step(1.0 - 0.12 * bad, hash(cell * 1.37 + floor(uTime * 6.0) + uSeed));
        float d = length(f);
        float dotM = smoothstep(0.46, 0.3, d);
        vec3 lit = mix(vec3(1.0, 0.66, 0.3), vec3(1.0, 0.95, 0.85), clamp(v, 0.0, 1.0));
        vec3 col = vec3(0.025, 0.018, 0.04) + lit * v * (dotM * 2.1 + 0.6);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  function draw(st) {
    x.fillStyle = '#000';
    x.fillRect(0, 0, CW, CH);
    const k = Math.round(255 * clamp(st.level));
    x.fillStyle = x.strokeStyle = `rgb(${k},${k},${k})`;
    const cx = CW / 2 + st.lookX * 22, cy = CH / 2 + st.lookY * 10;
    if (st.glyph) {
      x.save(); x.translate(CW / 2 - 27, CH / 2 - 27); x.scale(0.54, 0.54); x.fill(glyph[st.glyph], 'evenodd'); x.restore();
    } else if (st.happy > 0.5) {
      x.lineWidth = 13; x.lineCap = 'round';
      x.beginPath(); x.ellipse(cx, cy + 17, 40, 27, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
    } else {
      const rx = 54 * st.wide, ry = Math.max(3, 30 * st.open * (1 - 0.94 * st.blink));
      x.beginPath(); x.ellipse(cx, cy, rx, ry, side * -0.06, 0, Math.PI * 2); x.fill();
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
    float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main(){
      vec2 uv = vUv;
      float a = uAmt + uKick;
      float row = floor(uv.y * 64.0), tick = floor(uTime * 14.0);
      uv.x += step(0.82, hash(vec2(row * 0.7, tick))) * (hash(vec2(row, tick + 1.0)) - 0.5) * 0.05 * a;
      float s = 0.008 * a;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(s, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(s, 0.0)).b);
      c += (hash(floor(vUv * vec2(640.0, 360.0)) + tick * 3.1) - 0.5) * 0.08 * a;
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0);
    }`,
};

export async function createDigital2(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030206');
  scene.fog = new THREE.FogExp2('#07040e', 0.0055);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 900);
  const tanF = Math.tan((20 * Math.PI) / 180);
  const D = 10, DP = 40, ZP = D - DP, PH_ = 2 * DP * tanF, PW_ = PH_ * (W / H);
  const dir = (c, i, x, y, z) => { const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); return l; };
  const lights = [dir('#e9e4ff', 0.9, -8, 14, 10), dir('#9a74ff', 3.0, 10, 6, -20), dir('#ffe2c0', 1.3, 3, 6, 9), dir('#b9a6ff', 0.8, 0, -8, 4), new THREE.HemisphereLight('#2e2148', '#040208', 0.6)];
  lights.forEach((l) => { l.layers.enableAll(); scene.add(l); });
  const onTop = (o) => o.traverse((c) => c.layers.set(1));
  const both = (o) => o.traverse((c) => c.layers.enable(1));

  // ---------------------------------------------------------------- the page: the works, a sheet the hands push down
  const page = new THREE.Mesh(new THREE.PlaneGeometry(PW_, PH_, 160, 90), new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false,
    uniforms: { uTex: { value: pageTexture() }, uY: { value: 0 }, uTilt: { value: 0 }, uPress: { value: 0 }, uC: { value: new THREE.Vector4() }, uS: { value: new THREE.Vector4() }, uShade: { value: 0 }, uLit: { value: 0 }, uVig: { value: 0 }, uW: { value: PW_ }, uH: { value: PH_ }, uTime: { value: 0 }, uAsp: { value: W / H } },
    vertexShader: `
      uniform float uY, uTilt, uPress, uW, uH; uniform vec4 uC;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        vec2 d0 = (p.xy - uC.xy) / uH, d1 = (p.xy - uC.zw) / uH;
        float dent = exp(-dot(d0, d0) * 30.0) + exp(-dot(d1, d1) * 30.0);
        float bow = 1.0 - pow(p.x / (uW * 0.5), 2.0);
        p.z -= uPress * uH * (0.018 * dent + 0.022 * bow * smoothstep(-0.5, 0.5, p.y / uH));
        float c = cos(uTilt), s = sin(uTilt), yb = p.y + uH * 0.5;
        p = vec3(p.x, -uH * 0.5 + yb * c + p.z * s, p.z * c - yb * s);
        p.y -= uY;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uTime, uAsp, uVig, uShade, uLit, uW, uH; uniform vec4 uS;
      varying vec2 vUv;
      void main(){
        vec3 col = texture2D(uTex, vUv).rgb;
        vec2 c = vUv - 0.5;
        col *= 1.0 - smoothstep(0.45, 1.15, length(c * vec2(uAsp, 1.0))) * 0.7 * uVig;
        vec2 q = c * vec2(uW, uH) / uH;
        vec2 a = (q - uS.xy / uH) * vec2(2.2, 1.4), b = (q - uS.zw / uH) * vec2(2.2, 1.4);
        float sh = exp(-dot(a, a) * 7.0) + exp(-dot(b, b) * 7.0);
        col *= 1.0 - uShade * min(1.0, sh) * 0.65;
        // The palms' light, pressed against it, spills a warm ring onto the page.
        col += vec3(1.0, 0.68, 0.32) * (exp(-dot(a, a) * 60.0) + exp(-dot(b, b) * 60.0)) * uLit * 0.6;
        col += vec3(0.75, 0.62, 1.0) * smoothstep(0.994, 1.0, max(vUv.y, max(vUv.x, 1.0 - vUv.x))) * 0.5 * uVig;
        float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
        col += (g - 0.5) * 0.028 * uVig;
        if (!gl_FrontFacing) col = vec3(0.02, 0.016, 0.03);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  page.frustumCulled = false;
  page.position.z = ZP;
  onTop(page);
  scene.add(page);

  // ---------------------------------------------------------------- the colossus: a head and two hands, on one scale
  const [handSrc, headSrc] = await Promise.all([loadGlb('models/hand3.glb'), loadGlb('models/head3.glb')]);
  const head = headFromGlb(headSrc);
  const HEAD = 4.0;
  head.group.scale.setScalar(HEAD);
  head.group.updateMatrixWorld(true);
  const toLocal = (o) => o.getWorldPosition(V()).divideScalar(HEAD);
  const faceLocal = toLocal(head.face);
  head.U.uCenter.value.copy(faceLocal);
  const headBase = V(0, 1.5, -54).sub(faceLocal.clone().multiplyScalar(HEAD));
  head.group.position.copy(headBase);
  scene.add(head.group);
  const eyeL = ledEye(-1), eyeR = ledEye(1);
  head.eyes.l.material = eyeL.mat;
  head.eyes.r.material = eyeR.mat;
  const mouthLight = new THREE.PointLight('#ffc477', 0, 0, 2);
  scene.add(mouthLight);
  // Loose voxels round the parts of the head that are not there yet.
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
      const b = { p: p.clone(), n: n.clone(), h: rnd(), k: rnd(), s: 0.035 + rnd() * 0.07 };
      vox.userData.seed.push(b);
      vox.setColorAt(i, new THREE.Color(b.k > 0.93 ? '#ffcf86' : b.k > 0.6 ? '#7a5fd0' : '#2a2242').multiplyScalar(b.k > 0.93 ? 1.3 : 0.75));
    }
  }
  head.group.add(vox);
  const offs = new Float32Array(NV).fill(1);
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 130, (rnd() - 0.45) * 80, -6 - rnd() * 80], i * 3);
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: '#a891d8', size: 0.09, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  }

  // ---------------------------------------------------------------- the hands: the same make as the head, floating (no arms)
  const HS = 8.4;
  const right = handFromGlb(handSrc);
  const leftRoot = new THREE.Group();
  leftRoot.scale.x = -1;
  const left = handFromGlb(handSrc);
  leftRoot.add(left);
  scene.add(right, leftRoot);
  both(right); both(leftRoot);   // through the bloom with the head, and again over the page while it is up
  const animR = animator(right), animL = animator(left);
  // Rest: beside the head, fingers up, palms toward you a little. Push: fingers down, palms flat on the page.
  const REST = V(22, -5, -47);
  const qRest = handQ(V(0.1, 1, 0.05), V(-0.45, 0, 1));
  const qOver = handQ(V(0, 0.15, 1), V(0, -1, 0.1));
  const qPush = handQ(V(-0.32, -1, 0), V(0, 0, -1));
  const PALM = 0.18;       // the palm's surface, in front of the hand's axis (hand units)
  const PALM_C = 0.58;     // the middle of the palm, along the fingers from the wrist
  const CX = PW_ * 0.2, CY = PH_ * 0.1;

  // ---------------------------------------------------------------- the coins
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
  const COIN_IN = 1.75, COIN_TRAY = 0.15;
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float y = abs(vUv.y - 0.5) * 2.0, x = abs(vUv.x - 0.5) * 2.0; float a = (exp(-y * y * 40.0) * 1.6 + exp(-y * 6.0) * 0.25) * (1.0 - x * x) * uA; gl_FragColor = vec4(vec3(1.0, 0.78, 0.42) * a * 1.6, a); }',
  }));
  scene.add(scan);

  // ---------------------------------------------------------------- inside: through the mouth, a tunnel of traces to the CPU
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

  // A coin's turn: to the mouth, read, tipped flat, in. The last is a ride.
  const FLY = 0.95, READ = 0.75, TIP = 0.4, IN = 0.3, FLIGHT = FLY + READ + TIP + IN, POVT = 11;
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
      // ================================================================ the push (scroll), on one physical curve
      // Contact at r 0.3; pushed from rest under a steady force until r 0.62 (it speeds up); let go; it falls on.
      const pu = page.material.uniforms;
      pu.uTex.value = pageTexture(); pu.uTime.value = time;
      const R0 = 0.34, R1 = 0.62, D1 = PH_ * 0.34, v1 = (2 * D1) / (R1 - R0), G = PH_ * 7;
      const u = clamp((r - R0) / (R1 - R0)), tau = Math.max(0, r - R1);
      const Yp = r < R1 ? D1 * u * u : D1 + v1 * tau + 0.5 * G * tau * tau;
      const tilt = 0.75 * Math.pow(clamp(tau / 0.26), 2);
      const contact = ease((r - 0.27) / 0.05);
      const pressAmt = contact * (1 - ease((r - R1) / 0.05)) * (0.6 + 0.4 * Math.sin(clamp((r - 0.28) / 0.08) * Math.PI));
      pu.uY.value = Yp; pu.uTilt.value = tilt; pu.uPress.value = pressAmt; pu.uVig.value = ease(r / 0.12);
      page.visible = Yp < PH_ * 1.6;
      pu.uC.value.set(CX, CY, -CX, CY);
      const handAt = (hand, anim, lag, phase) => {
        // where the palm sits while it pushes, riding with the page; and how it gets there and away
        const ph = Math.min(Yp, D1 + v1 * Math.min(tau, 0.11) - 0.5 * (v1 / 0.11) * Math.min(tau, 0.11) ** 2);
        const onPage = V(CX, CY - ph, ZP + 0.02 - 0.87 * pressAmt);
        const fPush = V(0, -1, 0).applyAxisAngle(V(0, 0, 1), -0.32);
        const wristOn = (q, c) => {
          const f = V(0, 1, 0).applyQuaternion(q), n = V(0, 0, 1).applyQuaternion(q);
          return c.clone().addScaledVector(f, -PALM_C * HS).addScaledVector(n, -PALM * HS);
        };
        const pushW = wristOn(qPush, onPage);
        const a = clamp((r - 0.03 - lag) / (0.27 - lag));
        let W_, q;
        if (r < 0.3 + lag) {
          // Up from beside the head, over the top of the page, turning over, and down onto it.
          const e = io(a);
          W_ = bez(REST, REST.clone().add(V(-4, 30, 2)), pushW.clone().add(V(4, 16, 9)), pushW, e);
          q = e < 0.5 ? qRest.clone().slerp(qOver, ease(e / 0.5)) : qOver.clone().slerp(qPush, ease((e - 0.5) / 0.5));
          W_.z += Math.sin(clamp((r - 0.24 - lag) / 0.06) * Math.PI) * -0.25;     // the press lands with weight
        } else if (tau < 0.13) {
          // On the page; after letting go it slows, lifting off.
          W_ = pushW.clone().add(V(0, 0, 3.0 * out(tau / 0.13)));
          q = qPush.clone();
        } else {
          // Back to rest beside the head, turning back over.
          const b = io((r - R1 - 0.13 - lag) / 0.38);
          const from = V(pushW.x, pushW.y, pushW.z + 3.0);
          W_ = bez(from, from.clone().add(V(4, 2, -3)), REST.clone().add(V(-3, 3, 7)), REST, b);
          // Turning over toward you, fingers first, so the wrist always faces away.
          q = b < 0.45 ? qPush.clone().slerp(qOver, ease(b / 0.45)) : qOver.clone().slerp(qRest, ease((b - 0.45) / 0.55));
        }
        // Afloat: a slow breath, a little sway.
        const settle = clamp((r - 0.95) / 0.2);
        W_.y += Math.sin(time * 0.62 + phase) * 0.35 * settle;
        W_.x += Math.sin(time * 0.41 + phase) * 0.2 * settle;
        hand.position.copy(W_);
        hand.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(time * 0.5 + phase) * 0.05 * settle, 0, Math.sin(time * 0.37 + phase) * 0.04 * settle)));
        hand.scale.setScalar(HS);
        const pushing = r > 0.28 + lag && tau < 0.02;
        const fpose = [0, 1, 2, 3].map((i) => mix3(mix3(RELAX, REACH, ease((r - 0.12 - lag - i * 0.01) / 0.1)), FLAT, ease((r - 0.26 - lag - i * 0.012) / 0.05)))
          .map((p, i) => mix3(p, RELAX, ease((tau - 0.02 - i * 0.01) / 0.12)));
        anim({ f: fpose, t: pushing ? [-0.55, -0.1, 0.0] : [-0.25, 0.12, 0.1], spread: pushing ? 0.09 : 0.04, wave: settle * 0.05 }, dt, time + phase, pushing && r > R0 ? 1 : 0);
        const palm = W_.clone().addScaledVector(V(0, 1, 0).applyQuaternion(q), PALM_C * HS);
        return { palm, pushing };
      };
      const sR = handAt(right, animR, 0, 0), sL = handAt(left, animL, 0.012, 1.7);
      const toPage = (p, sx) => [sx * p.x, (p.y + Yp)];
      const [x0, y0] = toPage(sR.palm, 1), [x1, y1] = toPage(sL.palm, -1);
      pu.uS.value.set(x0, y0, x1, y1);
      pu.uShade.value = 0.9 * ease((r - 0.12) / 0.15) * (1 - ease((tau - 0.05) / 0.1));
      pu.uLit.value = contact * (1 - ease(tau / 0.08));
      for (const h of [right, left]) h.updateMatrixWorld(true);

      // ================================================================ presses
      let inserted = 0, flyI = -1, flyT = 0, pov = 0, pT = 0;
      if (fixed) { inserted = fixed.inserted; flyI = fixed.fly >= 0 && inserted < 3 ? inserted : -1; flyT = fixed.fly * FLIGHT; pov = fixed.pov; pT = pov * POVT; }
      else {
        presses.forEach((t0, i) => {
          const d = time - t0;
          if (i === 3) { pov = clamp(d / POVT); pT = d; }
          else if (d >= FLIGHT) inserted = i + 1; else { flyI = i; flyT = d; }
        });
      }
      const riding = pov > 0;
      const landedAt = inserted > 0 ? (fixed ? time - (fixed.since ?? 9) : presses[inserted - 1] + FLIGHT) : -99;
      const since = time - landedAt;
      // The ride wakes it as you come: signal full, eyes wide, a smile.
      const awake = ease((pT - 0.6) / 1.6);
      const sig = riding ? 0.75 + 0.25 * awake : inserted / 4;
      sigShown += (sig - sigShown) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.2));
      if (fixed) sigShown = sig;
      const kick = Math.max(0, 1 - since / 0.45);
      head.U.uSig.value = sigShown + awake * 0.3;
      head.group.position.set(headBase.x, headBase.y + Math.sin(time * 0.35) * 0.2, headBase.z);
      head.group.rotation.set(Math.sin(time * 0.27) * 0.008, Math.sin(time * 0.21) * 0.012, 0);
      head.group.updateMatrixWorld(true);
      head.U.uToHead.value.copy(head.group.matrixWorld).invert();
      const flick = (k) => (Math.sin(time * 37 + k) * Math.sin(time * 13.7 + k * 2.1) > 0.2 ? 1 : 0.3);
      const seamI = lerp(0.35 * flick(3), 3.0, sigShown) + awake * 2;
      head.M.seam.emissiveIntensity = seamI;
      for (const h of [right, left]) { h.userData.M.seam.emissiveIntensity = seamI * 0.45; h.userData.M.glow.emissiveIntensity = 1.2 + sigShown * 1.5; }
      const S = head.slot.getWorldPosition(V());
      const reading = flyI >= 0 && flyT > FLY * 0.85 && flyT < FLY + READ + TIP;
      head.M.rim.emissiveIntensity = 0.15 + (reading ? 0.6 : 0) + kick * 1.6 + awake * 0.5;
      head.M.slotglow.emissiveIntensity = (1.6 + kick * 8 + (reading ? 3 : 0)) * (riding ? 1 - 0.75 * ease((pT - 2.6) / 0.8) : 1);
      head.pips.forEach((m, i) => (m.emissiveIntensity = i < inserted || (riding && pT > 3.2 && i === 3) ? 3.0 : 0.06));
      mouthLight.position.copy(S).add(V(0, 0.4, 3));
      mouthLight.intensity = ((reading ? 50 : 10) + kick * 200) * (riding ? 1 - ease((pT - 2.4) / 0.6) : 1);
      // The loose voxels click back with the signal.
      {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), s = V();
        const kk = dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.6);
        vox.userData.seed.forEach((b, i) => {
          const gap = headGap(b.p, faceLocal, b.h, sigShown + awake * 0.3);
          const want = gap < 0 ? Math.min(1, -gap * 3.5) : 0;
          offs[i] = fixed ? want : offs[i] + (want - offs[i]) * kk;
          const o = offs[i];
          p.copy(b.p).addScaledVector(b.n, o * (0.15 + b.k * 0.75) + Math.sin(time * 0.7 + b.h * 40) * 0.04 * o);
          p.y += Math.sin(time * 0.5 + b.k * 30) * 0.06 * o;
          const sz = b.s * clamp(o / 0.12);
          s.set(sz, sz, sz);
          vox.setMatrixAt(i, m.compose(p, q, s));
        });
        vox.instanceMatrix.needsUpdate = true;
      }

      // ================================================================ the camera
      // It holds the page; once the page is gone it settles on the colossus; it leans in on the mouth for each coin.
      const inF = ease((r - 0.6) / 0.5);
      camera.up.set(0, 1, 0);
      const camEnd = V(0, 0.5, 4), lookEnd = V(0, 0.5, -54);
      camera.position.set(0, 0, D).lerp(camEnd, inF);
      const look0 = V(0, 0, ZP).lerp(lookEnd, inF);
      const want = flyI >= 0 || (since < 1.4 && inserted < 4) ? 1 : 0.15 * inserted;
      approach += (want - approach) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 1.6));
      if (fixed) approach = flyI >= 0 ? 1 : 0.15 * inserted;
      const camSlot = S.clone().add(V(0, 5.2, 30)), lookSlot = S.clone().add(V(0, 3.4, 0));
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
      const Hm = S.clone().add(V(0, 0.5, 7.5)), E = S.clone().add(V(0, 0, 0.9));
      const qFace = head.group.quaternion.clone();
      const qFlat = qFace.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
      scan.material.uniforms.uA.value = 0;
      coins.forEach((c, i) => {
        c.visible = false;
        if (i < inserted && !(riding && i === 3)) return;
        if (i === flyI) {
          if (flyT < FLY) {
            const P0 = byTag(i), e = io(flyT / FLY);
            c.position.copy(bez(P0, P0.clone().add(V(-0.6, 0.3, -1.5)), Hm.clone().add(V(5, 4, 6)), Hm, e));
            c.quaternion.copy(camera.quaternion).slerp(qFace, e);
            c.rotateY(Math.sin(e * Math.PI) * 0.5);
            c.scale.setScalar(lerp(COIN_TRAY * 1.15, COIN_IN, e));
            c.userData.glow(0.25);
          } else {
            const h = flyT - FLY;
            const tip = io((h - READ) / TIP), slide = (h - READ - TIP) / IN;
            const P = Hm.clone().lerp(E, tip);
            if (slide > 0) P.z -= inn(slide) * (COIN_IN * 2 + 4);
            P.y += Math.sin(time * 3.5) * 0.06 * (1 - tip);
            c.position.copy(P);
            c.quaternion.copy(qFace).slerp(qFlat, tip);
            c.scale.setScalar(COIN_IN);
            const sr = clamp(h / (READ - 0.1));
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
        tags[i].classList.toggle('in', i < inserted || (riding && i === 3 && pT > 3.2));
        tags[i].classList.toggle('next', (i === inserted && !riding) || i === flyI || (riding && i === 3 && pT < 3.2));
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

      // ================================================================ the last coin: you ride it into the mouth, through the head, to the CPU
      glitch.uniforms.uFade.value = 0;
      let inHead = false;
      if (riding) {
        const c = coins[3];
        c.visible = true;
        c.scale.setScalar(0.55);
        const start = byTag(3);
        const ride = io((pT - 0.2) / 3.6);           // the long glide to the mouth
        const lead = V(0, -0.85, -4.0);               // the coin a little ahead of you and below
        if (pT < 4.1) {
          // The coin leaves its name, comes to just in front of you; then you go together.
          const front = camera.localToWorld(lead.clone());
          const rise = io(pT / 0.7);
          const camFrom = camera.position.clone();
          const camTo = E.clone().add(V(0, 0.55, 2.6));
          const camP = bez(camFrom, camFrom.clone().add(V(0, -1, -8)), camTo.clone().add(V(0, 1.2, 9)), camTo, ride);
          // In the last stretch you sink to the slit's height and slide in behind the coin.
          const sink = io((pT - 3.3) / 0.8);
          camP.lerp(S.clone().add(V(0, 0.12, -2.5)), sink);
          camera.position.copy(camP);
          const lookTarget = lookAt.clone().lerp(S.clone().add(V(0, 0.6, 0)), ease(ride * 1.3)).lerp(S.clone().add(V(0, 0, -10)), sink);
          camera.lookAt(lookTarget);
          camera.updateMatrixWorld();
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
          // Inside: the coin flies on down the tunnel and seats in the socket, the brain in its square hole.
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
      head.group.visible = !inHead;
      right.visible = leftRoot.visible = !inHead && r > 0.02;

      // ================================================================ the eyes
      const watching = flyI >= 0 ? ease(flyT / FLY) * (1 - ease((flyT - FLY - READ - TIP) / IN)) : 0;
      const showGlyph = flyI >= 0 && flyT > FLY + 0.15 && flyT < FLY + READ + TIP * 0.5 ? STUDIES[flyI].glyph : null;
      const happy = (inserted > 0 && since > 0.1 && since < 1.3 && !riding) || (riding && pT > 1.4 && pT < 2.6) ? 1 : 0;
      const blinkPh = (time + 0.4) % 3.8;
      const eyeState = (side) => ({
        level: lerp(0.55 * flick(1 + side), 1, ease(sigShown)),
        open: lerp(0.16, 1, ease(sigShown)) * (1 + watching * 0.15) + awake * 0.12,
        wide: 0.92 + awake * 0.08,
        blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0,
        happy, glyph: showGlyph,
        lookX: riding ? 0 : Math.sin(time * 0.37) * 0.25 * (1 - watching),
        lookY: riding ? 0.1 : lerp(Math.sin(time * 0.29) * 0.12, 0.7, watching),
      });
      eyeL.draw(eyeState(-1)); eyeR.draw(eyeState(1));
      for (const e of [eyeL, eyeR]) {
        e.mat.uniforms.uTime.value = time;
        e.mat.uniforms.uSig.value = clamp(sigShown * 0.9 + 0.15 + awake);
        e.mat.uniforms.uKick.value = kick * 0.4;
      }
      glitch.uniforms.uAmt.value = (1 - sigShown) * 0.16 * ease((r - 0.85) / 0.2);
      glitch.uniforms.uKick.value = kick * 0.25;
      glitch.uniforms.uTime.value = time;
      bloom.strength = 0.5 * ease((r - 0.2) / 0.5);

      // ================================================================ HUD
      countEl.textContent = String(inserted + (riding && pT > 3.2 ? 1 : 0));
      sigEl.textContent = String(Math.round(sigShown * 100)).padStart(2, '0');
      hud.style.opacity = String(ease((r - 0.95) / 0.25) * (1 - ease((pT - 3.4) / 0.5)) + ease((pT - 9.2) / 1.0));
      press.style.opacity = r >= 1.2 && flyI < 0 && inserted < 4 && !riding ? '1' : '0';
      this._top = page.visible;
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
