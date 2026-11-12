// LAB ONLY (throwaway). Round 60, idea 3: Board City. A purple city at night in the rain that turns out to be Bob's
// circuit board. One direction, far to near: the skyline (his name is the tallest sign), the camera rises and tips
// down until the streets are traces and four lit districts are four chips (the studies), drops into the main street
// where the works are screens over the road, and stops at the chip at its end, where one window is still lit.
// Frames (?f=1..7): 1 skyline, 2 tipping down, 3 the board, 4 into the street, 5 the works, 6 the chip, 7 the window.
import { THREE, fonts, ready, key, span, clamp, scroller, loadWorks, pictureMaterial, bloom, renderer as makeRenderer, worksChrome } from './r60.js';
import { canvasTex } from './kit.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

await fonts();
const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio);
const phone = W / H < 0.8;
document.body.classList.toggle('phone', phone);
const scroll = scroller(7);
const q = new URLSearchParams(location.search);
let seed = 3;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const gl = document.getElementById('gl');
const rr = makeRenderer(gl, W, H, { exposure: 0.9 });
rr.toneMapping = THREE.ACESFilmicToneMapping; // keeps the night dark; AgX lifted the purple to grey
const scene = new THREE.Scene();
const FOG = new THREE.Color('#1d0c31');
scene.fog = new THREE.FogExp2(FOG, 0.011);
scene.background = canvasTex(4, 512, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#040208'); g.addColorStop(0.42, '#140823'); g.addColorStop(0.6, '#33164f'); g.addColorStop(0.68, '#24103a'); g.addColorStop(1, '#090410');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const cam = new THREE.PerspectiveCamera(phone ? 48 : 30, W / H, 0.1, 500);
const fx = bloom(rr, scene, cam, W, H, { strength: 0.5, radius: 0.4, threshold: 0.9 });

// ------------------------------------------------------------------ the grid: an avenue down the middle, blocks either side
// East blocks k = 0..4 span x [3 + 9k, 10 + 9k]; west mirror them; blocks j = 0..9 span z [-44 + 9j, -37 + 9j].
// Streets run between them (x = ±11, ±20, ±29, ±38; z = -36 + 9j).
const DISTRICTS = [
  { x: [12, 19], z: [-17, -1] }, // U1 software
  { x: [30, 37], z: [-17, -1] }, // U2 game & app
  { x: [12, 19], z: [1, 17] }, // U3 cybersecurity
  { x: [30, 37], z: [1, 17] }, // U4 mechatronics
];
const TOWER = { x: [3, 10], z: [19, 26] }; // his name's tower, on the avenue
const lots = [];
for (const side of [1, -1]) for (let k = 0; k < 5; k++) for (let j = 0; j < 10; j++) {
  if (j === 0 && k < 2) continue; // an open square at the end of the avenue, where the chip stands
  const xa = side > 0 ? 3 + 9 * k : -10 - 9 * k, za = -44 + 9 * j;
  const dist = side > 0 ? DISTRICTS.findIndex((d) => xa >= d.x[0] && xa + 7 <= d.x[1] && za >= d.z[0] && za + 7 <= d.z[1]) + 1 : 0;
  const isTower = side > 0 && xa === TOWER.x[0] && za === TOWER.z[0];
  const split = isTower ? 1 : rnd() < 0.3 ? 1 : rnd() < 0.55 ? 2 : 4;
  const cells = split === 1 ? [[0, 0, 7, 7]] : split === 2 ? (rnd() < 0.5 ? [[0, 0, 3.5, 7], [3.5, 0, 3.5, 7]] : [[0, 0, 7, 3.5], [0, 3.5, 7, 3.5]]) : [[0, 0, 3.5, 3.5], [3.5, 0, 3.5, 3.5], [0, 3.5, 3.5, 3.5], [3.5, 3.5, 3.5, 3.5]];
  for (const [cx, cz, cw, cd] of cells) {
    const x = xa + cx + cw / 2, z = za + cz + cd / 2;
    const r = Math.hypot(x - 4, z + 4);
    let h = 2.2 + rnd() * 3 + 15 * Math.exp(-((r / 26) ** 2)) * (0.35 + rnd() * 0.75);
    if (rnd() < 0.08) h += 6 + rnd() * 8;
    if (dist) h = 2.5 + rnd() * 4;
    if (isTower) h = 33;
    lots.push({ x, z, w: cw - 0.5, d: cd - 0.5, h, dist, seed: rnd(), tower: isTower });
  }
}
const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(lots.map((l) => l.seed)), 1));
box.setAttribute('aDist', new THREE.InstancedBufferAttribute(new Float32Array(lots.map((l) => l.dist)), 1));
const cityMat = new THREE.ShaderMaterial({
  uniforms: { uLit: { value: [0, 0, 0, 0] }, uFog: { value: FOG }, uFogD: { value: 0.0125 }, uCam: { value: new THREE.Vector3() }, uWin: { value: 1 } },
  vertexShader: `attribute float aSeed; attribute float aDist;
    varying vec2 vUv; varying vec3 vN; varying vec3 vS; varying float vSeed; varying float vDist; varying vec3 vW;
    void main(){
      vUv = uv; vN = normal; vSeed = aSeed; vDist = aDist;
      vS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `uniform float uLit[4]; uniform vec3 uFog; uniform float uFogD; uniform vec3 uCam; uniform float uWin;
    varying vec2 vUv; varying vec3 vN; varying vec3 vS; varying float vSeed; varying float vDist; varying vec3 vW;
    float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      float lit = 0.0;
      for (int k = 0; k < 4; k++) lit += abs(vDist - float(k + 1)) < 0.5 ? uLit[k] : 0.0;
      vec3 base = vec3(0.02, 0.012, 0.038);
      vec3 col;
      if (vN.y > 0.5) {
        // Roof: dark, a fine edge; in a lit district the roof is a chip lit gold.
        vec2 e = min(vUv, 1.0 - vUv) * vec2(vS.x, vS.z);
        float edge = 1.0 - smoothstep(0.0, 0.14, min(e.x, e.y));
        vec2 g = fract(vUv * vec2(vS.x, vS.z) / 0.7);
        float pad = step(0.35, g.x) * step(g.x, 0.65) * step(0.35, g.y) * step(g.y, 0.65) * step(0.5, hsh(floor(vUv * vec2(vS.x, vS.z) / 0.7) + vSeed));
        col = base * 0.7 + vec3(0.85, 0.58, 0.3) * edge * (0.18 + 1.8 * lit) + vec3(1.0, 0.68, 0.32) * pad * lit * 0.55 + vec3(0.32, 0.2, 0.1) * lit * 0.4;
      } else if (vN.y < -0.5) {
        col = base;
      } else {
        float wd = abs(vN.x) > 0.5 ? vS.z : vS.x;
        vec2 grid = vec2(max(1.0, floor(wd / 0.48)), max(1.0, floor(vS.y / 0.62)));
        vec2 g = vUv * grid, id = floor(g), c = fract(g);
        float win = step(0.18, c.x) * step(c.x, 0.82) * step(0.3, c.y) * step(c.y, 0.82);
        float r = hsh(id + vSeed * 17.0 + vN.xz * 3.1);
        float on = step(0.8 - lit * 0.2, r) * uWin;
        vec3 warm = mix(vec3(1.0, 0.52, 0.2), vec3(1.0, 0.76, 0.42), hsh(id.yx + vSeed));
        vec3 wc = r > 0.985 ? vec3(0.72, 0.46, 1.0) : warm;
        float bright = 0.7 + 1.3 * hsh(id * 1.7 + vSeed);
        col = base + win * (on * wc * bright + (1.0 - on) * vec3(0.018, 0.016, 0.04));
        // Far away, where a window is smaller than a pixel or two, show the facade's average instead of a moiré.
        float px = max(fwidth(g.x), fwidth(g.y));
        vec3 avg = base + 0.36 * (0.2 + lit * 0.2) * vec3(1.0, 0.64, 0.3) * 1.35 + 0.36 * vec3(0.018, 0.016, 0.04);
        col = mix(col, avg, smoothstep(0.35, 0.8, px));
        col *= 0.7 + 0.3 * smoothstep(0.0, 1.0, vUv.y);
      }
      float d = length(vW - uCam);
      float f = 1.0 - exp(-pow(d * uFogD, 1.6));
      gl_FragColor = vec4(mix(col, uFog, f), 1.0);
      #include <colorspace_fragment>
    }`,
});
const city = new THREE.InstancedMesh(box, cityMat, lots.length);
{
  const m = new THREE.Matrix4();
  lots.forEach((l, i) => city.setMatrixAt(i, m.compose(new THREE.Vector3(l.x, 0, l.z), new THREE.Quaternion(), new THREE.Vector3(l.w, l.h, l.d))));
}
city.frustumCulled = false;
scene.add(city);

// ------------------------------------------------------------------ the ground: wet road that reflects, and the traces
const mirror = new Reflector(new THREE.PlaneGeometry(320, 320), { clipBias: 0.003, textureWidth: Math.round(W * dpr * 0.6), textureHeight: Math.round(H * dpr * 0.6), color: 0x8a8090 });
mirror.rotation.x = -Math.PI / 2;
scene.add(mirror);
const MAP = 128, PX = 32; // the ground's textures cover x, z in [-64, 64], 32 px a unit
const toPx = (v) => (v + MAP / 2) * PX;
const asphalt = canvasTex(MAP * PX / 2, MAP * PX / 2, (x, w, h) => {
  x.fillStyle = 'rgba(14,8,22,0.8)'; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) { const cx = rnd() * w, cy = rnd() * h, r = 10 + rnd() * 70; const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(0,0,0,${0.25 + rnd() * 0.4})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshBasicMaterial({ map: asphalt, transparent: true, depthWrite: false }));
ground.rotation.x = -Math.PI / 2; ground.position.y = 0.01;
scene.add(ground);
// Traces: a line down every street, two down the avenue, a via at each crossing.
const XS = [-38, -29, -20, -11, 11, 20, 29, 38], ZS = [-36, -27, -18, -9, 0, 9, 18, 27, 36];
const traceTex = canvasTex(MAP * PX, MAP * PX, (x) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, MAP * PX, MAP * PX);
  x.strokeStyle = '#fff'; x.lineCap = 'round';
  x.lineWidth = 0.12 * PX;
  for (const sx of XS) { x.beginPath(); x.moveTo(toPx(sx), toPx(-46)); x.lineTo(toPx(sx), toPx(46)); x.stroke(); }
  for (const sz of ZS) { x.beginPath(); x.moveTo(toPx(-46), toPx(sz)); x.lineTo(toPx(46), toPx(sz)); x.stroke(); }
  for (const ax of [-1.3, 1.3]) { x.lineWidth = 0.14 * PX; x.beginPath(); x.moveTo(toPx(ax), toPx(-47)); x.lineTo(toPx(ax), toPx(46)); x.stroke(); }
  x.lineWidth = 0.08 * PX; x.setLineDash([0.6 * PX, 0.9 * PX]);
  x.beginPath(); x.moveTo(toPx(0), toPx(-47)); x.lineTo(toPx(0), toPx(46)); x.stroke();
  x.setLineDash([]);
  x.lineWidth = 0.1 * PX;
  for (const sx of XS) for (const sz of ZS) { x.beginPath(); x.arc(toPx(sx), toPx(sz), 0.32 * PX, 0, Math.PI * 2); x.stroke(); }
}, false);
const traces = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshBasicMaterial({ map: traceTex, color: new THREE.Color(2.2, 1.45, 0.62), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
traces.rotation.x = -Math.PI / 2; traces.position.y = 0.02;
scene.add(traces);
// The board's print, shown as the city turns into it: outlines round the four chips with pins along them, and the
// trace from Aruba to Rotterdam with its two pads.
const ARUBA = [11, 18], ROTTERDAM = [38, -18];
const silkTex = canvasTex(MAP * PX, MAP * PX, (x) => {
  x.clearRect(0, 0, MAP * PX, MAP * PX);
  x.strokeStyle = 'rgba(239,230,210,0.9)'; x.fillStyle = 'rgba(239,230,210,0.9)';
  x.lineWidth = 0.13 * PX;
  for (const d of DISTRICTS) {
    const x0 = toPx(d.x[0] - 0.55), x1 = toPx(d.x[1] + 0.55), z0 = toPx(d.z[0] - 0.55), z1 = toPx(d.z[1] + 0.55);
    x.strokeRect(x0, z0, x1 - x0, z1 - z0);
    x.beginPath(); x.arc((x0 + x1) / 2, z0, 0.6 * PX, 0, Math.PI); x.stroke();
    for (let t = d.z[0] + 0.5; t < d.z[1]; t += 0.9) { x.fillRect(x0 - 0.5 * PX, toPx(t) - 0.12 * PX, 0.42 * PX, 0.24 * PX); x.fillRect(x1 + 0.08 * PX, toPx(t) - 0.12 * PX, 0.42 * PX, 0.24 * PX); }
  }
}, false);
const silk = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshBasicMaterial({ map: silkTex, transparent: true, opacity: 0, depthWrite: false }));
silk.rotation.x = -Math.PI / 2; silk.position.y = 0.03;
scene.add(silk);
const spineTex = canvasTex(MAP * PX, MAP * PX, (x) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, MAP * PX, MAP * PX);
  x.strokeStyle = '#fff'; x.lineWidth = 0.42 * PX; x.lineJoin = 'round';
  const c = 2;
  x.beginPath(); x.moveTo(toPx(ARUBA[0]), toPx(ARUBA[1])); x.lineTo(toPx(11), toPx(c)); x.lineTo(toPx(11 + c), toPx(0)); x.lineTo(toPx(38 - c), toPx(0)); x.lineTo(toPx(38), toPx(-c)); x.lineTo(toPx(ROTTERDAM[0]), toPx(ROTTERDAM[1])); x.stroke();
  for (const p of [ARUBA, ROTTERDAM]) { x.lineWidth = 0.35 * PX; x.beginPath(); x.arc(toPx(p[0]), toPx(p[1]), 1.0 * PX, 0, Math.PI * 2); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(toPx(p[0]), toPx(p[1]), 0.4 * PX, 0, Math.PI * 2); x.fill(); }
}, false);
const spine = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshBasicMaterial({ map: spineTex, color: new THREE.Color(3.0, 2.0, 0.85), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
spine.rotation.x = -Math.PI / 2; spine.position.y = 0.04;
scene.add(spine);

// ------------------------------------------------------------------ his name, the tallest sign; a small 客家 sign lower down
const tower = lots.find((l) => l.tower);
const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 13.5), new THREE.MeshBasicMaterial({ map: canvasTex(240, 1408, (x, w, h) => {
  x.fillStyle = '#0c0614'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#e7b877'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = '#ffd9a0'; x.font = '800 170px Barlow'; x.textAlign = 'center'; x.textBaseline = 'middle';
  'BOB'.split('').forEach((ch, i) => x.fillText(ch, w / 2, 150 + i * 170));
  x.font = '800 118px Barlow';
  'CHUNG'.split('').forEach((ch, i) => x.fillText(ch, w / 2, 700 + i * 140));
}), color: new THREE.Color(1.9, 1.5, 1.15) }));
sign.position.set(tower.x + 1.4, 19, tower.z + tower.d / 2 + 0.25);
scene.add(sign);
const hakka = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.2), new THREE.MeshBasicMaterial({ map: canvasTex(200, 420, (x, w, h) => {
  x.fillStyle = '#0c0614'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#d7a8f2'; x.font = '400 150px KaiTi, STKaiti, "Ma Shan Zheng", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('客', w / 2, 120); x.fillText('家', w / 2, 300);
}), color: new THREE.Color(1.5, 1.3, 1.6) }));
hakka.position.set(tower.x - 2.2, 6.5, tower.z + tower.d / 2 + 0.25);
scene.add(hakka);
const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6) }));
beacon.position.set(tower.x, 33.6, tower.z);
scene.add(beacon);

// ------------------------------------------------------------------ the works: same-size screens hung over the avenue
const works = await loadWorks(rr);
const SW = 5.2, SH = 3.25;
const screens = works.map((w, i) => {
  const g = new THREE.Group();
  const mat = pictureMaterial(w.tex, { w: SW, h: SH, glow: 0.05 });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mat);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.24, SH + 0.24, 0.16), new THREE.MeshBasicMaterial({ color: '#07040b' }));
  bezel.position.z = -0.09;
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(SW + 0.3, 0.035), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.35, 0.6) }));
  edge.position.set(0, -SH / 2 - 0.14, 0.001);
  const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-SW * 0.38, SH / 2, -0.05), new THREE.Vector3(-SW * 0.38, 14, -0.05), new THREE.Vector3(SW * 0.38, SH / 2, -0.05), new THREE.Vector3(SW * 0.38, 14, -0.05)]), new THREE.LineBasicMaterial({ color: '#3a2a4a' }));
  g.add(bezel, pic, edge, cables);
  g.position.set(i % 2 ? 1.0 : -1.0, 3.7, 18 - i * 10);
  g.userData.mat = mat;
  scene.add(g);
  return g;
});

// ------------------------------------------------------------------ the chip at the end of the street, one window lit
const chip = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 7), new THREE.MeshBasicMaterial({ color: '#160e22', fog: false }));
  body.position.y = 3.5;
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.4), fog: false }));
  rim.position.y = 3.5;
  chip.add(body, rim);
  const pinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.6, 0.32) });
  for (let i = 0; i < 11; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 1.2), pinMat); p.position.set(-5 + i, 0.3, 4.1); chip.add(p); }
  const notch = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 48, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#cbbfa6' }));
  notch.position.set(0, 7.01, 3.5); notch.rotation.x = -Math.PI / 2;
  chip.add(notch);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), new THREE.MeshBasicMaterial({ transparent: true, fog: false, map: canvasTex(800, 120, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(239,230,210,0.8)'; x.font = '500 64px "IBM Plex Mono"'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('BC—2006', 10, h / 2); }) }));
  label.position.set(-3.6, 6.0, 3.51);
  chip.add(label);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.85), fog: false }));
  win.position.set(1.2, 3.0, 3.51);
  chip.add(win);
  chip.userData.win = win;
}
chip.position.set(0, 0, -49.5);
scene.add(chip);
const fill = new THREE.HemisphereLight('#6a4a9a', '#100818', 1.2);
scene.add(fill);

// ------------------------------------------------------------------ rain
const rain = (() => {
  const n = 5200, pts = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = (rnd() - 0.5) * 60, y = rnd() * 30, z = (rnd() - 0.5) * 60, l = 0.5 + rnd() * 0.6; pts.set([x, y, z, x - 0.06, y - l, z + 0.02], i * 6); }
  const m = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: '#b9a6e8', transparent: true, opacity: 0.22, depthWrite: false }));
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();

// ------------------------------------------------------------------ the type
const hero = document.querySelector('.hero'), board = document.querySelector('.board'), end = document.getElementById('end');
{
  const lead = hero.querySelector('.lead'), copy = hero.querySelector('.copy'), eb = hero.querySelector('.eyebrow');
  copy.style.bottom = phone ? 'calc(var(--gutter) + 70px)' : 'calc(var(--gutter) + 6px)';
  const cb = copy.getBoundingClientRect();
  lead.style.top = `${cb.top - lead.getBoundingClientRect().height - 22}px`;
  eb.style.top = `${lead.getBoundingClientRect().top - 34}px`;
}
const silks = [...board.querySelectorAll('.silk.big')], pads = [...board.querySelectorAll('.silk.pad')];
const talk = end.querySelector('.talk');
Object.assign(talk.style, { left: `calc(var(--gutter) * 2 + 4.5vh)`, top: `${H * 0.33}px` });
const tb = talk.getBoundingClientRect();
Object.assign(end.querySelector('.eyebrow').style, { left: `calc(var(--gutter) * 2 + 4.5vh)`, top: `${tb.top - 38}px` });
Object.assign(end.querySelector('.links').style, { left: `calc(var(--gutter) * 2 + 4.5vh)`, top: `${tb.bottom + H * 0.07}px` });
Object.assign(end.querySelector('.where').style, { left: `calc(var(--gutter) * 2 + 4.5vh)`, bottom: `calc(var(--gutter) + 4.5vh)` });
const chrome = worksChrome(document.body);
const cue = document.querySelector('.cue');
const cur = document.querySelector('.cur');
document.body.dataset.on = '';

// ------------------------------------------------------------------ the frames
const TOP = 92;
const POS = [[-6, 5, 108], [-2, 46, 52], [10, TOP, 0.001], [0, 6.2, 34], [-0.5, 3.4, 7.3], [0, 3.8, -24.5], [1.2, 3.0, -45.15]];
const LOOK = [[6, 14, 0], [6, 0, 2], [10, 0, 0], [0, 2.8, 0], [-0.8, 3.7, -2], [0, 3.4, -46], [1.2, 3.0, -46]];
const UP = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]];
if (phone) { POS[0] = [-2, 5, 112]; LOOK[0] = [5, 17, 0]; }
const v = new THREE.Vector3(), up = new THREE.Vector3();
const project = (x, y, z) => { v.set(x, y, z).project(cam); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
let frames = 0;
function frame(now) {
  const p = scroll.tick(now);
  cam.position.set(...key(POS, p));
  up.set(...key(UP, p)).normalize();
  cam.up.copy(up);
  cam.lookAt(...key(LOOK, p));
  cam.updateMatrixWorld();
  cityMat.uniforms.uCam.value.copy(cam.position);
  // The city becomes the board: the print appears, the four districts light, the fog clears from above.
  const boardA = span(p, 1.35, 1.9) * (1 - span(p, 2.25, 2.75));
  silk.material.opacity = boardA;
  spine.material.opacity = boardA;
  cityMat.uniforms.uLit.value = [0, 1, 2, 3].map((k) => span(p, 1.5 + k * 0.08, 1.85 + k * 0.08) * (1 - span(p, 2.4, 2.8)));
  const fogD = key([0.0072, 0.009, 0.003, 0.011, 0.011, 0.0085, 0.0085], p);
  scene.fog.density = fogD;
  cityMat.uniforms.uFogD.value = fogD;
  rain.visible = p < 1.3 || p > 2.6;
  rain.position.set(cam.position.x, cam.position.y - 18, cam.position.z - 20);
  if (!scroll.fixed) rain.position.y -= ((now / 1000) * 14) % 2;
  traces.material.opacity = 0.75 + 0.25 * boardA;
  // The works: the one you are at is sharp and bright.
  // Kept just under the bloom's threshold: a big white picture must not haze the whole street.
  screens.forEach((g, i) => { const d = Math.abs(i - 2) * span(p, 3.5, 4); g.userData.mat.uniforms.uBlur.value = Math.min(2.5, d * 1.2); g.userData.mat.uniforms.uDim.value = 0.8 - Math.min(0.35, d * 0.22); });
  fx.render();

  // Type.
  hero.style.opacity = 1 - span(p, 0.15, 0.55);
  board.style.opacity = span(p, 1.7, 1.95) * (1 - span(p, 2.25, 2.55));
  if (board.style.opacity > 0) {
    DISTRICTS.forEach((d, k) => { const [sx, sy] = project(d.x[0] - 0.6, 0, d.z[0] - 0.6); Object.assign(silks[k].style, { left: `${sx}px`, top: `${sy - 58}px` }); });
    [ARUBA, ROTTERDAM].forEach((pp, k) => { const [sx, sy] = project(pp[0], 0, pp[1]); Object.assign(pads[k].style, { left: `${sx + 26}px`, top: `${sy - 22}px` }); });
  }
  const wA = span(p, 3.55, 3.9) * (1 - span(p, 4.5, 4.85));
  chrome.el.style.opacity = wA;
  chrome.set(2, works);
  if (q.get('f') === '5') { cur.hidden = false; const [sx, sy] = project(-0.2, 4.3, -1.95); Object.assign(cur.style, { left: `${sx}px`, top: `${sy}px` }); }
  const endA = span(p, 5.45, 5.95);
  end.style.opacity = endA;
  end.style.display = endA > 0 ? '' : 'none';
  document.body.classList.toggle('gold', endA > 0.5);
  cue.style.opacity = 1 - span(p, 0.05, 0.4);
  if (++frames === 3) ready();
  if (!scroll.fixed || frames < 4) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
