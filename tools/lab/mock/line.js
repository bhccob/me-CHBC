// LAB ONLY (throwaway). Round 60, idea 2: One Line. One unbroken gold line draws the whole site: it writes "Chung"
// after BOB, runs down the page, passes Aruba and arcs to Rotterdam, bends into a sign per study, lifts off the page as a
// wire into the dark and frames each work, then comes back flat to underline "Let's talk" and stops in a loose end.
// Frames (?f=1..7): 1 the name, 2 the way down, 3 about and the four signs, 4 the page tips back and the line lifts,
// 5 the works, 6 the line leaves the last frame toward you, 7 the loose end.
import { THREE, fonts, ready, key, span, clamp, mix, scroller, pointer, paper, loadWorks, pictureMaterial, bloom, renderer as makeRenderer, pathFromRuns, worksChrome } from './r60.js';

await fonts();
const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio);
const phone = W / H < 0.8;
document.body.classList.toggle('phone', phone);
const scroll = scroller(7);
const ptr = pointer([0.6, 0.3]);
const q = new URLSearchParams(location.search);

// ------------------------------------------------------------------ the sheet: one tall page the scroll pans
const sheet = document.getElementById('sheet');
const DOC_H = 2.3 * H;
sheet.style.height = `${DOC_H}px`;
const pc = paper(W, DOC_H, dpr, { at: [0.35, 0.22] });
pc.className = 'paper';
sheet.prepend(pc);
const svg = sheet.querySelector('svg.ink');
svg.setAttribute('width', W); svg.setAttribute('height', DOC_H);
svg.setAttribute('viewBox', `0 0 ${W} ${DOC_H}`);

// The name: BOB set solid; the line writes "Chung" after it in one stroke.
const probe = document.createElement('canvas').getContext('2d');
probe.font = '800 1000px Barlow';
const capR = probe.measureText('B').actualBoundingBoxAscent / 1000;
const k = phone ? W * 0.21 : H * 0.19; // cap height
const bob = svg.querySelector('.bob');
bob.setAttribute('font-size', k / capR);
const nameX = phone ? W * 0.07 : W * 0.075, baseY = phone ? H * 0.3 : H * 0.42;
bob.setAttribute('x', nameX); bob.setAttribute('y', baseY);
const bobW = bob.getComputedTextLength();
const sx = phone ? nameX + k * 0.05 : nameX + bobW + k * 0.32, sy = phone ? baseY + k * 1.55 : baseY;
const U = ([x, y]) => [sx + x * k, sy - y * k];
const CHUNG = [
  [[0.66, 0.84], [0.52, 0.97], [0.32, 0.98], [0.14, 0.86], [0.04, 0.62], [0.03, 0.36], [0.12, 0.12], [0.3, 0.0], [0.5, 0.0], [0.66, 0.1], [0.8, 0.3], [0.92, 0.6], [0.99, 0.92], [0.99, 1.14], [0.93, 1.22], [0.86, 1.14], [0.84, 0.9], [0.85, 0.5], [0.86, 0.0]],
  [[0.86, 0.0], [0.88, 0.28], [0.96, 0.48], [1.08, 0.56], [1.2, 0.5], [1.26, 0.3], [1.27, 0.08], [1.33, 0.0], [1.43, 0.06], [1.52, 0.28], [1.56, 0.55]],
  [[1.56, 0.55], [1.56, 0.3], [1.6, 0.08], [1.7, 0.0], [1.84, 0.06], [1.93, 0.28], [1.96, 0.55]],
  [[1.96, 0.55], [1.96, 0.25], [1.98, 0.05], [2.05, 0.0], [2.13, 0.08], [2.19, 0.3], [2.22, 0.52]],
  [[2.22, 0.52], [2.22, 0.0]],
  [[2.22, 0.0], [2.25, 0.3], [2.34, 0.5], [2.46, 0.56], [2.58, 0.48], [2.63, 0.28], [2.64, 0.06], [2.71, 0.0], [2.8, 0.07], [2.92, 0.32], [3.06, 0.52]],
  [[3.06, 0.52], [2.96, 0.57], [2.86, 0.5], [2.82, 0.3], [2.87, 0.1], [2.98, 0.04], [3.08, 0.12], [3.12, 0.32], [3.13, 0.55]],
  [[3.13, 0.55], [3.13, 0.2], [3.12, -0.2], [3.08, -0.5], [2.98, -0.68], [2.84, -0.68], [2.78, -0.55], [2.86, -0.38], [3.04, -0.26], [3.3, -0.2], [3.6, -0.24]],
].map((run) => run.map(U));
const gEnd = CHUNG.at(-1).at(-1);

// The way down, then about me: Aruba, the arc to Rotterdam, and a row of four signs.
const C0 = 1.2 * H; // where the about section starts on the sheet
const P = (x, y) => [x * W, C0 + y * H];
const aruba = P(0.09, 0.36), rotterdam = P(0.4, 0.27);
const descent = [gEnd, [gEnd[0] + W * 0.05, gEnd[1] + H * 0.05], [W * 0.9, H * 0.62], [W * 0.91, H * 0.82], [W * 0.82, H * 0.97], [W * 0.6, H * 1.06], [W * 0.3, H * 1.09], [W * 0.12, H * 1.16], [W * 0.065, H * 1.34], aruba];
const arc = [aruba, P(0.13, 0.2), P(0.24, 0.12), P(0.34, 0.15), rotterdam];
const u = phone ? W * 0.14 : H * 0.15, yc = C0 + H * 0.68;
const SIGNS = [
  { w: 1.3, entry: [0, 0.5], exit: [1.3, 0.5], runs: [[[0, 0.5], [0.32, 0.88]], [[0.32, 0.88], [0, 0.5]], [[0, 0.5], [0.32, 0.12]], [[0.32, 0.12], [0.45, 0.04]], [[0.45, 0.04], [0.8, 0.96]], [[0.8, 0.96], [0.98, 0.88]], [[0.98, 0.88], [1.3, 0.5]], [[1.3, 0.5], [0.98, 0.12]], [[0.98, 0.12], [1.3, 0.5]]] },
  { w: 1.0, entry: [0, 0.5], exit: [1.0, 0.5], runs: [
    [[0, 0.5], [0, 0.76], [0.06, 0.94], [0.24, 1.0], [0.5, 1.0], [0.76, 1.0], [0.94, 0.94], [1.0, 0.76], [1.0, 0.5], [1.0, 0.24], [0.94, 0.06], [0.76, 0], [0.5, 0], [0.24, 0], [0.06, 0.06], [0, 0.24], [0, 0.5]],
    [[0, 0.5], [0.37, 0.5]], [[0.37, 0.5], [0.37, 0.27]], [[0.37, 0.27], [0.71, 0.5]], [[0.71, 0.5], [0.37, 0.73]], [[0.37, 0.73], [0.37, 0.5]], [[0.37, 0.5], [0.71, 0.5]], [[0.71, 0.5], [1.0, 0.5]]] },
  { w: 0.9, entry: [0.05, 0.5], exit: [0.95, 0.97], runs: [
    [[0.05, 0.5], [0.05, 0.84]], [[0.05, 0.84], [0.45, 0.98]], [[0.45, 0.98], [0.85, 0.84]], [[0.85, 0.84], [0.84, 0.55], [0.74, 0.26], [0.45, 0.02]], [[0.45, 0.02], [0.16, 0.26], [0.06, 0.42], [0.05, 0.5]],
    [[0.05, 0.5], [0.26, 0.5]], [[0.26, 0.5], [0.41, 0.33]], [[0.41, 0.33], [0.74, 0.72]], [[0.74, 0.72], [0.95, 0.97]]] },
  { w: 1.0, entry: [0, 0.5], exit: [1.0, 0.5], runs: (() => {
    const pol = (a, r) => [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
    const pts = [pol(Math.PI, 0.5)];
    for (let t = 0; t < 8; t++) {
      const c = Math.PI - t * (Math.PI / 4), n = c - Math.PI / 4;
      pts.push(pol(c - 0.13, 0.5), pol(c - 0.21, 0.39), pol(n + 0.21, 0.39), pol(n + 0.13, 0.5), pol(n, 0.5));
    }
    const runs = [];
    for (let i = 0; i < pts.length - 1; i++) runs.push([pts[i], pts[i + 1]]);
    const hub = [];
    for (let i = 0; i <= 16; i++) hub.push(pol(Math.PI - (i / 16) * Math.PI * 2, 0.15));
    runs.push([pts[0], hub[0]], hub, [hub.at(-1), [1.0, 0.5]]);
    return runs;
  })() },
];
const totalW = SIGNS.reduce((s, g) => s + g.w, 0) * u;
const x0 = W * (phone ? 0.06 : 0.07), x1 = W * (phone ? 0.94 : 0.93);
const gap = (x1 - x0 - totalW) / 3;
let xs = x0;
SIGNS.forEach((g) => { g.x = xs; xs += g.w * u + gap; });
const S = (g, [x, y]) => [g.x + x * u, yc + (0.5 - y) * u];
const swoop = [rotterdam, P(0.38, 0.4), P(0.25, 0.5), P(0.11, 0.54), P(0.04, 0.585), P(0.032, 0.64), S(SIGNS[0], SIGNS[0].entry)];
const connector = (a, b) => { const g = b[0] - a[0]; return [a, [a[0] + g * 0.35, yc + u * 0.16], [a[0] + g * 0.68, yc - u * 0.14], b]; };
const signRuns = SIGNS.map((g) => g.runs.map((run) => run.map((p) => S(g, p))));
const connectors = SIGNS.slice(0, 3).map((g, i) => connector(S(g, g.exit), S(SIGNS[i + 1], SIGNS[i + 1].entry)));
const axle = S(SIGNS[3], SIGNS[3].exit);
const exitRun = [axle, [axle[0] + W * 0.025, yc], [W * 1.04, yc]];
const RUNS = [...CHUNG, descent, arc, swoop, ...signRuns[0], connectors[0], ...signRuns[1], connectors[1], ...signRuns[2], connectors[2], ...signRuns[3], exitRun];
const D_ALL = pathFromRuns(RUNS);
// Where frames stop the pen, measured along the path.
const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
svg.append(tmp);
const lengthOf = (runs) => { tmp.setAttribute('d', pathFromRuns(runs)); return tmp.getTotalLength(); };
const L_NAME = lengthOf(CHUNG);
const L_DOWN = lengthOf([...CHUNG, descent.slice(0, 7)]);
const L_SIGN2 = lengthOf([...CHUNG, descent, arc, swoop, ...signRuns[0], connectors[0], ...signRuns[1]]);
tmp.remove();
const core = svg.querySelector('.core'), glow = svg.querySelector('.glow'), ghost = svg.querySelector('.ghost');
for (const el of [core, glow]) el.setAttribute('d', D_ALL);
core.setAttribute('stroke-width', phone ? 3.6 : 4.6);
glow.setAttribute('stroke-width', phone ? 9 : 12);
const L_ALL = core.getTotalLength();
ghost.setAttribute('d', pathFromRuns([connectors[1], ...signRuns[2], connectors[2], ...signRuns[3], exitRun]));
ghost.setAttribute('stroke-width', 3);
const dots = svg.querySelector('.dots');
for (const p of [aruba, rotterdam]) {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 7); c.setAttribute('fill', '#150923'); c.setAttribute('stroke', '#f3c88f'); c.setAttribute('stroke-width', 3);
  dots.append(c);
}
const tip = svg.querySelector('.tip'), tipHalo = svg.querySelector('.tipHalo');

// Type on the sheet.
const place = (el, s) => Object.assign(el.style, s);
place(sheet.querySelector('.e1'), phone ? { left: `${nameX}px`, top: `${baseY - k - 44}px` } : { left: `${nameX}px`, top: `${baseY - k - 48}px` });
const intro = sheet.querySelector('.intro');
place(intro, phone ? { left: `${nameX}px`, right: 'var(--gutter)', top: `${sy + k * 0.95}px` } : { left: `${nameX}px`, top: `${baseY + H * 0.16}px` });
const side = sheet.querySelector('.side');
const ib = intro.getBoundingClientRect();
place(side, phone ? { left: `${nameX}px`, right: 'var(--gutter)', top: `${ib.bottom + 18}px` } : { left: `${nameX}px`, top: `${ib.bottom + 22}px` });
place(sheet.querySelector('.about'), { left: `${W * 0.53}px`, top: `${C0 + H * 0.1}px`, width: `${W * 0.4}px` });
place(sheet.querySelector('.p1'), { left: `${aruba[0] - 6}px`, top: `${aruba[1] + 18}px` });
place(sheet.querySelector('.p2'), { left: `${rotterdam[0] + 18}px`, top: `${rotterdam[1] + 10}px` });
const lbls = [...sheet.querySelectorAll('.lbl')];
lbls.forEach((el, i) => { const g = SIGNS[i]; place(el, { left: `${g.x + (g.w * u) / 2}px`, top: `${yc + u * 0.68}px` }); });

// ------------------------------------------------------------------ the last page: the loose end
const end = document.getElementById('end');
end.prepend(Object.assign(paper(W, H, dpr, { at: [0.3, 0.55], s: 31 }), { className: 'layer' }));
const talk = end.querySelector('.talk');
place(talk, phone ? { left: 'var(--gutter)', top: `${H * 0.3}px`, fontSize: `${W * 0.2}px`, whiteSpace: 'normal' } : { left: `calc(var(--gutter) * 2)`, top: `${H * 0.24}px` });
const tb = talk.getBoundingClientRect();
const endSvg = end.querySelector('svg');
endSvg.setAttribute('width', W); endSvg.setAttribute('height', H);
const ul = tb.bottom + H * 0.035;
const endRun = [[-20, ul + H * 0.1], [W * 0.03, ul + H * 0.02], [W * 0.12, ul], [W * 0.4, ul + 4], [tb.right - W * 0.08, ul - 2], [tb.right - W * 0.03, ul + H * 0.045], [tb.right - W * 0.065, ul + H * 0.075], [tb.right - W * 0.075, ul + H * 0.035], [tb.right - W * 0.02, ul + H * 0.01], [tb.right + W * 0.035, ul + H * 0.04]];
const endD = pathFromRuns([endRun]);
const endCore = endSvg.querySelector('.core'), endGlow = endSvg.querySelector('.glow');
for (const el of [endCore, endGlow]) el.setAttribute('d', endD);
endCore.setAttribute('stroke-width', 4.6); endGlow.setAttribute('stroke-width', 12);
const endTip = endRun.at(-1);
endSvg.querySelector('.tip').setAttribute('cx', endTip[0]); endSvg.querySelector('.tip').setAttribute('cy', endTip[1]);
endSvg.querySelector('.tipHalo').setAttribute('cx', endTip[0]); endSvg.querySelector('.tipHalo').setAttribute('cy', endTip[1]);
place(end.querySelector('.note'), { left: `${endTip[0] + 26}px`, top: `${endTip[1] + 6}px` });
place(end.querySelector('.links'), { left: `calc(var(--gutter) * 2)`, top: `${ul + H * 0.15}px` });
place(end.querySelector('.where'), { left: `calc(var(--gutter) * 2)`, bottom: 'var(--gutter)' });
document.body.dataset.on = '';

// ------------------------------------------------------------------ the 3D: the page tips back, the line lifts off it
const gl = document.getElementById('gl');
const rr = makeRenderer(gl, W, H);
rr.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0513');
scene.fog = new THREE.FogExp2('#0a0513', 0.035);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.02, 200);
const fx = bloom(rr, scene, cam, W, H, { strength: 0.42, radius: 0.32, threshold: 1.05 });
const A = W / H, DCAM = 1 / Math.tan((15 * Math.PI) / 180);

// The page in 3D is the about section exactly as it was on screen (paper, type, the line), drawn into a texture.
function pageTexture() {
  const c = document.createElement('canvas');
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d');
  x.drawImage(pc, 0, C0 * dpr, W * dpr, H * dpr, 0, 0, W * dpr, H * dpr);
  x.scale(dpr, dpr);
  x.save();
  x.translate(0, -C0);
  x.lineCap = 'round'; x.lineJoin = 'round';
  const p2d = new Path2D(D_ALL);
  x.filter = 'blur(4px)'; x.strokeStyle = 'rgba(230,168,90,0.5)'; x.lineWidth = 12; x.stroke(p2d); x.filter = 'none';
  x.strokeStyle = '#f3c88f'; x.lineWidth = 4.6; x.stroke(p2d);
  for (const p of [aruba, rotterdam]) { x.beginPath(); x.arc(p[0], p[1], 7, 0, Math.PI * 2); x.fillStyle = '#150923'; x.fill(); x.lineWidth = 3; x.stroke(); }
  x.restore();
  // The type, line by line, where the page had it.
  const top = sheet.getBoundingClientRect().top;
  for (const el of sheet.querySelectorAll('.about .eyebrow, .about .line, .pin, .lbl b, .lbl span, .lbl small')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.top - top < C0 - 4) continue;
    x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    x.fillStyle = cs.color;
    x.textBaseline = 'top';
    x.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const text = cs.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent;
    if (el.classList.contains('pin')) { const [a, b] = el.innerText.split('\n'); x.fillStyle = '#f2efe8'; x.fillText(a.toUpperCase(), r.left, r.top - top - C0 + 2); x.fillStyle = cs.color; x.fillText(b, r.left, r.top - top - C0 + 20); continue; }
    x.fillText(text, r.left, r.top - top - C0 + (r.height - parseFloat(cs.fontSize)) / 2);
  }
  x.font = '400 17px Barlow'; x.fillStyle = 'rgba(242,239,232,0.64)';
  const copy = sheet.querySelector('.about .copy').getBoundingClientRect();
  const words = sheet.querySelector('.about .copy').textContent.split(' ');
  let line = '', y = copy.top - top - C0 + 4;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > copy.width) { x.fillText(line, copy.left, y); line = w; y += 25.5; } else line = t; }
  x.fillText(line, copy.left, y);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = rr.capabilities.getMaxAnisotropy();
  return t;
}
const pivot = new THREE.Group();
pivot.position.set(0, -1, 0);
scene.add(pivot);
// Drawn now, while the sheet is laid out, at the pan the about section is seen at.
sheet.style.transform = `translateY(${-C0}px)`;
const pageMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * A, 2), new THREE.MeshBasicMaterial({ map: pageTexture(), fog: false }));
pageMesh.position.set(0, 1, 0);
pivot.add(pageMesh);

// The works, framed by the line: five same-size pictures on a gentle arc above and beyond the page.
const works = await loadWorks(rr);
const PW = 2.2, PH = 1.375, M = 0.07;
const band = works.map((w, i) => {
  const d = 2 - i;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), pictureMaterial(w.tex, { w: PW, h: PH }));
  m.position.set(d * 2.62, 1.4, -5.2 - 0.22 * d * d);
  m.rotation.y = d * 0.09;
  m.updateMatrixWorld();
  scene.add(m);
  return m;
});
const corner = (m, sxx, syy) => new THREE.Vector3(sxx * (PW / 2 + M), syy * (PH / 2 + M), 0.02).applyMatrix4(m.matrixWorld);

// The line in 3D: off the page at the axle, up to the first work, round three sides of each frame, a garland to the
// next, and after the last it turns and comes at you.
const THETA = 1.1;
const pageAt = ([dx, dy]) => { const yl = 2 * (1 - (dy - C0) / H); const lx = (dx / W - 0.5) * 2 * A; return new THREE.Vector3(lx, -1 + yl * Math.cos(THETA), -yl * Math.sin(THETA)); };
const nrm = new THREE.Vector3(0, Math.sin(THETA), Math.cos(THETA));
const start = pageAt(axle);
const path = new THREE.CurvePath();
const marks = {};
const add = (c) => path.add(c);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
add(new THREE.CubicBezierCurve3(start.clone().addScaledVector(nrm, 0.004), start.clone().add(V(0.35, 0, 0)).addScaledVector(nrm, 0.01), start.clone().add(V(0.6, 0.05, 0)).addScaledVector(nrm, 0.45), V(2.6, 0.9, -1.6)));
marks.rise = path.curves.length;
let last = V(2.6, 0.9, -1.6);
band.forEach((m, i) => {
  const br = corner(m, 1, -1), tr = corner(m, 1, 1), tl = corner(m, -1, 1), bl = corner(m, -1, -1);
  if (i === 0) add(new THREE.CubicBezierCurve3(last, V(4.6, 0.4, -3.2), br.clone().add(V(0.3, -0.7, 0.3)), br));
  else add(new THREE.CubicBezierCurve3(last, last.clone().add(V(-0.25, -0.55, 0.08)), br.clone().add(V(0.25, -0.55, 0.08)), br));
  add(new THREE.LineCurve3(br, tr));
  add(new THREE.LineCurve3(tr, tl));
  add(new THREE.LineCurve3(tl, bl));
  last = bl;
  marks[`w${i}`] = path.curves.length;
});
// After the last work it swings out and comes at the camera, passing just under and right of it.
add(new THREE.CubicBezierCurve3(last, last.clone().add(V(-0.55, -0.65, 1.2)), V(-5.0, 0.55, -3.4), V(-3.4, 0.98, -2.4)));
add(new THREE.CubicBezierCurve3(V(-3.4, 0.98, -2.4), V(-2.95, 1.06, -1.95), V(-2.62, 1.08, -1.62), V(-2.5, 1.1, -0.9)));
const lens = path.getCurveLengths(), LT = path.getLength();
const fracAt = (n) => lens[n - 1] / LT;
const tubeMat = new THREE.ShaderMaterial({
  uniforms: { uPtr: { value: new THREE.Vector3(0, 99, 0) }, uPull: { value: 0 } },
  vertexShader: `uniform vec3 uPtr; uniform float uPull; void main(){ vec3 p = position; vec3 d = uPtr - p; float w = exp(-dot(d, d) / 0.09) * uPull; p += d * w * 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: 'void main(){ gl_FragColor = vec4(2.2, 1.5, 0.72, 1.0); }',
});
const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 2400, 0.0058, 10, false), tubeMat);
tube.frustumCulled = false;
scene.add(tube);
{
  const n = 700, pts = new Float32Array(n * 3);
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) pts.set([(rnd() - 0.5) * 24, rnd() * 7 - 2, -rnd() * 14 + 1.5], i * 3);
  scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)), new THREE.PointsMaterial({ color: '#b9a2dc', size: 0.018, transparent: true, opacity: 0.5, depthWrite: false })));
}

// ------------------------------------------------------------------ the frames
const chrome = worksChrome(document.body);
const cue = document.querySelector('.cue');
const cur = document.querySelector('.cur');
const PAN = [0, 0.48 * H, C0, C0, C0, C0, C0];
const LEN = [L_NAME + 40, L_DOWN, L_SIGN2 + 50, L_ALL, L_ALL, L_ALL, L_ALL];
const CAM = { align: [[0, 0, DCAM], [0, 0, 0]], f4: [[0.4, 0.12, 2.3], [0.9, -1.0, -1.1]], f5: [[0, 1.42, -0.9], [0, 1.42, -5.2]], f6: [[-2.7, 1.2, -1.2], [-4.8, 1.25, -6.0]] };
const TUBE = [0, 0, 0, fracAt(marks.rise), fracAt(marks.w3) + 0.012, 1, 1];
const lerp3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const ptrWorld = V(0.55, 1.4 + PH / 2 + 0.24, -5.15);
const pv = V();
let frames = 0;
function frame(now) {
  const p = scroll.tick(now);
  ptr.tick();

  // The sheet: pan, and how far the pen has gone.
  const pan = key(PAN, p);
  sheet.style.transform = `translateY(${-pan}px)`;
  const len = key(LEN, p);
  for (const el of [core, glow]) el.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${L_ALL + 10}`);
  const tp = core.getPointAtLength(Math.min(len, L_ALL - 1));
  for (const el of [tip, tipHalo]) { el.setAttribute('cx', tp.x); el.setAttribute('cy', tp.y); }
  // In the about frame the pen has drawn two signs: the second is the current one, the last two wait.
  lbls.forEach((el, i) => { el.classList.toggle('dim', i >= 2 && p < 2.4); el.classList.toggle('on', i === 1 && p > 1.8 && p < 2.4); });
  const sheetA = 1 - span(p, 2.45, 2.62);
  sheet.style.opacity = sheetA;
  sheet.style.display = sheetA > 0 ? '' : 'none';

  // The 3D.
  const glA = span(p, 2.42, 2.55) * (1 - span(p, 5.45, 5.95));
  gl.style.opacity = glA;
  if (glA > 0) {
    const t = span(p, 2.5, 3);
    pivot.rotation.x = -THETA * t;
    let c;
    if (p <= 3) c = [lerp3(CAM.align[0], CAM.f4[0], t), lerp3(CAM.align[1], CAM.f4[1], t)];
    else if (p <= 4) { const s = span(p, 3, 4); c = [lerp3(CAM.f4[0], CAM.f5[0], s), lerp3(CAM.f4[1], CAM.f5[1], s)]; }
    else { const s = span(p, 4, 5); c = [lerp3(CAM.f5[0], CAM.f6[0], s), lerp3(CAM.f5[1], CAM.f6[1], s)]; }
    cam.position.set(...c[0]);
    cam.lookAt(...c[1]);
    const tf = p < 2.55 ? 0 : key(TUBE, p);
    tube.geometry.setDrawRange(0, Math.floor(tube.geometry.index.count * tf / 6) * 6);
    tube.visible = tf > 0;
    // The pointer bends the line round the work in front.
    const pull = span(p, 3.6, 4) * (1 - span(p, 4.3, 4.6));
    tubeMat.uniforms.uPull.value = pull;
    tubeMat.uniforms.uPtr.value.copy(ptrWorld);
    band.forEach((m, i) => {
      const d = Math.abs(i - 2 - clamp(p - 4) * 2); // the work in focus moves from the third to the last
      m.material.uniforms.uBlur.value = Math.min(2.6, d * 1.6);
      m.material.uniforms.uDim.value = 1 - Math.min(0.5, d * 0.4);
    });
    fx.render();
    if (q.get('f') === '5') {
      pv.copy(ptrWorld).project(cam);
      cur.hidden = false;
      Object.assign(cur.style, { left: `${(pv.x * 0.5 + 0.5) * W}px`, top: `${(-pv.y * 0.5 + 0.5) * H}px` });
    }
  }
  const wA = span(p, 3.55, 3.9) * (1 - span(p, 4.5, 4.85));
  chrome.el.style.opacity = wA;
  chrome.set(2, works);
  const endA = span(p, 5.5, 5.95);
  end.style.opacity = endA;
  end.style.display = endA > 0 ? '' : 'none';
  cue.style.opacity = 1 - span(p, 0.05, 0.4);

  if (++frames === 3) ready();
  if (!scroll.fixed || frames < 4) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
