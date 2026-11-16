// LAB ONLY (throwaway). Round 63: Bob's gaming setup, seen through his eyes. A stand-in until he sends his own: a dark
// desk, a 34" ultrawide, a 27" side monitor, a phone on a stand, an RGB keyboard, a headset, a glass-sided PC (its
// insides modelled, so the camera can be inside it), the gold coin on the wall, LED light on the wall. In metres.
// The works sit on the devices they were made for, big, and react to the pointer. Code art only.
import { THREE, tex, pose, mix, clamp, ease, ASPECT, TAN, phone, coinGeo, renderer } from './r62.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lockedScreen, lockedGame } from './kit.js';

const img = (src) => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.src = src; });
const imgTex = (im) => { const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };

/** A picture fitted into a screen: contained, over a blurred, darkened copy of itself. */
function fitted(im, w, h) {
  return tex(w, h, (x) => {
    const sc = Math.max(w / im.width, h / im.height), sf = Math.min(w / im.width, h / im.height);
    x.filter = 'blur(28px) brightness(0.35) saturate(1.2)';
    x.drawImage(im, (w - im.width * sc) / 2, (h - im.height * sc) / 2, im.width * sc, im.height * sc);
    x.filter = 'none';
    x.drawImage(im, (w - im.width * sf) / 2, (h - im.height * sf) / 2, im.width * sf, im.height * sf);
  }, true);
}

export const DESK_Y = 0.74;

export async function makeRoom() {
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.003, 0.0015, 0.006);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.1;
  pm.dispose();

  const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const glow = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const rbox = (w, h, d, r = 0.004) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
  const DARK = std('#120f17', 0.5, 0.1), METAL = std('#2a2532', 0.32, 0.85), GOLD = std('#cf9a62', 0.3, 1);

  // the room
  add(scene, new THREE.PlaneGeometry(10, 10), std('#09070d', 0.55), 0, 0, 0).rotation.x = -Math.PI / 2;
  const wallMat = std('#110c18', 0.92);
  add(scene, new THREE.PlaneGeometry(6, 3.2), wallMat, 0, 1.6, -0.86);
  add(scene, new THREE.PlaneGeometry(4, 3.2), wallMat, -1.6, 1.6, 1.1).rotation.y = Math.PI / 2;
  // acoustic panels: a few hexagons on the wall, dark, edged in faint gold
  const hex = new THREE.CylinderGeometry(0.11, 0.11, 0.02, 6);
  [[-0.95, 1.55], [-0.76, 1.66], [-0.76, 1.44], [-0.57, 1.55], [0.82, 1.62], [1.01, 1.51], [1.01, 1.73]].forEach(([x, y]) => {
    const h = add(scene, hex, std('#1a1324', 0.8), x, y, -0.845); h.rotation.x = Math.PI / 2; h.rotation.y = Math.PI / 6;
  });

  // the desk
  add(scene, rbox(2.4, 0.035, 0.8, 0.01), std('#18121f', 0.36, 0.15), 0, DESK_Y - 0.0175, -0.43);
  for (const x of [-1.12, 1.12]) add(scene, rbox(0.06, DESK_Y - 0.035, 0.66, 0.01), METAL, x, (DESK_Y - 0.035) / 2, -0.43);
  const mat = tex(1600, 640, (x, w, h) => {
    x.fillStyle = '#140d1d'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(207,154,98,0.55)'; x.lineWidth = 6; x.strokeRect(12, 12, w - 24, h - 24);
    x.fillStyle = 'rgba(207,154,98,0.35)'; x.font = '700 40px Barlow'; x.textAlign = 'right'; x.fillText('BC · 2006', w - 48, h - 44);
  }, true);
  add(scene, new THREE.PlaneGeometry(1.1, 0.44), std('#ffffff', 0.85, 0, { map: mat }), 0, DESK_Y + 0.001, -0.2).rotation.x = -Math.PI / 2;

  // screens: two pictures stacked so one can fade into the next; a sheen that runs across on hover
  const sheenTex = tex(512, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,220,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, true);
  function screen(parent, w, h, z, a) {
    const base = new THREE.MeshBasicMaterial({ map: a, toneMapped: false });
    const top = new THREE.MeshBasicMaterial({ map: a, toneMapped: false, transparent: true, opacity: 0, depthWrite: false });
    const sheenMap = sheenTex.clone(); sheenMap.needsUpdate = true; sheenMap.wrapS = THREE.RepeatWrapping; sheenMap.repeat.set(0.6, 1);
    const sheen = new THREE.MeshBasicMaterial({ map: sheenMap, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const g = new THREE.PlaneGeometry(w, h);
    const m0 = add(parent, g, base, 0, 0, z), m1 = add(parent, g, top, 0, 0, z + 0.0004), m2 = add(parent, g, sheen, 0, 0, z + 0.0008);
    m1.renderOrder = 1; m2.renderOrder = 2;
    return {
      mesh: m0, w, h,
      set(A, B, t, bright = 1) {
        if (base.map !== A) { base.map = A; base.needsUpdate = true; }
        if (top.map !== B) { top.map = B; top.needsUpdate = true; }
        top.opacity = t; base.color.setScalar(bright); top.color.setScalar(bright);
      },
      sheen(amount, time) { sheen.opacity = amount * 0.2; sheenMap.offset.x = -((time * 0.55) % 1.6) + 0.3; },
      scroll(y) { for (const m of [base, top]) if (m.map) { m.map.repeat.y = 0.86; m.map.offset.y = 0.14 * (1 - y); } },
    };
  }

  // the works' pictures
  const [lumoIm, jontaiIm, cookiesIm] = await Promise.all([img('img/lumo.webp'), img('/public/flight/jontai.webp'), img('/public/flight/cookies.webp')]);
  const T = {
    lumo: imgTex(lumoIm), locked: lockedScreen(), jontai: imgTex(jontaiIm),
    cookies: fitted(cookiesIm, 2048, 858), roblox: fitted(lockedGame().image, 2048, 858),
  };
  for (const t of [T.lumo, T.locked]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  T.contact = tex(1600, 900, (x, w, h) => {
    x.fillStyle = '#0d0912'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#cf9a62'; x.font = '700 150px Barlow'; x.fillText('Let’s talk.', 110, 330);
    x.font = '500 46px "IBM Plex Mono"'; x.fillStyle = '#f2efe8';
    ['> bhccob@gmail.com', '> github.com/bhccob', '> instagram'].forEach((l, i) => x.fillText(l, 116, 470 + i * 84));
    x.fillStyle = '#cf9a62'; x.fillRect(116, 720, 26, 50);
  }, true);

  // the main monitor: a 34" ultrawide on a stand
  const MAIN = new THREE.Group();
  MAIN.position.set(0, 1.08, -0.56);
  scene.add(MAIN);
  add(MAIN, rbox(0.82, 0.355, 0.024, 0.006), DARK, 0, 0, -0.012);
  add(MAIN, rbox(0.05, 0.3, 0.03), METAL, 0, -0.22, -0.05);
  add(MAIN, rbox(0.3, 0.012, 0.2, 0.004), METAL, 0, DESK_Y + 0.006 - 1.08, 0.0);
  const mainScreen = screen(MAIN, 0.8, 0.335, 0.0012, null);

  // the side monitor: a 27", turned toward the chair
  const SIDE = new THREE.Group();
  SIDE.position.set(0.68, 1.06, -0.42);
  SIDE.rotation.y = -0.62;
  scene.add(SIDE);
  add(SIDE, rbox(0.615, 0.352, 0.024, 0.006), DARK, 0, 0, -0.012);
  add(SIDE, rbox(0.045, 0.28, 0.03), METAL, 0, -0.2, -0.05);
  add(SIDE, rbox(0.24, 0.012, 0.18, 0.004), METAL, 0, DESK_Y + 0.006 - 1.06, 0.0);
  const sideScreen = screen(SIDE, 0.597, 0.336, 0.0012, T.jontai);

  // the phone, on a stand, leaning back
  const PHONE = new THREE.Group();
  PHONE.position.set(-0.5, DESK_Y + 0.088, -0.18);
  PHONE.rotation.set(-0.3, 0.5, 0, 'YXZ');
  scene.add(PHONE);
  add(PHONE, rbox(0.076, 0.158, 0.009, 0.009), std('#0c0a10', 0.3, 0.6), 0, 0, -0.0045);
  const stand = add(scene, rbox(0.09, 0.012, 0.09, 0.004), METAL, -0.5, DESK_Y + 0.006, -0.16);
  stand.rotation.y = 0.5;
  const phoneScreen = screen(PHONE, 0.07, 0.151, 0.0002, T.lumo);

  // keyboard: dark keys over a light that moves through purple and gold
  const kbGlowTex = tex(1024, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); ['#7d3cff', '#cf9a62', '#b47ed4', '#ffb35c', '#7d3cff'].forEach((c, i) => g.addColorStop(i / 4, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); }, true);
  kbGlowTex.wrapS = THREE.RepeatWrapping;
  const KB = new THREE.Group();
  KB.position.set(0, DESK_Y, -0.15);
  scene.add(KB);
  add(KB, rbox(0.44, 0.02, 0.145, 0.006), std('#0d0b11', 0.5, 0.3), 0, 0.01, 0);
  const kbGlow = add(KB, new THREE.PlaneGeometry(0.42, 0.125), new THREE.MeshBasicMaterial({ map: kbGlowTex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) }), 0, 0.0205, 0);
  kbGlow.rotation.x = -Math.PI / 2;
  const keys = new THREE.InstancedMesh(rbox(0.021, 0.01, 0.021, 0.003), std('#16131b', 0.55, 0.1), 15 * 5);
  { const o = new THREE.Object3D(); let k = 0; for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) { o.position.set(-0.196 + c * 0.028, 0.026, -0.052 + r * 0.026); o.updateMatrix(); keys.setMatrixAt(k++, o.matrix); } }
  KB.add(keys);
  // mouse
  const mouse = add(scene, rbox(0.064, 0.036, 0.118, 0.03), std('#0f0d13', 0.4, 0.3), 0.34, DESK_Y + 0.018, -0.12);
  add(scene, new THREE.BoxGeometry(0.004, 0.003, 0.05), glow('#b47ed4', 1.4), 0.34, DESK_Y + 0.036, -0.14);
  mouse.rotation.y = -0.08;
  // headset on its stand
  {
    const g = new THREE.Group(); g.position.set(-0.86, DESK_Y, -0.52); scene.add(g);
    add(g, new THREE.CylinderGeometry(0.06, 0.07, 0.012, 32), METAL, 0, 0.006, 0);
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.3, 12), METAL, 0, 0.16, 0);
    const band = add(g, new THREE.TorusGeometry(0.085, 0.012, 10, 40, Math.PI), std('#1a1520', 0.5), 0, 0.31, 0);
    band.rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) { const cup = add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.035, 28), std('#141118', 0.45, 0.2), 0, 0.24, s * 0.085); cup.rotation.x = Math.PI / 2; add(g, new THREE.TorusGeometry(0.038, 0.004, 8, 28), glow('#7d3cff', 1.2), 0, 0.24, s * 0.104); }
  }

  // the coin on the wall, backlit
  const coinWall = new THREE.Mesh(coinGeo, [GOLD, GOLD]);
  coinWall.scale.setScalar(0.15);
  coinWall.position.set(0, 1.54, -0.835);
  scene.add(coinWall);
  const haloTex = tex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); g.addColorStop(0, 'rgba(160,90,255,0.9)'); g.addColorStop(1, 'rgba(90,30,180,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }, true);
  add(scene, new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 }), 0, 1.54, -0.855);

  // LED light: a strip along the wall behind the desk and a wash of colour up the wall
  const ledColor = new THREE.Color('#7d3cff');
  const ledMat = new THREE.MeshBasicMaterial({ color: ledColor.clone(), toneMapped: false });
  add(scene, new THREE.BoxGeometry(2.3, 0.008, 0.008), ledMat, 0, DESK_Y + 0.04, -0.84);
  const washTex = tex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, true);
  const washMat = new THREE.MeshBasicMaterial({ map: washTex, color: ledColor.clone().multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  add(scene, new THREE.PlaneGeometry(2.4, 0.9), washMat, 0, DESK_Y + 0.48, -0.848);

  // light
  scene.add(new THREE.HemisphereLight('#3a2a58', '#050308', 0.35));
  const rect = (w, h, color, k, pos, target) => { const l = new THREE.RectAreaLight(color, k, w, h); l.position.copy(pos); l.lookAt(target); scene.add(l); return l; };
  const mainLight = rect(0.8, 0.335, '#cfd6ff', 2.2, new THREE.Vector3(0, 1.08, -0.54), new THREE.Vector3(0, 0.9, 0.6));
  rect(0.6, 0.336, '#cfd6ff', 1.3, new THREE.Vector3(0.67, 1.06, -0.41), new THREE.Vector3(-0.2, 0.9, 0.5));
  const ledLight = rect(2.3, 0.05, '#7d3cff', 3, new THREE.Vector3(0, DESK_Y + 0.05, -0.82), new THREE.Vector3(0, DESK_Y - 0.3, 0.2));
  const key = new THREE.SpotLight('#ffd9b0', 6, 4, 0.7, 0.6, 1.5);
  key.position.set(-0.9, 2.2, 0.7); key.target.position.set(0, DESK_Y, -0.3);
  scene.add(key, key.target);

  // ---------------------------------------------------------------- the PC, glass side toward the chair, built inside
  const PC = new THREE.Group();
  PC.position.set(1.07, DESK_Y, -0.46);
  PC.rotation.y = 0.55;
  scene.add(PC);
  const pcw = 0.23, pch = 0.47, pcd = 0.46; // x across (glass at -x), y up, z front (+) to back (-)
  const shell = std('#0b090f', 0.45, 0.6);
  add(PC, rbox(0.01, pch, pcd, 0.004), shell, pcw / 2 - 0.005, pch / 2, 0);
  add(PC, rbox(pcw, 0.01, pcd, 0.004), shell, 0, 0.005, 0);
  add(PC, rbox(pcw, 0.01, pcd, 0.004), shell, 0, pch - 0.005, 0);
  add(PC, rbox(pcw, pch, 0.01, 0.004), shell, 0, pch / 2, -pcd / 2 + 0.005);
  add(PC, rbox(pcw, pch, 0.01, 0.004), std('#0e0b13', 0.6, 0.4), 0, pch / 2, pcd / 2 - 0.005);
  const glass = add(PC, new THREE.PlaneGeometry(pcd - 0.01, pch - 0.01), new THREE.MeshStandardMaterial({ color: '#3a2f48', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }), -pcw / 2, pch / 2, 0);
  glass.rotation.y = -Math.PI / 2;
  // motherboard on the far wall, facing the glass
  const pcbTex = tex(1024, 1024, (x, w) => {
    x.fillStyle = '#100b16'; x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(207,154,98,0.55)'; x.lineCap = 'round';
    let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 160; n++) {
      let px = Math.round(r() * 64) * 16, py = Math.round(r() * 64) * 16, dir = Math.floor(r() * 4) * 2;
      x.lineWidth = 1.5 + r() * 2; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 2 + r() * 6; k++) { if (r() < 0.4) dir = (dir + (r() < 0.5 ? 1 : 7)) % 8; const a = (dir * Math.PI) / 4, len = 16 * (1 + Math.floor(r() * 5)); px += Math.round(Math.cos(a)) * len; py += Math.round(Math.sin(a)) * len; x.lineTo(px, py); }
      x.stroke(); x.fillStyle = 'rgba(207,154,98,0.7)'; x.beginPath(); x.arc(px, py, 4, 0, Math.PI * 2); x.fill();
    }
  }, true);
  const MB = new THREE.Group();
  MB.position.set(pcw / 2 - 0.012, 0, 0);
  MB.rotation.y = -Math.PI / 2; // its +z faces the glass (-x of the case)
  PC.add(MB);
  add(MB, new THREE.PlaneGeometry(0.3, 0.3), std('#8a8090', 0.6, 0.25, { map: pcbTex }), -0.01, 0.31, 0);
  // the parts that light up, one per study
  const parts = {};
  // CPU: a socket and a gold lid whose engraving folds like a brain
  const cpuTex = tex(512, 512, (x, w) => {
    x.fillStyle = '#c99257'; x.fillRect(0, 0, w, w);
    x.strokeStyle = 'rgba(80,46,18,0.75)'; x.lineWidth = 7; x.lineCap = 'round';
    let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 34; n++) { x.beginPath(); let px = 60 + r() * 392, py = 60 + r() * 392; x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (r() - 0.5) * 90; py += (r() - 0.5) * 90; px = Math.max(40, Math.min(472, px)); py = Math.max(40, Math.min(472, py)); x.quadraticCurveTo(px + (r() - 0.5) * 60, py + (r() - 0.5) * 60, px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(80,46,18,0.9)'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, w - 28);
  }, true);
  add(MB, rbox(0.058, 0.058, 0.006, 0.002), std('#1c1722', 0.5, 0.3), 0, 0.37, 0.003);
  parts.cpu = add(MB, rbox(0.04, 0.04, 0.004, 0.002), new THREE.MeshStandardMaterial({ color: '#ffffff', map: cpuTex, roughness: 0.28, metalness: 1, emissive: new THREE.Color('#cf9a62'), emissiveMap: cpuTex, emissiveIntensity: 0 }), 0, 0.37, 0.008);
  // RAM: four sticks with lit tops
  parts.ram = [];
  for (let i = 0; i < 4; i++) {
    add(MB, rbox(0.007, 0.13, 0.035, 0.002), DARK, 0.055 + i * 0.011, 0.37, 0.02);
    parts.ram.push(add(MB, new THREE.BoxGeometry(0.007, 0.13, 0.004), glow('#7d3cff', 1.2), 0.055 + i * 0.011, 0.37, 0.039));
  }
  // GPU: a long card under the CPU, three fans facing down, a light strip on its edge
  const GPU = new THREE.Group(); GPU.position.set(-0.01, 0.24, 0.07); MB.add(GPU);
  add(GPU, rbox(0.28, 0.045, 0.12, 0.006), std('#15111a', 0.45, 0.5), 0, 0, 0);
  parts.gpuStrip = add(GPU, new THREE.BoxGeometry(0.26, 0.006, 0.003), glow('#cf9a62', 0.4), 0, 0.012, 0.0615);
  parts.gpuFans = [];
  for (let i = 0; i < 3; i++) {
    const fan = new THREE.Group(); fan.position.set(-0.09 + i * 0.09, -0.0235, 0); GPU.add(fan);
    const ring = add(fan, new THREE.TorusGeometry(0.039, 0.002, 6, 40), glow('#7d3cff', 0.5)); ring.rotation.x = Math.PI / 2;
    const blades = new THREE.Group(); fan.add(blades);
    for (let b = 0; b < 9; b++) { const bl = add(blades, new THREE.BoxGeometry(0.034, 0.001, 0.009), std('#211b28', 0.5, 0.3), 0.018, 0, 0); bl.rotation.x = 0.4; const piv = new THREE.Group(); piv.rotation.y = (b / 9) * Math.PI * 2; piv.add(bl); blades.add(piv); }
    parts.gpuFans.push({ ring, blades });
  }
  // the security chip: small, square, a shield cut in its lid
  const shieldTex = tex(256, 256, (x, w) => { x.fillStyle = '#16121c'; x.fillRect(0, 0, w, w); x.strokeStyle = '#cf9a62'; x.lineWidth = 12; x.beginPath(); x.moveTo(128, 50); x.lineTo(196, 78); x.lineTo(190, 150); x.quadraticCurveTo(170, 196, 128, 214); x.quadraticCurveTo(86, 196, 66, 150); x.lineTo(60, 78); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(98, 132); x.lineTo(122, 156); x.lineTo(162, 108); x.stroke(); }, true);
  parts.chip = add(MB, rbox(0.024, 0.024, 0.004, 0.002), new THREE.MeshStandardMaterial({ map: shieldTex, emissive: new THREE.Color('#ffffff'), emissiveMap: shieldTex, emissiveIntensity: 0.05, roughness: 0.5 }), -0.1, 0.16, 0.004);
  parts.chipRing = add(MB, new THREE.RingGeometry(0.022, 0.024, 48), glow('#cf9a62', 0.0), -0.1, 0.16, 0.003);
  // fans: three in the front, one at the back, lit rings
  parts.caseFans = [];
  const caseFan = (pos, rotY) => {
    const fan = new THREE.Group(); fan.position.copy(pos); fan.rotation.y = rotY; PC.add(fan);
    add(fan, rbox(0.12, 0.12, 0.025, 0.006), std('#0f0c13', 0.5, 0.3), 0, 0, 0);
    const ring = add(fan, new THREE.TorusGeometry(0.052, 0.0035, 8, 48), glow('#7d3cff', 0.8), 0, 0, 0.014);
    const blades = new THREE.Group(); blades.position.z = 0.006; fan.add(blades);
    for (let b = 0; b < 7; b++) { const piv = new THREE.Group(); piv.rotation.z = (b / 7) * Math.PI * 2; const bl = add(piv, new THREE.BoxGeometry(0.046, 0.016, 0.002), std('#241d2c', 0.5, 0.2), 0.026, 0, 0); bl.rotation.x = 0.5; blades.add(piv); }
    parts.caseFans.push({ ring, blades });
  };
  for (let i = 0; i < 3; i++) caseFan(new THREE.Vector3(0, 0.1 + i * 0.13, pcd / 2 - 0.025), Math.PI);
  caseFan(new THREE.Vector3(0, 0.36, -pcd / 2 + 0.025), 0);
  // a shroud over the power supply
  add(PC, rbox(pcw - 0.02, 0.08, pcd - 0.02, 0.004), std('#100d14', 0.5, 0.5), 0, 0.05, 0);
  const pcLight = new THREE.PointLight('#8a4dff', 0.25, 0.5, 2); pcLight.position.set(0, 0.3, 0); PC.add(pcLight);
  const pcKey = new THREE.PointLight('#f2e6ff', 0.18, 0.6, 2); pcKey.position.set(-0.09, 0.42, 0.1); PC.add(pcKey);
  const pcGold = new THREE.PointLight('#ffb36b', 0.0, 0.4, 2); pcGold.position.set(-0.04, 0.3, 0); PC.add(pcGold);

  scene.updateMatrixWorld(true);

  // ---------------------------------------------------------------- poses
  const screenPose = (grp, w, h, share, offset = 0) => {
    const c = new THREE.Vector3(0, 0, 0).applyMatrix4(grp.matrixWorld);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(grp.matrixWorld);
    const d = Math.max(h / share / (2 * TAN), w / share / (2 * TAN * ASPECT));
    return pose(c.clone().addScaledVector(n, d).add(new THREE.Vector3(0, offset, 0)), c, undefined);
  };
  const poses = {
    eye: pose(new THREE.Vector3(0, 1.2, phone ? 0.95 : 0.66), new THREE.Vector3(0, 1.0, -0.5)),
    phone: screenPose(PHONE, 0.07, 0.151, phone ? 0.5 : 0.74),
    side: screenPose(SIDE, 0.597, 0.336, phone ? 0.86 : 0.74),
    main: screenPose(MAIN, 0.8, 0.335, phone ? 0.9 : 0.78),
    end: phone ? pose(new THREE.Vector3(0.2, 1.75, 3.2), new THREE.Vector3(0.15, 0.85, -0.45)) : pose(new THREE.Vector3(-0.85, 1.4, 2.55), new THREE.Vector3(-0.72, 1.0, -0.45)),
    /** where the camera must stand for the main screen to fill the view exactly (for coming out of the monitor) */
    mainFill: (() => { const c = new THREE.Vector3(0, 0, 0.0012).applyMatrix4(MAIN.matrixWorld); const d = 0.335 / (2 * TAN); return pose(c.clone().add(new THREE.Vector3(0, 0, d)), c); })(),
  };
  const PCW = (v) => v.clone().applyMatrix4(PC.matrixWorld);
  const MBW = (v) => v.clone().applyMatrix4(MB.matrixWorld);

  // ---------------------------------------------------------------- what plays where, and the pointer
  const devices = [
    { key: 'phone', grp: PHONE, scr: phoneScreen, base: PHONE.position.clone(), rot: PHONE.rotation.clone(), lift: 0.012, h: 0 },
    { key: 'side', grp: SIDE, scr: sideScreen, base: SIDE.position.clone(), rot: SIDE.rotation.clone(), lift: 0.02, h: 0 },
    { key: 'main', grp: MAIN, scr: mainScreen, base: MAIN.position.clone(), rot: MAIN.rotation.clone(), lift: 0.02, h: 0 },
  ];
  const WORK_DEVICE = ['phone', 'phone', 'side', 'main', 'main'];
  const WORK_COLOR = ['#3fae5a', '#ff7a2f', '#f0c24a', '#c98a45', '#8a4dff'].map((c) => new THREE.Color(c));
  const BASE_LED = new THREE.Color('#7d3cff');
  const ray = new THREE.Raycaster();

  return {
    scene, poses, T, devices, parts, PC, MB, PCW, MBW, WORK_DEVICE, mainScreen,
    /** The camera pose to look at work i, big. */
    workPose(i) { return poses[WORK_DEVICE[i]]; },
    /** Which device the pointer is over (from the given camera), or -1. */
    pick(cam, nx, ny) {
      ray.setFromCamera(new THREE.Vector2(nx, ny), cam);
      const hits = ray.intersectObjects(devices.map((d) => d.scr.mesh), false);
      return hits.length ? devices.findIndex((d) => d.scr.mesh === hits[0].object) : -1;
    },
    /**
     * Each frame. `w`: the works' place (0 Lumo .. 4 Roblox, fractional between); `end` 0..1; `idle`: the main monitor's
     * picture when it shows no work; `hover`: the device index under the pointer; `tilt`: the pointer, -0.5..0.5.
     */
    update({ time, w, end, idle, hover, tilt, works = 1, study = -1, studyAmt = 0, dt = 1 / 60 }) {
      const k = 1 - Math.exp(-dt / 0.12);
      devices.forEach((d, i) => {
        d.h += ((i === hover ? 1 : 0) - d.h) * k;
        const n = new THREE.Vector3(0, 0, 1).applyEuler(d.rot);
        d.grp.position.copy(d.base).addScaledVector(n, d.lift * d.h);
        d.grp.rotation.set(d.rot.x - tilt[1] * 0.12 * d.h, d.rot.y + tilt[0] * 0.16 * d.h, d.rot.z, d.rot.order);
        d.scr.sheen(d.h, time);
      });
      // phone: Lumo, then Locked; side: Jontai, then the contact card; main: the idle picture, Cookies, the game, idle again
      const ph = clamp(w - 0.5) ;
      phoneScreen.set(T.lumo, T.locked, ease(clamp((w - 0.5) / 0.5)), 0.9 + 0.1 * devices[0].h);
      phoneScreen.scroll(devices[0].h);
      sideScreen.set(T.jontai, T.contact, ease(end), 0.9 + 0.1 * devices[1].h);
      let A = idle, B = T.cookies, t = 0;
      if (w < 2.5) { A = idle; B = T.cookies; t = 0; }
      else if (w < 3) { A = idle; B = T.cookies; t = ease((w - 2.5) * 2); }
      else if (w < 3.5) { A = T.cookies; B = T.roblox; t = 0; }
      else if (w < 4) { A = T.cookies; B = T.roblox; t = ease((w - 3.5) * 2); }
      else { A = T.roblox; B = idle; t = ease(end); }
      mainScreen.set(A, B, t, 0.9 + 0.1 * devices[2].h);
      // the LEDs take the colour of the work in front, or the one under the pointer
      const wi = Math.round(clamp(w, 0, 4));
      const target = BASE_LED.clone().lerp(WORK_COLOR[wi], 0.55 * works);
      if (hover >= 0) { const hw = hover === 0 ? (w > 0.5 ? 1 : 0) : hover === 1 ? 2 : (w > 3.5 ? 4 : 3); target.lerp(WORK_COLOR[hw], 0.8); }
      ledColor.lerp(target, dt >= 1 ? 1 : k * 0.8);
      ledMat.color.copy(ledColor).multiplyScalar(2.2);
      washMat.color.copy(ledColor).multiplyScalar(0.32);
      ledLight.color.copy(ledColor);
      kbGlowTex.offset.x = time * 0.06;
      mainLight.intensity = 2.2 + 0.8 * devices[2].h;
      // the PC: one part per study lights gold; the fans spin, faster for mechatronics
      const lit = (i) => (study === i ? studyAmt : 0);
      parts.cpu.material.emissiveIntensity = 0.02 + 0.75 * lit(0);
      parts.ram.forEach((r) => r.material.color.set('#7d3cff').lerp(new THREE.Color('#cf9a62'), lit(0)).multiplyScalar(0.7 + 0.7 * lit(0)));
      parts.gpuStrip.material.color.set('#cf9a62').multiplyScalar(0.25 + 1.3 * lit(1));
      parts.gpuFans.forEach((f, i) => { f.blades.rotation.y = time * (6 + 10 * lit(1)) + i; f.ring.material.color.set('#7d3cff').lerp(new THREE.Color('#cf9a62'), lit(1)).multiplyScalar(0.4 + 1.1 * lit(1)); });
      parts.chip.material.emissiveIntensity = 0.04 + 0.8 * lit(2);
      parts.chipRing.material.color.set('#cf9a62').multiplyScalar(1.4 * lit(2));
      parts.caseFans.forEach((f, i) => { f.blades.rotation.z = time * (4 + 16 * lit(3)) + i * 0.7; f.ring.material.color.set('#7d3cff').lerp(new THREE.Color('#cf9a62'), lit(3)).multiplyScalar(0.5 + 1.1 * lit(3)); });
      pcGold.intensity = 0.25 * studyAmt;
    },
  };
}
