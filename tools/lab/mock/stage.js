// LAB ONLY (throwaway). The robot beat, round 41. Two armoured hands tear the works dimension open like a page; behind it
// a robot's face, a dark screen full of interference. Its hand holds the four study coins over its glowing palm; each press
// tosses one, flipping, into the slot on top of its head, and the picture on its face clears. The last coin takes you
// with it: into the slot, down a shaft of gold traces, onto the CPU socket, where the brain sits in the coin's square hole.
// Original designs: the hands are sleek plated gauntlets in the site's dark metal and gold, the head a soft rounded robot
// with a screen for a face.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { C, coin } from './kit.js';

export const STUDIES = [
  { n: '02', name: 'Software engineering', line: 'Makes it think.', glyph: 'software' },
  { n: '03', name: 'Game & app development', line: 'Makes it playable.', glyph: 'game' },
  { n: '04', name: 'Cybersecurity', line: 'Keeps it safe.', glyph: 'security' },
  { n: '05', name: 'Mechatronics', line: 'Makes it move. Still being minted.', glyph: 'gear', fresh: true },
];
const PATHS = {
  software: 'M38 18 L8 50 L38 82 L48 72 L27 50 L48 28 Z M62 18 L92 50 L62 82 L52 72 L73 50 L52 28 Z',
  game: 'M37 10 H63 V37 H90 V63 H63 V90 H37 V63 H10 V37 H37 Z',
  security: 'M50 6 L88 20 V48 C88 70 72 86 50 95 C28 86 12 70 12 48 V20 Z',
};
const GLOW = new THREE.Color(C.glow);
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const lerp = THREE.MathUtils.lerp;

// ------------------------------------------------------------------ the gauntlet: plated, jointed, a light in the palm
const POSES = {
  claw: { curl: [[0.18, 0.3, 0.25], [0.15, 0.28, 0.22], [0.18, 0.3, 0.25], [0.22, 0.32, 0.25]], thumb: [0.5, 0.25, 0.2], spread: 0.07 },
  grip: { curl: [[0.95, 1.15, 0.85], [0.95, 1.15, 0.85], [1.0, 1.15, 0.85], [1.05, 1.15, 0.85]], thumb: [0.9, 0.5, 0.4], spread: 0.02 },
  open: { curl: [[0.12, 0.12, 0.08], [0.08, 0.1, 0.08], [0.12, 0.12, 0.08], [0.18, 0.14, 0.1]], thumb: [0.35, 0.12, 0.08], spread: 0.09 },
  flick: { curl: [[0.55, 0.6, 0.4], [0.45, 0.5, 0.35], [0.5, 0.55, 0.4], [0.6, 0.6, 0.4]], thumb: [0.7, 0.4, 0.3], spread: 0.05 },
};
function gauntlet() {
  const gun = new THREE.MeshPhysicalMaterial({ color: '#4a4654', metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
  const plate = new THREE.MeshPhysicalMaterial({ color: '#6a6475', metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0d0b11', metalness: 0.7, roughness: 0.45 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#d4a253', metalness: 1, roughness: 0.22 });
  const light = new THREE.MeshStandardMaterial({ color: '#2a1d08', emissive: GLOW.clone(), emissiveIntensity: 2.2 });
  const fgun = gun.clone(), fplate = plate.clone(), fdark = dark.clone();
  const hand = new THREE.Group();
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // The cuff, cut by whatever the hand comes through; a gold band where it meets the wrist.
  add(hand, new THREE.CylinderGeometry(0.42, 0.45, 1.0, 56), plate, 0, -0.66, 0);
  add(hand, new THREE.CylinderGeometry(0.435, 0.435, 0.05, 56), gold, 0, -0.18, 0);
  add(hand, new THREE.TorusGeometry(0.445, 0.012, 8, 64), dark, 0, -0.55, 0).rotation.x = Math.PI / 2;
  add(hand, new THREE.CylinderGeometry(0.33, 0.36, 0.34, 44), dark, 0, 0.02, 0);
  // Palm and the plates over the back of the hand, in two layers; a gold seam between them.
  add(hand, new RoundedBoxGeometry(1.0, 1.08, 0.36, 6, 0.14), gun, 0, 0.62, 0);
  add(hand, new RoundedBoxGeometry(0.96, 0.56, 0.1, 5, 0.05), plate, 0, 0.4, -0.21).rotation.x = -0.12;
  add(hand, new RoundedBoxGeometry(1.0, 0.5, 0.1, 5, 0.05), plate, 0, 0.84, -0.22).rotation.x = 0.1;
  add(hand, new RoundedBoxGeometry(0.62, 0.025, 0.03, 2, 0.01), gold, 0, 0.62, -0.28);
  // The light in the palm.
  const emitter = add(hand, new THREE.CylinderGeometry(0.19, 0.19, 0.04, 48), light, 0, 0.6, 0.18);
  emitter.rotation.x = Math.PI / 2;
  add(hand, new THREE.TorusGeometry(0.25, 0.022, 10, 56), gold, 0, 0.6, 0.18);
  const lengths = [[0.46, 0.34, 0.26], [0.52, 0.38, 0.28], [0.5, 0.36, 0.27], [0.42, 0.3, 0.23]];
  const fingers = lengths.map((ls, f) => {
    const base = new THREE.Group();
    base.position.set(-0.36 + f * 0.24, 1.17, 0);
    hand.add(base);
    let parent = base;
    const joints = ls.map((len, s) => {
      add(parent, new THREE.CylinderGeometry(0.085, 0.085, 0.2, 24), fdark).rotation.z = Math.PI / 2;
      const seg = new THREE.Group();
      parent.add(seg);
      add(seg, new RoundedBoxGeometry(0.16, len, 0.17, 3, 0.06), fgun, 0, len / 2 + 0.03, 0);
      add(seg, new RoundedBoxGeometry(0.19, len * 0.86, 0.07, 3, 0.03), fplate, 0, len / 2 + 0.03, -0.09);
      if (s === 2) add(seg, new THREE.SphereGeometry(0.09, 20, 12), fplate, 0, len + 0.02, -0.01).scale.set(1, 0.7, 1);
      const next = new THREE.Group();
      next.position.y = len + 0.06;
      seg.add(next);
      parent = next;
      return seg;
    });
    return { base, joints };
  });
  const tb = new THREE.Group();
  tb.position.set(-0.52, 0.42, 0.08);
  hand.add(tb);
  let parent = tb;
  const thumbJoints = [0.42, 0.32, 0.25].map((len, s) => {
    add(parent, new THREE.CylinderGeometry(0.095, 0.095, 0.22, 24), fdark).rotation.z = Math.PI / 2;
    const seg = new THREE.Group();
    parent.add(seg);
    add(seg, new RoundedBoxGeometry(0.19, len, 0.2, 3, 0.06), fgun, 0, len / 2 + 0.03, 0);
    add(seg, new RoundedBoxGeometry(0.21, len * 0.8, 0.07, 3, 0.03), fplate, 0, len / 2 + 0.03, -0.1);
    const next = new THREE.Group();
    next.position.y = len + 0.06;
    seg.add(next);
    parent = next;
    return seg;
  });
  hand.userData = { fingers, thumb: { base: tb, joints: thumbJoints }, light, body: [gun, plate, dark, gold, light] };
  return hand;
}
function pose(hand, a, b, f) {
  const { fingers, thumb } = hand.userData;
  const A = POSES[a], B = POSES[b] ?? A;
  fingers.forEach((fg, i) => {
    fg.base.rotation.z = (1.5 - i) * lerp(A.spread, B.spread, f);
    fg.joints.forEach((j, s) => (j.rotation.x = lerp(A.curl[i][s], B.curl[i][s], f)));
  });
  thumb.base.rotation.set(0.3, 0, lerp(A.thumb[0], B.thumb[0], f));
  thumb.joints.forEach((j, s) => (j.rotation.x = s === 0 ? 0.2 : lerp(A.thumb[s], B.thumb[s], f)));
}

// ------------------------------------------------------------------ the study coins: one mark each, the last one newly minted
function markGeometry(name, size = 0.36, depth = 0.04) {
  let shapes;
  if (name === 'gear') {
    const s = new THREE.Shape(), teeth = 8;
    for (let i = 0; i <= teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2, r = i % 4 < 2 ? 46 : 34;
      const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    const h = new THREE.Path();
    h.absarc(50, 50, 15, 0, Math.PI * 2, true);
    s.holes.push(h);
    shapes = [s];
  } else {
    const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${PATHS[name]}"/></svg>`);
    shapes = data.paths.flatMap((p) => p.toShapes(true));
  }
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
  g.translate(-50, -50, 0);
  g.scale(size / 100, -size / 100, 1);
  g.computeVertexNormals();
  return g;
}
function studyCoin(study) {
  const g = coin();
  const [body, high] = g.userData.materials;
  if (study.fresh) {
    for (const m of [body, high]) { m.map = null; m.roughnessMap = null; m.needsUpdate = true; }
    body.color.set('#c99a55'); body.roughness = 0.3;
    high.color.set('#f2c674'); high.roughness = 0.14;
  }
  for (const face of g.children.filter((c) => c.isGroup)) {
    face.children.slice(2).forEach((m) => face.remove(m));
    const lit = high.clone();
    lit.emissive = GLOW.clone();
    lit.emissiveIntensity = 0.55;
    for (const [y, r] of [[0.67, 0], [-0.67, Math.PI]]) {
      const m = new THREE.Mesh(markGeometry(study.glyph), lit);
      m.position.set(0, y, 0);
      m.rotation.z = r;
      face.add(m);
    }
  }
  return g;
}

// ------------------------------------------------------------------ the face: a dark screen, two eyes, and interference until it has power
function faceText() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  let last = '';
  return {
    tex,
    draw(top, bottom) {
      const key = top + '|' + bottom;
      if (key === last) return;
      last = key;
      x.clearRect(0, 0, 1024, 512);
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.font = '500 64px "IBM Plex Mono"';
      x.fillText(top, 512, 120);
      x.font = '500 40px "IBM Plex Mono"';
      x.fillText(bottom, 512, 440);
      tex.needsUpdate = true;
    },
  };
}
function faceMaterial(text) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSignal: { value: 0 }, uOn: { value: 0 }, uBlink: { value: 0 }, uHappy: { value: 0 }, uKick: { value: 0 }, uLook: { value: new THREE.Vector2() }, uText: { value: text.tex }, uTextOn: { value: 1 }, uAsp: { value: 1.5 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime, uSignal, uOn, uBlink, uHappy, uKick, uTextOn, uAsp; uniform vec2 uLook; uniform sampler2D uText;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float seg(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
      // One eye: a tilted pill, squashed by a blink; happy, it bends into an arc.
      float eye(vec2 p, float side){
        p.x *= side;
        float tilt = 0.22;
        p = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p;
        float h = mix(0.13, 0.008, uBlink);
        float pill = seg(p, vec2(0.0, -h), vec2(0.0, h), 0.085);
        float arc = abs(length(p - vec2(0.0, -0.11)) - 0.14) - 0.035;
        arc = max(arc, -(p.y - 0.0 + 0.02));
        return mix(pill, arc, uHappy);
      }
      float eyes(vec2 p){
        vec2 e = uLook * vec2(0.09, 0.06) * uOn;
        return min(eye(p - vec2(-0.36, 0.03) - e, -1.0), eye(p - vec2(0.36, 0.03) - e, 1.0));
      }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0);
        if (rbox(p, vec2(uAsp * 0.5, 0.5), 0.16) > 0.0) discard;
        float bad = 1.0 - uSignal;
        // Interference: rows that slip, a rolling bar, snow, colour that will not line up.
        float row = floor(vUv.y * 110.0), tick = floor(uTime * 22.0);
        float slip = (hash(vec2(row, tick)) - 0.5) * 0.18 * bad * step(0.72, hash(vec2(row * 1.7, floor(uTime * 7.0))));
        slip += sin(vUv.y * 40.0 + uTime * 30.0) * 0.004 * bad + uKick * (hash(vec2(row, tick + 3.0)) - 0.5) * 0.12;
        vec2 q = p + vec2(slip, 0.0);
        float split = 0.012 + 0.03 * bad + uKick * 0.03;
        float dr = eyes(q + vec2(split, 0.0)), dg = eyes(q), db = eyes(q - vec2(split, 0.0));
        vec3 glow = vec3(${GLOW.r.toFixed(3)}, ${GLOW.g.toFixed(3)}, ${GLOW.b.toFixed(3)});
        float flick = mix(step(0.55, hash(vec2(row * 0.3, floor(uTime * 12.0)))) * 0.8 + 0.2, 1.0, uSignal);
        vec3 lit = vec3(1.0 - smoothstep(0.0, 0.01, dr), 1.0 - smoothstep(0.0, 0.01, dg), 1.0 - smoothstep(0.0, 0.01, db));
        vec3 halo = vec3(exp(-max(dr, 0.0) * 22.0), exp(-max(dg, 0.0) * 22.0), exp(-max(db, 0.0) * 22.0));
        vec3 col = vec3(0.012, 0.01, 0.018);
        col += (lit * 1.4 + halo * 0.35) * glow * flick * mix(0.35, 1.0, uSignal) * (0.6 + 0.4 * uOn);
        float bar = smoothstep(0.0, 0.25, fract(vUv.y * 0.7 - uTime * 0.25)) * (1.0 - smoothstep(0.25, 0.4, fract(vUv.y * 0.7 - uTime * 0.25)));
        col += vec3(0.5, 0.45, 0.65) * bar * 0.12 * bad;
        float snow = hash(floor(vUv * vec2(320.0, 200.0)) + tick * 13.1);
        col += vec3(snow) * (0.06 + 0.22 * bad) * bad;
        // The words: NO SIGNAL, then the credits, slipping with the rows.
        vec4 tx = texture2D(uText, vec2(vUv.x + slip * 0.5, vUv.y));
        col += vec3(0.85, 0.82, 0.95) * tx.a * uTextOn * (0.5 + 0.5 * flick);
        // Scan lines and a glassy sheen.
        col *= 0.88 + 0.12 * sin(vUv.y * 600.0);
        col += vec3(0.06, 0.055, 0.08) * smoothstep(0.35, 0.0, abs(vUv.x - vUv.y * 0.55 - 0.18)) * 0.6;
        col += glow * uKick * 0.25;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ------------------------------------------------------------------ the tunnel inside, and the socket at the bottom
function circuitMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime; varying vec2 vUv; varying float vY;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 g = vUv * vec2(48.0, 160.0);
        vec2 id = floor(g), f = fract(g);
        float h = hash(id), h2 = hash(id + 7.3);
        float trace = 0.0;
        if (h < 0.55) trace = 1.0 - smoothstep(0.04, 0.09, abs(f.x - 0.5));         // runs along the shaft
        else if (h < 0.75) trace = 1.0 - smoothstep(0.04, 0.09, abs(f.y - 0.5));    // across it
        float pad = (1.0 - smoothstep(0.12, 0.18, length(f - 0.5))) * step(0.86, h2);
        // Pulses running down the long traces.
        float pulse = h < 0.55 ? smoothstep(0.92, 1.0, fract(vUv.y * 6.0 + uTime * (0.6 + h2) + h * 10.0)) : 0.0;
        vec3 base = vec3(0.016, 0.01, 0.026);
        vec3 col = base + vec3(0.42, 0.3, 0.12) * (trace * 0.35 + pad * 0.6) + vec3(1.0, 0.75, 0.35) * pulse * trace * 2.2;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
function socketTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0a10'; x.fillRect(0, 0, 1024, 1024);
  let sd = 9; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.strokeStyle = 'rgba(214,162,83,0.55)'; x.lineWidth = 3;
  for (let i = 0; i < 90; i++) {
    const side = i % 4, t = 120 + rnd() * 784;
    const [sx, sy] = side === 0 ? [t, 0] : side === 1 ? [1024, t] : side === 2 ? [t, 1024] : [0, t];
    x.beginPath(); x.moveTo(sx, sy);
    const mx = side % 2 === 0 ? sx : 512 + (sx > 512 ? 300 : -300), my = side % 2 === 0 ? 512 + (sy > 512 ? 300 : -300) : sy;
    x.lineTo(mx, my); x.lineTo(512 + (mx - 512) * 0.62, 512 + (my - 512) * 0.62); x.stroke();
  }
  x.fillStyle = '#16131c'; x.fillRect(272, 272, 480, 480);
  x.fillStyle = 'rgba(214,162,83,0.9)';
  for (let i = 0; i < 18; i++) for (let j = 0; j < 18; j++) { if (i > 3 && i < 14 && j > 3 && j < 14) continue; x.beginPath(); x.arc(290 + i * 26, 290 + j * 26, 5, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = 'rgba(239,181,61,0.9)'; x.lineWidth = 4; x.strokeRect(372, 372, 280, 280);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
/** A brain, seen as the brain section sees it: an X-ray in gold, folds and all. */
function brain() {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const a = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) {
    v.fromBufferAttribute(a, i);
    const fold = Math.abs(Math.sin(v.x * 9.0 + Math.sin(v.y * 7.0) * 1.6) * Math.sin(v.z * 8.0 + Math.cos(v.x * 6.0) * 1.4));
    const gap = Math.exp(-Math.pow(v.x / 0.08, 2)) * 0.12 * (v.y > -0.3 ? 1 : 0);
    v.multiplyScalar(1 + fold * 0.07 - gap);
    v.set(v.x * 0.82, v.y * 0.7, v.z * 1.05);
    a.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uA; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(vec3(1.0, 0.74, 0.32) * (f * 1.6 + 0.08) * uA, 1.0); }`,
  }));
}

// ------------------------------------------------------------------ the stage
export async function createStage(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#040308');
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  pm.dispose();
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 400);
  const D = 10, PH_ = 2 * D * Math.tan((20 * Math.PI) / 180), PW_ = PH_ * (W / H);
  camera.position.set(0, 0, D);
  const key = new THREE.DirectionalLight('#fff0dd', 2.2);
  key.position.set(-5, 6, 8);
  const rim = new THREE.DirectionalLight('#a582ff', 3.0);
  rim.position.set(6, 3, -8);
  const under = new THREE.PointLight(C.glow, 0, 0, 2);
  const fingerKey = new THREE.DirectionalLight('#ffe6c8', 2.4);
  fingerKey.position.set(2, 3, 9);
  scene.add(key, rim, under, fingerKey, new THREE.HemisphereLight('#3a2a5a', '#06040a', 0.6));

  // ---------------------------------------------------------------- the page: the works dimension, torn down the middle
  const tear = (y) => 0.22 * Math.sin(y * 1.6 + 0.7) + 0.09 * Math.sin(y * 4.1 + 2.0) + 0.035 * Math.sin(y * 11.3);
  const TEAR = 'float tearX(float y){ return 0.22 * sin(y * 1.6 + 0.7) + 0.09 * sin(y * 4.1 + 2.0) + 0.035 * sin(y * 11.3) + 0.018 * sin(y * 37.0) + 0.01 * sin(y * 71.0 + 1.0); }';
  const halves = [-1, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PW_, PH_, 180, 100), new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTex: { value: pageTexture() }, uSide: { value: side }, uAng: { value: 0 }, uTx: { value: 0 }, uBend: { value: 0 }, uGap: { value: 0 }, uCrack: { value: 0 }, uW: { value: PW_ }, uH: { value: PH_ }, uTime: { value: 0 }, uAsp: { value: W / H } },
      vertexShader: `${TEAR}
        uniform float uSide, uAng, uTx, uBend, uW;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          // A little paper: the torn edge lifts as it is pulled.
          p.z += uBend * exp(-abs(p.x - tearX(p.y)) * 0.8) * 0.3;
          float hinge = uSide * uW * 0.5, a = uSide * uAng;
          vec3 v = p - vec3(hinge, 0.0, 0.0);
          p = vec3(v.x * cos(a) + v.z * sin(a), v.y, -v.x * sin(a) + v.z * cos(a)) + vec3(hinge + uSide * uTx, 0.0, 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `${TEAR}
        uniform sampler2D uTex; uniform float uSide, uGap, uCrack, uW, uH, uTime, uAsp;
        varying vec2 vUv;
        void main(){
          float x = (vUv.x - 0.5) * uW, y = (vUv.y - 0.5) * uH;
          float tx = tearX(y);
          // The crack runs down from the top; the tear opens along it.
          float run = smoothstep(0.0, 0.25, (uH * 0.5 - y) - (1.0 - uCrack) * (uH + 0.3) + 0.3);
          float sd = (x - tx) * uSide - uGap * 0.5 * run;
          if (sd < 0.0 && run > 0.5 && uGap > 0.001) discard;
          vec2 c = vUv - 0.5;
          vec3 col = texture2D(uTex, vUv).rgb;
          col *= 1.0 - smoothstep(0.45, 1.15, length(c * vec2(uAsp, 1.0))) * 0.7;
          float e = abs(sd);
          float lineOn = run * step(0.001, uCrack);
          col += vec3(1.0, 0.76, 0.38) * exp(-e * 70.0) * lineOn * 1.6 + vec3(0.62, 0.45, 1.0) * exp(-e * 14.0) * lineOn * 0.35;
          float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
          col += (g - 0.5) * 0.028;
          if (!gl_FrontFacing) col = vec3(0.02, 0.016, 0.03) + vec3(1.0, 0.76, 0.38) * exp(-e * 30.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });

  // ---------------------------------------------------------------- the robot: a soft rounded head, a screen for a face, a slot on top
  const head = new THREE.Group();
  head.position.set(-0.9, 0.25, -4.2);
  const shell = new THREE.MeshPhysicalMaterial({ color: '#ece7f3', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: new THREE.Color('#d9ccff') });
  const violet = new THREE.MeshPhysicalMaterial({ color: '#8d5bd6', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(head, new RoundedBoxGeometry(3.5, 2.95, 2.9, 10, 1.15), shell);
  add(head, new RoundedBoxGeometry(2.1, 0.55, 1.9, 8, 0.27), violet, 0, 1.36, -0.05);
  for (const sx of [-1, 1]) add(head, new THREE.CylinderGeometry(0.42, 0.42, 0.24, 48), violet, sx * 1.76, 0.0, 0).rotation.z = Math.PI / 2;
  const slotRim = new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 0.6 });
  add(head, new RoundedBoxGeometry(1.0, 0.06, 0.26, 3, 0.03), slotRim, 0, 1.64, -0.05);
  add(head, new RoundedBoxGeometry(0.86, 0.08, 0.13, 3, 0.03), new THREE.MeshStandardMaterial({ color: '#000' }), 0, 1.655, -0.05);
  const text = faceText();
  const face = faceMaterial(text);
  const FW = 2.72, FH = 1.86;
  face.uniforms.uAsp.value = FW / FH;
  const fg = new THREE.PlaneGeometry(FW, FH, 40, 1);
  
  // The screen's dark glass frame, then the picture.
  add(head, (() => { const sh = new THREE.Shape(), w = (FW + 0.18) / 2, h = (FH + 0.18) / 2, rr = 0.34; sh.moveTo(-w + rr, -h); sh.lineTo(w - rr, -h); sh.quadraticCurveTo(w, -h, w, -h + rr); sh.lineTo(w, h - rr); sh.quadraticCurveTo(w, h, w - rr, h); sh.lineTo(-w + rr, h); sh.quadraticCurveTo(-w, h, -w, h - rr); sh.lineTo(-w, -h + rr); sh.quadraticCurveTo(-w, -h, -w + rr, -h); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }); g.translate(0, 0, -0.06); return g; })(), new THREE.MeshPhysicalMaterial({ color: '#09080c', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.4, envMapIntensity: 0.15 }), 0, -0.05, 1.47);
  const screen = add(head, fg, face, 0, -0.05, 1.565);
  screen.renderOrder = 1;
  scene.add(head);
  head.updateMatrixWorld(true);
  const slotTop = head.localToWorld(new THREE.Vector3(0, 1.66, -0.05));
  under.position.copy(head.position).add(new THREE.Vector3(0, -2.4, 1.2));

  // ---------------------------------------------------------------- the hands
  const HS_ = 1.35;
  const right = gauntlet();
  right.scale.setScalar(HS_);
  const leftRoot = new THREE.Group();
  leftRoot.scale.x = -1;
  const left = gauntlet();
  left.scale.setScalar(HS_);
  leftRoot.add(left);
  scene.add(right, leftRoot);
  const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  // Through the page: fingers toward you, palm facing out to its own side, so the fingers hook the torn edge.
  const qThrough = basis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1));
  // Holding the coins: palm up, fingers toward the head.
  const fy = new THREE.Vector3(-0.75, 0.12, -0.65).normalize(), fz0 = new THREE.Vector3(0, 1, 0);
  const fx = new THREE.Vector3().crossVectors(fy, fz0).normalize(), fz = new THREE.Vector3().crossVectors(fx, fy).normalize();
  const qPalm = basis(fx, fy, fz);

  // ---------------------------------------------------------------- the coins, floating over the palm
  const coins = STUDIES.map((s) => { const c = studyCoin(s); c.scale.setScalar(0.34); scene.add(c); return c; });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.2, 1.2, 48, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uTime; varying vec2 vUv;
      void main(){ float lines = 0.6 + 0.4 * sin(vUv.y * 40.0 - uTime * 4.0); gl_FragColor = vec4(vec3(1.0, 0.72, 0.3) * pow(1.0 - vUv.y, 1.5) * 0.12 * lines * uA, 1.0); }`,
  }));
  scene.add(beam);
  const palmLight = new THREE.PointLight(C.glow, 0, 0, 2);
  scene.add(palmLight);

  // ---------------------------------------------------------------- inside: the shaft, the socket, the brain
  const inside = new THREE.Group();
  inside.position.set(0, -200, 0);
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
  const insideLight = new THREE.PointLight(C.glow, 0, 0, 2);
  insideLight.position.set(0, -42, 0);
  inside.add(insideLight);
  scene.add(inside);

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'st';
  hud.innerHTML = `<style>
    .st { position: fixed; inset: 0; z-index: 13; pointer-events: none; color: #f2efe8; opacity: 0; font: 500 12px Barlow; }
    .st .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
    .st-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-press { position: fixed; left: 50%; bottom: calc(var(--gutter, 30px) + 6px); transform: translateX(-50%); margin: 0; display: flex; align-items: center; gap: 14px; transition: opacity .4s; }
    .st-press i { width: 34px; height: 34px; border-radius: 50%; border: 1px solid #efb53d; display: grid; place-items: center; animation: stp 1.6s infinite; }
    .st-press i::after { content: ''; width: 9px; height: 9px; border: 1.5px solid #efb53d; }
    .st-press b { font: 700 15px Barlow; letter-spacing: 0.06em; text-transform: uppercase; }
    .st-press span { color: rgb(242 239 232 / 0.55); }
    @keyframes stp { 0%, 100% { box-shadow: 0 0 0 0 rgb(239 181 61 / 0.5); } 50% { box-shadow: 0 0 0 10px rgb(239 181 61 / 0); } }
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 34px); right: var(--gutter, 30px); margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; text-align: right; }
    .st-tag { margin: 0; white-space: nowrap; opacity: 0.4; transition: opacity .5s; }
    .st-tag.next { opacity: 1; }
    .st-tag.in { opacity: 0.7; }
    .st-tag.in b::after { content: ' · in'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
    .st-tag span { display: block; color: #efb53d; margin-bottom: 3px; }
    .st-tag b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-tag em { display: block; font: 400 13px Barlow; font-style: normal; color: rgb(242 239 232 / 0.6); margin-top: 3px; }
    .st-fly { position: fixed; left: 0; top: 0; margin: 0; width: 280px; text-align: right; }
    .st-fly span { display: block; color: #efb53d; }
    .st-fly b { display: block; font: 800 26px/1.02 Barlow; letter-spacing: -0.01em; text-transform: uppercase; margin: 6px 0 6px; }
    .st-fly em { font: 400 15px Barlow; font-style: normal; color: rgb(242 239 232 / 0.7); }
    .st-end { position: fixed; inset: 0; display: grid; place-items: center; background: #000; opacity: 0; color: rgb(239 181 61 / 0.85); }
  </style>
  <p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4 in</p>
  <ol class="st-list">${STUDIES.map((s) => `<li class="st-tag m"><span>${s.n}</span><b>${s.name}</b></li>`).join('')}</ol>
  <p class="st-fly"><span class="m"></span><b></b><em></em></p>
  <p class="st-press"><i></i><b>Press to insert a coin</b><span class="m">Click or space</span></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const tags = [...hud.querySelectorAll('.st-tag')], fly = hud.querySelector('.st-fly'), press = hud.querySelector('.st-press'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n');
  const tmp = new THREE.Vector3();
  const proj = (v) => { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, tmp.z]; };

  // ---------------------------------------------------------------- the coin flight: a toss that flips into the slot
  const bez = (a, b, c, d, t) => { const u = 1 - t; return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
  const FLIGHT = 1.35, POVT = 9.4; // a coin's toss; after the last one: power on, go in, the shaft, the brain
  const flight = (from, t) => {
    const above = slotTop.clone().add(new THREE.Vector3(0, 0.42, 0));
    if (t < 0.82) {
      const f = ease(t / 0.82);
      return { pos: bez(from, from.clone().add(new THREE.Vector3(-0.3, 1.9, 0.4)), above.clone().add(new THREE.Vector3(0.5, 1.5, 0.4)), above, f), spin: f * Math.PI * 6 };
    }
    const f = clamp((t - 0.82) / 0.18);
    return { pos: above.clone().add(new THREE.Vector3(0, -0.9 * f * f, 0)), spin: Math.PI * 6 };
  };

  const pointer = new THREE.Vector2();
  addEventListener('pointermove', (e) => pointer.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1));
  let presses = [], blinkAt = 0;

  return {
    scene, camera, face, text,
    /** r: the tear, 0..1.25 by scroll; inserted / flying / pov can be fixed for stills. */
    press(now) {
      const flying = presses.length && now - presses[presses.length - 1] < FLIGHT;
      if (presses.length >= 4 || flying) return false;
      presses.push(now);
      return true;
    },
    ready: (r) => r >= 1.2,
    update({ r, time, fixed = null }) {
      halves.forEach((h) => { h.material.uniforms.uTex.value = pageTexture(); h.material.uniforms.uTime.value = time; });
      // ---- the tear (scroll)
      const crack = ease(r / 0.15), gap = 0.12 * ease((r - 0.12) / 0.15);
      const ang = 0.38 * ease((r - 0.34) / 0.4), tx = PW_ * 0.62 * Math.pow(ease((r - 0.36) / 0.56), 1.4), bend = ease((r - 0.28) / 0.25);
      halves.forEach((h) => { const u = h.material.uniforms; u.uCrack.value = crack; u.uGap.value = gap; u.uAng.value = ang; u.uTx.value = tx; u.uBend.value = bend; h.visible = tx < PW_ * 0.61; });
      const shake = r > 0 && r < 0.4 ? Math.sin(time * 70) * 0.02 * (1 - Math.abs(r - 0.2) / 0.2) : 0;
      // ---- the camera: holds the page, then moves in on the face once it is open
      const inF = ease((r - 0.72) / 0.5);
      camera.position.set(shake + lerp(0, 0.2, inF), lerp(0, 0.05, inF), lerp(D, 5.2, inF));
      camera.rotation.set(0, 0, 0);
      camera.updateMatrixWorld();
      // ---- the hands: from behind the page, each grips its torn edge (fingers curling round to the front) and goes
      // where that edge goes. Worked out for the right door; the left hand is its mirror.
      const push = ease((r - 0.1) / 0.18), hook = ease((r - 0.22) / 0.14);
      const door = new THREE.Matrix4().makeTranslation(PW_ / 2 + tx, 0, 0).multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(new THREE.Matrix4().makeTranslation(-PW_ / 2, 0, 0));
      const hold = (edgeX, y) => new THREE.Matrix4().compose(new THREE.Vector3(edgeX + 1.17 * HS_ + 0.1, y - 0.45, lerp(-2.6, -0.46, push) + bend * 0.3), qThrough, new THREE.Vector3(HS_, HS_, HS_));
      const yR = 0.55, yL = -0.4;
      door.clone().multiply(hold(tear(yR) + gap / 2, yR)).decompose(right.position, right.quaternion, right.scale);
      door.clone().multiply(hold(-(tear(yL) - gap / 2), yL)).decompose(left.position, left.quaternion, left.scale);
      leftRoot.position.x = 0;
      pose(right, 'open', 'grip', hook);
      pose(left, 'open', 'grip', hook);
      // Nothing of a hand but its fingers comes through the page.
      const behind = new THREE.Plane(new THREE.Vector3(0, 0, -1), -0.05).applyMatrix4(door);
      const behindL = behind.clone().applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
      const tearing = r < 1.0;
      right.userData.body.forEach((m) => (m.clippingPlanes = tearing ? [behind] : null));
      left.userData.body.forEach((m) => (m.clippingPlanes = [behindL]));
      leftRoot.visible = r > 0.08 && tx < PW_ * 0.61;
      // ---- after the tear: the right hand comes back, palm up, the coins over its light
      const back = ease((r - 1.0) / 0.22);
      const palmAt = new THREE.Vector3(3.0, -2.45, -0.4);
      let inserted = 0, flyI = -1, flyT = 0, pov = 0;
      if (fixed) { inserted = fixed.inserted; flyI = fixed.fly >= 0 ? inserted : -1; flyT = fixed.fly * FLIGHT; pov = fixed.pov; }
      else {
        presses.forEach((t0, i) => { const dt = time - t0; if (dt >= FLIGHT) inserted = i + 1; else { flyI = i; flyT = dt; } });
        if (presses.length === 4) pov = clamp((time - presses[3] - FLIGHT) / POVT);
      }
      if (r >= 1.0) {
        const toss = flyI >= 0 ? Math.max(0, 1 - Math.abs(flyT - 0.12) / 0.12) : 0;
        right.position.copy(palmAt).add(new THREE.Vector3(0.4, -3.4, 0.3).multiplyScalar(1 - back)).add(new THREE.Vector3(0, toss * 0.25, 0));
        right.quaternion.copy(qPalm);
        pose(right, 'open', 'flick', toss);
        right.visible = true;
      } else right.visible = r > 0.08 && tx < PW_ * 0.61;
      right.updateMatrixWorld(true);
      const palmCentre = right.localToWorld(new THREE.Vector3(0, 0.6, 0.6));
      right.userData.light.emissiveIntensity = 2.2 + back * 2;
      palmLight.position.copy(palmCentre).add(new THREE.Vector3(-0.4, 1.2, 1.0));
      palmLight.intensity = 6 * back;
      beam.visible = back > 0.01 && pov < 0.25;
      beam.position.copy(palmCentre).add(new THREE.Vector3(0, 0.62, 0));
      beam.material.uniforms.uA.value = back;
      beam.material.uniforms.uTime.value = time;
      // ---- the coins: a slow ring over the palm; the one in the air flips into the slot
      const ringC = palmCentre.clone().add(new THREE.Vector3(-0.35, 1.0, 0));
      coins.forEach((c, i) => {
        const a = THREE.MathUtils.degToRad(lerp(158, 92, i / 3));
        const nextUp = i === inserted && flyI < 0;
        const ringPos = palmCentre.clone().add(new THREE.Vector3(Math.cos(a) * 1.9, Math.sin(a) * 1.9 + Math.sin(time * 1.3 + i) * 0.05, 0.3 + (nextUp ? 0.25 : 0)));
        c.visible = back > 0.01 && i >= inserted;
        if (i === flyI) {
          const f = flight(ringPos, flyT / FLIGHT);
          c.position.copy(f.pos);
          c.rotation.set(f.spin, 0, 0);
          c.visible = flyT / FLIGHT < 0.97;
        } else {
          c.position.copy(ringPos).lerp(palmCentre.clone().add(new THREE.Vector3(0, -2.5, 0)), 1 - back);
          c.rotation.set(0.08, Math.sin(time * 0.8 + i * 1.3) * 0.55, Math.sin(time * 0.5 + i) * 0.06);
          c.scale.setScalar(nextUp ? 0.46 : 0.4);
        }
        const tag = tags[i];
        tag.classList.toggle('in', i < inserted);
        tag.classList.toggle('next', i === inserted || i === flyI);
      });
      // The coin in the air says what it is, at the top of its arc.
      if (flyI >= 0) {
        const s = STUDIES[flyI];
        const fp = proj(head.position.clone().add(new THREE.Vector3(-2.15, 0.55, 0)));
        fly.querySelector('span').textContent = `${s.n} / 05`;
        fly.querySelector('b').textContent = s.name;
        fly.querySelector('em').textContent = s.line;
        fly.style.transform = `translate(${fp[0]}px, ${fp[1]}px) translate(-100%, -50%)`;
        fly.style.opacity = String(Math.min(1, Math.sin((flyT / FLIGHT) * Math.PI) * 2.2) );
      } else fly.style.opacity = '0';
      // ---- the face: interference that clears a step with each coin
      const sig = inserted / 4;
      face.uniforms.uSignal.value += (sig - face.uniforms.uSignal.value) * (fixed ? 1 : 0.06);
      face.uniforms.uTime.value = time;
      const landed = inserted > 0 && !fixed ? time - presses[inserted - 1] - FLIGHT : 9;
      face.uniforms.uKick.value = Math.max(0, 1 - landed / 0.35) * (landed >= 0 ? 1 : 0);
      face.uniforms.uOn.value = ease((face.uniforms.uSignal.value - 0.6) / 0.4);
      if (time > blinkAt) blinkAt = time + 2.4 + Math.random() * 2.2;
      face.uniforms.uBlink.value = inserted === 4 ? Math.max(0, 1 - Math.abs(time - (blinkAt - 0.12)) / 0.08) : 0;
      face.uniforms.uHappy.value = inserted === 4 ? ease((landed - 0.2) / 0.3) * (1 - ease((landed - 2.4) / 0.4)) : 0;
      face.uniforms.uLook.value.lerp(pointer, 0.06);
      face.uniforms.uTextOn.value = 1 - ease((inserted - 3.6) / 0.4);
      text.draw(inserted === 0 ? 'NO SIGNAL' : inserted < 4 ? 'WEAK SIGNAL' : '', `CREDITS ${String(inserted + 1).padStart(2, '0')} / 05`);
      slotRim.emissiveIntensity = 0.6 + 0.6 * Math.sin(time * 3) ** 2 + (inserted === 4 ? 1 : 0);
      under.intensity = 3 * back + inserted;
      countEl.textContent = String(inserted);
      // ---- the last coin: you go with it
      if (pov > 0) {
        const P = pov * POVT; // seconds since the last coin went in
        const last = coins[3];
        if (P < 3.4) {
          // It powers on (the face does that, above) while the camera leans in; then you go in after the last coin: up
          // over the head and down through the slot.
          camera.position.add(new THREE.Vector3(-0.3, 0.1, -0.7).multiplyScalar(ease(P / 2.0)));
          const g = ease((P - 2.0) / 1.4);
          if (g > 0) {
            const start = camera.position.clone();
            const over = slotTop.clone().add(new THREE.Vector3(0, 1.7, 2.1));
            const into = slotTop.clone().add(new THREE.Vector3(0, -0.3, 0));
            const a = 1 - g;
            camera.position.copy(start.multiplyScalar(a * a).addScaledVector(over, 2 * a * g).addScaledVector(into, g * g));
            camera.up.set(0, 1, 0).lerp(new THREE.Vector3(0, 0, -1), ease((g - 0.45) / 0.5)).normalize();
            camera.lookAt(slotTop.clone().add(new THREE.Vector3(0, -0.7 * g, -0.3 * (1 - g))));
          } else camera.lookAt(camera.position.clone().add(new THREE.Vector3(0, 0, -1)));
          camera.updateMatrixWorld();
          inside.visible = false;
        } else {
          // Inside: down the shaft of traces, the coin falling ahead, onto the socket; the brain in its hole.
          inside.visible = true;
          const q = clamp((P - 3.4) / 4.0);
          const yCam = lerp(-202, -244.6 + 1.2, ease(q));
          camera.position.set(0, yCam, 0.001);
          camera.up.set(0, 0, -1);
          camera.lookAt(0, yCam - 5, 0);
          camera.updateMatrixWorld();
          last.visible = true;
          const yCoin = lerp(-203.2, -244.86, Math.min(1, ease(q * 1.12)));
          last.position.set(0, yCoin, 0);
          last.rotation.set(-Math.PI / 2, 0, (1 - Math.min(1, q * 1.12)) * 8);
          last.scale.setScalar(0.4);
          shaft.material.uniforms.uTime.value = time;
          insideLight.intensity = 6;
          brainMesh.material.uniforms.uA.value = ease((P - 7.0) / 1.0);
          brainMesh.rotation.y = time * 0.4;
        }
        endEl.style.opacity = String(ease((P - 8.3) / 1.0));
      } else { camera.up.set(0, 1, 0); inside.visible = false; endEl.style.opacity = '0'; }
      head.visible = !(pov > 0 && pov * POVT > 3.4);
      hud.style.opacity = String(ease((r - 0.9) / 0.3));
      press.style.opacity = r >= 1.2 && flyI < 0 && inserted < 4 && pov === 0 ? '1' : '0';
      return { inserted, pov };
    },
    render() {
      const tm = renderer.toneMapping, ex = renderer.toneMappingExposure;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      renderer.toneMapping = tm;
      renderer.toneMappingExposure = ex;
    },
  };
}
