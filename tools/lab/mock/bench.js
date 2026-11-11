// LAB ONLY (throwaway). The works' room behind the coin's hole: a dark workbench, after jesperlandberg.com's works band.
// Units: the hole is 2·HS wide, at the origin, facing +z; the page is on the +z side. The host gives `home`, where the
// camera comes to rest, and the band's height; the works stand on a ring round home and turn as you scroll.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { canvasTex, lockedScreen, lockedGame } from './kit.js';

export const HS = 0.9; // half the hole's side
export const RC = 9; // the ring's radius
export const PW = 5.1, PH = 3.1875, GAP = 0.13; // a picture is a plain 16:10 rectangle
export const STEP = (PW + GAP) / RC; // radians from one picture to the next
const POOL = 9, CORNER = 0.07;

const CSS = `
  .bh { position: fixed; inset: 0; z-index: 12; pointer-events: none; color: #f2efe8; opacity: 0; font: 500 12px Barlow; }
  .bh .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
  .bh-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
  .bh-tl { top: var(--gutter, 30px); left: var(--gutter, 30px); }
  .bh-tr { top: var(--gutter, 30px); right: var(--gutter, 30px); }
  .bh-bl { bottom: var(--gutter, 30px); left: var(--gutter, 30px); color: rgb(242 239 232 / 0.55); line-height: 1.8; }
  .bh-br { bottom: var(--gutter, 30px); right: var(--gutter, 30px); color: rgb(242 239 232 / 0.55); text-align: right; line-height: 1.8; }
  .bh b { color: #f2efe8; font-weight: 500; }
  .bh-br i { font-style: normal; color: #cf9a62; }
  .bh-t { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; font: 500 17px Barlow; letter-spacing: -0.01em; text-shadow: 0 1px 10px rgb(0 0 0 / 0.45); transform-origin: 0 100%; }
  .bh-t.locked { color: #cf9a62; }
  .bh-b { position: fixed; left: 0; top: 0; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; background: #0b0910; display: grid; place-items: center; transition: width .35s, height .35s, margin .35s; }
  .bh-b::after { content: '→'; font: 500 11px Barlow; color: #f2efe8; }
  .bh-b.on { width: 34px; height: 34px; margin: -17px 0 0 -17px; }`;

function finishMaterial(full) {
  return new THREE.ShaderMaterial({
    depthTest: !full, depthWrite: !full,
    uniforms: { uTex: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: { value: 0 } },
    vertexShader: full ? 'void main(){ gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }' : 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uTex; uniform vec2 uRes; uniform float uTime;
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes, c = uv - 0.5;
        vec3 col = texture2D(uTex, uv).rgb;
        col *= 1.0 - smoothstep(0.45, 1.15, length(c * vec2(uRes.x / uRes.y, 1.0))) * 0.7;
        float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
        col += (g - 0.5) * 0.028;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
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
    { title: 'Lumo', tex: phone(['#1f7a34', '#0b3b17'], lumo) },
    { title: 'Locked', tex: phone(['#2a1a12', '#0d0b0f'], lockedScreen().image) },
    { title: 'Jontai Energy', tex: cover(jontai) },
    { title: 'Cookies Clicker', tex: cover(cookies) },
    { title: 'Roblox game · in development', tex: card((x, w, h) => x.drawImage(lockedGame().image, 0, 0, w, h)), locked: true },
  ];
  for (const w of works) {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d'); x.drawImage(w.tex.image, 0, 0, 1, 1);
    const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
    w.avg = new THREE.Color(`rgb(${r},${g},${b})`);
  }
  return works;
}

/** The dial on the bench: degrees round the ring, a tick a degree, a number every ten. */
function dialTexture() {
  return canvasTex(8192, 160, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const per = w / 360;
    for (let d = 0; d < 360; d++) {
      const big = d % 10 === 0, mid = d % 5 === 0;
      x.fillStyle = big ? 'rgba(242,239,232,0.7)' : 'rgba(242,239,232,0.32)';
      x.fillRect(d * per, 0, big ? 3 : 2, big ? h * 0.5 : mid ? h * 0.32 : h * 0.2);
      if (big) { x.font = '500 46px "IBM Plex Mono"'; x.fillStyle = 'rgba(242,239,232,0.55)'; x.fillText(String(d).padStart(3, '0'), d * per + 10, h * 0.9); }
    }
  });
}

export async function createBench(renderer, { W, H, dpr, home, bandY, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020103');
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 600);
  const floorY = home.y + bandY - PH / 2 - 0.6;

  // ---------------------------------------------------------------- the room: black, a faint violet haze low down, specks of dust
  const haze = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vD; void main(){ vec3 d = normalize(vD); float h = exp(-pow((d.y + 0.08) / 0.12, 2.0)); gl_FragColor = vec4(vec3(0.006, 0.005, 0.009) + vec3(0.03, 0.018, 0.05) * h * 0.22, 1.0); }',
  }));
  haze.renderOrder = -2;
  scene.add(haze);
  const DUST = 1400;
  const dustU = { uCam: { value: new THREE.Vector3() }, uFocal: { value: 1 }, uPx: { value: dpr } };
  {
    let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const p = new Float32Array(DUST * 3), seed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      p.set([home.x + (rnd() - 0.5) * 40, home.y + (rnd() - 0.4) * 14, -0.5 - rnd() * 30], i * 3);
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    var dust = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: dustU,
      vertexShader: `attribute float aSeed; uniform float uFocal, uPx; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float depth = -mv.z;
          float size = 0.02 * (0.5 + aSeed) * uFocal / max(depth, 0.01); gl_PointSize = clamp(size, 1.2 * uPx, 60.0 * uPx);
          vA = min(1.0, pow(2.5 * uPx / max(size, 0.001), 2.0)) * smoothstep(0.2, 1.2, depth) * (0.25 + aSeed * 0.5); }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.72, 0.66, 0.92) * (1.0 - smoothstep(0.15, 0.5, d)) * vA, 1.0); }',
    }));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  // ---------------------------------------------------------------- the bench: a fine grid with crosses, fading before the works, lit by them
  const lightU = { uLP: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, -99, 0)) }, uLC: { value: Array.from({ length: 5 }, () => new THREE.Color(0, 0, 0)) } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShaderMaterial({
    uniforms: { uHome: { value: home.clone() }, ...lightU },
    vertexShader: 'varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uHome; uniform vec3 uLP[5]; uniform vec3 uLC[5]; varying vec3 vWP;
      float lines(vec2 p, float s, float w){ vec2 f = abs(fract(p / s - 0.5) - 0.5) * s; vec2 fw = fwidth(p) * w; vec2 l = 1.0 - smoothstep(fw * 0.5, fw * 1.5, f); return max(l.x, l.y); }
      void main(){
        vec2 p = vWP.xz - uHome.xz;
        float dist = length(p);
        float fade = 1.0 - smoothstep(${(RC * 0.45).toFixed(2)}, ${(RC + 2.5).toFixed(2)}, dist);
        float minor = lines(p, 1.0, 0.8), major = lines(p, 5.0, 1.2);
        vec2 q = abs(fract(p / 5.0 - 0.5) - 0.5) * 5.0;
        float cross = step(max(q.x, q.y), 0.22) * (1.0 - smoothstep(fwidth(p.x) * 1.5, fwidth(p.x) * 2.5, min(q.x, q.y)));
        vec3 col = vec3(0.006, 0.005, 0.009) + vec3(0.74, 0.7, 0.9) * (minor * 0.1 + major * 0.16 + cross * 0.4) * fade;
        for (int i = 0; i < 5; i++) { vec2 d = vWP.xz - uLP[i].xz; col += uLC[i] * exp(-dot(d, d) * 0.2) * 0.045; }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(home.x, floorY, home.z);
  scene.add(floor);
  // The dial: degrees round the ring on the bench, turning with the works; a gold mark in front of you.
  const dial = (() => {
    const segs = 360, r0 = RC - 1.5, r1 = RC - 0.95, pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pos.push(Math.sin(a) * r0, 0, -Math.cos(a) * r0, Math.sin(a) * r1, 0, -Math.cos(a) * r1);
      uv.push(i / segs, 0, i / segs, 1);
      if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 }));
    m.position.set(home.x, floorY + 0.004, home.z);
    scene.add(m);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.75), new THREE.MeshBasicMaterial({ color: '#cf9a62' }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(home.x, floorY + 0.006, home.z - (RC - 1.22));
    scene.add(mark);
    return m;
  })();

  // ---------------------------------------------------------------- the works: plain rectangles on the ring, one sheet that waves when it moves
  const works = await loadWorks();
  const cardVert = `
    uniform vec3 uHome; uniform float uAng, uVel, uTime, uHover, uY;
    varying vec2 vUv; varying vec3 vWP;
    void main(){
      vUv = uv;
      float grow = 1.0 + uHover * 0.035;
      float th = uAng + position.x * ${PW.toFixed(3)} * grow / ${RC.toFixed(1)};
      // One sheet: a wave travels along the ring while it turns, and a breath of it stays when it rests.
      float ph = th * 2.3 + uTime * 1.5;
      float r = ${RC.toFixed(1)} - uVel * 0.75 * cos(ph) - uHover * 0.3;
      float y = uY + position.y * ${PH.toFixed(3)} * grow + uVel * (0.42 * sin(ph) + 0.18 * sin(th * 4.7 - uTime * 1.1)) + 0.035 * sin(th * 1.9 + uTime * 0.45);
      vec3 p = uHome + vec3(sin(th) * r, y, -cos(th) * r);
      vWP = p;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`;
  const cardFrag = `
    uniform sampler2D uMap; uniform float uHover, uLocked, uDim;
    varying vec2 vUv; varying vec3 vWP;
    float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 p = (vUv - 0.5) * vec2(${PW}, ${PH});
      float d = rbox(p, vec2(${PW / 2}, ${PH / 2}), ${CORNER});
      float a = 1.0 - smoothstep(-0.008, 0.004, d);
      if (a < 0.01) discard;
      vec3 c = texture2D(uMap, (vUv - 0.5) / (1.0 + uHover * 0.045) + 0.5).rgb;
      c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), uLocked * 0.6);
      // The sheet darkens where it turns from you, and toward the edges of the view.
      vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
      float facing = abs(dot(N, normalize(cameraPosition - vWP)));
      c *= mix(0.42, 1.0, pow(facing, 2.0)) * uDim;
      gl_FragColor = vec4(c, a);
    }`;
  const cards = [];
  const hud = document.createElement('div');
  hud.className = 'bh';
  hud.innerHTML = `<style>${CSS}</style><div class="bh-cards"></div>
    <p class="bh-c bh-tl">Bob Chung</p><p class="bh-c bh-tr">Selected works</p>
    <p class="bh-c bh-bl m">Scroll or drag<br>θ <b>000.0°</b></p>
    <p class="bh-c bh-br m"><span>Speed <i>0.00</i></span><br><b>01</b> / 05</p>`;
  hudParent.append(hud);
  const cardsEl = hud.querySelector('.bh-cards'), thetaEl = hud.querySelector('.bh-bl b'), speedEl = hud.querySelector('.bh-br i'), countEl = hud.querySelector('.bh-br b');
  for (let i = 0; i < POOL; i++) {
    const u = { uMap: { value: works[0].tex }, uHome: { value: home.clone() }, uAng: { value: 0 }, uVel: { value: 0 }, uTime: { value: 0 }, uHover: { value: 0 }, uY: { value: bandY }, uLocked: { value: 0 }, uDim: { value: 1 } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 64, 24), new THREE.ShaderMaterial({ uniforms: u, vertexShader: cardVert, fragmentShader: cardFrag, transparent: true, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    scene.add(m);
    const t = document.createElement('p'); t.className = 'bh-t';
    const b = document.createElement('i'); b.className = 'bh-b';
    cardsEl.append(t, b);
    cards.push({ m, u, t, b, hover: 0, slot: null });
  }

  // ---------------------------------------------------------------- the picture: off screen, finished by whoever shows it
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.renderToScreen = false;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const portalMaterial = finishMaterial(false), fullMaterial = finishMaterial(true);
  for (const m of [portalMaterial, fullMaterial]) m.uniforms.uRes.value.set(W * dpr, H * dpr);
  const fsScene = new THREE.Scene(), fsCam = new THREE.Camera();
  const fs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fullMaterial);
  fs.frustumCulled = false;
  fsScene.add(fs);

  const mouse = new THREE.Vector2(9, 9), ray = new THREE.Raycaster(), tmp = new THREE.Vector3();
  addEventListener('pointermove', (e) => mouse.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1));
  let lastA = null, vel = 0, hoverSlot = null;
  const proj = (v) => { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, tmp.z]; };
  // Where a point of a picture is, the same sum as the shader's.
  const at = (ang, lx, ly, v, time, hover) => {
    const grow = 1 + hover * 0.035, th = ang + (lx * PW * grow) / RC, ph = th * 2.3 + time * 1.5;
    const r = RC - v * 0.75 * Math.cos(ph) - hover * 0.3;
    const y = home.y + bandY + ly * PH * grow + v * (0.42 * Math.sin(ph) + 0.18 * Math.sin(th * 4.7 - time * 1.1)) + 0.035 * Math.sin(th * 1.9 + time * 0.45);
    return new THREE.Vector3(home.x + Math.sin(th) * r, y, home.z - Math.cos(th) * r);
  };

  return {
    scene, camera, portalMaterial, hud,
    /** pos: the camera; fov; pitch (radians, down is negative); angle: how far the ring has turned; arrive: 0..1. */
    update({ pos, fov, pitch = 0, angle = 0, look = { x: 0, y: 0 }, arrive = 1, dt = 1 / 60, time = 0, dragging = false }) {
      camera.position.copy(pos);
      camera.rotation.set(pitch + look.y * 0.035 * arrive, -look.x * 0.05 * arrive, 0, 'YXZ');
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      haze.position.copy(pos);
      dustU.uFocal.value = (H * dpr) / 2 / Math.tan((fov * Math.PI) / 360);
      if (lastA === null) lastA = angle;
      vel += ((angle - lastA) / Math.max(dt, 1e-3) - vel) * 0.12;
      lastA = angle;
      const v = THREE.MathUtils.clamp(vel * 0.9, -1, 1);
      dial.rotation.y = angle;
      // Hover: where the pointer's ray meets the ring.
      let hit = null;
      if (arrive > 0.9 && !dragging) {
        ray.setFromCamera(mouse, camera);
        const o = ray.ray.origin.clone().sub(home), d = ray.ray.direction;
        const A = d.x * d.x + d.z * d.z, B = 2 * (o.x * d.x + o.z * d.z), Cc = o.x * o.x + o.z * o.z - RC * RC;
        const disc = B * B - 4 * A * Cc;
        if (disc > 0) {
          const t = (-B + Math.sqrt(disc)) / (2 * A), q = o.addScaledVector(d, t);
          const th = Math.atan2(q.x, -q.z), k = Math.round((th + angle) / STEP);
          const off = (th + angle - k * STEP) * RC;
          if (Math.abs(off) < PW / 2 && Math.abs(q.y - bandY) < PH / 2) hit = k;
        }
      }
      hoverSlot = hit;
      // The pool takes the slots in view: a slot k stands at k·STEP − angle.
      const k0 = Math.round(angle / STEP), lights = [];
      let front = 0;
      cards.forEach((c, i) => {
        const k = k0 + i - Math.floor(POOL / 2);
        const ang = k * STEP - angle;
        const n = ((k % 5) + 5) % 5, w = works[n];
        c.u.uMap.value = w.tex;
        c.u.uLocked.value = w.locked ? 1 : 0;
        c.u.uAng.value = ang;
        c.u.uVel.value = v;
        c.u.uTime.value = time;
        if (c.slot !== k) { c.slot = k; c.hover = 0; }
        c.hover += ((k === hoverSlot ? 1 : 0) - c.hover) * 0.1;
        c.u.uHover.value = c.hover;
        c.u.uDim.value = THREE.MathUtils.lerp(0.45, 1, THREE.MathUtils.smoothstep(Math.cos(ang - (-look.x * 0.05 * arrive)), 0.62, 0.97)) * (0.9 + c.hover * 0.1);
        if (Math.abs(ang) < STEP / 2) front = n;
        if (Math.abs(ang) < 2.2 * STEP) lights.push({ p: at(ang, 0, -0.5, v, time, c.hover), c: w.avg, s: c.u.uDim.value });
        c.t.textContent = w.title;
        c.t.classList.toggle('locked', !!w.locked);
        c.b.classList.toggle('on', c.hover > 0.5);
        const bl = proj(at(ang, -0.5 + 0.22 / PW, -0.5 + 0.28 / PH, v, time, c.hover));
        const br = proj(at(ang, 0.5 - 0.3 / PW, -0.5 + 0.3 / PH, v, time, c.hover));
        const vis = bl[2] < 1 && Math.cos(ang) > 0.55 ? Math.min(1, (Math.cos(ang) - 0.55) * 5) * (1 - Math.min(1, Math.abs(v) * 1.8)) : 0;
        c.t.style.opacity = c.b.style.opacity = vis.toFixed(3);
        c.t.style.transform = `translate(${bl[0]}px, ${bl[1] - 22}px)`;
        c.b.style.transform = `translate(${br[0]}px, ${br[1]}px)`;
      });
      for (let i = 0; i < 5; i++) {
        const l = lights[i];
        if (l) { lightU.uLP.value[i].copy(l.p); lightU.uLC.value[i].copy(l.c).multiplyScalar(l.s); }
        else lightU.uLP.value[i].set(0, -99, 0);
      }
      const deg = ((((angle * 180) / Math.PI) % 360) + 360) % 360;
      thetaEl.textContent = `${deg.toFixed(1).padStart(5, '0')}°`;
      speedEl.textContent = Math.min(0.99, Math.abs(vel) * 0.5).toFixed(2);
      countEl.textContent = String(front + 1).padStart(2, '0');
      hud.style.opacity = arrive.toFixed(3);
      for (const m of [portalMaterial, fullMaterial]) m.uniforms.uTime.value = time;
      return { vel, front, hovered: hoverSlot };
    },
    render() {
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      composer.render();
      renderer.toneMapping = tm;
      portalMaterial.uniforms.uTex.value = fullMaterial.uniforms.uTex.value = composer.readBuffer.texture;
      renderer.setRenderTarget(null);
    },
    present() {
      renderer.setRenderTarget(null);
      renderer.render(fsScene, fsCam);
    },
  };
}
