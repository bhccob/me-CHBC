// LAB ONLY (throwaway). The mock-ups' shared 3D: the stage, the coin, the O, the robot hand, the visor, the floor grid and
// the post chain. Code art only. Units: the coin's radius is 1.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { BloomEffect, DepthOfFieldEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';

export { THREE };
export const C = {
  page: '#f2efe8',
  ink: '#130724',
  glow: '#efb53d',
  coolBg: '#05070f',
  cool: '#8ea4ff',
  warmBg: '#100604',
  warm: '#ff8f52',
};
export const HOLE = 0.48; // half the square hole's side, as a share of the radius
const RIM_IN = 0.86;

export async function fonts() {
  await Promise.all(['800 100px Barlow', '500 20px Barlow', '500 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f)));
}

export function ready() {
  window.__ready = true;
  document.documentElement.dataset.ready = '';
}

/** One renderer on a canvas filling its box. `post`: the dark scenes go through bloom, depth of field and tone mapping. */
export function stage(canvas, { fov = 30, exposure = 1, env = 0.6, shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = env;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.01, 200);
  let composer = null;
  const s = {
    renderer, scene, camera, w, h,
    post({ focus = 5, range = 2, bokeh = 2, bloom = 0.6, threshold = 0.85, vignette = 0.45, radius = 0.85 } = {}) {
      renderer.toneMapping = THREE.NoToneMapping;
      composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
      composer.addPass(new RenderPass(scene, camera));
      const dof = new DepthOfFieldEffect(camera, { focusDistance: focus, focusRange: range, bokehScale: bokeh });
      const effects = [dof, new BloomEffect({ intensity: bloom, luminanceThreshold: threshold, mipmapBlur: true, radius }), new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new VignetteEffect({ darkness: vignette, offset: 0.3 })];
      composer.addPass(new EffectPass(camera, ...effects));
      s.dof = dof;
      return s;
    },
    render() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
  };
  return s;
}

/** A camera whose z = 0 plane maps 1 unit to 1 CSS pixel (x right, y up from the bottom), seen from (ox, oy) off centre. */
export function pixelCamera(camera, w, h, ox = 0, oy = 0, fov = 30) {
  const d = h / 2 / Math.tan((fov * Math.PI) / 360);
  camera.position.set(w / 2 + ox, h / 2 + oy, d);
  camera.rotation.set(0, 0, 0);
  camera.updateMatrixWorld();
  const near = 1, far = d * 6, k = near / d;
  const left = (0 - camera.position.x) * k, right = (w - camera.position.x) * k;
  const bottom = (0 - camera.position.y) * k, top = (h - camera.position.y) * k;
  camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return d;
}

// ------------------------------------------------------------------ textures

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rand(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Worn bronze: a warm base, darker blotches in the low parts, a little verdigris, fine scratches. */
function patina(seed = 7) {
  return canvasTex(1024, 1024, (x, w, h) => {
    const r = rand(seed);
    x.fillStyle = '#b48a5e';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      const dark = r() < 0.82;
      g.addColorStop(0, dark ? `rgba(58,38,22,${0.08 + r() * 0.18})` : `rgba(70,96,78,${0.08 + r() * 0.12})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.save();
      x.translate(r() * w, r() * h);
      const s = 20 + r() * 120;
      x.scale(s * (0.6 + r()), s);
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, 1, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
    x.strokeStyle = 'rgba(255,226,180,0.08)';
    for (let i = 0; i < 160; i++) {
      x.lineWidth = 0.5 + r();
      x.beginPath();
      const a = r() * w, b = r() * h, len = 20 + r() * 90, ang = r() * Math.PI;
      x.moveTo(a, b);
      x.lineTo(a + Math.cos(ang) * len, b + Math.sin(ang) * len);
      x.stroke();
    }
  });
}

function roughMap(seed = 11) {
  return canvasTex(512, 512, (x, w, h) => {
    const r = rand(seed);
    x.fillStyle = '#9a9a9a';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,40,40'},${0.05 + r() * 0.1})`;
      x.beginPath();
      x.arc(r() * w, r() * h, 4 + r() * 30, 0, Math.PI * 2);
      x.fill();
    }
  }, false);
}

// ------------------------------------------------------------------ the coin and the O

const GLYPHS = {
  // Studies face: software, game, app, cybersecurity. Original marks, drawn for this coin.
  software: 'M38 18 L8 50 L38 82 L48 72 L27 50 L48 28 Z M62 18 L92 50 L62 82 L52 72 L73 50 L52 28 Z',
  game: 'M37 10 H63 V37 H90 V63 H63 V90 H37 V63 H10 V37 H37 Z',
  app: 'M10 10 H44 V44 H10 Z M56 10 H90 V44 H56 Z M10 56 H44 V90 H10 Z M56 56 H90 V90 H56 Z',
  security: 'M50 6 L88 20 V48 C88 70 72 86 50 95 C28 86 12 70 12 48 V20 Z M50 32 C43 32 39 37 39 43 C39 48 42 51 45 53 L42 72 H58 L55 53 C58 51 61 48 61 43 C61 37 57 32 50 32 Z',
  // Built face: Lumo, Locked, Jontai Energy, Cookies Clicker.
  lumo: 'M10 14 H90 V30 H10 Z M10 42 H90 V58 H10 Z M10 70 H62 V86 H10 Z',
  locked: 'M16 44 H84 V92 H16 Z M28 44 V30 C28 2 72 2 72 30 V44 H60 V30 C60 16 40 16 40 30 V44 Z',
  jontai: 'M60 4 L20 56 H46 L36 96 L82 38 H56 Z',
  cookies: 'M50 6 C74 6 94 26 94 50 C94 74 74 94 50 94 C26 94 6 74 6 50 C6 26 26 6 50 6 Z M30 30 V44 H44 V30 Z M56 50 V64 H70 V50 Z M34 62 V74 H46 V62 Z',
};
export const FACES = { built: ['lumo', 'locked', 'jontai', 'cookies'], studies: ['software', 'game', 'app', 'security'] };
/** Where the four marks sit (top, right, bottom, left), in the order the trace joins them. */
export const MARK_AT = [[0, 0.68], [0.68, 0], [0, -0.68], [-0.68, 0]];

function glyphGeometry(name, size = 0.27, depth = 0.035) {
  const loader = new SVGLoader();
  const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${GLYPHS[name]}"/></svg>`);
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 10 });
  // SVG is y-down, 0..100: centre it, flip y, scale to `size`.
  g.translate(-50, -50, 0);
  g.scale(size / 100, -size / 100, 1);
  g.computeVertexNormals();
  return g;
}

function discWithHole(r, hole, segments = 128) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  const p = new THREE.Path();
  p.moveTo(-hole, -hole);
  p.lineTo(-hole, hole);
  p.lineTo(hole, hole);
  p.lineTo(hole, -hole);
  p.closePath();
  s.holes.push(p);
  return { shape: s, segments };
}

function ring(rOut, rIn, segments = 128) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const p = new THREE.Path();
  p.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(p);
  return s;
}

function squareRing(outer, inner) {
  const s = new THREE.Shape();
  s.moveTo(-outer, -outer);
  s.lineTo(outer, -outer);
  s.lineTo(outer, outer);
  s.lineTo(-outer, outer);
  s.closePath();
  const p = new THREE.Path();
  p.moveTo(-inner, -inner);
  p.lineTo(-inner, inner);
  p.lineTo(inner, inner);
  p.lineTo(inner, -inner);
  p.closePath();
  s.holes.push(p);
  return s;
}

/** The rim's band: "BC · 2006" twice round, engraved. */
function rimTexture() {
  return canvasTex(4096, 128, (x, w, h) => {
    x.fillStyle = '#b48a5e';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(50,30,16,0.85)';
    x.font = '500 76px "IBM Plex Mono"';
    x.textBaseline = 'middle';
    x.textAlign = 'center';
    const words = ['BC', '·', '2006', '·', 'BC', '·', '2006', '·'];
    words.forEach((word, i) => x.fillText(word, ((i + 0.5) / words.length) * w, h / 2 + 4));
    x.fillStyle = 'rgba(50,30,16,0.35)';
    for (let i = 0; i < 260; i++) x.fillRect((i / 260) * w, 6, 3, 10), x.fillRect((i / 260) * w, h - 16, 3, 10);
  });
}

/**
 * The coin: worn bronze, a square hole, a raised outer rim and a raised border round the hole, four raised marks on each
 * face (front, +z: Built; back, -z: Studies), "BC · 2006" round the rim. `ink`: the near-black O instead (no marks, no
 * wear), the shape the first view shows.
 */
export function coin({ ink = false, thickness = 0.16 } = {}) {
  const group = new THREE.Group();
  const T = thickness;
  const tex = ink ? null : patina();
  const rough = ink ? null : roughMap();
  const body = ink
    ? new THREE.MeshPhysicalMaterial({ color: C.ink, metalness: 0.2, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18 })
    : new THREE.MeshPhysicalMaterial({ color: '#58402a', map: tex, metalness: 0.9, roughness: 0.78, roughnessMap: rough });
  const high = ink ? body : new THREE.MeshPhysicalMaterial({ color: '#b8956a', map: tex, metalness: 0.95, roughness: 0.38 });
  const bevel = 0.025;
  const { shape } = discWithHole(1 - bevel, HOLE + bevel);
  const disc = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: T - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 128 }), body);
  disc.geometry.translate(0, 0, -(T - 2 * bevel) / 2);
  disc.castShadow = disc.receiveShadow = true;
  group.add(disc);
  group.userData.materials = [body, high];
  if (ink) return group;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.0015, 1.0015, T - 2 * bevel, 256, 1, true), new THREE.MeshPhysicalMaterial({ color: '#86664a', map: rimTexture(), metalness: 0.95, roughness: 0.55 }));
  band.rotation.x = Math.PI / 2;
  group.add(band);
  for (const side of [1, -1]) {
    const face = new THREE.Group();
    face.position.z = (side * T) / 2;
    if (side < 0) face.rotation.y = Math.PI;
    const raise = 0.028;
    const outer = new THREE.Mesh(new THREE.ExtrudeGeometry(ring(0.985, RIM_IN, 128), { depth: raise, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 128 }), high);
    const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(squareRing(HOLE + 0.075, HOLE + 0.004), { depth: raise, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }), high);
    face.add(outer, inner);
    const marks = side > 0 ? FACES.built : FACES.studies;
    marks.forEach((name, i) => {
      const m = new THREE.Mesh(glyphGeometry(name), high);
      m.position.set(MARK_AT[i][0], MARK_AT[i][1], 0);
      m.castShadow = true;
      face.add(m);
    });
    for (const o of face.children) o.castShadow = o.receiveShadow = true;
    group.add(face);
  }
  return group;
}

// ------------------------------------------------------------------ the robot hand

/**
 * An original armoured robot hand, cropped at the wrist (y = 0): layered plates over the back, exposed knuckle joints,
 * three-segment fingers, a thumb. The palm faces +z, the fingers point +y. `curl`: per finger [base, middle, tip] in
 * radians; `spread`: the fingers' fan; `thumb`: [swing, curl].
 */
export function robotHand({ curl = [[0.2, 0.25, 0.2], [0.2, 0.25, 0.2], [0.2, 0.25, 0.2], [0.2, 0.25, 0.2]], spread = 0.06, thumb = [0.6, 0.4], left = false, glow = 0 } = {}) {
  const shell = new THREE.MeshPhysicalMaterial({ color: '#2b2832', metalness: 0.85, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const plate = new THREE.MeshPhysicalMaterial({ color: '#3a3542', metalness: 0.9, roughness: 0.26, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const joint = new THREE.MeshPhysicalMaterial({ color: '#9a96a2', metalness: 1, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0d0b10', metalness: 0.4, roughness: 0.6 });
  const light = new THREE.MeshStandardMaterial({ color: '#2a1d08', emissive: new THREE.Color(C.glow), emissiveIntensity: glow });
  const hand = new THREE.Group();
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Wrist: a jointed sleeve, cropped by whatever it comes through.
  add(hand, new THREE.CylinderGeometry(0.34, 0.36, 0.7, 40), dark, 0, -0.32, 0);
  for (const y of [-0.1, -0.26, -0.42, -0.58]) add(hand, new THREE.CylinderGeometry(0.375, 0.375, 0.07, 40), plate, 0, y, 0);
  add(hand, new THREE.SphereGeometry(0.3, 32, 16), joint, 0, 0.05, 0);
  // Palm and the plates over the back of the hand.
  const palm = add(hand, new RoundedBoxGeometry(1.0, 1.05, 0.34, 4, 0.08), shell, 0, 0.62, 0);
  add(hand, new RoundedBoxGeometry(0.86, 0.5, 0.06, 3, 0.03), plate, 0, 0.45, -0.2).rotation.x = -0.08;
  add(hand, new RoundedBoxGeometry(0.92, 0.44, 0.06, 3, 0.03), plate, 0, 0.82, -0.215).rotation.x = 0.06;
  add(hand, new RoundedBoxGeometry(0.5, 0.025, 0.02, 2, 0.008), light, 0, 0.62, -0.25);
  // The tendons: four rods over the back, from the wrist to the knuckles.
  for (let i = 0; i < 4; i++) add(hand, new THREE.CylinderGeometry(0.018, 0.018, 0.9, 10), joint, -0.36 + i * 0.24, 0.62, -0.25);
  palm.userData.kind = 'palm';
  // Fingers.
  const lengths = [[0.46, 0.34, 0.26], [0.52, 0.38, 0.28], [0.5, 0.36, 0.27], [0.42, 0.3, 0.23]];
  for (let f = 0; f < 4; f++) {
    const base = new THREE.Group();
    base.position.set(-0.36 + f * 0.24, 1.17, 0);
    base.rotation.z = (1.5 - f) * spread;
    hand.add(base);
    let parent = base;
    for (let s = 0; s < 3; s++) {
      const len = lengths[f][s];
      const knuckle = add(parent, new THREE.CylinderGeometry(0.095, 0.095, 0.2, 24), joint);
      knuckle.rotation.z = Math.PI / 2;
      const seg = new THREE.Group();
      seg.rotation.x = curl[f][s];
      parent.add(seg);
      add(seg, new RoundedBoxGeometry(0.19, len, 0.2, 3, 0.05), shell, 0, len / 2 + 0.03, 0);
      add(seg, new RoundedBoxGeometry(0.17, len * 0.7, 0.05, 2, 0.02), plate, 0, len / 2 + 0.03, -0.11);
      const next = new THREE.Group();
      next.position.y = len + 0.06;
      seg.add(next);
      parent = next;
    }
  }
  // Thumb, from the side of the palm.
  const tb = new THREE.Group();
  tb.position.set(-0.52, 0.42, 0.08);
  tb.rotation.set(0.3, 0, thumb[0]);
  hand.add(tb);
  let parent = tb;
  [0.42, 0.32, 0.25].forEach((len, s) => {
    const knuckle = add(parent, new THREE.CylinderGeometry(0.1, 0.1, 0.22, 24), joint);
    knuckle.rotation.z = Math.PI / 2;
    const seg = new THREE.Group();
    seg.rotation.x = s === 0 ? 0.2 : thumb[1];
    parent.add(seg);
    add(seg, new RoundedBoxGeometry(0.21, len, 0.22, 3, 0.05), shell, 0, len / 2 + 0.03, 0);
    add(seg, new RoundedBoxGeometry(0.18, len * 0.7, 0.05, 2, 0.02), plate, 0, len / 2 + 0.03, -0.12);
    const next = new THREE.Group();
    next.position.y = len + 0.06;
    seg.add(next);
    parent = next;
  });
  if (left) hand.scale.x = -1;
  return hand;
}

// ------------------------------------------------------------------ places

/** A thin-line floor that fades into the fog: the inside of a system, not space. */
export function gridFloor(color, { size = 60, step = 0.5, y = -1.5, opacity = 0.5 } = {}) {
  const pts = [];
  for (let i = -size / 2; i <= size / 2; i += step) {
    pts.push(-size / 2, 0, i, size / 2, 0, i, i, 0, -size / 2, i, 0, size / 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  lines.position.y = y;
  return lines;
}

/** Light words on a dark ground, for screens and the visor. */
export function words(w, h, draw) {
  return canvasTex(w, h, draw);
}

export function rounded(w, h, d, r = 0.04, seg = 4) {
  return new RoundedBoxGeometry(w, h, d, seg, r);
}

// ------------------------------------------------------------------ the page, after the O has left it

/**
 * In pixel space (see pixelCamera): the page as a plane exactly the CSS page's colour, with the round hole the coin left at
 * (cx, cy) radius r, a dark round shaft behind it with thin gold rings going down and a faint glow, and a shadow catcher.
 */
export function pageWithHole(W, H, cx, cy, r, { shadow = 0.24, glow = 0.3 } = {}) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-W, -H); shape.lineTo(2 * W, -H); shape.lineTo(2 * W, 2 * H); shape.lineTo(-W, 2 * H); shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(cx, cy, r, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 96);
  const page = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.page, toneMapped: false }));
  const catcher = new THREE.Mesh(geo, new THREE.ShadowMaterial({ opacity: shadow, color: '#1b0d24' }));
  catcher.position.z = 0.5;
  catcher.receiveShadow = true;
  group.add(page, catcher);
  const depth = r * 9;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 96, 1, true), new THREE.MeshBasicMaterial({ color: '#0b0714', side: THREE.BackSide, toneMapped: false }));
  wall.rotation.x = Math.PI / 2;
  wall.position.set(cx, cy, -depth / 2);
  const end = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshBasicMaterial({ color: '#0b0714', toneMapped: false }));
  end.position.set(cx, cy, -depth);
  group.add(wall, end);
  for (let i = 1; i < 12; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.99, r, 96), new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.38 * Math.pow(1 - i / 12, 1.6), toneMapped: false, side: THREE.DoubleSide }));
    ring.position.set(cx, cy, -i * (depth / 12));
    group.add(ring);
  }
  const g = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.2, r * 2.2), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: glow, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  g.position.set(cx, cy, -depth * 0.7);
  group.add(g);
  return group;
}

export function glowTexture(color = [239, 181, 61]) {
  return canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(255,222,150,0.9)`);
    g.addColorStop(0.3, `rgba(${color.join(',')},0.32)`);
    g.addColorStop(1, `rgba(${color.join(',')},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
  });
}

/** A key light that casts soft shadows over a pixel-space page. */
export function pageLight(scene, W, H, { x = -0.4, y = 0.9, z = 1.3, intensity = 2.4, target = [W / 2, H / 2, 0] } = {}) {
  const sun = new THREE.DirectionalLight('#fff3e2', intensity);
  sun.position.set(target[0] + x * W, target[1] + y * H, z * H);
  sun.target.position.set(...target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  const cam = sun.shadow.camera;
  cam.left = -W; cam.right = W; cam.top = H; cam.bottom = -H; cam.near = 1; cam.far = H * 6;
  scene.add(sun, sun.target, new THREE.HemisphereLight('#fff6ea', '#3a2a40', 0.6));
  return sun;
}

// ------------------------------------------------------------------ project screens

export function loadTexture(url) {
  return new Promise((done) => new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; done(t); }));
}

/** Locked has no screenshot on disk: its first screen drawn plainly, in its own dark and ember. */
export function lockedScreen() {
  return canvasTex(540, 1050, (x, w, h) => {
    x.fillStyle = '#0e0d10'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f2efe8'; x.font = '800 58px Barlow'; x.fillText('PUSH DAY', 40, 150);
    x.fillStyle = '#ff7a2f'; x.font = '500 26px "IBM Plex Mono"'; x.fillText('STREAK 23 · FORGED', 40, 200);
    const rows = [['Bench press', '82.5 kg × 5'], ['Incline DB', '30 kg × 8'], ['Dips', 'BW + 10 × 8'], ['Cable fly', '18 kg × 12']];
    rows.forEach(([a, b], i) => {
      const y = 300 + i * 150;
      x.fillStyle = '#1a181d'; x.beginPath(); x.roundRect(30, y, w - 60, 120, 18); x.fill();
      x.fillStyle = '#f2efe8'; x.font = '500 30px Barlow'; x.fillText(a, 60, y + 52);
      x.fillStyle = '#ff9a5c'; x.font = '500 22px "IBM Plex Mono"'; x.fillText(`NEXT ${b}`, 60, y + 94);
    });
  });
}

/** The Roblox game: no name yet, locked, in development. */
export function lockedGame() {
  return canvasTex(1440, 810, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#15121c'); g.addColorStop(1, '#0a090d');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(242,239,232,0.06)'; x.lineWidth = 2;
    for (let i = -h; i < w; i += 36) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    x.strokeStyle = '#f2efe8'; x.lineWidth = 10;
    x.beginPath(); x.roundRect(w / 2 - 60, h / 2 - 10, 120, 100, 14); x.stroke();
    x.beginPath(); x.arc(w / 2, h / 2 - 10, 40, Math.PI, 0); x.stroke();
    x.fillStyle = 'rgba(242,239,232,0.7)'; x.font = '500 30px "IBM Plex Mono"'; x.textAlign = 'center';
    x.fillText('IN DEVELOPMENT', w / 2, h / 2 + 170);
  });
}

// ------------------------------------------------------------------ the robot's face: a visor and a coin slot

/** The visor's words: the glow colour on near-black, faint scan lines, a caret after the last line. */
export function visorTexture(lines, { size = 92, caret = true, align = 'center' } = {}) {
  return canvasTex(2048, 512, (x, w, h) => {
    x.fillStyle = '#07050b';
    x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, 'rgba(239,181,61,0.10)');
    g.addColorStop(1, 'rgba(239,181,61,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = C.glow;
    x.textBaseline = 'middle';
    x.textAlign = align;
    const lh = size * 1.25;
    lines.forEach(([text, s = size], i) => {
      x.font = `500 ${s}px "IBM Plex Mono"`;
      const y = h / 2 + (i - (lines.length - 1) / 2) * lh;
      const at = align === 'center' ? w / 2 : 150;
      x.fillText(text, at, y);
      if (caret && i === lines.length - 1) {
        const tw = x.measureText(text).width;
        x.fillRect(align === 'center' ? at + tw / 2 + 18 : at + tw + 18, y - s * 0.42, s * 0.5, s * 0.84);
      }
    });
    x.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < h; y += 6) x.fillRect(0, y, w, 2);
  });
}

/**
 * A geometric head, not a face: a rounded helmet, one curved visor band across it with words in the glow colour, a disc
 * on each side, a coin slot on the chin.
 */
export function visorHead(lines) {
  const head = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: '#211d27', metalness: 0.75, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const edge = new THREE.MeshPhysicalMaterial({ color: '#3a3542', metalness: 0.9, roughness: 0.3 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; head.add(m); return m; };
  const skull = add(new THREE.SphereGeometry(1, 96, 64), shell);
  skull.scale.set(4.4, 3.3, 3.0);
  // The visor: a band of dark glass following the helmet's curve, the words lit inside it.
  const words = visorTexture(lines);
  words.wrapS = THREE.ClampToEdgeWrapping;
  const span = 1.9;
  const band = new THREE.CylinderGeometry(1, 1, 1.5, 96, 1, true, -span / 2, span);
  const visor = new THREE.Mesh(band, new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(1, 1, 1), emissiveMap: words, emissiveIntensity: 1.7, side: THREE.FrontSide }));
  visor.scale.set(4.42, 1, 3.03);
  visor.position.y = 0.45;
  head.add(visor);
  for (const sx of [-1, 1]) {
    const disc = add(new THREE.CylinderGeometry(0.95, 0.95, 0.35, 64), edge, sx * 4.35, 0.1, 0);
    disc.rotation.z = Math.PI / 2;
    const inner = add(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 64), shell, sx * 4.4, 0.1, 0);
    inner.rotation.z = Math.PI / 2;
  }
  // The coin slot on the chin, lit round its edge.
  const chin = new THREE.Group();
  chin.position.set(0, -1.85, 2.38);
  chin.rotation.x = -0.62;
  head.add(chin);
  const plate = new THREE.Mesh(rounded(1.2, 1.4, 0.25, 0.12), edge);
  const slit = new THREE.Mesh(rounded(0.18, 0.95, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: '#000' }));
  const glowRing = new THREE.Mesh(rounded(0.3, 1.07, 0.27, 0.08), new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(C.glow), emissiveIntensity: 1.6 }));
  slit.position.z = 0.03;
  chin.add(plate, glowRing, slit);
  head.userData.slot = chin;
  return head;
}
