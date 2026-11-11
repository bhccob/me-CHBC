// LAB ONLY (throwaway). The robot beat, round 42: a colossus. Two huge armoured hands tear the works dimension open from
// behind; behind it a face so large only its brow and eyes fit the screen: a monumental armoured mask, dark, its eyes
// and seams flickering with interference. Each press sends the next study coin up into a socket in the emblem on its
// forehead; the face comes on a step at a time. The last coin docks in the emblem's centre, the colossus wakes, and you
// fly through that coin's square hole, down to the CPU, where the brain sits. Original designs, in the spirit of the
// giant cosmic beings Bob mentioned; not any existing character.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { C } from './kit.js';
import { STUDIES, studyCoin, circuitMaterial, socketTexture, brain } from './stage.js';

const GLOW = new THREE.Color(C.glow);
const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const lerp = THREE.MathUtils.lerp;

// ------------------------------------------------------------------ the hand: sculpted plates, tapered fingers, light in the seams
/** A plate bent across its width, so armour reads as shells, not boxes. */
function shellGeo(w, h, d, bend = 1.6) {
  const g = new THREE.BoxGeometry(w, h, d, 12, 2, 1);
  const a = g.attributes.position;
  for (let i = 0; i < a.count; i++) a.setZ(i, a.getZ(i) - bend * a.getX(i) * a.getX(i));
  g.computeVertexNormals();
  return g;
}
function segGeo(r, len, tip = false) {
  const pts = [[r * 0.9, 0], [r * 1.02, len * 0.1], [r * 0.97, len * 0.45], [r * 0.86, len * 0.86], [r * 0.93, len * 0.93], [r * 0.8, len]];
  if (tip) pts.push([r * 0.62, len * 1.12], [r * 0.3, len * 1.22], [0, len * 1.25]);
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28);
}
function gauntlet() {
  const armor = new THREE.MeshPhysicalMaterial({ color: '#3a3542', metalness: 1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });
  const shell = new THREE.MeshPhysicalMaterial({ color: '#615a6b', metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0d0b11', metalness: 0.8, roughness: 0.45 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#d6a352', metalness: 1, roughness: 0.24 });
  const glow = new THREE.MeshStandardMaterial({ color: '#140c04', emissive: GLOW.clone(), emissiveIntensity: 1.8 });
  const f = { armor: armor.clone(), shell: shell.clone(), dark: dark.clone(), gold: gold.clone(), glow: glow.clone() };
  const hand = new THREE.Group();
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // Wrist and a short cuff (it is always cut by the page or the frame).
  add(hand, new THREE.CylinderGeometry(0.42, 0.5, 3.4, 48), armor, 0, -1.8, 0);
  for (const y of [-0.9, -1.7, -2.5]) add(hand, new THREE.TorusGeometry(0.47, 0.016, 8, 64), gold, 0, y, 0).rotation.x = Math.PI / 2;
  add(hand, new THREE.TorusGeometry(0.43, 0.02, 10, 64), gold, 0, -0.12, 0).rotation.x = Math.PI / 2;
  add(hand, new THREE.CylinderGeometry(0.33, 0.36, 0.3, 40), dark, 0, 0.02, 0);
  // Palm, and layered shells over the back of the hand with a seam of light between them.
  add(hand, new RoundedBoxGeometry(1.0, 1.06, 0.34, 6, 0.15), armor, 0, 0.62, 0);
  add(hand, shellGeo(1.02, 0.56, 0.09, 0.5), shell, 0, 0.36, -0.2).rotation.x = -0.14;
  add(hand, shellGeo(1.06, 0.5, 0.09, 0.5), shell, 0, 0.84, -0.22).rotation.x = 0.08;
  add(hand, new THREE.BoxGeometry(0.7, 0.018, 0.02), glow, 0, 0.6, -0.27);
  for (const x of [-0.3, 0.3]) add(hand, new THREE.BoxGeometry(0.018, 0.4, 0.02), glow, x, 0.62, -0.25);
  const lengths = [[0.44, 0.33, 0.24], [0.5, 0.36, 0.26], [0.48, 0.34, 0.25], [0.4, 0.29, 0.21]], radii = [0.108, 0.112, 0.105, 0.094];
  const fingers = lengths.map((ls, i) => {
    const base = new THREE.Group();
    base.position.set(-0.36 + i * 0.24, 1.15, 0);
    hand.add(base);
    add(base, shellGeo(0.22, 0.16, 0.08, 2), f.shell, 0, 0.02, -0.15); // knuckle guard
    let parent = base;
    const joints = ls.map((len, s) => {
      const r = radii[i] * (1 - s * 0.1);
      const seg = new THREE.Group();
      parent.add(seg);
      add(seg, new THREE.SphereGeometry(r * 0.96, 24, 16), f.dark);
      add(seg, new THREE.TorusGeometry(r * 0.99, 0.012, 8, 32), f.gold).rotation.y = Math.PI / 2;
      add(seg, segGeo(r, len, s === 2), f.armor).scale.z = 0.92;
      add(seg, shellGeo(r * 2.1, len * 0.8, 0.045, 5), f.shell, 0, len * 0.48, -r * 0.7);
      add(seg, new THREE.BoxGeometry(0.014, len * 0.5, 0.012), f.glow, 0, len * 0.48, -r * 0.7 - 0.03);
      const next = new THREE.Group();
      next.position.y = len + 0.02;
      seg.add(next);
      parent = next;
      return seg;
    });
    return { base, joints };
  });
  const tb = new THREE.Group();
  tb.position.set(-0.5, 0.4, 0.06);
  hand.add(tb);
  let parent = tb;
  const tj = [0.4, 0.31, 0.25].map((len, s) => {
    const r = 0.098 * (1 - s * 0.08);
    const seg = new THREE.Group();
    parent.add(seg);
    add(seg, new THREE.SphereGeometry(r, 20, 14), f.dark);
    add(seg, new THREE.CylinderGeometry(r * 0.86, r, len, 18), f.armor, 0, len / 2, 0);
    add(seg, shellGeo(r * 2.3, len * 0.84, 0.05, 5), f.shell, 0, len / 2, -r * 0.62);
    if (s === 2) add(seg, new THREE.ConeGeometry(r * 0.84, len * 0.4, 18), f.shell, 0, len + len * 0.18, 0);
    const next = new THREE.Group();
    next.position.y = len + 0.02;
    seg.add(next);
    parent = next;
    return seg;
  });
  hand.userData = { fingers, thumb: { base: tb, joints: tj }, body: [armor, shell, dark, gold, glow] };
  return hand;
}
/** Moves a hand's joints toward a pose with weight, a breath of motion always, and a tremor when it strains. */
function animator(hand) {
  const cur = { f: [[0.5, 0.55, 0.45], [0.5, 0.55, 0.45], [0.5, 0.55, 0.45], [0.5, 0.55, 0.45]], t: [0.6, 0.3, 0.2] };
  return (target, dt, time, strain = 0) => {
    const k = dt <= 0 ? 1 : 1 - Math.exp(-dt * 9);
    const { fingers, thumb } = hand.userData;
    fingers.forEach((fg, i) => {
      fg.base.rotation.z = (1.5 - i) * 0.06 + Math.sin(time * 0.9 + i) * 0.012;
      fg.joints.forEach((j, s) => {
        cur.f[i][s] += (target.f[i][s] - cur.f[i][s]) * k;
        j.rotation.x = cur.f[i][s] + Math.sin(time * 1.6 + i * 1.3 + s * 0.8) * 0.03 + strain * Math.sin(time * 29 + i * 2.3 + s * 1.1) * 0.025;
      });
    });
    if (!hand.userData.glb) thumb.base.rotation.set(0.3, 0, 0.6 + cur.t[0] * 0.5);
    thumb.joints.forEach((j, s) => { cur.t[s] += (target.t[s] - cur.t[s]) * k; j.rotation.x = s === 0 ? 0.15 + cur.t[0] * 0.3 : cur.t[s]; });
  };
}
const OPEN = [1.3, 0.2, 0.1], REACH = [1.25, 0.25, 0.12], GRIP = [1.5, 0.95, 0.75], LET = [0.85, 0.35, 0.2];
const mix3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

// ------------------------------------------------------------------ the colossus: a mask of plates, slit eyes, an emblem on the brow
function circuitTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 1024);
  let sd = 4; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.lineWidth = 3;
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = rnd() < 0.7 ? 'rgba(160,110,255,0.9)' : 'rgba(239,181,61,0.9)';
    let px = rnd() * 1024, py = rnd() * 1024;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 4; k++) { if (rnd() < 0.5) px += (rnd() - 0.5) * 220; else py += (rnd() - 0.5) * 220; x.lineTo(px, py); }
    x.stroke();
    x.fillStyle = x.strokeStyle; x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.18, 0.18);
  return t;
}
function colossusHead() {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: '#17151b', metalness: 1, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: new THREE.Color('#ffffff'), emissiveMap: circuitTex(), emissiveIntensity: 0 });
  const plate = new THREE.MeshPhysicalMaterial({ color: '#2c2833', metalness: 1, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3, flatShading: true });
  const plate2 = new THREE.MeshPhysicalMaterial({ color: '#3a3442', metalness: 1, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.2, flatShading: true });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#c89443', metalness: 1, roughness: 0.28 });
  const recess = new THREE.MeshStandardMaterial({ color: '#050407', metalness: 0.5, roughness: 0.6 });
  const eyeM = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
  const ext = (pts, depth, bevel = 0.1, z = 0) => {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 });
    geo.translate(0, 0, z - depth);
    return geo;
  };
  const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  // The base of the mask, deep; its traces light up in the seams between the plates.
  add(ext([[-3.3, 3.7], [3.3, 3.7], [3.9, 1.6], [3.75, -1.4], [2.4, -4.0], [0.95, -5.0], [-0.95, -5.0], [-2.4, -4.0], [-3.75, -1.4], [-3.9, 1.6]], 3.6, 0.5, 0), metal);
  // Forehead: a broad plate; the emblem sits on it.
  add(ext([[-3.0, 1.3], [3.0, 1.3], [3.2, 2.5], [2.3, 3.75], [-2.3, 3.75], [-3.2, 2.5]], 0.4, 0.09, 0.75), plate);
  // Brows: heavy, sloping down to the centre.
  const brow = [[-3.25, 1.0], [-0.42, 0.62], [-0.32, 1.12], [-3.05, 1.42]];
  add(ext(brow, 0.55, 0.07, 1.05), plate2);
  add(ext(mirror(brow), 0.55, 0.07, 1.05), plate2);
  // Eye sockets, deep, and the slit eyes in them.
  const sock = [[-2.95, 0.36], [-0.55, 0.06], [-0.5, 0.56], [-2.85, 0.92]];
  add(ext(sock, 0.1, 0.03, 0.42), recess);
  add(ext(mirror(sock), 0.1, 0.03, 0.42), recess);
  const eye = [[-2.62, 0.5], [-0.78, 0.27], [-0.76, 0.42], [-2.56, 0.68]];
  add(ext(eye, 0.05, 0.02, 0.52), eyeM);
  add(ext(mirror(eye), 0.05, 0.02, 0.52), eyeM);
  // Cheeks, the bridge of the nose, the jaw with its vents.
  const cheek = [[-3.55, -0.05], [-0.62, -0.32], [-0.78, -2.35], [-2.35, -2.05], [-3.45, -1.0]];
  add(ext(cheek, 0.45, 0.08, 0.68), plate);
  add(ext(mirror(cheek), 0.45, 0.08, 0.68), plate);
  add(ext([[-0.3, 0.55], [0.3, 0.55], [0.2, -1.75], [-0.2, -1.75]], 0.7, 0.06, 0.95), plate2);
  add(ext([[-2.25, -2.55], [2.25, -2.55], [1.55, -4.3], [-1.55, -4.3]], 0.38, 0.07, 0.62), plate);
  const vents = [];
  for (let k = 0; k < 5; k++) { const v = add(new THREE.BoxGeometry(2.6 - k * 0.3, 0.07, 0.08), eyeM.clone()); v.position.set(0, -2.85 - k * 0.28, 0.72); vents.push(v); }
  // The crest and the side plates, mostly beyond the frame: the head is that big.
  add(ext([[-0.55, 3.5], [0.55, 3.5], [0.28, 8.5], [-0.28, 8.5]], 0.9, 0.08, 0.2), plate2);
  const side = [[-3.75, 2.6], [-4.7, 1.6], [-4.8, -1.2], [-3.85, -2.2]];
  add(ext(side, 2.4, 0.12, -0.5), plate);
  add(ext(mirror(side), 2.4, 0.12, -0.5), plate);
  // The emblem: a ring, an inner ring of lit arcs that turns, three sockets in a triangle and one in the centre.
  const emblem = new THREE.Group();
  emblem.position.set(0, 2.32, 0.88);
  g.add(emblem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.07, 12, 96), gold);
  emblem.add(ring);
  const arcs = new THREE.Group();
  const arcM = new THREE.MeshStandardMaterial({ color: '#100804', emissive: GLOW.clone(), emissiveIntensity: 0.2 });
  for (let k = 0; k < 8; k++) { const a = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.035, 8, 24, 0.55), arcM); a.rotation.z = (k / 8) * Math.PI * 2; arcs.add(a); }
  emblem.add(arcs);
  const SOCK = [[0, 0.72, 0.25], [-0.62, -0.36, 0.25], [0.62, -0.36, 0.25], [0, 0, 0.31]];
  const socketGlows = SOCK.map(([x, y, r]) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 48), recess);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, y, 0.0);
    emblem.add(d);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.022, 10, 48), gold);
    rim.position.set(x, y, 0.04);
    emblem.add(rim);
    const lit = new THREE.Mesh(new THREE.TorusGeometry(r + 0.075, 0.012, 8, 48), new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 0 }));
    lit.position.set(x, y, 0.04);
    emblem.add(lit);
    return lit.material;
  });
  return { group: g, metal, eyeM, vents, emblem, arcs, arcM, socketGlows, sockets: SOCK };
}

// ------------------------------------------------------------------ the Blender models (tools/lab/blender/*.py)
const gltf = new GLTFLoader();
const loadGlb = (url) => new Promise((ok, no) => gltf.load(url, (g) => ok(g.scene), undefined, no));
const baseName = (m) => (m?.name || '').replace(/\.\d+$/, '');
function handMaterials() {
  return {
    armor: new THREE.MeshPhysicalMaterial({ color: '#3d3846', metalness: 1, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }),
    shell: new THREE.MeshPhysicalMaterial({ color: '#6b6475', metalness: 1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    joint: new THREE.MeshStandardMaterial({ color: '#0d0b11', metalness: 0.8, roughness: 0.42 }),
    gold: new THREE.MeshPhysicalMaterial({ color: '#d6a352', metalness: 1, roughness: 0.22 }),
    glow: new THREE.MeshStandardMaterial({ color: '#140c04', emissive: GLOW.clone(), emissiveIntensity: 2.0 }),
  };
}
/** One hand from the Blender model: finger segments are nodes with their pivots at the joints. */
function handFromGlb(src) {
  const hand = src.clone(true);
  const body = handMaterials(), fing = handMaterials();
  hand.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, finger = false;
    while (p) { if (/^(f\d_base|thumb_base)$/.test(p.name)) { finger = true; break; } p = p.parent; }
    const set = finger ? fing : body;
    o.material = set[baseName(o.material)] ?? set.armor;
  });
  const node = (n) => hand.getObjectByName(n);
  hand.userData = {
    glb: true,
    fingers: [0, 1, 2, 3].map((f) => ({ base: node(`f${f}_base`), joints: [0, 1, 2].map((s) => node(`f${f}_s${s}`)) })),
    thumb: { base: node('thumb_base'), joints: [0, 1, 2].map((s) => node(`thumb_s${s}`)) },
    body: Object.values(body),
  };
  return hand;
}
/** The colossus from the Blender model, with handles on what the page lights and where the coins go. */
function headFromGlb(src) {
  const g = src;
  const M = {
    shell: new THREE.MeshPhysicalMaterial({ color: '#141219', metalness: 1, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18 }),
    plate: new THREE.MeshPhysicalMaterial({ color: '#2e2a36', metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#05040a', metalness: 0.3, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }),
    eye: new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 }),
    seam: new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color('#a57cff'), emissiveIntensity: 0 }),
    gold: new THREE.MeshPhysicalMaterial({ color: '#c89443', metalness: 1, roughness: 0.26 }),
    recess: new THREE.MeshStandardMaterial({ color: '#050407', metalness: 0.5, roughness: 0.6 }),
  };
  const socketGlows = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: GLOW.clone(), emissiveIntensity: 0 }));
  g.traverse((o) => {
    if (!o.isMesh) return;
    const m = /^socket_(\d)_light/.exec(o.name);
    o.material = m ? socketGlows[Number(m[1])] : M[baseName(o.material)] ?? M.shell;
  });
  const sockets = [0, 1, 2, 3].map((i) => { const n = g.getObjectByName(`socket_${i}`); return { node: n, r: n.userData.radius ?? 0.25 }; });
  return { group: g, eyeM: M.eye, metal: M.seam, vents: [], socketGlows, arcM: M.seam, arcs: new THREE.Group(), emblem: g.getObjectByName('emblem'), sockets };
}

// ------------------------------------------------------------------ interference over everything while it is not powered
const GLITCH = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uKick: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAmt, uTime, uKick; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float a = uAmt + uKick;
      float row = floor(uv.y * 64.0), tick = floor(uTime * 14.0);
      float slip = step(0.78, hash(vec2(row * 0.7, tick))) * (hash(vec2(row, tick + 1.0)) - 0.5) * 0.08 * a;
      float big = step(0.93, hash(vec2(floor(uTime * 3.0), 2.0))) * step(abs(uv.y - hash(vec2(floor(uTime * 3.0), 5.0))), 0.08) * 0.05 * a;
      uv.x += slip + big;
      float s = 0.012 * a;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(s, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(s, 0.0)).b);
      c += (hash(floor(vUv * vec2(640.0, 360.0)) + tick * 3.1) - 0.5) * 0.12 * a;
      c *= 1.0 - 0.18 * a * step(0.5, fract(vUv.y * 180.0));
      float roll = smoothstep(0.0, 0.08, fract(vUv.y * 0.5 - uTime * 0.18)) * (1.0 - smoothstep(0.08, 0.2, fract(vUv.y * 0.5 - uTime * 0.18)));
      c += roll * 0.05 * a;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export async function createColossus(renderer, { W, H, dpr, pageTexture, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030206');
  scene.fog = new THREE.FogExp2('#07040e', 0.011);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.2;
  pm.dispose();
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 600);
  const D = 10, PH_ = 2 * D * Math.tan((20 * Math.PI) / 180), PW_ = PH_ * (W / H);
  const key = new THREE.DirectionalLight('#e9e4ff', 0.75);
  key.position.set(-8, 14, 10);
  const rim = new THREE.DirectionalLight('#9a74ff', 3.2);
  rim.position.set(10, 6, -20);
  const handLight = new THREE.DirectionalLight('#ffe2c0', 1.2);
  handLight.position.set(3, 4, 9);
  const gapLight = new THREE.PointLight('#ffc98a', 0, 0, 2);
  gapLight.position.set(0.2, 0, -1.6);
  scene.add(key, rim, handLight, gapLight, new THREE.HemisphereLight('#2e2148', '#040208', 0.5));

  // ---------------------------------------------------------------- the page: the works dimension, torn down the middle
  const tear = (y) => 0.22 * Math.sin(y * 1.6 + 0.7) + 0.09 * Math.sin(y * 4.1 + 2.0) + 0.035 * Math.sin(y * 11.3);
  const TEAR = 'float tearX(float y){ return 0.22 * sin(y * 1.6 + 0.7) + 0.09 * sin(y * 4.1 + 2.0) + 0.035 * sin(y * 11.3) + 0.018 * sin(y * 37.0) + 0.01 * sin(y * 71.0 + 1.0); }';
  const halves = [-1, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PW_, PH_, 180, 100), new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false,
      uniforms: { uTex: { value: pageTexture() }, uSide: { value: side }, uAng: { value: 0 }, uTx: { value: 0 }, uBend: { value: 0 }, uGap: { value: 0 }, uCrack: { value: 0 }, uW: { value: PW_ }, uH: { value: PH_ }, uTime: { value: 0 }, uAsp: { value: W / H } },
      vertexShader: `${TEAR}
        uniform float uSide, uAng, uTx, uBend, uW;
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
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

  // ---------------------------------------------------------------- the colossus
  const [handSrc, headSrc] = await Promise.all([loadGlb('models/hand.glb'), loadGlb('models/head.glb')]);
  const head = headFromGlb(headSrc);
  const HEAD = 4.6;
  head.group.scale.setScalar(HEAD);
  // Placed so its emblem sits where the camera will look, high in the frame, the face going on below the screen.
  head.group.updateMatrixWorld(true);
  const emblemLocal = head.emblem.getWorldPosition(new THREE.Vector3()).divideScalar(HEAD);
  const headBase = new THREE.Vector3(0, 8.4, -40).sub(emblemLocal.clone().multiplyScalar(HEAD));
  head.group.position.copy(headBase);
  scene.add(head.group);
  const eyeLights = [-1, 1].map((sx) => { const l = new THREE.PointLight('#ffcf8a', 0, 0, 2); scene.add(l); l.userData.sx = sx; return l; });
  const camEnd = new THREE.Vector3(0, 2.2, -4.5), lookEnd = new THREE.Vector3(0, 3.4, -40);
  // Dust between you and it: it is far, and huge.
  {
    let sd = 2; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const n = 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 60, (rnd() - 0.4) * 40, -4 - rnd() * 36], i * 3);
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3));
    var dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#a891d8', size: 0.06, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);
  }

  // ---------------------------------------------------------------- the hands
  const HS_ = 2.5;
  const right = handFromGlb(handSrc);
  const leftRoot = new THREE.Group();
  leftRoot.scale.x = -1;
  const left = handFromGlb(handSrc);
  leftRoot.add(left);
  scene.add(right, leftRoot);
  const animR = animator(right), animL = animator(left);
  const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const qHold = basis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1));

  // ---------------------------------------------------------------- the coins: in a row before you, lit; up into the brow by press
  const coins = STUDIES.map((s) => { const c = studyCoin(s); c.scale.setScalar(0.4); scene.add(c); return c; });
  const coinLight = new THREE.PointLight('#ffd9a0', 0, 0, 2);
  scene.add(coinLight);
  const order = [0, 1, 2, 3]; // coin i goes to socket i; the last, mechatronics, to the centre

  // ---------------------------------------------------------------- inside: the shaft, the socket, the brain
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

  // ---------------------------------------------------------------- the picture: straight to the screen while the page is up, through interference after
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
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
    .st-list { position: fixed; top: calc(var(--gutter, 30px) + 34px); right: var(--gutter, 30px); margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; text-align: right; }
    .st-tag { margin: 0; white-space: nowrap; opacity: 0.4; transition: opacity .5s; }
    .st-tag span { display: block; color: #efb53d; margin-bottom: 3px; }
    .st-tag b { display: block; font: 700 14px/1.1 Barlow; letter-spacing: 0.03em; text-transform: uppercase; }
    .st-tag.next { opacity: 1; }
    .st-tag.in { opacity: 0.7; }
    .st-tag.in b::after { content: ' · in'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }
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
  <p class="st-c m" style="top: var(--gutter, 30px); left: var(--gutter, 30px)">Bob Chung</p><p class="st-c m" style="top: var(--gutter, 30px); right: var(--gutter, 30px)">Studies · <b class="st-n">0</b> / 4 in</p>
  <ol class="st-list">${STUDIES.map((s) => `<li class="st-tag m"><span>${s.n}</span><b>${s.name}</b></li>`).join('')}</ol>
  <p class="st-fly"><span class="m"></span><b></b><em></em></p>
  <p class="st-state m">Signal <b>00</b> %</p>
  <p class="st-press"><i></i><b>Press to insert a coin</b><span class="m">Click or space</span></p>
  <div class="st-end"><p class="m">The brain, as it is now</p></div>`;
  hudParent.append(hud);
  const tags = [...hud.querySelectorAll('.st-tag')], fly = hud.querySelector('.st-fly'), press = hud.querySelector('.st-press'), endEl = hud.querySelector('.st-end'), countEl = hud.querySelector('.st-n'), sigEl = hud.querySelector('.st-state b');

  const bez = (a, b, c, d, t) => { const u = 1 - t; return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
  const FLIGHT = 1.25, POVT = 9.0;
  const orbitA = [0, 0, 0, 0], glideFrom = [null, null, null, null];
  let approach = 0;
  let presses = [], lastT = null, sigShown = 0;

  return {
    scene, camera,
    press(now) {
      const flying = presses.length && now - presses[presses.length - 1] < FLIGHT;
      if (presses.length >= 4 || flying) return false;
      presses.push(now);
      return true;
    },
    update({ r, time, fixed = null }) {
      const dt = lastT === null || fixed ? 0 : Math.min(0.1, time - lastT);
      lastT = time;
      halves.forEach((h) => { h.material.uniforms.uTex.value = pageTexture(); h.material.uniforms.uTime.value = time; });
      // ---- the tear (scroll)
      const crack = ease(r / 0.15), gap = 0.12 * ease((r - 0.12) / 0.15);
      const ang = 0.34 * ease((r - 0.34) / 0.4), tx = PW_ * 0.62 * Math.pow(ease((r - 0.36) / 0.56), 1.4), bend = ease((r - 0.26) / 0.25);
      halves.forEach((h) => { const u = h.material.uniforms; u.uCrack.value = crack; u.uGap.value = gap; u.uAng.value = ang; u.uTx.value = tx; u.uBend.value = bend; h.visible = tx < PW_ * 0.61; });
      // ---- the hands: from behind, they push their fingers through, one after another, curl round the torn edges,
      // strain to pull them apart, and let go as the halves go.
      const push = ease((r - 0.1) / 0.14);
      const door = new THREE.Matrix4().makeTranslation(PW_ / 2 + tx, 0, 0).multiply(new THREE.Matrix4().makeRotationY(ang)).multiply(new THREE.Matrix4().makeTranslation(-PW_ / 2, 0, 0));
      const hold = (edgeX, y, sway) => new THREE.Matrix4().compose(new THREE.Vector3(edgeX - 0.08 + 1.15 * HS_, y + sway, -0.17 * HS_ - 0.16 - (1 - push) * 3.4 + bend * 0.3), qHold, new THREE.Vector3(HS_, HS_, HS_));
      const yR = 0.85, yL = -1.15;
      door.clone().multiply(hold(tear(yR) + gap / 2, yR, Math.sin(time * 1.1) * 0.04)).decompose(right.position, right.quaternion, right.scale);
      door.clone().multiply(hold(-(tear(yL) - gap / 2), yL, Math.sin(time * 1.3 + 1) * 0.04)).decompose(left.position, left.quaternion, left.scale);
      const poseAt = (lag) => ({
        f: [0, 1, 2, 3].map((i) => {
          const reach = ease((r - 0.1 - i * 0.02 - lag) / 0.1), grip = ease((r - 0.2 - i * 0.022 - lag) / 0.11), let_ = ease((r - 0.86 - i * 0.012) / 0.1);
          return mix3(mix3(mix3(OPEN, REACH, reach), GRIP, grip), LET, let_);
        }),
        t: mix3(mix3([0.7, 0.4, 0.3], [1.0, 0.7, 0.55], ease((r - 0.24 - lag) / 0.12)), [0.5, 0.2, 0.15], ease((r - 0.86) / 0.1)),
      });
      const strain = r > 0.32 && r < 0.86 ? 1 : 0;
      const behind = new THREE.Plane(new THREE.Vector3(0, 0, -1), -0.04).applyMatrix4(door);
      right.userData.body.forEach((m) => (m.clippingPlanes = [behind]));
      left.userData.body.forEach((m) => (m.clippingPlanes = [behind.clone().applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1))]));
      for (const h of [right, left]) h.userData.thumb.base.visible = false;
      gapLight.intensity = 60 * ease((r - 0.08) / 0.15) * (1 - ease((r - 0.9) / 0.1));
      animR(poseAt(0), dt, time, strain);
      animL(poseAt(0.03), dt, time + 0.7, strain);
      right.visible = leftRoot.visible = r > 0.05 && tx < PW_ * 0.6;
      // ---- the camera: holds the page; once it is open, it lifts its eyes to the face
      const inF = ease((r - 0.68) / 0.5);
      camera.position.set(0, 0, D).lerp(camEnd, inF);
      camera.up.set(0, 1, 0);
      camera.lookAt(new THREE.Vector3(0, 0, 0).lerp(lookEnd, inF));
      // ---- presses
      let inserted = 0, flyI = -1, flyT = 0, pov = 0;
      if (fixed) { inserted = fixed.inserted; flyI = fixed.fly >= 0 ? inserted : -1; flyT = fixed.fly * FLIGHT; pov = fixed.pov; }
      else {
        presses.forEach((t0, i) => { const d = time - t0; if (d >= FLIGHT) inserted = i + 1; else { flyI = i; flyT = d; } });
        if (presses.length === 4) pov = clamp((time - presses[3] - FLIGHT) / POVT);
      }
      const landedAt = inserted > 0 && !fixed ? presses[inserted - 1] + FLIGHT : -99;
      // ---- the colossus: interference until the coins are in; each one lights its socket and more of the face
      const sig = inserted / 4;
      sigShown += (sig - sigShown) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 2.5));
      const kick = Math.max(0, 1 - (time - landedAt) / 0.4);
      const flicker = (k) => (Math.sin(time * 37 + k) * Math.sin(time * 13.7 + k * 2.1) > 0.2 ? 1 : 0.25);
      const awake = ease(pov / 0.12);
      head.eyeM.emissiveIntensity = lerp(0.25 * flicker(1), 3.2, ease((sigShown - 0.15) / 0.85)) + awake * 1.5 + kick * 1.5;
      head.metal.emissiveIntensity = lerp(0.15 * flicker(3), 2.4, sigShown) + awake * 1.2;
      head.vents.forEach((v, k) => (v.material.emissiveIntensity = lerp(0.1 * flicker(k + 5), 1.6, ease((sigShown - k * 0.12) / 0.4))));
      head.socketGlows.forEach((m, i) => (m.emissiveIntensity = i < inserted ? 2.4 + Math.sin(time * 3 + i) * 0.4 : 0.15 * flicker(i + 9)));
      head.arcM.emissiveIntensity = 0.3 + sigShown * 2.2 + awake;
      head.arcs.rotation.z += (0.05 + sigShown * 0.9 + awake * 2) * (dt || 0.016);
      head.group.position.set(headBase.x, headBase.y + Math.sin(time * 0.35) * 0.15 + awake * 0.6, headBase.z);
      head.group.rotation.set(-0.04 + Math.sin(time * 0.27) * 0.008 - awake * 0.05, Math.sin(time * 0.21) * 0.01, 0);
      head.group.updateMatrixWorld(true);
      eyeLights.forEach((l) => { l.position.copy(head.group.localToWorld(new THREE.Vector3(l.userData.sx * 1.25, 0.72, 4.2))); l.intensity = head.eyeM.emissiveIntensity * 60; });
      glitch.uniforms.uAmt.value = (1 - sigShown) * 0.6 * ease((r - 0.85) / 0.2);
      glitch.uniforms.uKick.value = kick * 0.6;
      glitch.uniforms.uTime.value = time;
      // ---- the coins: a slow orbit round the emblem, at the size of their sockets; a press draws the next one in along a
      // spiral and it clicks home; the camera leans in a little each time.
      const socketWorld = (i) => head.sockets[i].node.getWorldPosition(new THREE.Vector3());
      const socketScale = (i) => head.sockets[i].r * HEAD * 0.96;
      const E = head.emblem.getWorldPosition(new THREE.Vector3());
      const back = ease((r - 1.0) / 0.22);
      const RO = 7.6, ZO = 5.5;
      const rem = [0, 1, 2, 3].filter((i) => i >= inserted && i !== flyI);
      const kA = dt <= 0 ? 1 : 1 - Math.exp(-dt * 3);
      rem.forEach((i, k) => {
        const want = Math.PI / 2 + (k / Math.max(1, rem.length)) * Math.PI * 2 + time * 0.16;
        let d = want - orbitA[i]; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
        orbitA[i] += d * kA;
      });
      coins.forEach((c, i) => {
        const orbitPos = E.clone().add(new THREE.Vector3(Math.cos(orbitA[i]) * RO, Math.sin(orbitA[i]) * RO * 0.55, ZO + Math.sin(time * 0.9 + i) * 0.3));
        if (i < inserted) {
          c.position.copy(socketWorld(i));
          c.quaternion.copy(head.group.quaternion);
          c.scale.setScalar(socketScale(i));
          c.visible = true;
          glideFrom[i] = null;
        } else if (i === flyI) {
          if (!glideFrom[i]) glideFrom[i] = { a: orbitA[i] };
          const f = clamp(flyT / FLIGHT), e = ease(f);
          const S = socketWorld(i).sub(E);
          const aS = Math.atan2(S.y, S.x), rS = Math.hypot(S.x, S.y);
          let d = aS - glideFrom[i].a; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
          const a = glideFrom[i].a + (d + Math.PI) * e;
          const rr = lerp(RO, rS, e), ry = lerp(0.55, 1, e);
          const z = lerp(ZO, S.z, Math.pow(e, 1.5)) - 0.5 * Math.sin(clamp((f - 0.82) / 0.18) * Math.PI);
          c.position.copy(E).add(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr * ry, z));
          c.rotation.set(0, 0, (1 - e) * Math.PI * 3);
          c.scale.setScalar(lerp(socketScale(i) * 1.15, socketScale(i), e));
          c.visible = true;
          orbitA[i] = a;
        } else {
          c.position.copy(orbitPos);
          c.rotation.set(0.1 * Math.sin(time + i), Math.sin(time * 0.7 + i * 1.3) * 0.45, 0);
          c.scale.setScalar(socketScale(i) * (i === inserted ? 1.22 + Math.sin(time * 4) * 0.04 : 1.1) * back);
          c.visible = back > 0.01;
        }
        tags[i].classList.toggle('in', i < inserted);
        tags[i].classList.toggle('next', i === inserted || i === flyI);
      });
      coinLight.position.copy(E).add(new THREE.Vector3(0, -2, 14));
      coinLight.intensity = 260 * back;
      // The camera leans toward the emblem a step with each coin.
      approach += (inserted / 4 + (flyI >= 0 ? 0.25 * ease(flyT / FLIGHT) : 0) - approach) * (dt <= 0 ? 1 : 1 - Math.exp(-dt * 1.8));
      const camBase = camera.position.clone().lerp(E.clone().add(new THREE.Vector3(0, -3.5, 20)), 0.32 * approach);
      camera.position.copy(camBase);
      camera.lookAt(new THREE.Vector3(0, 0, 0).lerp(lookEnd, inF).lerp(E, 0.4 * approach));
      camera.updateMatrixWorld();
      if (flyI >= 0) {
        const s = STUDIES[flyI];
        fly.querySelector('span').textContent = `${s.n} / 05`;
        fly.querySelector('b').textContent = s.name;
        fly.querySelector('em').textContent = s.line;
        fly.style.opacity = String(Math.min(1, Math.sin((flyT / FLIGHT) * Math.PI) * 2));
      } else fly.style.opacity = '0';
      // ---- awake: then you go in, through the square hole of the coin in the centre, down to the brain
      if (pov > 0) {
        const P = pov * POVT;
        const centre = socketWorld(3);
        if (P < 3.6) {
          const g = ease((P - 1.8) / 1.8);
          if (g > 0) {
            camera.position.copy(camBase).lerp(centre.clone().add(new THREE.Vector3(0, 0, 0.15)), Math.pow(g, 1.8));
            camera.lookAt(centre.clone().add(new THREE.Vector3(0, 0, -2)));
          }
          inside.visible = false;
        } else {
          inside.visible = true;
          const q = clamp((P - 3.6) / 3.6);
          const yCam = lerp(-302, -344.6 + 1.2, ease(q));
          camera.position.set(0, yCam, 0.001);
          camera.up.set(0, 0, -1);
          camera.lookAt(0, yCam - 5, 0);
          const last = coins[3];
          last.visible = true;
          last.position.set(0, lerp(-303.2, -344.86, Math.min(1, ease(q * 1.12))), 0);
          last.rotation.set(-Math.PI / 2, 0, (1 - Math.min(1, q * 1.12)) * 8);
          last.scale.setScalar(0.4);
          shaft.material.uniforms.uTime.value = time;
          brainMesh.material.uniforms.uA.value = ease((P - 6.6) / 1.0);
          brainMesh.rotation.y = time * 0.4;
        }
        endEl.style.opacity = String(ease((P - 7.8) / 1.0));
        head.group.visible = P < 3.6;
      } else { inside.visible = false; endEl.style.opacity = '0'; head.group.visible = true; }
      camera.updateMatrixWorld();
      // ---- HUD
      countEl.textContent = String(inserted);
      sigEl.textContent = String(Math.round(sigShown * 100)).padStart(2, '0');
      hud.style.opacity = String(ease((r - 0.95) / 0.25));
      press.style.opacity = r >= 1.2 && flyI < 0 && inserted < 4 && pov === 0 ? '1' : '0';
      this._post = r > 0.95;
      return { inserted, pov };
    },
    render() {
      const tm = renderer.toneMapping, ex = renderer.toneMappingExposure;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      if (this._post) composer.render();
      else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
      renderer.toneMapping = tm;
      renderer.toneMappingExposure = ex;
    },
  };
}
