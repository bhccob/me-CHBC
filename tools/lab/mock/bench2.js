// LAB ONLY (throwaway). The works' room, round 55: premium and real. A deep purple space; the works are same-size
// pictures under glass on a ring round you (after jesperlandberg.com's band), each one lighting the room round it; a
// polished floor that reflects them, softly; the ones to the side a little out of focus, as a lens would have them.
// Hover: your cursor is a gold ring that opens into a VIEW disc over a work; the work comes toward you, tilts under
// the pointer like a card in the hand, its glass catches a glare where the pointer is, and its edge lights.
// Units: the hole is 2·HS wide, at the origin, facing +z; the page is on the +z side. The host gives `home`, where the
// camera comes to rest, and the band's height; the works stand on a ring round home and turn as you scroll.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { canvasTex, lockedScreen, lockedGame } from './kit.js';

export const HS = 0.9; // half the hole's side
export const RC = 9; // the ring's radius
export const PW = 5.8, PH = 3.625, GAP = 0.34; // a picture is a plain 16:10 rectangle
export const STEP = (PW + GAP) / RC; // radians from one picture to the next
const POOL = 9, CORNER = 0.06;

const CSS = `
  .bh { position: fixed; inset: 0; z-index: 12; pointer-events: none; color: #f2efe8; opacity: 0; font: 500 12px Barlow; }
  .bh .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
  .bh-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
  .bh-tl { top: var(--gutter, 30px); left: var(--gutter, 30px); }
  .bh-tr { top: var(--gutter, 30px); right: var(--gutter, 30px); }
  .bh-bl { bottom: var(--gutter, 30px); left: var(--gutter, 30px); color: rgb(242 239 232 / 0.55); line-height: 1.8; }
  .bh-br { bottom: var(--gutter, 30px); right: var(--gutter, 30px); color: rgb(242 239 232 / 0.55); text-align: right; line-height: 1.8; }
  .bh b { color: #f2efe8; font-weight: 500; }
  .bh-t { position: fixed; left: 0; top: 0; margin: 0; white-space: nowrap; }
  .bh-t .k { display: block; margin-bottom: 6px; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.18em; text-transform: uppercase; color: #cf9a62; }
  .bh-t .n { display: block; font: 600 22px/1 Barlow; letter-spacing: -0.01em; }
  .bh-t .n::after { content: ''; display: block; height: 1px; margin-top: 9px; background: #cf9a62; transform: scaleX(0); transform-origin: left; transition: transform .7s cubic-bezier(0.16, 1, 0.3, 1); }
  .bh-t.on .n::after { transform: none; }
  .bh-cur { position: fixed; left: 0; top: 0; pointer-events: none; z-index: 40; }
  .bh-cur .ring { position: absolute; left: 0; top: 0; width: 38px; height: 38px; margin: -19px 0 0 -19px; border-radius: 50%; border: 1px solid rgb(242 239 232 / 0.5); display: grid; place-items: center; box-sizing: border-box;
    transition: width .6s cubic-bezier(0.16, 1, 0.3, 1), height .6s cubic-bezier(0.16, 1, 0.3, 1), margin .6s cubic-bezier(0.16, 1, 0.3, 1), background .45s, border-color .45s; }
  .bh-cur .ring span { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.2em; text-transform: uppercase; color: #f2efe8; opacity: 0; transform: translateY(8px); white-space: nowrap;
    transition: opacity .3s, transform .6s cubic-bezier(0.16, 1, 0.3, 1); }
  .bh-cur .ring span i { font-style: normal; color: #e7b877; margin-left: 7px; }
  .bh-cur .dot { position: absolute; left: 0; top: 0; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #cf9a62; transition: transform .35s cubic-bezier(0.16, 1, 0.3, 1); }
  .bh-cur.on .ring { width: 116px; height: 116px; margin: -58px 0 0 -58px; background: rgb(28 10 48 / 0.62); border-color: rgb(207 154 98 / 0.95); backdrop-filter: blur(12px) saturate(1.4); -webkit-backdrop-filter: blur(10px) saturate(1.4); }
  .bh-cur.on .ring span { opacity: 1; transform: none; transition-delay: .08s; }
  .bh-cur.on .dot { transform: scale(0); }
  .bh-cur.drag .ring { width: 70px; height: 70px; margin: -35px 0 0 -35px; border-color: rgb(207 154 98 / 0.8); }
  .bh-cur.drag .ring span { opacity: 1; transform: none; }`;

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
        col *= 1.0 - smoothstep(0.55, 1.2, length(c * vec2(uRes.x / uRes.y, 1.0))) * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

async function loadWorks(aniso) {
  const card = (draw) => { const t = canvasTex(2048, 1280, draw); t.anisotropy = aniso; return t; };
  const cover = (img) => card((x, w, h) => { const s = Math.max(w / img.width, h / img.height); x.imageSmoothingQuality = 'high'; x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s); });
  const phone = (bg, im) => card((x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const ph = h * 0.86, pw = ph * (im.width / im.height);
    x.imageSmoothingQuality = 'high';
    x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 60; x.shadowOffsetY = 24; x.beginPath(); x.roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 40); x.fillStyle = '#000'; x.fill(); x.restore();
    x.save(); x.beginPath(); x.roundRect((w - pw) / 2, (h - ph) / 2, pw, ph, 40); x.clip(); x.drawImage(im, (w - pw) / 2, (h - ph) / 2, pw, ph); x.restore();
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

/** The dial on the floor: degrees round the ring, a tick a degree, a number every ten. */
function dialTexture() {
  return canvasTex(8192, 160, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const per = w / 360;
    for (let d = 0; d < 360; d++) {
      const big = d % 10 === 0, mid = d % 5 === 0;
      x.fillStyle = big ? 'rgba(231,184,119,0.75)' : 'rgba(231,184,119,0.3)';
      x.fillRect(d * per, 0, big ? 3 : 2, big ? h * 0.5 : mid ? h * 0.32 : h * 0.2);
      if (big) { x.font = '500 46px "IBM Plex Mono"'; x.fillStyle = 'rgba(231,184,119,0.55)'; x.fillText(String(d).padStart(3, '0'), d * per + 10, h * 0.9); }
    }
  });
}

export async function createBench2(renderer, { W, H, dpr, home, bandY, hudParent = document.body }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0412');
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 600);
  const floorY = home.y + bandY - PH / 2 - 0.55;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  // ---------------------------------------------------------------- the space: deep purple, a warm glow far behind the works, dust in the light
  const haze = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float h = exp(-pow((d.y + 0.05) / 0.16, 2.0));
        float back = exp(-pow(acos(clamp(dot(d, normalize(vec3(0.0, 0.05, -1.0))), -1.0, 1.0)) / 0.55, 2.0));
        vec3 col = vec3(0.009, 0.004, 0.017) + vec3(0.06, 0.024, 0.09) * h * 0.4 + vec3(0.2, 0.1, 0.04) * back * 0.05;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  haze.renderOrder = -2;
  scene.add(haze);
  const DUST = 900;
  const dustU = { uFocal: { value: 1 }, uPx: { value: dpr } };
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
    const dust = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: dustU,
      vertexShader: `attribute float aSeed; uniform float uFocal, uPx; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float depth = -mv.z;
          float size = 0.022 * (0.5 + aSeed) * uFocal / max(depth, 0.01); gl_PointSize = clamp(size, 1.2 * uPx, 60.0 * uPx);
          vA = min(1.0, pow(2.5 * uPx / max(size, 0.001), 2.0)) * smoothstep(0.2, 1.2, depth) * (0.2 + aSeed * 0.45); }`,
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.95, 0.78, 0.6) * (1.0 - smoothstep(0.15, 0.5, d)) * vA, 1.0); }',
    }));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  // ---------------------------------------------------------------- the floor: polished, a soft true reflection of the works, their light pooled on it
  const lightU = { uLP: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, -99, 0)) }, uLC: { value: Array.from({ length: 5 }, () => new THREE.Color(0, 0, 0)) } };
  const floor = new Reflector(new THREE.PlaneGeometry(90, 90), {
    textureWidth: Math.round(W * dpr * 0.5), textureHeight: Math.round(H * dpr * 0.5), clipBias: 0.003, multisample: 0,
    shader: {
      name: 'BenchFloor',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTexel: { value: new THREE.Vector2(2 / (W * dpr), 2 / (H * dpr)) }, uHome: { value: home.clone() }, uLP: { value: null }, uLC: { value: null } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWP;
        void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform vec3 uHome; uniform vec3 uLP[5]; uniform vec3 uLC[5];
        varying vec4 vUv; varying vec3 vWP;
        float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        void main(){
          vec2 uv = vUv.xy / vUv.w;
          vec3 r = vec3(0.0); float ws = 0.0;
          for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) {
            float w = exp(-float(i * i) / 5.0 - float(j * j) / 5.0);
            r += texture2D(tDiffuse, uv + vec2(float(i) * 1.6, float(j) * 3.2) * uTexel).rgb * w; ws += w;
          }
          r /= ws;
          float dist = length(vWP.xz - uHome.xz);
          vec3 col = vec3(0.01, 0.005, 0.017) + r * 0.5 * (1.0 - smoothstep(${(RC * 0.6).toFixed(1)}, ${(RC + 10).toFixed(1)}, dist));
          for (int i = 0; i < 5; i++) { vec2 d = vWP.xz - uLP[i].xz; col += uLC[i] * exp(-dot(d, d) * 0.12) * 0.075; }
          col *= 1.0 - 0.6 * smoothstep(${(RC + 2).toFixed(1)}, ${(RC + 20).toFixed(1)}, dist);
          col += (hash(floor(vWP.xz * 60.0)) - 0.5) * 0.004;
          gl_FragColor = vec4(col, 1.0);
        }`,
    },
  });
  floor.material.uniforms.uLP = lightU.uLP;
  floor.material.uniforms.uLC = lightU.uLC;
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(home.x, floorY, home.z);
  scene.add(floor);
  const dial = (() => {
    const segs = 360, r0 = RC - 2.6, r1 = RC - 1.95, pos = [], uv = [], idx = [];
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
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.38 }));
    m.position.set(home.x, floorY + 0.004, home.z);
    scene.add(m);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.7), new THREE.MeshBasicMaterial({ color: '#e7b877' }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(home.x, floorY + 0.006, home.z - (RC - 2.27));
    scene.add(mark);
    return m;
  })();

  // ---------------------------------------------------------------- the works: pictures under glass on the ring; behind each, the light it gives off
  const works = await loadWorks(aniso);
  const cardVert = `
    uniform vec3 uHome; uniform float uAng, uHover, uY, uGrowX, uGrowY, uPush; uniform vec2 uTilt;
    varying vec2 vUv; varying vec3 vWP;
    void main(){
      vUv = uv;
      float grow = 1.0 + uHover * 0.035;
      float th = uAng + position.x * ${PW.toFixed(3)} * grow * uGrowX / ${RC.toFixed(1)};
      // Hover: it comes toward you, and tilts under the pointer (the side you press goes back).
      float r = ${RC.toFixed(1)} + uPush - uHover * 0.55 + uHover * (position.x * uTilt.x * 1.1 + position.y * uTilt.y * 0.7);
      float y = uY + position.y * ${PH.toFixed(3)} * grow * uGrowY + uHover * 0.06;
      vec3 p = uHome + vec3(sin(th) * r, y, -cos(th) * r);
      vWP = p;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`;
  const cardFrag = `
    uniform sampler2D uMap; uniform float uHover, uLocked, uDim, uHoverT, uBlur, uAng; uniform vec2 uMouse;
    varying vec2 vUv; varying vec3 vWP;
    float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 p = (vUv - 0.5) * vec2(${PW}, ${PH});
      float d = rbox(p, vec2(${PW / 2}, ${PH / 2}), ${CORNER});
      float a = 1.0 - smoothstep(-0.006, 0.004, d);
      if (a < 0.01) discard;
      vec2 asp = vec2(${(PW / PH).toFixed(4)}, 1.0);
      // The picture sits a little behind its glass: it shifts against the pointer, and pushes in while you look.
      float zoom = 1.0 + uHover * (0.02 + 0.035 * (1.0 - exp(-uHoverT * 0.6)));
      vec2 uv = (vUv - 0.5) / zoom + 0.5 - (uMouse - 0.5) * 0.022 * uHover;
      vec3 c = texture2D(uMap, clamp(uv, 0.001, 0.999), uBlur * (1.0 - uHover)).rgb;
      c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), uLocked * 0.6);
      // its depth under the glass: a soft inner shade at the edges
      c *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.16, -d));
      vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
      vec3 V = normalize(cameraPosition - vWP);
      float facing = abs(dot(N, V));
      c *= mix(0.45, 1.0, pow(facing, 1.6)) * uDim;
      // the glass: a broad sheen that slides across as the work turns past you, and a glare where your pointer is
      float s = vUv.x - vUv.y * 0.42 - 0.3 + uAng * 1.9;
      c += vec3(0.95, 0.9, 1.0) * (smoothstep(0.22, 0.0, abs(s)) * 0.045 + smoothstep(0.03, 0.0, abs(s - 0.16)) * 0.035) * uDim;
      vec2 dm = (vUv - uMouse) * asp;
      c += vec3(1.0, 0.94, 0.86) * (exp(-dot(dm, dm) * 3.2) * 0.13 + exp(-dot(dm, dm) * 38.0) * 0.07) * uHover;
      // the edge: a fine line of light, gold when you hover
      float edge = 1.0 - smoothstep(0.0, 0.018, -d);
      c += mix(vec3(0.8, 0.78, 0.9) * 0.1, vec3(1.0, 0.8, 0.5) * 0.85, uHover) * edge;
      gl_FragColor = vec4(c, a);
    }`;
  const glowFrag = `
    uniform vec3 uCol; uniform float uDim, uHover;
    varying vec2 vUv;
    void main(){
      vec2 q = (vUv - 0.5) * 2.0;
      // soft all the way to the plane's edge, so it never shows as a line
      float f = exp(-dot(q, q) * 3.0) * (1.0 - smoothstep(0.55, 1.0, abs(q.x))) * (1.0 - smoothstep(0.55, 1.0, abs(q.y)));
      gl_FragColor = vec4(mix(uCol, vec3(0.35, 0.18, 0.5), 0.35) * f * (0.05 + 0.1 * uHover) * uDim, 1.0);
    }`;
  const cards = [];
  const hud = document.createElement('div');
  hud.className = 'bh';
  hud.innerHTML = `<style>${CSS}</style><div class="bh-cards"></div>
    <p class="bh-c bh-tl">Bob Chung</p><p class="bh-c bh-tr">Selected works</p>
    <p class="bh-c bh-bl m">Scroll or drag<br>θ <b>000.0°</b></p>
    <p class="bh-c bh-br m"><b>01</b> / 05</p>
    <div class="bh-cur"><b class="ring"><span>View<i>↗</i></span></b><i class="dot"></i></div>`;
  hudParent.append(hud);
  const cardsEl = hud.querySelector('.bh-cards'), thetaEl = hud.querySelector('.bh-bl b'), countEl = hud.querySelector('.bh-br b');
  const cur = hud.querySelector('.bh-cur'), ringEl = cur.querySelector('.ring'), dotEl = cur.querySelector('.dot'), curLabel = cur.querySelector('span');
  for (let i = 0; i < POOL; i++) {
    const u = { uMap: { value: works[0].tex }, uHome: { value: home.clone() }, uAng: { value: 0 }, uHover: { value: 0 }, uY: { value: bandY }, uLocked: { value: 0 }, uDim: { value: 1 }, uHoverT: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTilt: { value: new THREE.Vector2() }, uBlur: { value: 0 }, uGrowX: { value: 1 }, uGrowY: { value: 1 }, uPush: { value: 0 } };
    const geo = new THREE.PlaneGeometry(1, 1, 64, 24);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: cardVert, fragmentShader: cardFrag, transparent: true, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    scene.add(m);
    const gu = { ...u, uGrowX: { value: 1.3 }, uGrowY: { value: 1.55 }, uPush: { value: 0.6 }, uCol: { value: new THREE.Color() } };
    const glow = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: gu, vertexShader: cardVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.frustumCulled = false;
    glow.renderOrder = -1;
    scene.add(glow);
    const t = document.createElement('p'); t.className = 'bh-t'; t.innerHTML = '<span class="k"></span><span class="n"></span>';
    cardsEl.append(t);
    cards.push({ m, u, gu, t, hover: 0, slot: null, hoverT: 0, was: false, mouse: new THREE.Vector2(0.5, 0.5), tilt: new THREE.Vector2() });
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
  const ptr = { x: -200, y: -200 }, ring = { x: -200, y: -200 };
  addEventListener('pointermove', (e) => { mouse.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1); ptr.x = e.clientX; ptr.y = e.clientY; });
  let hoverSlot = null, focus = 0;
  const hitUV = new THREE.Vector2();
  const proj = (v) => { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H, tmp.z]; };
  // Where a point of a picture is, the same sum as the shader's.
  const at = (ang, lx, ly, hover, tilt) => {
    const grow = 1 + hover * 0.035, th = ang + (lx * PW * grow) / RC;
    const r = RC - hover * 0.55 + hover * (lx * tilt.x * 1.1 + ly * tilt.y * 0.7);
    return new THREE.Vector3(home.x + Math.sin(th) * r, home.y + bandY + ly * PH * grow + hover * 0.06, home.z - Math.cos(th) * r);
  };

  return {
    scene, camera, portalMaterial, hud,
    /** The room's last finished picture (for whoever shows it as a page). */
    texture: () => portalMaterial.uniforms.uTex.value,
    /** pos: the camera; fov; pitch (radians, down is negative); angle: how far the ring has turned; arrive: 0..1. */
    update({ pos, fov, pitch = 0, angle = 0, look = { x: 0, y: 0 }, arrive = 1, dt = 1 / 60, time = 0, dragging = false }) {
      camera.position.copy(pos);
      camera.rotation.set(pitch + look.y * 0.03 * arrive, -look.x * 0.045 * arrive, 0, 'YXZ');
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      haze.position.copy(pos);
      dustU.uFocal.value = (H * dpr) / 2 / Math.tan((fov * Math.PI) / 360);
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
          if (Math.abs(off) < PW / 2 && Math.abs(q.y - bandY) < PH / 2) { hit = k; hitUV.set(off / PW + 0.5, (q.y - bandY) / PH + 0.5); }
        }
      }
      hoverSlot = hit;
      const k0 = Math.round(angle / STEP), lights = [];
      const ease = 1 - Math.exp(-dt * 7);
      focus += ((hoverSlot !== null ? 1 : 0) - focus) * ease;
      let front = 0, hoveredWork = null;
      cards.forEach((c, i) => {
        const k = k0 + i - Math.floor(POOL / 2);
        const ang = k * STEP - angle;
        const n = ((k % 5) + 5) % 5, w = works[n];
        c.u.uMap.value = w.tex;
        c.u.uLocked.value = w.locked ? 1 : 0;
        c.u.uAng.value = ang;
        if (c.slot !== k) { c.slot = k; c.hover = 0; c.was = false; }
        const on = k === hoverSlot;
        if (on && !c.was) { c.hoverT = 0; c.mouse.copy(hitUV); }
        c.was = on;
        c.hoverT += dt;
        if (on) { c.mouse.lerp(hitUV, 1 - Math.exp(-dt * 10)); hoveredWork = w; }
        c.tilt.lerp(on ? new THREE.Vector2(hitUV.x - 0.5, hitUV.y - 0.5) : new THREE.Vector2(), 1 - Math.exp(-dt * 6));
        c.hover += ((on ? 1 : 0) - c.hover) * (1 - Math.exp(-dt * 5.5));
        c.u.uHover.value = c.hover;
        c.u.uHoverT.value = Math.min(c.hoverT, 60);
        c.u.uMouse.value.copy(c.mouse);
        c.u.uTilt.value.copy(c.tilt);
        c.u.uBlur.value = 1.6 * THREE.MathUtils.smoothstep(Math.abs(ang) / STEP, 0.5, 1.3);
        c.u.uDim.value = THREE.MathUtils.lerp(0.5, 1, THREE.MathUtils.smoothstep(Math.cos(ang - (-look.x * 0.045 * arrive)), 0.6, 0.97)) * (0.92 + c.hover * 0.08) * (1 - 0.32 * focus * (1 - c.hover));
        c.gu.uCol.value.copy(w.avg);
        if (Math.abs(ang) < STEP / 2) front = n;
        if (Math.abs(ang) < 2.2 * STEP) lights.push({ p: at(ang, 0, -0.5, c.hover, c.tilt), c: w.avg, s: c.u.uDim.value });
        if (c.t.dataset.n !== String(n)) { c.t.dataset.n = String(n); c.t.firstChild.textContent = w.meta; c.t.lastChild.textContent = w.title; }
        c.t.classList.toggle('on', on);
        // its title, under its bottom-left corner
        const bl = proj(at(ang, -0.5, -0.5, c.hover, c.tilt));
        const vis = bl[2] < 1 && Math.cos(ang) > 0.6 ? Math.min(1, (Math.cos(ang) - 0.6) * 6) : 0;
        c.t.style.opacity = vis.toFixed(3);
        c.t.style.transform = `translate(${bl[0]}px, ${bl[1] + 16}px)`;
      });
      for (let i = 0; i < 5; i++) {
        const l = lights[i];
        if (l) { lightU.uLP.value[i].copy(l.p); lightU.uLC.value[i].copy(l.c).multiplyScalar(l.s); }
        else lightU.uLP.value[i].set(0, -99, 0);
      }
      // The cursor: a dot, and a ring that follows a beat behind; over a work it opens into a disc.
      const kk = 1 - Math.exp(-dt * 14);
      ring.x += (ptr.x - ring.x) * kk; ring.y += (ptr.y - ring.y) * kk;
      ringEl.style.transform = `translate(${ring.x}px, ${ring.y}px)`;
      dotEl.style.transform = `translate(${ptr.x}px, ${ptr.y}px)${hoveredWork ? ' scale(0)' : ''}`;
      cur.classList.toggle('on', !!hoveredWork && !dragging);
      cur.classList.toggle('drag', dragging && arrive > 0.9);
      const label = dragging ? 'Drag' : hoveredWork?.locked ? 'Soon' : 'View';
      if (curLabel.dataset.l !== label) { curLabel.dataset.l = label; curLabel.innerHTML = label === 'View' ? 'View<i>↗</i>' : label; }
      const deg = ((((angle * 180) / Math.PI) % 360) + 360) % 360;
      thetaEl.textContent = `${deg.toFixed(1).padStart(5, '0')}°`;
      countEl.textContent = String(front + 1).padStart(2, '0');
      hud.style.opacity = arrive.toFixed(3);
      for (const m of [portalMaterial, fullMaterial]) m.uniforms.uTime.value = time;
      return { front, hovered: hoverSlot };
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
