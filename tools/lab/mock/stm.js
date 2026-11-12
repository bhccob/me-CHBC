// LAB ONLY (throwaway). Round 60, idea 1: See · Think · Make. Bob's eye, brain and printer are one machine you are
// always inside, never shown from outside. One gold dot runs through it: the pupil, the spark in the brain, the ink dot
// on the last sheet, the full stop. Frames (?f=1..7): 1 the eye (the O of BOB), 2 through the pupil, 3 the brain lights
// a part per study, 4 the parts feed one line that prints, 5 the prints, 6 a blank sheet with one dot, 7 Let's talk.
import { THREE, fonts, ready, key, span, clamp, scroller, pointer, paperLayer, loadWorks, pictureMaterial, bloom, renderer as makeRenderer, glowSprite, worksChrome } from './r60.js';
import { pixelCamera } from './kit.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

await fonts();
const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio);
const phone = W / H < 0.8;
document.body.classList.toggle('phone', phone);
const scroll = scroller(7);
const ptr = pointer(phone ? [0.7, 0.62] : [0.47, 0.8]);

// ------------------------------------------------------------------ the first page: the name, the O is a lens
const page = document.getElementById('page');
paperLayer(page, W, H, dpr);
const end = document.getElementById('end');
paperLayer(end, W, H, dpr, { at: [0.3, 0.5], s: 23 });
const name = page.querySelector('.name'), slot = name.querySelector('.slot');
const r1 = name.querySelector('.r1'), r2 = name.querySelector('.r2');
const probe = document.createElement('canvas').getContext('2d');
probe.font = '800 1000px Barlow';
const cap = probe.measureText('B').actualBoundingBoxAscent / 1000, D = cap * 1.06;
const setSize = (s) => { name.style.fontSize = `${s}px`; slot.style.width = `${D * s}px`; slot.style.height = `${cap * s}px`; slot.style.margin = `0 ${0.025 * s}px`; };
let size = 200;
const gapEl = name.querySelector('.gap');
for (let i = 0; i < 5; i++) {
  setSize(size);
  const a = r1.getBoundingClientRect().width, b = r2.getBoundingClientRect().width;
  const wide = phone ? Math.max(a, b) : a + b + gapEl.getBoundingClientRect().width;
  size *= Math.min((phone ? W * 0.74 : W * 0.8) / wide, (phone ? H * 0.115 : H * 0.24) / (cap * size));
}
setSize(size);
name.style.top = `${phone ? H * 0.16 : H * 0.15}px`;
const box = slot.getBoundingClientRect();
const ox = box.left + box.width / 2, oy = box.top + box.height / 2, R = (D * size) / 2;
const nb = name.getBoundingClientRect();
const eyebrow = page.querySelector('.eyebrow');
const r2b = r2.getBoundingClientRect();
Object.assign(eyebrow.style, phone ? { left: 'var(--gutter)', top: `${nb.top - 30}px` } : { left: `${r2b.left + size * 0.05}px`, top: `${r2b.top - 4}px` });
const intro = page.querySelector('.intro'), side = page.querySelector('.side');
const r1b = r1.getBoundingClientRect();
Object.assign(intro.style, phone ? { left: 'var(--gutter)', right: 'var(--gutter)', top: `${nb.bottom + H * 0.05}px` } : { left: `${r1b.left + size * 0.02}px`, top: `${nb.bottom + H * 0.085}px` });
const ib = intro.getBoundingClientRect();
Object.assign(side.style, phone ? { left: 'var(--gutter)', right: 'var(--gutter)', top: `${ib.bottom + 22}px` } : { left: `${Math.max(r2b.left + size * 0.1, ib.right + 60)}px`, top: `${ib.bottom - 52}px` });
// The page has a hole under the lens: the inside shows through the pupil.
const HOLE = 0.66;
page.style.webkitMaskImage = page.style.maskImage = `radial-gradient(circle at ${ox}px ${oy}px, transparent ${R * HOLE}px, #000 ${R * HOLE + 1}px)`;

// The last page: Let's talk, its full stop is the lens again.
const talk = end.querySelector('.talk');
Object.assign(talk.style, phone ? { left: 'var(--gutter)', top: `${H * 0.3}px`, fontSize: `${W * 0.2}px`, whiteSpace: 'normal' } : { left: `calc(var(--gutter) * 2)`, top: `${H * 0.3}px` });
const tb = talk.getBoundingClientRect();
Object.assign(end.querySelector('.eyebrow').style, { left: `calc(var(--gutter) * 2)`, top: `${tb.top - 40}px` });
Object.assign(end.querySelector('.links').style, { left: `calc(var(--gutter) * 2)`, top: `${tb.bottom + H * 0.07}px` });
Object.assign(end.querySelector('.where').style, { left: `calc(var(--gutter) * 2)`, bottom: 'var(--gutter)' });
const stopB = end.querySelector('.stop').getBoundingClientRect();
const sx = stopB.left + stopB.width / 2, sy = stopB.top + stopB.height / 2, sR = stopB.width * 0.62;
document.body.dataset.on = '';

// ------------------------------------------------------------------ the lens: a gold barrel, an eight-blade iris, glass
const lensCanvas = document.getElementById('lens');
const rB = makeRenderer(lensCanvas, W, H, { alpha: true, exposure: 1.0 });
rB.toneMapping = THREE.NoToneMapping;
const sceneB = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(rB); sceneB.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sceneB.environmentIntensity = 0.55; pm.dispose(); }
const camB = new THREE.PerspectiveCamera();
pixelCamera(camB, W, H);
// Glows on a see-through canvas: add light, never cover what is behind.
const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const sunB = new THREE.DirectionalLight('#ffe6c4', 1.6);
sunB.position.set(W * 0.1, H * 1.6, H * 1.3);
sunB.target.position.set(W / 2, H / 2, 0);
const glint = new THREE.PointLight('#ffd9a0', 2.2, 0, 0);
sceneB.add(sunB, sunB.target, glint, new THREE.HemisphereLight('#ffeedd', '#1a0c28', 0.5));

const lens = new THREE.Group();
// The barrel's gold matches the printed B's beside it, with a little metal on top: it reads as the letter O first.
const goldMetal = new THREE.MeshStandardMaterial({ color: '#cf9a62', emissive: '#cf9a62', emissiveIntensity: 0.42, metalness: 0.55, roughness: 0.34 });
const darkMetal = new THREE.MeshPhysicalMaterial({ color: '#2b1c14', metalness: 0.9, roughness: 0.4 });
{
  // The barrel, turned: inner wall, a bevel, the front face, the outer edge.
  // Outside in, so every face points out of the metal.
  const prof = [[1.0, -0.3], [1.0, 0.0], [0.985, 0.06], [0.93, 0.095], [0.79, 0.095], [0.7, 0.07], [0.655, 0.0], [0.655, -0.3]].map(([r, h]) => new THREE.Vector2(r, h));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), goldMetal);
  barrel.rotation.x = Math.PI / 2;
  lens.add(barrel);
  // Two fine rings cut into the front face.
  for (const r of [0.84, 0.885]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0055, 8, 160), darkMetal);
    ring.position.z = 0.096;
    lens.add(ring);
  }
  // The housing behind the blades.
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.66, 96), new THREE.MeshStandardMaterial({ color: '#0d0810', roughness: 0.8 }));
  back.position.z = -0.08;
  back.visible = false; // the inside shows through the opening, so the housing is only the blades' ring
  lens.add(back);
}
const blades = new THREE.Group();
lens.add(blades);
const bladeMats = [0, 1].map((k) => new THREE.MeshPhysicalMaterial({ color: k ? '#3a2618' : '#2e1e14', metalness: 0.92, roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide }));
const edgeMat = new THREE.LineBasicMaterial({ color: '#f0c48a', transparent: true, opacity: 0.55 });
let bladeOpen = -1;
/** Eight blades leave an octagon of circumradius `ri` open; each one's inner edge runs on until it meets the housing. */
function setBlades(ri) {
  if (Math.abs(ri - bladeOpen) < 0.002) return;
  bladeOpen = ri;
  for (const c of [...blades.children]) { blades.remove(c); c.geometry.dispose(); }
  const n = 8, ro = 0.67, tw = 0.3;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2 + tw, a1 = ((k + 1) / n) * Math.PI * 2 + tw;
    const v0 = new THREE.Vector2(Math.cos(a0), Math.sin(a0)).multiplyScalar(ri);
    const v1 = new THREE.Vector2(Math.cos(a1), Math.sin(a1)).multiplyScalar(ri);
    const dir = v1.clone().sub(v0).normalize();
    const b = v1.dot(dir), c = v1.lengthSq() - ro * ro;
    const e = v1.clone().addScaledVector(dir, -b + Math.sqrt(b * b - c));
    const ae = Math.atan2(e.y, e.x);
    let aEnd = a0 - 0.05;
    let aStart = ae; while (aStart < aEnd) aStart += Math.PI * 2;
    const sh = new THREE.Shape();
    sh.moveTo(v0.x, v0.y); sh.lineTo(e.x, e.y);
    for (let i = 1; i <= 40; i++) { const a = aStart + (aEnd - aStart) * (i / 40); sh.lineTo(Math.cos(a) * ro, Math.sin(a) * ro); }
    sh.lineTo(v0.x, v0.y);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 2), bladeMats[k % 2]);
    m.position.z = -0.05 + k * 0.006;
    blades.add(m);
    const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(v0.x, v0.y, 0.0005), new THREE.Vector3(e.x, e.y, 0.0005)]), edgeMat);
    edge.position.z = m.position.z;
    blades.add(edge);
  }
}
{
  // The glass: a shallow dome over the iris, reflecting the room.
  const Rs = 1.6, a = 0.7;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(Rs, 96, 24, 0, Math.PI * 2, 0, Math.asin(a / Rs)), new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.05, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }));
  dome.rotation.x = Math.PI / 2;
  dome.position.z = 0.13 - Rs;
  dome.renderOrder = 5;
  lens.add(dome);
  // A soft window reflection, top left, as on a real lens.
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; void main(){ vec2 p = (vUv - 0.5) * 1.4; float r = length(p);
      float arc = smoothstep(0.62, 0.55, r) * smoothstep(0.42, 0.5, length(p - vec2(0.12, -0.12)));
      float side = smoothstep(-0.1, -0.45, p.x + p.y * 0.2);
      float spot = exp(-dot(p - vec2(-0.3, 0.33), p - vec2(-0.3, 0.33)) / 0.004);
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * (arc * side * 0.28 + spot * 0.9), 1.0); }`,
  }));
  hl.position.z = 0.135;
  hl.renderOrder = 6;
  lens.add(hl);
}
const pupil = new THREE.Sprite(glowSprite([239, 181, 61], [255, 238, 200]));
Object.assign(pupil.material, ADD);
pupil.renderOrder = 4;
lens.add(pupil);
const pupilCore = new THREE.Mesh(new THREE.CircleGeometry(0.045, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.62), toneMapped: false }));
pupilCore.position.z = -0.02;
lens.add(pupilCore);
sceneB.add(lens);

// ------------------------------------------------------------------ the inside: a gold brain in the dark, the print line, the prints
const deep = document.getElementById('deep');
const rA = makeRenderer(deep, W, H, { exposure: 1.05 });
const sceneA = new THREE.Scene();
sceneA.background = new THREE.Color('#0a0512');
const camA = new THREE.PerspectiveCamera(30, W / H, 0.05, 500);
// Only what is brighter than paper glows: the gold lines, the dot, the lit parts of the brain.
const fx = bloom(rA, sceneA, camA, W, H, { strength: 0.8, radius: 0.5, threshold: 1.25 });

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const brainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uA: { value: 1 }, uLit: { value: [0, 0, 0, 0] }, uC: { value: [new THREE.Vector3(-0.66, 0.2, 0.42), new THREE.Vector3(0.24, 0.6, 0.38), new THREE.Vector3(-0.18, -0.34, 0.6), new THREE.Vector3(0.7, -0.52, 0.28)] } },
  vertexShader: 'attribute float fold; varying vec3 vN; varying vec3 vV; varying vec3 vO; varying float vF; void main(){ vO = (modelMatrix * vec4(position, 1.0)).xyz; vF = fold; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform float uA; uniform float uLit[4]; uniform vec3 uC[4]; varying vec3 vN; varying vec3 vV; varying vec3 vO; varying float vF;
    void main(){
      float f = pow(1.0 - abs(dot(vN, vV)), 2.4);
      vec3 gold = vec3(1.0, 0.62, 0.26);
      vec3 col = gold * (f * 0.62 + 0.008) * (0.45 + 0.8 * vF);
      float lit = 0.0;
      for (int k = 0; k < 4; k++) { vec3 d = vO - uC[k]; lit += uLit[k] * exp(-dot(d, d) / 0.05); }
      col += vec3(1.0, 0.74, 0.4) * lit * (0.05 + 0.85 * vF * vF) * (0.35 + f);
      gl_FragColor = vec4(col * uA, 1.0);
    }`,
});
const brain = new THREE.Group();
{
  const v = new THREE.Vector3();
  const shape = (geo, fn) => {
    const pos = geo.attributes.position, fold = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); fold[i] = fn(v); pos.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    geo.setAttribute('fold', new THREE.BufferAttribute(fold, 1));
    return geo;
  };
  // The cerebrum: long in x, its front (at -x) lower and rounder, folds all over, a fissure between the halves and a
  // groove low on the side.
  const cerebrum = shape(new THREE.SphereGeometry(1, 220, 160), (p) => {
    const s = Math.abs(Math.sin(p.x * 10.5 + Math.sin(p.y * 8 + p.z * 3) * 1.8) * Math.sin(p.y * 9.5 + p.z * 6 + Math.cos(p.x * 7) * 1.5));
    const fis = Math.exp(-Math.pow(p.z / 0.06, 2)) * 0.12 * smooth(-0.3, 0.3, p.y);
    const syl = Math.exp(-Math.pow((p.y - (-0.16 + 0.32 * (p.x + 0.25))) / 0.045, 2)) * 0.06 * smooth(-0.75, -0.45, p.x) * smooth(0.55, 0.3, p.x) * smooth(0.35, 0.6, Math.abs(p.z));
    p.multiplyScalar(1 + s * 0.055 - fis - syl);
    p.x *= 1.0; p.y *= 0.74; p.z *= 0.84;
    if (p.y < 0) p.y *= 0.8 + 0.12 * smooth(0.2, -0.6, p.x);
    p.y -= 0.06 * Math.max(0, -p.x - 0.2);
    return s;
  });
  brain.add(new THREE.Mesh(cerebrum, brainMat));
  // The cerebellum, tucked under the back, with fine horizontal folds; the brainstem below it.
  const cb = shape(new THREE.SphereGeometry(1, 120, 90), (p) => { const s = Math.abs(Math.sin(p.y * 34 + p.x * 3)); p.multiplyScalar(1 + s * 0.035); return 0.4 + s * 0.6; });
  const cbm = new THREE.Mesh(cb, brainMat);
  cbm.scale.set(0.33, 0.21, 0.5);
  cbm.position.set(0.6, -0.5, 0);
  brain.add(cbm);
  const st = shape(new THREE.CylinderGeometry(0.1, 0.13, 0.62, 48, 24), () => 0.12);
  const stm = new THREE.Mesh(st, brainMat);
  stm.position.set(0.32, -0.8, 0);
  stm.rotation.z = -0.42;
  brain.add(stm);
}
sceneA.add(brain);
// Dust round it, for depth as you fly in.
{
  const n = 900, pts = new Float32Array(n * 3);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) { const r = 1.5 + Math.pow(rnd(), 0.7) * 9, a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1); pts.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b) * 0.7, r * Math.sin(b) * Math.sin(a) - 1], i * 3); }
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)), new THREE.PointsMaterial({ color: new THREE.Color(1.2, 0.85, 0.5), size: 0.022, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  sceneA.add(dust);
}
const spark = new THREE.Sprite(glowSprite());
spark.position.set(-0.66, 0.2, 0.5);
sceneA.add(spark);
const haze = new THREE.Sprite(glowSprite([110, 60, 180], [70, 40, 120]));
haze.material.opacity = 0.12;
haze.scale.setScalar(8);
haze.position.set(0.2, 0, -3);
sceneA.add(haze);
// A soft light on each part as its study lights it.
const partGlows = brainMat.uniforms.uC.value.map((c) => { const s = new THREE.Sprite(glowSprite()); s.position.copy(c); s.position.z += 0.1; sceneA.add(s); return s; });

// The print head: a dark bar with a lit slot under the brain.
const HEAD = -1.15;
const head = new THREE.Group();
{
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.11, 0.16), new THREE.MeshBasicMaterial({ color: '#120a18' }));
  bar.position.y = HEAD + 0.06;
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.75), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  slit.position.set(0, HEAD + 0.003, 0.085);
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 0.004), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.62, 0.34) }));
  lip.position.set(0, HEAD + 0.115, 0.081);
  head.add(bar, slit, lip);
}
sceneA.add(head);
// The four studies feed one line into the head.
const merge = new THREE.Vector3(0, -0.98, 0.18);
const feedMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 1.5, 0.66), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const feeds = brainMat.uniforms.uC.value.map((c, k) => {
  const pts = [c.clone(), new THREE.Vector3(c.x * 0.7, Math.min(c.y, -0.3) - 0.35, 0.5), new THREE.Vector3(c.x * 0.25, -0.86, 0.3), merge.clone(), new THREE.Vector3(0, HEAD + 0.12, 0.09)];
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, k === 0 ? 0.0075 : 0.0055, 8), feedMat);
  sceneA.add(m);
  return m;
});

// The prints: same size, matte paper with a white border; a sixth sheet comes out blank but for one gold dot.
const works = await loadWorks(rA);
const PW = 2.54, PH = 1.64, BORDER = 0.07, GAP = 2.9, BAND_Y = -2.03;
const prints = works.map((w) => {
  const mat = pictureMaterial(w.tex, { w: PW, h: PH, border: BORDER, glow: 0.3 });
  mat.uniforms.uHead.value = HEAD;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  sceneA.add(m);
  return m;
});
{
  const mat = pictureMaterial(null, { w: PW, h: PH, border: 0, paper: '#24113a' });
  mat.uniforms.uBlank.value = 1;
  mat.uniforms.uHead.value = HEAD;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.03, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.3, 0.62) }));
  dot.position.z = 0.002;
  const dotGlow = new THREE.Sprite(glowSprite());
  dotGlow.scale.setScalar(0.42);
  dotGlow.position.z = 0.003;
  sheet.add(dot, dotGlow);
  sheet.userData.dot = [dot, dotGlow];
  sceneA.add(sheet);
  prints.push(sheet);
}

// ------------------------------------------------------------------ the type of the middle acts
const think = document.getElementById('think');
const nums = [...document.querySelectorAll('#nums .num')];
const numsLayer = document.getElementById('nums');
const chrome = worksChrome(document.body);
const acts = [...document.querySelectorAll('.acts span')];
const cue = document.querySelector('.cue');
const cur = document.querySelector('.cur');
const q = new URLSearchParams(location.search);
if (q.get('f') === '5') { cur.hidden = false; Object.assign(cur.style, { left: `${W * 0.585}px`, top: `${H * 0.46}px` }); }

// ------------------------------------------------------------------ the frames
const CAM = [[0, 0.05, 70], [0, 0.05, 10], [0, 0.04, 5.0], [0, -1.58, 6.6], [0, -2.0, 4.75], [0, -2.0, 4.75], [0, -2.0, 0.62]];
const LOOK = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, -1.58, 0], [0, -2.0, 0], [0, -2.0, 0], [0, -2.0, 0]];
const CENTRE = [[ox / W, oy / H], [ox / W, oy / H], phone ? [0.5, 0.42] : [0.69, 0.5], [0.5, 0.5], [0.5, 0.47], [0.5, 0.47], [0.5, 0.5]];
const v3 = new THREE.Vector3();
let frames = 0;
function frame(now) {
  const p = scroll.tick(now);
  ptr.tick();

  // The first page zooms about the O as you go through the pupil.
  const m = p <= 1 ? key([1, 3.2], p) : 3.2 * Math.exp((p - 1) * 6);
  const onPage = p < 1.4;
  page.style.display = onPage ? '' : 'none';
  if (onPage) {
    page.style.transform = `translate(${ox}px, ${oy}px) scale(${m}) translate(${-ox}px, ${-oy}px)`;
    page.style.filter = m > 1.02 ? `blur(${Math.min(9, (m - 1) * 1.5)}px)` : '';
  }
  const endA = span(p, 5.45, 5.95);
  end.style.opacity = endA;
  end.style.display = endA > 0 ? '' : 'none';

  // The lens: at the O, then (at the end) as the full stop.
  const atEnd = p > 5.5;
  const lx = atEnd ? sx : ox, ly = atEnd ? sy : oy, lr = atEnd ? sR : R * m;
  lens.visible = (onPage && R * m * 0.6 < Math.hypot(W, H)) || atEnd;
  lens.position.set(lx, H - ly, 0);
  lens.scale.setScalar(lr);
  const dx = clamp((ptr.x - lx) / W * 1.6, -1, 1), dy = clamp((ptr.y - ly) / H * 1.6, -1, 1);
  lens.rotation.set(dy * 0.42, dx * 0.42, 0);
  setBlades(atEnd ? 0.3 : key([0.24, 0.6], clamp(p, 0, 1)));
  pupil.position.set(dx * 0.05, -dy * 0.05, -0.03);
  pupil.scale.setScalar(atEnd ? 0.5 : key([0.48, 0.22], clamp(p, 0, 1)));
  pupilCore.position.set(dx * 0.05, -dy * 0.05, -0.02);
  pupilCore.visible = atEnd || p < 0.7;
  glint.position.set(ptr.x, H - ptr.y, H * 0.35);
  rB.render(sceneB, camB);

  // The inside.
  const cx = key(CENTRE, p);
  camA.position.set(...key(CAM, p));
  camA.lookAt(v3.set(...key(LOOK, p)));
  camA.setViewOffset(W, H, W / 2 - cx[0] * W, H / 2 - cx[1] * H, W, H);
  brainMat.uniforms.uLit.value = [0, 1, 2, 3].map((k) => span(p, 1.45 + k * 0.12, 1.62 + k * 0.12) * (1 - 0.55 * span(p, 3.3, 4)));
  partGlows.forEach((g, k) => { g.scale.setScalar(0.42 * brainMat.uniforms.uLit.value[k]); g.material.opacity = 0.7; });
  brainMat.uniforms.uA.value = 1 - 0.5 * span(p, 3.4, 4);
  spark.scale.setScalar(0.5 * span(p, 0.9, 1.3) * (1 - span(p, 1.6, 2)));
  head.visible = p > 2.2 && p < 5.85;
  head.children.forEach((c) => { if (c.material.transparent) c.material.opacity = span(p, 2.2, 2.7); });
  const feed = span(p, 2.1, 2.85);
  feeds.forEach((f) => { f.geometry.setDrawRange(0, Math.floor(f.geometry.index.count * feed)); f.visible = feed > 0 && p < 5.85; });
  feedMat.opacity = 1 - 0.5 * span(p, 3.5, 4);
  const E = key([0, 0, 0, 0.62, 5, 6, 6], p), band = key([0, 0, 0, 0, 2, 5, 5], p);
  prints.forEach((pr, i) => {
    const e = clamp(E - i), d = i - band;
    pr.visible = e > 0 && Math.abs(d) < 3.2;
    pr.position.set(d * GAP, BAND_Y + PH * (1 - e) + 0.05 * (1 - e), -0.3 * Math.pow(Math.abs(d), 1.25));
    pr.rotation.y = -d * 0.1;
    const u = pr.material.uniforms;
    u.uHead.value = e < 1 ? HEAD : 1e6; // once a print is all the way out, its ink has settled
    u.uBlur.value = Math.min(3.2, Math.abs(d) * 2.4);
    u.uDim.value = 1 - Math.min(0.62, Math.abs(d) * 0.5);
    if (pr.userData.dot) pr.userData.dot.forEach((o) => { o.visible = pr.position.y < HEAD - 0.02; });
  });
  fx.render();

  // Type.
  const tA = span(p, 1.6, 1.95) * (1 - span(p, 2.3, 2.7));
  think.style.opacity = tA;
  numsLayer.style.opacity = tA;
  if (tA > 0) {
    brainMat.uniforms.uC.value.forEach((c, k) => {
      v3.copy(c).project(camA);
      Object.assign(nums[k].style, { left: `${(v3.x * 0.5 + 0.5) * W + 30}px`, top: `${(-v3.y * 0.5 + 0.5) * H - 26}px` });
    });
  }
  const wA = span(p, 3.55, 3.9) * (1 - span(p, 4.55, 4.9));
  chrome.el.style.opacity = wA;
  chrome.set(clamp(Math.round(band), 0, 4), works);
  const act = p < 1.4 ? 0 : p < 3.35 ? 1 : p < 5.45 ? 2 : -1;
  acts.forEach((a, i) => a.classList.toggle('on', i === act));
  cue.style.opacity = 1 - span(p, 0.05, 0.4);

  if (++frames === 3) ready();
  if (!scroll.fixed || frames < 4) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
