// LAB ONLY (throwaway). The works' space: one world that lies behind the coin's hole. Units: the hole is 2·HS wide and sits
// at the origin, facing +z; the page is on the +z side, so everything here is at z < 0. The host moves the camera; this
// file draws the sky, the sun, a planet, drifting dust and the works as lit glass slabs on a band, and the HUD over them.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { canvasTex, lockedScreen, lockedGame } from './kit.js';

export const HS = 0.9; // half the hole's side
export const L = 6; // where the camera comes to rest, behind the hole
export const FOV_IN = 38; // the lens once inside
export const PW = 5.4, PH = 3.375, SP = PW + 0.85; // a picture, and one picture plus the gap
const T = 0.07, RR = 0.16, N = 10, LOOP = N * SP, DB = 9, RC = 15, Y0 = -0.45;
const SUN = new THREE.Vector3(0.42, 0.24, -0.88).normalize();
const PLANET = { at: new THREE.Vector3(-133, -246, -292), r: 169 };

const NOISE = `
  float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.02 + 0.13; a *= 0.5; } return s; }`;

const CSS = `
  .sp-hud { position: fixed; inset: 0; z-index: 12; pointer-events: none; color: #f2efe8; opacity: 0; }
  .sp-hud .mono { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
  .sp-tag { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; font: 500 15px Barlow; text-shadow: 0 1px 14px rgb(0 0 0 / 0.55); }
  .sp-tag.locked { color: #cf9a62; }
  .sp-btn { position: fixed; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: rgb(10 6 18 / 0.7); display: grid; place-items: center; }
  .sp-btn::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #f2efe8; }
  .sp-ret { position: fixed; left: 0; top: 0; width: 100px; height: 60px; transition: opacity 0.3s; }
  .sp-ret i { position: absolute; width: 16px; height: 16px; border: 1px solid rgb(242 239 232 / 0.75); }
  .sp-ret i:nth-child(1) { left: -10px; top: -10px; border-width: 1px 0 0 1px; }
  .sp-ret i:nth-child(2) { right: -10px; top: -10px; border-width: 1px 1px 0 0; }
  .sp-ret i:nth-child(3) { left: -10px; bottom: -10px; border-width: 0 0 1px 1px; }
  .sp-ret i:nth-child(4) { right: -10px; bottom: -10px; border-width: 0 1px 1px 0; }
  .sp-ret span { position: absolute; left: -10px; top: -30px; white-space: nowrap; color: rgb(242 239 232 / 0.7); }
  .sp-ret span b { color: #cf9a62; font-weight: 500; }
  .sp-tape { position: fixed; left: 50%; bottom: calc(var(--gutter, 30px) + 2px); width: min(420px, 50vw); height: 26px; transform: translateX(-50%);
    -webkit-mask: linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent); mask: linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent); }
  .sp-tape .t { position: absolute; inset: 10px 0 0; background: repeating-linear-gradient(90deg, rgb(242 239 232 / 0.5) 0 1px, transparent 1px 8px); }
  .sp-tape .T { position: absolute; inset: 4px 0 0; background: repeating-linear-gradient(90deg, rgb(242 239 232 / 0.85) 0 1px, transparent 1px 64px); }
  .sp-tape b { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #cf9a62; }
  .sp-read { position: fixed; left: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); line-height: 1.8; }
  .sp-read b { color: #f2efe8; font-weight: 500; }
  .sp-count { position: fixed; right: var(--gutter, 30px); bottom: var(--gutter, 30px); margin: 0; color: rgb(242 239 232 / 0.55); text-align: right; line-height: 1.8; }
  .sp-count b { color: #f2efe8; font-weight: 500; }
  .sp-count i { font-style: normal; color: #cf9a62; }
  .sp-top { position: fixed; top: var(--gutter, 30px); left: var(--gutter, 30px); right: var(--gutter, 30px); display: flex; justify-content: space-between; margin: 0; }
  .sp-top span { font: 500 15px Barlow; }
  .sp-cursor { position: fixed; left: 0; top: 0; width: 74px; height: 74px; margin: -37px 0 0 -37px; border-radius: 50%; border: 1px solid rgb(242 239 232 / 0.5); display: grid; place-items: center;
    color: #f2efe8; transition: width 0.4s, height 0.4s, margin 0.4s, background 0.4s, color 0.4s; }
  .sp-cursor.open { width: 104px; height: 104px; margin: -52px 0 0 -52px; background: #f2efe8; color: #130724; }`;

/** The composite: the space's picture, with a touch of lens (edge fringing, the sun's streak, vignette, grain). */
function finishMaterial(full) {
  return new THREE.ShaderMaterial({
    depthTest: !full, depthWrite: !full,
    uniforms: { uTex: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3() } },
    vertexShader: full ? 'void main(){ gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }' : 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime; uniform vec3 uSun;
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes, c = uv - 0.5;
        float ca = dot(c, c) * 0.012;
        vec3 col = vec3(texture2D(uTex, uv - c * ca).r, texture2D(uTex, uv).g, texture2D(uTex, uv + c * ca).b);
        if (uSun.z > 0.0) { vec2 d = (gl_FragCoord.xy - uSun.xy) / uRes.y; col += vec3(1.0, 0.78, 0.5) * exp(-abs(d.y) * 340.0) * exp(-abs(d.x) * 2.4) * 0.28 * uSun.z; }
        col *= 1.0 - smoothstep(0.42, 1.1, length(c * vec2(uRes.x / uRes.y, 1.0))) * 0.6;
        float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
        col += (g - 0.5) * 0.03;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function slabGeometry() {
  const pos = [], uv = [], part = [], idx = [];
  const add = (x, y, z, u, v, k) => { pos.push(x, y, z); uv.push(u, v); part.push(k); return pos.length / 3 - 1; };
  for (const [k, z] of [[0, T / 2], [1, -T / 2]]) {
    const NX = 64, NY = 40, base = pos.length / 3;
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) add((i / NX - 0.5) * PW, (j / NY - 0.5) * PH, z, i / NX, j / NY, k);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = base + j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      if (k === 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
  }
  // The edge: a ribbon round the rounded outline, fine enough to bend with the faces.
  const ring = [], a = PW / 2 - RR, b = PH / 2 - RR;
  const corners = [[a, b, 0], [-a, b, Math.PI / 2], [-a, -b, Math.PI], [a, -b, Math.PI * 1.5]];
  for (let ci = 0; ci < 4; ci++) {
    const [cx, cy, a0] = corners[ci];
    for (let s = 0; s <= 8; s++) { const t = a0 + (s / 8) * (Math.PI / 2); ring.push([cx + Math.cos(t) * RR, cy + Math.sin(t) * RR]); }
    const [nx, ny, a1] = corners[(ci + 1) % 4], e = ring[ring.length - 1], st = [nx + Math.cos(a1) * RR, ny + Math.sin(a1) * RR];
    const steps = ci % 2 ? 20 : 40;
    for (let s = 1; s < steps; s++) ring.push([e[0] + ((st[0] - e[0]) * s) / steps, e[1] + ((st[1] - e[1]) * s) / steps]);
  }
  const base = pos.length / 3;
  ring.forEach(([x, y]) => { add(x, y, T / 2, 0, 0, 2); add(x, y, -T / 2, 0, 0, 2); });
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length, f0 = base + i * 2, b0 = f0 + 1, f1 = base + j * 2, b1 = f1 + 1;
    idx.push(f0, b0, b1, f0, b1, f1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

async function loadWorks() {
  const card = (draw) => canvasTex(1600, 1000, draw);
  const cover = (img) => card((x, w, h) => { const s = Math.max(w / img.width, h / img.height); x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s); });
  const phone = (bg, im) => card((x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const ph = h * 0.86, pw = ph * (im.width / im.height);
    x.save(); x.beginPath(); x.roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 34); x.clip(); x.drawImage(im, (w - pw) / 2, (h - ph) / 2, pw, ph); x.restore();
  });
  const img = (src) => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.src = src; });
  const [lumo, jontai, cookies] = await Promise.all([img('img/lumo.webp'), img('/public/flight/jontai.webp'), img('/public/flight/cookies.webp')]);
  const works = [
    { title: 'Lumo', meta: 'Android app · 2026', tex: phone(['#1f7a34', '#0b3b17'], lumo) },
    { title: 'Locked', meta: 'Android app · 2026', tex: phone(['#2a1a12', '#0d0b0f'], lockedScreen().image) },
    { title: 'Jontai Energy', meta: 'Website · 2025', tex: cover(jontai) },
    { title: 'Cookies Clicker', meta: 'Browser game · 2025', tex: cover(cookies) },
    { title: 'Roblox game', meta: 'In development', tex: card((x, w, h) => x.drawImage(lockedGame().image, 0, 0, w, h)), locked: true },
  ];
  for (const w of works) {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d'); x.drawImage(w.tex.image, 0, 0, 1, 1);
    const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
    w.avg = new THREE.Color(`rgb(${r},${g},${b})`);
  }
  return works;
}

export async function createSpace(renderer, { W, H, dpr, hudParent = document.body }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 3000);
  const sunU = { value: SUN.clone() };

  // ---------------------------------------------------------------- the sky: Milky Way, a nebula, the sun
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: { uSun: sunU },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${NOISE}
      uniform vec3 uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 nMW = normalize(vec3(0.32, 0.86, 0.4));
        float h = dot(d, nMW);
        float band = exp(-h * h / 0.03);
        float clump = fbm(d * 7.0);
        float lane = smoothstep(0.42, 0.72, fbm(d * 11.0 + 4.0)) * exp(-h * h / 0.006);
        vec3 mw = mix(vec3(0.16, 0.10, 0.24), vec3(0.46, 0.36, 0.30), exp(-h * h / 0.008)) * band * (0.3 + clump) * (1.0 - lane * 0.85);
        vec3 nd = normalize(vec3(-0.62, 0.36, -0.7));
        float near = smoothstep(0.25, 0.95, dot(d, nd));
        vec3 q = d * 2.6;
        float w = fbm(q + fbm(q * 1.7 + 2.0) * 1.7);
        float fil = pow(1.0 - abs(fbm(q * 3.1 + 7.0) * 2.0 - 1.0), 7.0);
        vec3 neb = (vec3(0.30, 0.08, 0.46) * smoothstep(0.4, 0.9, w) + vec3(0.7, 0.42, 0.14) * fil * smoothstep(0.45, 0.8, w) * 0.7) * near;
        float s = max(dot(d, uSun), 0.0);
        vec3 sun = vec3(1.0, 0.86, 0.66) * (smoothstep(0.99994, 0.99997, s) * 8.0 + pow(s, 2400.0) * 1.4 + pow(s, 160.0) * 0.14 + pow(s, 14.0) * 0.006);
        vec3 col = vec3(0.002, 0.001, 0.005) + mw * 0.1 + neb * 0.5 + sun;
        vec3 p = d * 320.0, c = floor(p); float r = hash13(c);
        if (r > 0.93) { float dd = length(fract(p) - vec3(hash13(c + 1.7), hash13(c + 3.1), hash13(c + 5.3))); col += vec3(0.8, 0.8, 1.0) * exp(-dd * dd * 40.0) * (r - 0.93) * 5.0 * (0.35 + band); }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -3;
  scene.add(sky);

  // Stars one by one, on a shell round the camera: a few bright ones bloom.
  const STARS = 5200;
  {
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const p = new Float32Array(STARS * 3), size = new Float32Array(STARS), col = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p.set([Math.cos(a) * s * 800, u * 800, Math.sin(a) * s * 800], i * 3);
      const m = Math.pow(rnd(), 7);
      size[i] = 1.1 + m * 3.2;
      const t = rnd(), b = 0.18 + m * 9;
      const c = t < 0.1 ? [1, 0.72, 0.42] : t < 0.3 ? [0.72, 0.68, 1] : [0.94, 0.92, 1];
      col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    var stars = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: dpr } },
      vertexShader: 'attribute float aSize; attribute vec3 aCol; uniform float uPx; varying vec3 vCol; void main(){ vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx; }',
      fragmentShader: 'varying vec3 vCol; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vCol * (1.0 - smoothstep(0.05, 0.5, d)), 1.0); }',
    }));
    stars.renderOrder = -2;
    stars.frustumCulled = false;
    scene.add(stars);
  }

  // ---------------------------------------------------------------- the planet: mostly night, a lit crescent and its air
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET.r, 160, 80), new THREE.ShaderMaterial({
    uniforms: { uSun: sunU, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vL; void main(){ vL = position / ' + PLANET.r.toFixed(1) + '; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${NOISE}
      uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vL;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
        float ndl = dot(n, uSun);
        vec3 q = vL; float wv = fbm(q * 3.0 + vec3(0.0, 0.0, uTime * 0.004));
        float b = fbm(vec3(q.x * 2.0, q.y * 11.0 + wv * 2.2, q.z * 2.0));
        vec3 surf = mix(vec3(0.05, 0.016, 0.09), vec3(0.26, 0.1, 0.38), b);
        surf = mix(surf, vec3(0.62, 0.42, 0.24), smoothstep(0.6, 0.78, b) * 0.55);
        float cloud = smoothstep(0.55, 0.8, fbm(q * 6.0 + wv));
        surf = mix(surf, vec3(0.62, 0.56, 0.72), cloud * 0.25);
        float day = smoothstep(0.0, 0.5, ndl);
        vec3 col = surf * day * vec3(1.0, 0.88, 0.72) * 0.8;
        float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6);
        float lit = smoothstep(-0.32, 0.35, ndl);
        vec3 tang = normalize(n - v * dot(n, v));
        vec3 air = mix(vec3(0.34, 0.16, 0.9), vec3(1.0, 0.7, 0.36), smoothstep(0.6, 0.98, dot(tang, uSun) * 0.5 + 0.5));
        col += air * rim * lit * 0.9;
        col += vec3(0.012, 0.005, 0.025) * (1.0 - day);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  planet.position.copy(PLANET.at);
  planet.rotation.set(0.35, 0, -0.2);
  const air = new THREE.Mesh(new THREE.SphereGeometry(PLANET.r * 1.035, 160, 80), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uSun: sunU },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vP);
        float f = dot(n, v);
        float k = pow(clamp(-f / 0.26, 0.0, 1.0), 3.0) * smoothstep(-0.5, 0.4, dot(n, uSun));
        vec3 c = mix(vec3(0.45, 0.2, 0.9), vec3(1.0, 0.72, 0.4), smoothstep(0.2, 0.8, dot(n, uSun)));
        gl_FragColor = vec4(c * k * 1.4, 1.0);
      }`,
  }));
  air.position.copy(PLANET.at);
  scene.add(planet, air);

  // ---------------------------------------------------------------- dust: specks near and far, soft when close, streaked when you move
  const DUST = 3200;
  const dustU = {
    uCam: { value: new THREE.Vector3() }, uPrev: { value: new THREE.Matrix4() }, uFocal: { value: 1 }, uSun: sunU,
    uPP: { value: Array.from({ length: 6 }, () => new THREE.Vector3(0, 0, 999)) }, uPC: { value: Array.from({ length: 6 }, () => new THREE.Color(0, 0, 0)) },
    uShutter: { value: 2.2 }, uPx: { value: dpr },
  };
  const dustVert = `
    attribute float aSeed; attribute float aEnd;
    uniform vec3 uCam; uniform mat4 uPrev; uniform float uFocal, uShutter, uPx; uniform vec3 uSun; uniform vec3 uPP[6]; uniform vec3 uPC[6];
    varying vec3 vCol; varying float vA;
    void main(){
      vec3 p = position;
      p.x = uCam.x + mod(p.x - uCam.x + 40.0, 80.0) - 40.0;
      vec4 cur = projectionMatrix * viewMatrix * vec4(p, 1.0);
      vec4 prev = uPrev * vec4(p, 1.0);
      float depth = cur.w;
      vec3 v = normalize(p - cameraPosition);
      vec3 light = vec3(0.5, 0.46, 0.66) * 0.085 + vec3(1.0, 0.8, 0.55) * pow(max(dot(v, uSun), 0.0), 9.0) * 0.6;
      for (int i = 0; i < 6; i++) { float d = distance(p, uPP[i]); light += uPC[i] * 0.7 / (1.0 + d * d * 0.5); }
      vCol = light * (0.45 + aSeed);
      #ifdef STREAK
        vec2 a = cur.xy / cur.w, b = prev.xy / prev.w;
        float len = length((a - b) * vec2(${(W * dpr) / 2}.0, ${(H * dpr) / 2}.0));
        gl_Position = aEnd < 0.5 ? cur : mix(cur, prev * (cur.w / prev.w), uShutter);
        vA = prev.w > 0.0 && depth > 0.15 ? smoothstep(2.0, 8.0, len) * 4.0 / (1.0 + len * 0.06) * smoothstep(0.15, 1.2, depth) : 0.0;
      #else
        gl_Position = cur;
        float size = 0.026 * (0.5 + aSeed) * uFocal / max(depth, 0.01);
        gl_PointSize = clamp(size, 1.4 * uPx, 130.0 * uPx);
        vA = min(1.0, pow(3.0 * uPx / max(size, 0.001), 2.0)) * smoothstep(0.12, 0.9, depth) * (1.0 - smoothstep(30.0, 48.0, depth));
      #endif
    }`;
  const dustGeo = (streak) => {
    let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const k = streak ? 2 : 1;
    const p = new Float32Array(DUST * 3 * k), seed = new Float32Array(DUST * k), end = new Float32Array(DUST * k);
    for (let i = 0; i < DUST; i++) {
      const x = (rnd() - 0.5) * 80, y = (rnd() - 0.5) * 18, z = -0.4 - Math.pow(rnd(), 0.8) * 44, s = rnd();
      for (let e = 0; e < k; e++) { p.set([x, y, z], (i * k + e) * 3); seed[i * k + e] = s; end[i * k + e] = e; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    return g;
  };
  const dust = new THREE.Points(dustGeo(false), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: dustU, vertexShader: dustVert,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.2, 0.5, d)) * vA; gl_FragColor = vec4(vCol * a, 1.0); }',
  }));
  const streaks = new THREE.LineSegments(dustGeo(true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: dustU, defines: { STREAK: 1 }, vertexShader: dustVert,
    fragmentShader: 'varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol * vA, 1.0); }',
  }));
  dust.frustumCulled = streaks.frustumCulled = false;
  scene.add(dust, streaks);

  // ---------------------------------------------------------------- rocks: a loose field, near and far, rim-lit by the sun
  const sunLight = new THREE.DirectionalLight('#ffe2bc', 3.2);
  sunLight.position.copy(SUN).multiplyScalar(100);
  scene.add(sunLight, new THREE.HemisphereLight('#3c2468', '#000000', 0.35));
  // Each picture near you throws its own light on the rocks around it.
  const spill = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ffffff', 0, 0, 2); scene.add(l); return l; });
  const rockMat = new THREE.MeshPhysicalMaterial({ color: '#463a4c', roughness: 0.9, metalness: 0.05, flatShading: true, sheen: 1, sheenColor: new THREE.Color('#8a62c4'), sheenRoughness: 0.45 });
  const ROCKS = [
    [-2.4, 1.2, -10.2, 0.11], [2.9, -1.7, -11.0, 0.16], [-9.5, 2.4, -12.5, 0.4], [8.2, -3.0, -12.0, 0.3], [9.2, 0.4, -19.0, 0.55], [-12.5, -1.2, -18.0, 0.7],
    [-4.5, -4.2, -25.0, 1.0], [12.0, 3.8, -29.0, 1.5], [-17.0, 4.8, -34.0, 2.3], [3.5, 6.2, -41.0, 1.2], [21.0, -5.5, -46.0, 3.0], [-27.0, -1.5, -56.0, 4.2],
    [31.0, 7.0, -68.0, 6.5], [-40.0, 9.0, -82.0, 7.5], [14.5, -0.6, -15.5, 0.22], [-15.0, 1.6, -15.0, 0.25],
  ];
  const rocks = ROCKS.map(([x, y, z, size], i) => {
    const g = new THREE.IcosahedronGeometry(1, 4), a = g.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < a.count; k++) {
      v.fromBufferAttribute(a, k);
      const n = 0.2 * Math.sin(v.x * 2.3 + i) * Math.sin(v.y * 2.9 + i * 1.7) * Math.sin(v.z * 2.1 + i * 0.6) + 0.07 * Math.sin(v.x * 7.1 + v.y * 5.3 + i) + 0.035 * Math.sin(v.z * 13.0 + v.x * 11.0);
      v.multiplyScalar(1 + n);
      a.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat);
    m.scale.set(size * (1 + (i % 3) * 0.25), size * (0.75 + (i % 2) * 0.2), size);
    m.userData = { x, y, z, spin: 0.05 + (i % 4) * 0.03, axis: new THREE.Vector3(Math.sin(i), 1, Math.cos(i * 1.3)).normalize() };
    scene.add(m);
    return m;
  });

  // ---------------------------------------------------------------- the works: glass slabs on a band that curves round you
  const works = await loadWorks();
  const cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 2000, cube);
  const geo = slabGeometry();
  const slabVert = `
    attribute float aPart;
    uniform float uVel, uTime, uHover, uPhase, uBend;
    varying vec2 vUv; varying vec3 vWP; varying vec3 vLocal; varying float vPart;
    void main(){
      vUv = uv; vPart = aPart; vLocal = position;
      vec3 p = position;
      float x = p.x / ${(PW / 2).toFixed(3)};
      float wave = sin(x * 1.7 + uTime * 1.8 + uPhase) * 0.6 + sin(x * 0.8 - uTime * 1.2 + uPhase * 1.7) * 0.4;
      p.z += uVel * wave * 0.34 - uBend * x * x * 0.5;
      p.y += uVel * x * 0.07;
      p *= 1.0 + uHover * 0.035;
      vec4 w = modelMatrix * vec4(p, 1.0);
      vWP = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const slabFrag = `
    uniform sampler2D uMap; uniform samplerCube uEnv; uniform vec3 uSun, uAxX, uAxY; uniform float uHover, uLocked, uOn;
    varying vec2 vUv; varying vec3 vWP; varying vec3 vLocal; varying float vPart;
    float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      float y01 = vLocal.y / ${PH} + 0.5, edge = 1.0 - uOn;
      if (y01 < edge - 0.004) discard;
      vec3 V = normalize(cameraPosition - vWP);
      vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
      if (dot(N, V) < 0.0) N = -N;
      vec3 sunC = vec3(1.0, 0.86, 0.66) * 3.2;
      float ndl = max(dot(N, uSun), 0.0);
      float nh = max(dot(N, normalize(uSun + V)), 0.0);
      float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      vec3 env = textureCube(uEnv, reflect(-V, N)).rgb;
      vec3 col;
      if (vPart > 1.5) {
        col = vec3(0.3, 0.2, 0.12) * ndl * sunC * 0.5 + vec3(1.0, 0.74, 0.44) * pow(nh, 70.0) * ndl * 9.0 + env * 0.35 + vec3(0.016, 0.01, 0.024);
      } else {
        float d = rbox(vLocal.xy, vec2(${PW / 2}, ${PH / 2}), ${RR});
        if (d > 0.0) discard;
        if (vPart > 0.5) {
          col = vec3(0.012, 0.01, 0.016) + vec3(0.3, 0.2, 0.12) * ndl * sunC * 0.2 + vec3(1.0, 0.74, 0.44) * pow(nh, 50.0) * ndl * 2.5 + env * F;
        } else {
          float bez = 0.075;
          float inner = rbox(vLocal.xy, vec2(${PW / 2}, ${PH / 2}) - bez, ${RR} - bez * 0.6);
          vec2 uv = vLocal.xy / (vec2(${PW}, ${PH}) - 2.0 * bez) + 0.5;
          vec3 img = texture2D(uMap, uv).rgb;
          img = mix(img, vec3(dot(img, vec3(0.3, 0.59, 0.11))), uLocked * 0.6);
          vec3 screen = img * (0.86 + uHover * 0.08);
          // The bezel: near-black metal whose outer lip catches the sun on the side that faces it.
          vec3 outw = normalize(uAxX * vLocal.x / ${PW / 2} + uAxY * vLocal.y / ${PH / 2});
          float lip = smoothstep(-0.03, -0.004, d) * pow(max(dot(outw, uSun), 0.0), 1.2);
          vec3 bezel = vec3(0.016, 0.012, 0.02) + vec3(1.0, 0.72, 0.4) * lip * 2.4;
          float on = 1.0 - smoothstep(-0.003, 0.003, inner);
          col = mix(bezel, screen, on) + env * F * 1.2;
        }
      }
      col += vec3(0.78, 0.66, 1.0) * exp(-abs(y01 - edge) * 110.0) * step(uOn, 0.999) * 2.2;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const haloMat = (c) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: c.clone().multiplyScalar(0.55) }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uC; uniform float uA; varying vec2 vP;
      float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main(){ float d = rbox(vP, vec2(${PW / 2}, ${PH / 2}), ${RR}); gl_FragColor = vec4(uC * exp(-max(d, 0.0) * 2.4) * smoothstep(-0.2, 0.05, d) * 0.07 * uA, 1.0); }`,
  });
  const hud = document.createElement('div');
  hud.className = 'sp-hud';
  hud.innerHTML = `<style>${CSS}</style><div class="sp-tags"></div>
    <div class="sp-ret"><i></i><i></i><i></i><i></i><span class="mono"></span></div>
    <p class="sp-top"><span>Bob Chung</span><span>Selected works</span></p>
    <div class="sp-tape"><div class="t"></div><div class="T"></div><b></b></div>
    <p class="sp-read mono">Scroll or drag<br>X <b>+000.0</b> · Z <b>-000.0</b></p>
    <p class="sp-count mono"><span>Speed <i>0.00</i> c</span><br><b>01</b> / 05</p>
    <div class="sp-cursor mono">Drag</div>`;
  hudParent.append(hud);
  const tagsEl = hud.querySelector('.sp-tags'), ret = hud.querySelector('.sp-ret'), retLabel = ret.querySelector('span');
  const tapeT = hud.querySelector('.sp-tape .t'), tapeTT = hud.querySelector('.sp-tape .T');
  const readB = hud.querySelectorAll('.sp-read b'), speedEl = hud.querySelector('.sp-count i'), countEl = hud.querySelector('.sp-count b');
  const cursor = hud.querySelector('.sp-cursor');
  const panels = [];
  for (let i = 0; i < N; i++) {
    const w = works[i % works.length];
    const u = { uMap: { value: w.tex }, uEnv: { value: cube.texture }, uSun: sunU, uAxX: { value: new THREE.Vector3(1, 0, 0) }, uAxY: { value: new THREE.Vector3(0, 1, 0) },
      uVel: { value: 0 }, uTime: { value: 0 }, uHover: { value: 0 }, uPhase: { value: i * 1.9 }, uBend: { value: 0 }, uLocked: { value: w.locked ? 1 : 0 }, uOn: { value: 1 } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: slabVert, fragmentShader: slabFrag, side: THREE.DoubleSide }));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.9, PH * 2.2), haloMat(w.avg));
    halo.position.z = -0.2;
    m.add(halo);
    scene.add(m);
    const tag = document.createElement('p'); tag.className = `sp-tag${w.locked ? ' locked' : ''}`; tag.textContent = w.title;
    const btn = document.createElement('i'); btn.className = 'sp-btn';
    tagsEl.append(tag, btn);
    panels.push({ m, u, halo, tag, btn, work: w, hover: 0, i, n: i % works.length });
  }

  // The reflections: the sky and the planet as the slabs see them.
  for (const p of panels) p.m.visible = false;
  dust.visible = streaks.visible = stars.visible = false;
  for (const r of rocks) r.visible = false;
  cubeCam.position.set(0, 0, -12);
  sky.position.copy(cubeCam.position);
  stars.position.copy(cubeCam.position);
  cubeCam.update(renderer, scene);
  for (const p of panels) p.m.visible = true;
  dust.visible = streaks.visible = stars.visible = true;
  for (const r of rocks) r.visible = true;

  // ---------------------------------------------------------------- the picture: rendered off screen, finished by whoever shows it
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.renderToScreen = false;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.12, 1.12));
  composer.addPass(new OutputPass());
  const portalMaterial = finishMaterial(false), fullMaterial = finishMaterial(true);
  for (const m of [portalMaterial, fullMaterial]) m.uniforms.uRes.value.set(W * dpr, H * dpr);
  const fsScene = new THREE.Scene(), fsCam = new THREE.Camera();
  const fs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fullMaterial);
  fs.frustumCulled = false;
  fsScene.add(fs);

  // ---------------------------------------------------------------- input for hovering
  const mouse = new THREE.Vector2(9, 9), ray = new THREE.Raycaster();
  let mx = -999, my = -999;
  addEventListener('pointermove', (e) => { mouse.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1); mx = e.clientX; my = e.clientY; });
  const prevVP = new THREE.Matrix4(), tmp = new THREE.Vector3(), center = new THREE.Vector3();
  let first = true, lastX = 0, vel = 0, hovered = null;
  const wrap = (x) => x - LOOP * Math.floor((x + LOOP / 2) / LOOP);
  const proj = (v) => { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, tmp.z]; };

  return {
    scene, camera, portalMaterial, hud,
    /** pos: the camera, in space units; fov; look: a little turn toward the pointer; arrive: 0..1, how settled you are. */
    update({ pos, fov, look = { x: 0, y: 0 }, arrive = 1, power = 1, dt = 1 / 60, time = 0, dragging = false }) {
      // Before the move: where the camera was, for the dust's streaks.
      if (!first) prevVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      else lastX = pos.x;
      camera.position.copy(pos);
      camera.rotation.set((look.y * 0.05 - Math.atan2(-Y0, DB)) * arrive, -look.x * 0.07 * arrive, 0);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      if (first) { prevVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); first = false; }
      sky.position.copy(pos);
      stars.position.copy(pos);
      dustU.uPrev.value.copy(prevVP);
      dustU.uCam.value.copy(pos);
      dustU.uFocal.value = (H * dpr) / 2 / Math.tan((fov * Math.PI) / 360);
      planet.material.uniforms.uTime.value = time;
      for (const r of rocks) {
        const d = r.userData;
        r.position.set(pos.x + (((d.x - pos.x + 50) % 100) + 100) % 100 - 50, d.y, d.z);
        r.setRotationFromAxisAngle(d.axis, time * d.spin + d.x);
      }
      const cx = pos.x;
      vel += ((cx - lastX) / Math.max(dt, 1e-3) - vel) * 0.18;
      lastX = cx;
      const v = THREE.MathUtils.clamp(vel * 0.07, -1, 1);
      // Hover: the picture under the pointer.
      ray.setFromCamera(mouse, camera);
      const hit = arrive > 0.9 && !dragging ? ray.intersectObjects(panels.filter((p) => p.u.uOn.value > 0.9).map((p) => p.m), false)[0]?.object ?? null : null;
      const hp = panels.find((p) => p.m === hit) ?? null;
      if (hp !== hovered) { hovered = hp; cursor.classList.toggle('open', !!hp); cursor.textContent = hp ? (hp.work.locked ? 'Soon' : 'Open') : 'Drag'; }
      cursor.style.transform = `translate(${mx}px, ${my}px)`;
      // The band: a curve of radius RC whose middle is DB in front of where the camera comes to rest.
      center.set(cx, Y0, -L - DB + RC);
      let target = null, best = 1e9;
      const lights = [];
      panels.forEach((p) => {
        const dx = wrap(p.i * SP - cx), ang = dx / RC;
        p.hover += ((p === hovered ? 1 : 0) - p.hover) * 0.1;
        const push = p.hover * 0.55;
        const bob = Math.sin(time * 0.45 + p.i * 1.3) * 0.07;
        p.m.position.set(cx + Math.sin(ang) * (RC - push), Y0 + bob, center.z - Math.cos(ang) * (RC - push));
        p.m.lookAt(center.x, Y0 + bob, center.z);
        p.m.rotateZ(Math.sin(time * 0.3 + p.i * 2.1) * 0.012);
        p.m.updateMatrixWorld();
        p.u.uAxX.value.setFromMatrixColumn(p.m.matrixWorld, 0).normalize();
        p.u.uAxY.value.setFromMatrixColumn(p.m.matrixWorld, 1).normalize();
        p.u.uVel.value = v;
        p.u.uBend.value = Math.abs(v) * 0.7;
        p.u.uTime.value = time;
        p.u.uHover.value = p.hover;
        p.u.uOn.value = THREE.MathUtils.clamp(power * 1.7 - Math.abs(dx) / SP * 0.35, 0, 1);
        p.halo.visible = p.u.uOn.value > 0;
        p.halo.material.uniforms.uA.value = p.u.uOn.value;
        if (Math.abs(dx) < 3 * SP) lights.push(p);
        if (Math.abs(dx) < best) { best = Math.abs(dx); target = p; }
        // The title in the picture's bottom left, the round button in its bottom right.
        const bl = proj(tmp.set(-PW / 2 + 0.3, -PH / 2 + 0.32, T).applyMatrix4(p.m.matrixWorld));
        const br = proj(tmp.set(PW / 2 - 0.34, -PH / 2 + 0.34, T).applyMatrix4(p.m.matrixWorld));
        const facing = Math.cos(ang);
        const vis = bl[2] < 1 && facing > 0.55 ? Math.min(1, (facing - 0.55) * 4) * (1 - Math.min(1, Math.abs(v) * 1.6)) : 0;
        p.tag.style.opacity = p.btn.style.opacity = vis.toFixed(3);
        p.tag.style.transform = `translate(${bl[0]}px, ${bl[1] - 20}px)`;
        p.btn.style.transform = `translate(${br[0]}px, ${br[1]}px)`;
      });
      lights.sort((a, b) => Math.abs(wrap(a.i * SP - cx)) - Math.abs(wrap(b.i * SP - cx)));
      for (let k = 0; k < 6; k++) {
        const p = lights[k];
        if (p && k < 3) { spill[k].position.copy(p.m.position).addScaledVector(center.clone().sub(p.m.position).normalize(), 0.8); spill[k].color.copy(p.work.avg); spill[k].intensity = 9 * p.u.uOn.value * (1 + p.hover); }
        else if (k < 3) spill[k].intensity = 0;
        if (p) { dustU.uPP.value[k].copy(p.m.position); dustU.uPC.value[k].copy(p.work.avg).multiplyScalar((0.35 + p.hover * 0.3) * p.u.uOn.value); }
        else dustU.uPP.value[k].set(0, 0, 999);
      }
      // The reticle locks on the picture you hover, else the one in front.
      const tp = hovered ?? target;
      const c = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([a, b]) => proj(tmp.set((a * PW) / 2, (b * PH) / 2, T).applyMatrix4(tp.m.matrixWorld)));
      const left = Math.min(c[0][0], c[2][0]), top = Math.min(c[0][1], c[1][1]), right = Math.max(c[1][0], c[3][0]), bottom = Math.max(c[2][1], c[3][1]);
      Object.assign(ret.style, { transform: `translate(${left}px, ${top}px)`, width: `${right - left}px`, height: `${bottom - top}px`, opacity: String(1 - Math.min(1, Math.abs(v) * 2)) });
      retLabel.innerHTML = `Nº ${String(tp.n + 1).padStart(2, '0')} <b>·</b> ${tp.work.meta}`;
      countEl.textContent = String(target.n + 1).padStart(2, '0');
      tapeT.style.backgroundPosition = `${-cx * 64 / SP}px 0`;
      tapeTT.style.backgroundPosition = `${-cx * 64 / SP + 210}px 0`;
      readB[0].textContent = `${pos.x >= 0 ? '+' : '-'}${Math.abs(pos.x).toFixed(1).padStart(5, '0')}`;
      readB[1].textContent = `${pos.z >= 0 ? '+' : '-'}${Math.abs(pos.z).toFixed(1).padStart(5, '0')}`;
      speedEl.textContent = Math.min(0.99, Math.abs(vel) * 0.04).toFixed(2);
      hud.style.opacity = arrive.toFixed(3);
      // The sun on screen, for the lens's streak.
      const sp = proj(tmp.copy(SUN).multiplyScalar(500).add(pos));
      const onScreen = sp[2] < 1 && sp[0] > -W * 0.2 && sp[0] < W * 1.2 && sp[1] > -H * 0.2 && sp[1] < H * 1.2;
      for (const m of [portalMaterial, fullMaterial]) { m.uniforms.uSun.value.set(sp[0] * dpr, (H - sp[1]) * dpr, onScreen ? 1 : 0); m.uniforms.uTime.value = time; }
      return { vel, target: target.n, hovered: hovered?.n ?? -1 };
    },
    /** Draws the space into its own picture; the portal and present() show it. */
    render() {
      const ex = renderer.toneMappingExposure, tm = renderer.toneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      composer.render();
      renderer.toneMappingExposure = ex;
      renderer.toneMapping = tm;
      const tex = composer.readBuffer.texture;
      portalMaterial.uniforms.uTex.value = fullMaterial.uniforms.uTex.value = tex;
      renderer.setRenderTarget(null);
    },
    /** The whole screen is space. */
    present() {
      renderer.setRenderTarget(null);
      renderer.render(fsScene, fsCam);
    },
  };
}
