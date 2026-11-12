// LAB ONLY (throwaway). The works' room, round 59: the works are prints. A deep purple space; same-size prints on a
// ring round you (after jesperlandberg.com's band), matte paper with a white border, lit from above; a polished floor
// that reflects them. Hover peels a print: the corner nearest your pointer curls up toward you (the nearer you go to
// that corner, the further it peels) and shows the back of the print. The printer at the end of this room printed them.
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
  .bh-cur.on .ring { width: 18px; height: 18px; margin: -9px 0 0 -9px; background: rgb(207 154 98 / 0.3); border-color: rgb(231 184 119 / 0.95); }
  .bh-cur .lab { position: absolute; left: 0; top: 0; font: 500 10.5px 'IBM Plex Mono', monospace; font-style: normal; letter-spacing: 0.2em; text-transform: uppercase; color: #f2efe8; white-space: nowrap; opacity: 0; transition: opacity .3s; }
  .bh-cur .lab i { font-style: normal; color: #e7b877; margin-left: 6px; }
  .bh-cur.on .lab { opacity: 1; }
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

export async function createBench3(renderer, { W, H, dpr, home, bandY, hudParent = document.body }) {
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

  // ---------------------------------------------------------------- the works: prints on the ring, matte paper with a white border, lit from above.
  // Hover peels the print: the corner nearest your pointer curls up toward you, further the nearer you go to it, and
  // shows the back of the print (its number, the coin stamp, who printed it).
  const works = await loadWorks(aniso);
  works.forEach((w, i) => {
    w.back = canvasTex(1024, 640, (x, cw, ch) => {
      x.fillStyle = '#ece5d6'; x.fillRect(0, 0, cw, ch);
      let sd = 13 + i; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 9000; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '120,100,80' : '255,255,255'},${rnd() * 0.08})`; x.fillRect(rnd() * cw, rnd() * ch, 1 + rnd() * 2, 1); }
      // the coin, stamped in gold at each corner: whichever you peel, it is there
      for (const [cx, cy] of [[120, 120], [cw - 120, 120], [120, ch - 120], [cw - 120, ch - 120]]) {
        x.strokeStyle = 'rgba(168,119,44,0.75)'; x.lineWidth = 7;
        x.beginPath(); x.arc(cx, cy, 70, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 5; x.strokeRect(cx - 26, cy - 26, 52, 52);
        x.fillStyle = 'rgba(168,119,44,0.8)'; x.font = '700 22px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(String(i + 1).padStart(2, '0'), cx, cy + 95);
      }
      x.fillStyle = 'rgba(42,21,70,0.8)'; x.textAlign = 'center';
      x.font = '700 64px Barlow'; x.fillText(w.title.toUpperCase(), cw / 2, ch / 2 - 30);
      x.font = '500 24px "IBM Plex Mono", monospace'; x.fillStyle = 'rgba(42,21,70,0.6)';
      x.fillText(`${w.meta.toUpperCase()}  ·  PRINTED BY BC—2006`, cw / 2, ch / 2 + 34);
    });
    w.back.anisotropy = aniso;
  });
  const cardVert = `
    uniform vec3 uHome; uniform float uAng, uHover, uY, uCurl; uniform vec2 uCorner;
    varying vec2 vUv; varying vec3 vWP; varying float vCurled, vFold, vBehind;
    void main(){
      vUv = uv;
      vec2 P = vec2(position.x * ${PW.toFixed(3)}, position.y * ${PH.toFixed(3)});
      float lift = 0.0; vCurled = 0.0; vFold = 0.0; vBehind = 9.0;
      if (uCurl > 0.001) {
        // the paper rolls round a small cylinder whose axis is the fold, across the corner being peeled
        vec2 n = normalize(uCorner);
        float s = dot(uCorner - P, n);
        vBehind = s - uCurl;
        if (s < uCurl) {
          float a = uCurl - s, R = 0.3, th = a / R, s2;
          if (th < 3.14159) { s2 = uCurl - R * sin(th); lift = R * (1.0 - cos(th)); }
          else { s2 = uCurl + (a - 3.14159 * R); lift = 2.0 * R; }
          P += n * (s - s2);
          vCurled = 1.0; vFold = min(th, 3.14159);
        }
      }
      float th = uAng + P.x / ${RC.toFixed(1)};
      float r = ${RC.toFixed(1)} - uHover * 0.3 - lift;
      vec3 p = uHome + vec3(sin(th) * r, uY + P.y + uHover * 0.04, -cos(th) * r);
      vWP = p;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`;
  const cardFrag = `
    uniform sampler2D uMap, uBack; uniform float uHover, uLocked, uDim, uBlur, uCurl;
    varying vec2 vUv; varying vec3 vWP; varying float vCurled, vFold, vBehind;
    void main(){
      vec2 p = (vUv - 0.5) * vec2(${PW}, ${PH});
      vec3 paper = vec3(0.86, 0.82, 0.72);
      vec3 c;
      if (gl_FrontFacing) {
        // the picture, inside a white border
        vec2 inner = vec2(${(PW / 2 - 0.17).toFixed(3)}, ${(PH / 2 - 0.17).toFixed(3)});
        vec2 ip = p / inner;
        if (abs(ip.x) < 1.0 && abs(ip.y) < 1.0) {
          c = texture2D(uMap, ip * 0.5 + 0.5, uBlur).rgb;
          c = mix(c, vec3(dot(c, vec3(0.3, 0.59, 0.11))), uLocked * 0.6);
          c = c * 0.95 + paper * 0.02; // matte: the blacks sit a little up, like ink on paper
        } else c = paper;
        // the curl throws a soft shadow on the sheet beside the fold
        c *= 1.0 - 0.4 * exp(-max(vBehind, 0.0) * 3.5) * smoothstep(0.0, 0.3, uCurl) * (1.0 - smoothstep(0.0, 0.25, vFold));
      } else {
        c = texture2D(uBack, vec2(1.0 - vUv.x, vUv.y)).rgb;
      }
      // the rolled part is a cylinder: it darkens as it turns from the light
      // (no thresholds here: the fold's angle is smooth across it, so the shading is too)
      c *= 0.62 + 0.38 * abs(cos(vFold)) + 0.12 * sin(vFold);
      // lit from above, and dimmer as the sheet turns away from you
      c *= mix(0.84, 1.06, vUv.y);
      vec3 N = normalize(cross(dFdx(vWP), dFdy(vWP)));
      float facing = abs(dot(N, normalize(cameraPosition - vWP)));
      c *= mix(0.5, 1.0, pow(facing, 1.4)) * uDim;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const cards = [];
  const hud = document.createElement('div');
  hud.className = 'bh';
  hud.innerHTML = `<style>${CSS}</style><div class="bh-cards"></div>
    <p class="bh-c bh-tl">Bob Chung</p><p class="bh-c bh-tr">Selected works</p>
    <p class="bh-c bh-bl m">Scroll or drag<br>θ <b>000.0°</b></p>
    <p class="bh-c bh-br m"><b>01</b> / 05</p>
    <div class="bh-cur"><b class="ring"><span>Drag</span></b><i class="dot"></i><em class="lab">Open<i>↗</i></em></div>`;
  hudParent.append(hud);
  const cardsEl = hud.querySelector('.bh-cards'), thetaEl = hud.querySelector('.bh-bl b'), countEl = hud.querySelector('.bh-br b');
  const cur = hud.querySelector('.bh-cur'), ringEl = cur.querySelector('.ring'), dotEl = cur.querySelector('.dot'), labEl = cur.querySelector('.lab');
  for (let i = 0; i < POOL; i++) {
    const u = { uMap: { value: works[0].tex }, uBack: { value: works[0].back }, uHome: { value: home.clone() }, uAng: { value: 0 }, uHover: { value: 0 }, uY: { value: bandY }, uLocked: { value: 0 }, uDim: { value: 1 }, uBlur: { value: 0 }, uCurl: { value: 0 }, uCorner: { value: new THREE.Vector2(PW / 2, -PH / 2) } };
    const geo = new THREE.PlaneGeometry(1, 1, 200, 110);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: cardVert, fragmentShader: cardFrag, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    scene.add(m);
    const t = document.createElement('p'); t.className = 'bh-t'; t.innerHTML = '<span class="k"></span><span class="n"></span>';
    cardsEl.append(t);
    cards.push({ m, u, t, hover: 0, slot: null, curl: 0, corner: new THREE.Vector2(PW / 2, -PH / 2), cornerTo: new THREE.Vector2(PW / 2, -PH / 2) });
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
  const at = (ang, lx, ly, hover) => {
    const th = ang + (lx * PW) / RC, r = RC - hover * 0.3;
    return new THREE.Vector3(home.x + Math.sin(th) * r, home.y + bandY + ly * PH + hover * 0.04, home.z - Math.cos(th) * r);
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
        c.u.uBack.value = w.back;
        if (c.slot !== k) { c.slot = k; c.hover = 0; c.curl = 0; }
        const on = k === hoverSlot;
        if (on) hoveredWork = w;
        c.hover += ((on ? 1 : 0) - c.hover) * (1 - Math.exp(-dt * 5.5));
        // the peel: the corner nearest your pointer, further the nearer you are to it; the one in front shows a hint
        let want = 0;
        if (on) {
          const lx = (hitUV.x - 0.5) * PW, ly = (hitUV.y - 0.5) * PH;
          const cx = (lx < 0 ? -1 : 1) * (PW / 2), cy = (ly < 0 ? -1 : 1) * (PH / 2);
          c.cornerTo.set(cx, cy);
          const prox = 1 - Math.min(1, Math.hypot(lx - cx, ly - cy) / (0.62 * Math.hypot(PW, PH)));
          want = 0.6 + 2.2 * prox * prox;
        } else if (hoverSlot === null && Math.abs(ang) < STEP * 0.3 && arrive > 0.9) {
          c.cornerTo.set(PW / 2, -PH / 2);
          want = 0.26 + 0.05 * Math.sin(time * 1.6);
        }
        c.corner.lerp(c.cornerTo, 1 - Math.exp(-dt * 9));
        c.curl += (want - c.curl) * (1 - Math.exp(-dt * 6));
        c.u.uCurl.value = c.curl;
        c.u.uCorner.value.copy(c.corner);
        c.u.uHover.value = c.hover;
        c.u.uBlur.value = 1.6 * THREE.MathUtils.smoothstep(Math.abs(ang) / STEP, 0.5, 1.3);
        c.u.uDim.value = THREE.MathUtils.lerp(0.5, 1, THREE.MathUtils.smoothstep(Math.cos(ang - (-look.x * 0.045 * arrive)), 0.6, 0.97)) * (0.92 + c.hover * 0.08) * (1 - 0.32 * focus * (1 - c.hover));
        if (Math.abs(ang) < STEP / 2) front = n;
        if (Math.abs(ang) < 2.2 * STEP) lights.push({ p: at(ang, 0, -0.5, c.hover), c: w.avg.clone().lerp(new THREE.Color(1, 0.9, 0.75), 0.6), s: c.u.uDim.value });
        if (c.t.dataset.n !== String(n)) { c.t.dataset.n = String(n); c.t.firstChild.textContent = w.meta; c.t.lastChild.textContent = w.title; }
        c.t.classList.toggle('on', on);
        // its title, under its bottom-left corner
        const bl = proj(at(ang, -0.5, -0.5, c.hover));
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
      labEl.style.transform = `translate(${ring.x + 18}px, ${ring.y + 12}px)`;
      cur.classList.toggle('on', !!hoveredWork && !dragging);
      cur.classList.toggle('drag', dragging && arrive > 0.9);
      const label = hoveredWork?.locked ? 'Soon' : 'Open';
      if (labEl.dataset.l !== label) { labEl.dataset.l = label; labEl.innerHTML = label === 'Open' ? 'Open<i>↗</i>' : label; }
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
