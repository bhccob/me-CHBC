// LAB ONLY (throwaway). The robot beat, round 58: a simple printer robot, and everything is print. You pull back out
// through the coin and the works were a print: the sheet rising out of the top of a small printer. The coin you came
// through drops into its coin slot and it wakes. It prints what I studied, a line at a time, under the works. Then it
// prints the way in: a drawing of the brain's gold shaft. Closer, the drawing has depth; its ink spreads into the dark
// and the lines turn to light, and you go in. No cut, no portal. Model: tools/lab/blender/printer.py. Original design.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { coin } from './kit.js';
import { STUDIES, PATHS } from './stage.js';

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const out = (v) => 1 - Math.pow(1 - clamp(v), 3);
const smoother = (v) => { v = clamp(v); return v * v * v * (v * (v * 6 - 15) + 10); };
const bump = (v) => { v = clamp(v); return Math.sin(v * Math.PI) ** 2; };
const lerp = THREE.MathUtils.lerp;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const NAMES = ['Software engineering', 'Game & app development', 'Cybersecurity', 'Mechatronics'];
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
const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig; varying vec2 vUv;
    float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c *= 1.0 - smoothstep(0.5, 1.25, length((vUv - 0.5) * vec2(1.7, 1.0))) * 0.55 * uVig;
      c += (hash(floor(vUv * vec2(720.0, 405.0)) + floor(uTime * 14.0) * 3.1) - 0.5) * 0.025 * uVig;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));
const baseName = (m) => (m?.name || '').replace(/\.\d+$/, '');

/** Past the drawing: the gold shaft into the brain as the site has it now, running away along -z. */
function brainTunnel() {
  const g = new THREE.Scene();
  g.background = new THREE.Color('#06050a');
  const grp = new THREE.Group();
  grp.rotation.x = Math.PI / 2;
  g.add(grp);
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.36), toneMapped: false, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 18; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.035, 6, 8), gold);
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 8);
    ring.position.set(0, -4 - i * 7, 0);
    grp.add(ring);
  }
  const pts = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; pts.push(Math.cos(a) * 6.2, -2, Math.sin(a) * 6.2, Math.cos(a) * 6.2, -130, Math.sin(a) * 6.2); }
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 120; k++) {
    const a = rnd() * Math.PI * 2, rr = 9 + rnd() * 26, y0 = -rnd() * 130, len = 2 + rnd() * 9;
    pts.push(Math.cos(a) * rr, y0, Math.sin(a) * rr, Math.cos(a) * rr * 1.04, y0 - len, Math.sin(a) * rr * 1.04);
  }
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: new THREE.Color(0.62, 0.42, 0.2), transparent: true, opacity: 0.55 })));
  const sp = new Float32Array(2600 * 3);
  for (let i = 0; i < 2600; i++) { const a = rnd() * Math.PI * 2, rr = 12 + rnd() * 60; sp.set([Math.cos(a) * rr, -rnd() * 160, Math.sin(a) * rr], i * 3); }
  grp.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: '#d9c7ff', size: 0.12, transparent: true, opacity: 0.7, depthWrite: false })));
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), rg = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,236,200,1)'); rg.addColorStop(0.18, 'rgba(240,200,140,0.55)'); rg.addColorStop(0.5, 'rgba(160,110,60,0.12)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  orb.scale.setScalar(26);
  orb.position.set(0, -120, 0);
  grp.add(orb);
  return { scene: g, group: grp };
}

/** Its face: a small dark panel of gold LEDs; two eyes. */
function face(w, h) {
  const CW = 300, CH = Math.round((300 * h) / w);
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const U = { uFace: { value: tex }, uOn: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) } };
  const mat = new THREE.ShaderMaterial({
    toneMapped: false, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uFace; uniform float uOn; uniform vec2 uSize; varying vec2 vUv;
      void main(){
        vec2 p = vUv * uSize / 0.11;
        vec2 cc = (floor(p) + 0.5) * 0.11 / uSize, f = fract(p) - 0.5;
        float led = smoothstep(0.5, 0.3, length(f));
        float v = texture2D(uFace, cc).r * uOn;
        vec3 col = vec3(0.05, 0.03, 0.08) * led + vec3(1.0, 0.68, 0.3) * v * led * 1.6 + vec3(1.0, 0.8, 0.5) * v * 0.15;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  function draw({ lookX = 0, lookY = 0, blink = 0, happy = 0 }) {
    x.fillStyle = '#000'; x.fillRect(0, 0, CW, CH);
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    const ew = CW * 0.09, eh = CH * 0.56 * (1 - 0.9 * blink);
    for (const sx of [-1, 1]) {
      const cx = CW * 0.5 + sx * CW * 0.16 + lookX * 14, cy = CH * 0.5 + lookY * 10;
      if (happy > 0.5) { x.lineWidth = ew * 0.5; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy + ew * 0.6, ew * 0.7, Math.PI * 1.12, Math.PI * 1.88); x.stroke(); }
      else { x.beginPath(); x.roundRect(cx - ew / 2, cy - eh / 2, ew, Math.max(4, eh), ew / 2); x.fill(); }
    }
    tex.needsUpdate = true;
  }
  return { mat, U, draw };
}

export const PRINTER_END = 2.72;

export async function createPrinter(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
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

  // ---------------------------------------------------------------- the printer
  const machine = await loadGlb('models/printer.glb');
  scene.add(machine);
  machine.updateMatrixWorld(true);
  const node = (n) => machine.getObjectByName(n);
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: '#2b1e48', roughness: 0.42, metalness: 0.25, clearcoat: 0.55, clearcoatRoughness: 0.25 }),
    trim: new THREE.MeshPhysicalMaterial({ color: '#c99a4a', roughness: 0.28, metalness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0e0a14', roughness: 0.55, metalness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0a0710', roughness: 0.08, metalness: 0, clearcoat: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffc46a'), emissiveIntensity: 0.4 }),
  };
  machine.traverse((o) => { if (o.isMesh) o.material = M[baseName(o.material)] ?? M.body; });
  const slotY = node('paper_slot').getWorldPosition(V()).y;
  const CS = node('coin_slot').getWorldPosition(V());
  const fc = node('face').getWorldPosition(V());
  const fw = node('face').userData.width ?? 9.2, fh = node('face').userData.height ?? 3.0;
  const fx = face(fw, fh);
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), fx.mat);
  facePlane.position.copy(fc).add(V(0, 0, 0.01));
  scene.add(facePlane);

  // ---------------------------------------------------------------- the sheet: one long fanfold page; what is printed on it is there all along and comes out of the slot
  const LH = 1.45, SW = PW_ + 1.6;
  const L0 = { wTop: 0.5 };
  L0.wBot = L0.wTop + PH_;
  L0.hTop = L0.wBot + 1.15;
  L0.lines = [0, 1, 2, 3].map((i) => L0.hTop + LH * (i + 1));
  L0.cTop = L0.hTop + LH * 5 + 0.4;
  L0.dTop = L0.cTop + LH * 0.9;
  L0.dBot = L0.dTop + PH_;
  const SL = L0.dBot + 1.3 + 8; // what is still inside the printer at the end
  const s0 = (L0.wTop + PH_ / 2) - 0; // the works' middle is at y = 0 to start with
  const atSlot0 = s0 - slotY; // which s is at the slot to start with
  // how far the sheet has risen for a given s to be fully out
  const outFor = (s) => s - atSlot0;
  const PX = 110; // canvas pixels per unit
  const pc = document.createElement('canvas');
  pc.width = Math.round(SW * PX); pc.height = Math.round(SL * PX);
  const px = pc.getContext('2d');
  {
    const w = pc.width, h = pc.height, u = (v) => v * PX;
    px.fillStyle = '#f1ece1'; px.fillRect(0, 0, w, h);
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26000; i++) { px.fillStyle = `rgba(${rnd() < 0.5 ? '120,100,80' : '255,255,255'},${rnd() * 0.08})`; px.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1); }
    // fanfold: perforated margins with sprocket holes, a fold every so often
    px.fillStyle = 'rgba(42,21,70,0.18)';
    for (let y = 0; y < h; y += 9) for (const xm of [u(0.78), w - u(0.78)]) px.fillRect(xm, y, 1.5, 4);
    px.globalCompositeOperation = 'destination-out';
    for (let s = 0.25; s < SL; s += 0.5) for (const xm of [u(0.38), w - u(0.38)]) { px.beginPath(); px.arc(xm, u(s), u(0.12), 0, Math.PI * 2); px.fill(); }
    px.globalCompositeOperation = 'source-over';
    const ink = '#2a1546', gold = '#a8772c';
    const left = u(0.8 + (SW - 1.6 - PW_) / 2 + 0.05), right = w - left;
    px.textBaseline = 'middle';
    // under the works
    px.font = `500 ${u(0.26)}px "IBM Plex Mono", monospace`; px.fillStyle = 'rgba(42,21,70,0.7)';
    px.textAlign = 'left'; px.fillText('SELECTED WORKS  ·  05', left, u(L0.wBot + 0.42));
    px.textAlign = 'right'; px.fillText('PRINTED BY BC—2006', right, u(L0.wBot + 0.42));
    // what I studied
    px.textAlign = 'left'; px.fillStyle = ink; px.font = `700 ${u(0.5)}px Barlow`;
    px.fillText('WHAT I STUDIED', left, u(L0.hTop + LH * 0.5));
    px.font = `500 ${u(0.26)}px "IBM Plex Mono", monospace`; px.textAlign = 'right'; px.fillStyle = 'rgba(42,21,70,0.7)';
    px.fillText('4 COURSES  ·  1 STILL BEING MINTED', right, u(L0.hTop + LH * 0.5));
    px.fillStyle = ink; px.fillRect(left, u(L0.hTop + LH - 0.06), right - left, u(0.04));
    const gear = gearPath();
    STUDIES.forEach((st, i) => {
      const y = u(L0.lines[i] + LH * 0.5);
      px.textAlign = 'left'; px.fillStyle = 'rgba(42,21,70,0.65)'; px.font = `500 ${u(0.3)}px "IBM Plex Mono", monospace`;
      px.fillText(st.n, left, y);
      px.save(); px.translate(left + u(0.9), y - u(0.32)); px.scale(u(0.64) / 100, u(0.64) / 100); px.fillStyle = gold;
      px.fill(st.glyph === 'gear' ? gear : new Path2D(PATHS[st.glyph]), 'evenodd'); px.restore();
      px.fillStyle = ink; px.font = `700 ${u(0.56)}px Barlow`; px.fillText(NAMES[i].toUpperCase(), left + u(1.9), y);
      const tw = px.measureText(NAMES[i].toUpperCase()).width;
      px.fillStyle = 'rgba(42,21,70,0.35)';
      for (let xx = left + u(2.1) + tw; xx < right - u(2.4); xx += u(0.22)) px.fillRect(xx, y + u(0.1), u(0.06), u(0.06));
      px.textAlign = 'right'; px.font = `500 ${u(0.28)}px "IBM Plex Mono", monospace`; px.fillStyle = st.fresh ? gold : ink;
      px.fillText(st.fresh ? 'BEING MINTED' : 'STUDIED', right, y);
      px.fillStyle = 'rgba(42,21,70,0.14)'; px.fillRect(left, u(L0.lines[i] + LH - 0.02), right - left, u(0.02));
    });
    // the way in
    px.textAlign = 'left'; px.fillStyle = ink; px.font = `700 ${u(0.5)}px Barlow`;
    px.fillText('THE WAY IN', left, u(L0.cTop + LH * 0.45));
    px.textAlign = 'right'; px.font = `500 ${u(0.26)}px "IBM Plex Mono", monospace`; px.fillStyle = 'rgba(42,21,70,0.7)';
    px.fillText('INTO THE BRAIN  ·  LOOK CLOSER', right, u(L0.cTop + LH * 0.45));
    px.strokeStyle = ink; px.lineWidth = u(0.035);
    px.strokeRect(w / 2 - u(PW_ / 2) - u(0.06), u(L0.dTop) - u(0.06), u(PW_) + u(0.12), u(PH_) + u(0.12));
    px.font = `500 ${u(0.24)}px "IBM Plex Mono", monospace`; px.textAlign = 'center'; px.fillStyle = 'rgba(42,21,70,0.6)';
    px.fillText('BOB CHUNG  ·  BC—2006', w / 2, u(L0.dBot + 0.5));
  }
  const ptex = new THREE.CanvasTexture(pc);
  ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 8;
  const tun = brainTunnel(), real = brainTunnel();
  real.group.visible = false;
  scene.add(real.group);
  const tunRT = new THREE.WebGLRenderTarget(Math.round(W * dpr), Math.round(H * dpr), { type: THREE.HalfFloatType, samples: 4 });
  const SU = {
    uWorks: { value: pageTexture() }, uPrint: { value: ptex }, uTun: { value: tunRT.texture }, uRes: { value: new THREE.Vector2(W * dpr, H * dpr) },
    uL: { value: SL }, uSW: { value: SW }, uPW: { value: PW_ }, uPH: { value: PH_ }, uWTop: { value: L0.wTop }, uDTop: { value: L0.dTop },
    uPaper: { value: 0 }, uInkR: { value: 0 }, uTunOn: { value: 0 }, uTime: { value: 0 },
  };
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(SW, SL), new THREE.ShaderMaterial({
    uniforms: SU, side: THREE.DoubleSide, transparent: true, clippingPlanes: [new THREE.Plane(V(0, 1, 0), -slotY)],
    vertexShader: 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D uWorks, uPrint, uTun; uniform vec2 uRes; uniform float uL, uSW, uPW, uPH, uWTop, uDTop, uPaper, uInkR, uTunOn, uTime;
      varying vec2 vUv; varying vec3 vWP;
      float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float s = (1.0 - vUv.y) * uL, x = (vUv.x - 0.5) * uSW;
        if (vWP.y < ${slotY.toFixed(3)}) discard; // still inside the printer
        vec4 pr = texture2D(uPrint, vUv);
        if (pr.a < 0.5) discard; // the sprocket holes
        // the paper, lit from the top left and in shade where it comes out of the slot (written as it shows)
        float shade = (0.8 + 0.07 * (1.0 - smoothstep(-6.0, 6.0, x))) * (0.72 + 0.28 * smoothstep(0.0, 2.5, vWP.y - (${slotY.toFixed(3)})));
        vec3 col = pow(max(pr.rgb, 0.0), vec3(1.0 / 2.2)) * shade;
        float alpha = 1.0;
        // the works, as a print: exactly the room at first; the paper and its grain come up as you pull away
        if (s > uWTop && s < uWTop + uPH && abs(x) < uPW * 0.5) {
          vec2 wuv = vec2(x / uPW + 0.5, 1.0 - (s - uWTop) / uPH);
          vec3 w = texture2D(uWorks, wuv).rgb;
          float g = (hash(floor(wuv * vec2(1800.0, 1000.0))) - 0.5) * 0.04;
          vec3 printed = w * vec3(0.94, 0.9, 0.86) + vec3(0.012, 0.01, 0.008) + g * 0.3;
          col = mix(w, printed, uPaper);
        }
        // the way in: drawn in ink, with real depth behind it; the ink spreads from the middle and turns to light
        if (s > uDTop && s < uDTop + uPH && abs(x) < uPW * 0.5) {
          vec3 t = texture2D(uTun, gl_FragCoord.xy / uRes).rgb * uTunOn;
          float lum = clamp(max(t.r, max(t.g, t.b)) * 1.3, 0.0, 1.0);
          col = mix(col, vec3(0.1, 0.05, 0.16), lum * 0.92);
          // where the ink has spread the paper is gone, and the shaft behind it is the real thing
          vec2 q = vec2(x, (uDTop + uPH * 0.5) - s);
          float edge = length(q * vec2(0.8, 1.0)) + (noise(q * 3.0) - 0.5) * 0.9 + (noise(q * 11.0) - 0.5) * 0.25;
          float spread = (1.0 - smoothstep(uInkR - 0.3, uInkR, edge)) * step(0.01, uInkR);
          float rim = (1.0 - smoothstep(0.0, 0.45, abs(edge - uInkR + 0.25))) * step(0.01, uInkR);
          col = mix(col, vec3(0.05, 0.025, 0.08), rim * 0.9);
          alpha = 1.0 - spread;
        }
        gl_FragColor = vec4(col, alpha);

      }`,
  }));
  sheet.layers.set(1);
  scene.add(sheet);
  // drawn with the sheet too, so they sit in front of it: the rollers and sprockets at the slot
  machine.traverse((o) => { if (o.isMesh && /^(roller|sprocket)/.test(o.name)) o.layers.enable(1); });
  const yTopAt = (rise) => s0 + rise; // the sheet's top edge
  const place = (rise) => { sheet.position.set(0, yTopAt(rise) - SL / 2, 0); };

  // ---------------------------------------------------------------- the coin: the one you came out through
  const R0 = 1.3, CZ = D - 0.5;
  const big = coin();
  const bigMats = [];
  big.traverse((o) => { if (o.isMesh && !bigMats.includes(o.material)) bigMats.push(o.material); });
  big.scale.setScalar(R0);
  scene.add(big);
  big.traverse((o) => o.layers.enable(1));
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 26, 2);
  coinLight.layers.enableAll();
  scene.add(coinLight);
  const coinPlane = new THREE.Plane(V(0, 1, 0), -CS.y);

  // ---------------------------------------------------------------- when it prints: the sheet's rise against scroll
  const FEEDS = [
    [0.95, outFor(L0.hTop + LH)], // what I studied
    ...[0, 1, 2, 3].map((i) => [1.1 + 0.15 * i, outFor(L0.lines[i] + LH)]),
    [1.72, outFor(L0.dTop)], // the way in: its caption
    [1.82, outFor(L0.dBot + 0.6)], // and the drawing, slower
  ];
  const riseAt = (r) => {
    let rise = 0, prev = 0;
    FEEDS.forEach(([t, to], i) => {
      const len = i === FEEDS.length - 1 ? 0.2 : 0.07;
      rise += (Math.max(to, prev) - prev) * smoother((r - t) / len);
      prev = Math.max(to, prev);
    });
    return rise;
  };
  const RISE_END = riseAt(9);
  const yD = yTopAt(RISE_END) - (L0.dTop + PH_ / 2); // the drawing's middle once it is all out
  tun.group.position.set(0, yD, -0.4);
  real.group.position.set(0, yD, -0.4);

  // ---------------------------------------------------------------- the picture
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.4, 0.5, 0.85);
  composer.addPass(bloom);
  const post = new ShaderPass(GLITCH);
  composer.addPass(post);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-frame { opacity: 0; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-big { position: fixed; left: var(--gutter, 30px); top: 44%; margin: 0; max-width: 300px; opacity: 0; }
    .st-big span { display: block; color: #efb53d; }
    .st-big b { display: block; font: 800 34px/1 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 8px 0 6px; }
    .st-big em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 40px); right: var(--gutter, 30px); margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; text-align: right; }
    .st-list li { opacity: 0.35; transition: opacity .4s; }
    .st-list li span { display: block; color: #efb53d; }
    .st-list li b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-list li.in { opacity: 1; }
    .st-list li.in b::after { content: ' · printed'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #06050a; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <div class="st-frame"><p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4</p>
  <ol class="st-list m">${STUDIES.map((s, i) => `<li><span>${s.n}</span><b>${NAMES[i]}</b></li>`).join('')}</ol></div>
  <p class="st-big"><span class="m"></span><b></b><em></em></p>
  <div class="st-end"><p class="m">Into the brain, as it is now</p></div>`;
  hudParent.append(hud);
  const frameEl = hud.querySelector('.st-frame'), listEls = [...hud.querySelectorAll('.st-list li')], bigEl = hud.querySelector('.st-big'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n');
  const pitchTo = (from, to) => { const d = to.clone().sub(from); return Math.atan2(d.y, Math.hypot(d.x, d.z)); };
  const say = (span, b, em, a) => { bigEl.querySelector('span').textContent = span; bigEl.querySelector('b').textContent = b; bigEl.querySelector('em').textContent = em; bigEl.style.opacity = String(a); };

  const HPOS = V(0, -1.2, 30), HLOOK = V(0, -5.6, 0);
  const F = V(0, yD, D);
  const push = [[2.3, D, 0], [2.42, 0, -140], [2.62, -40, 0]];

  return {
    scene, camera,
    press() { return false; },
    update({ r, time }) {
      // ================================================================ the sheet
      const rise = riseAt(r);
      place(rise);
      SU.uWorks.value = pageTexture();
      SU.uTime.value = time;
      SU.uPaper.value = ease((r - 0.06) / 0.4);
      SU.uInkR.value = 11 * Math.pow(ease((r - 2.2) / 0.16), 1.3);
      const drawingOut = rise > outFor(L0.dTop) - 0.01;
      SU.uTunOn.value = drawingOut ? 1 : 0;

      // ================================================================ the coin drops into its slot; it wakes
      const fall = clamp((r - 0.42) / 0.3);
      const yIn = CS.y - R0 * 2.6;
      if (r < 0.76) {
        const settle = ease((r - 0.26) / 0.14) * (1 - fall);
        big.position.set(0, (fall > 0 ? yIn * fall * fall : 0) + Math.sin(time * 1.1) * 0.05 * settle, lerp(CZ, CS.z, smoother(fall / 0.6)));
        big.rotation.set(Math.sin(time * 0.7) * 0.05 * settle, Math.sin(time * 0.5) * 0.12 * settle, Math.sin(fall * Math.PI) * 0.08);
        bigMats.forEach((m) => (m.clippingPlanes = fall > 0 ? [coinPlane] : null));
        big.visible = true;
        coinLight.position.copy(big.position).add(V(-1.5, 2.5, 4)); coinLight.intensity = 18;
      } else { big.visible = false; coinLight.intensity = 0; }
      const on = ease((r - 0.72) / 0.1);
      fx.U.uOn.value = on;
      M.lamp.emissiveIntensity = 0.4 + 1.8 * on;

      // ================================================================ the camera: out to the printer; then to the drawing, and through it
      const pull = smoother(r / 0.9);
      const lookDip = bump((r - 0.4) / 0.42) * 1.4;
      const pos = V(0, HPOS.y * pull, lerp(D, HPOS.z, pull));
      const look = V(0, HLOOK.y * pull - lookDip, 0);
      // while it prints, rise a little with the paper
      const follow = ease((r - 0.95) / 0.8) * 1.2;
      pos.y += follow; look.y += follow;
      const toF = smoother((r - 1.95) / 0.32);
      pos.lerp(F, toF);
      look.lerp(V(0, yD, 0), toF);
      if (r > 2.3) pos.z = track(r, push);
      camera.position.copy(pos);
      camera.rotation.set(pitchTo(pos, look), 0, 0);
      camera.updateMatrixWorld();
      const through = pos.z < -0.01;
      real.group.visible = r > 2.18;
      machine.visible = facePlane.visible = r < 2.2; // behind the paper by then; only the shaft is through the hole
      this._tun = drawingOut && r < 2.4 && !through;
      this._sheet = !through;

      // ================================================================ its face: it watches the paper come out
      const blinkPh = (time + 0.4) % 3.6;
      const printing = FEEDS.some(([t]) => r > t && r < t + 0.08) || (r > 1.82 && r < 2.02);
      const happy = FEEDS.slice(1, 5).some(([t]) => r > t + 0.08 && r < t + 0.13) || (r > 0.84 && r < 0.92);
      fx.draw({ lookX: r > 1.95 ? 0 : Math.sin(time * 0.37) * 0.25, lookY: printing ? -0.9 : r > 1.95 ? -0.6 : Math.sin(time * 0.29) * 0.2, blink: blinkPh < 0.14 ? Math.sin((blinkPh / 0.14) * Math.PI) : 0, happy: happy ? 1 : 0 });

      // ================================================================ the room: the post-processing goes as you go into the brain
      post.uniforms.uTime.value = time;
      post.uniforms.uVig.value = ease((r - 0.05) / 0.3) * (1 - ease((r - 2.22) / 0.14));
      bloom.strength = 0.4 * ease((r - 0.05) / 0.4);

      // ================================================================ HUD
      let inCount = 0;
      FEEDS.slice(1, 5).forEach(([t], i) => { const done = r > t + 0.06; if (done) inCount++; listEls[i].classList.toggle('in', done); });
      countEl.textContent = String(inCount);
      frameEl.style.opacity = String(ease((r - 0.9) / 0.08) * (1 - ease((r - 1.75) / 0.08)));
      if (r > 0.78 && r < 0.98) say('The coin goes in', 'It printed what it saw', 'Everything I built, on paper. Now, what I studied.', Math.sin(clamp((r - 0.78) / 0.2) * Math.PI) * 1.4);
      else if (r > 1.84 && r < 2.14) say('The last thing it prints', 'The way in', 'Look closer.', Math.sin(clamp((r - 1.84) / 0.3) * Math.PI) * 1.4);
      else bigEl.style.opacity = '0';
      endEl.style.opacity = String(ease((r - 2.58) / 0.12));
      return { inserted: inCount };
    },
    render() {
      const tm = renderer.toneMapping, ex = renderer.toneMappingExposure;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      if (this._tun) {
        renderer.setRenderTarget(tunRT);
        renderer.render(tun.scene, camera);
        renderer.setRenderTarget(null);
      }
      camera.layers.set(0);
      composer.render();
      if (this._sheet) {
        // the sheet (with the coin and the rollers), straight to the screen, over the picture
        const ac = renderer.autoClear, bg = scene.background, fog = scene.fog;
        camera.layers.set(1);
        renderer.setRenderTarget(null);
        renderer.autoClear = false;
        renderer.clearDepth();
        scene.background = null; scene.fog = null;
        renderer.render(scene, camera);
        scene.background = bg; scene.fog = fog;
        renderer.autoClear = ac;
        camera.layers.set(0);
      }
      renderer.toneMapping = tm;
      renderer.toneMappingExposure = ex;
    },
  };
}
