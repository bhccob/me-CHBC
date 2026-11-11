// LAB ONLY (throwaway). The beat after the works: in the dark beyond the bench a robot's visor lights up, "insert coin".
// One armoured hand (cropped at the wrist by the frame) takes the four study coins off the string that hung under the O on
// the first view, one at a time, turns each edge-on and pushes it into the slot under the visor. Each coin lights a
// quarter of one gold trace from the slot to the visor, and the visor names the study; with all four in, it boots and
// says who Bob is. Room units, the same as bench.js.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, coin, robotHand, rounded } from './kit.js';

export const STUDIES = [
  { n: '02', name: 'Software engineering', line: 'Makes it think.' },
  { n: '03', name: 'Game & app development', line: 'Makes it playable.' },
  { n: '04', name: 'Cybersecurity', line: 'Keeps it safe.' },
  { n: '05', name: 'Mechatronics', line: 'Makes it move. Next.' },
];
const BOOT = ['BOB CHUNG', 'Software engineering · games · apps · cybersecurity', 'I build apps, games and websites.', 'Next: mechatronics'];
const HEAD = 0.8, COIN_R = 0.29, SPACING = 0.78;

const CSS = `
  .rb { position: fixed; inset: 0; z-index: 12; pointer-events: none; color: #f2efe8; opacity: 0; font: 500 12px Barlow; }
  .rb .m { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: 0.16em; text-transform: uppercase; }
  .rb-c { position: fixed; margin: 0; letter-spacing: 0.06em; text-transform: uppercase; }
  .rb-tl { top: var(--gutter, 30px); left: var(--gutter, 30px); }
  .rb-tr { top: var(--gutter, 30px); right: var(--gutter, 30px); }
  .rb-bl { bottom: var(--gutter, 30px); left: var(--gutter, 30px); color: rgb(242 239 232 / 0.55); line-height: 1.8; }
  .rb-bl b { color: #efb53d; font-weight: 500; }
  .rb-rack { position: fixed; right: var(--gutter, 30px); top: 66%; margin: 0; padding: 0; list-style: none; display: grid; gap: 20px; }
  .rb-rack li { display: grid; grid-template-columns: 26px auto; align-items: center; gap: 14px; opacity: 0.32; transition: opacity .5s; }
  .rb-rack li.now { opacity: 1; }
  .rb-rack li.in { opacity: 0.7; }
  .rb-rack i { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #8a6a46; display: grid; place-items: center; }
  .rb-rack i::after { content: ''; width: 8px; height: 8px; border: 1.5px solid #8a6a46; }
  .rb-rack li.in i, .rb-rack li.now i { border-color: #efb53d; }
  .rb-rack li.in i::after, .rb-rack li.now i::after { border-color: #efb53d; }
  .rb-rack span { display: block; color: #efb53d; margin-bottom: 3px; }
  .rb-rack b { font: 700 16px/1 Barlow; letter-spacing: 0.02em; text-transform: uppercase; }
  .rb-rack li.in b::after { content: ' · in'; font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #efb53d; }`;

/** The visor's words, drawn into one canvas that is redrawn only when they change. */
function visorScreen() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 512;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let last = '';
  return {
    tex,
    draw(lines, typed, caret) {
      const total = lines.reduce((a, l) => a + l.length, 0);
      let left = Math.floor(typed * total + 1e-6);
      const key = `${lines.join('|')}#${left}#${caret}`;
      if (key === last) return;
      last = key;
      x.fillStyle = '#07050b';
      x.fillRect(0, 0, c.width, c.height);
      const g = x.createRadialGradient(1024, 256, 0, 1024, 256, 1100);
      g.addColorStop(0, 'rgba(239,181,61,0.12)');
      g.addColorStop(1, 'rgba(239,181,61,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < c.height; y += 6) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, y, c.width, 2); }
      x.fillStyle = C.glow;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      const sizes = lines.map((l, i) => (i === 0 ? (lines.length > 2 ? 96 : 120) : lines.length > 3 ? 54 : 66));
      const heights = sizes.map((s) => s * 1.3);
      let y = 256 - heights.reduce((a, b) => a + b, 0) / 2;
      let caretAt = null;
      lines.forEach((l, i) => {
        x.font = `500 ${sizes[i]}px "IBM Plex Mono"`;
        const wide = x.measureText(l).width;
        if (wide > 1360) { sizes[i] = Math.floor((sizes[i] * 1360) / wide); x.font = `500 ${sizes[i]}px "IBM Plex Mono"`; }
        const shown = l.slice(0, Math.max(0, Math.min(l.length, left)));
        left -= l.length;
        const cy = y + heights[i] / 2;
        if (shown.length) {
          const full = x.measureText(l).width;
          x.textAlign = 'left';
          x.fillText(shown, 1024 - full / 2, cy);
          caretAt = [1024 - full / 2 + x.measureText(shown).width + 10, cy, sizes[i]];
        }
        y += heights[i];
      });
      if (caret && caretAt) { x.fillRect(caretAt[0], caretAt[1] - caretAt[2] * 0.42, caretAt[2] * 0.5, caretAt[2] * 0.84); }
      tex.needsUpdate = true;
    },
  };
}

export function createRobot(renderer, scene, { home, bandY, W, H, hudParent = document.body }) {
  // Glossy things need something to reflect: a soft room, faint. The bench's own surfaces do not use it.
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pm.dispose();
  const key = new THREE.DirectionalLight('#ffe9d2', 1.1);
  const rim = new THREE.DirectionalLight('#9d7cff', 2.6);
  const visorLight = new THREE.PointLight(C.glow, 0, 0, 2);
  const fill = new THREE.HemisphereLight('#2a2040', '#000000', 0.5);
  scene.add(key, key.target, rim, rim.target, visorLight, fill);

  const rig = new THREE.Group();
  scene.add(rig);
  // ---------------------------------------------------------------- the head: a helmet, a visor, a slot; not a face
  const head = new THREE.Group();
  head.scale.setScalar(HEAD);
  head.position.set(home.x, home.y + bandY + 2.4, home.z - 21);
  const shell = new THREE.MeshPhysicalMaterial({ color: '#1b1721', metalness: 0.7, roughness: 0.36, clearcoat: 0.8, clearcoatRoughness: 0.22 });
  const edge = new THREE.MeshPhysicalMaterial({ color: '#3a3542', metalness: 0.9, roughness: 0.3 });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  add(head, new THREE.SphereGeometry(1, 96, 64), shell).scale.set(4.4, 3.3, 3.0);
  const screen = visorScreen();
  const span = 1.9;
  const visorMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(1, 1, 1), emissiveMap: screen.tex, emissiveIntensity: 0 });
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 96, 1, true, -span / 2, span), visorMat);
  visor.scale.set(4.42, 1, 3.03);
  visor.position.y = 0.45;
  head.add(visor);
  for (const sx of [-1, 1]) {
    add(head, new THREE.CylinderGeometry(0.95, 0.95, 0.35, 64), edge, sx * 4.35, 0.1, 0).rotation.z = Math.PI / 2;
    add(head, new THREE.CylinderGeometry(0.55, 0.55, 0.4, 64), shell, sx * 4.4, 0.1, 0).rotation.z = Math.PI / 2;
  }
  // The coin box: a ledge under the visor with the slot on its top, lit round the edge. Coins drop in face-on.
  const ledge = add(head, rounded(2.3, 0.95, 0.95, 0.14), edge, 0, -2.45, 2.42);
  ledge.userData.kind = 'ledge';
  const ringMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: new THREE.Color(C.glow), emissiveIntensity: 0.3 });
  add(head, rounded(1.36, 0.06, 0.32, 0.03), ringMat, 0, -1.97, 2.36);
  add(head, rounded(1.18, 0.08, 0.15, 0.02), new THREE.MeshStandardMaterial({ color: '#000' }), 0, -1.955, 2.36);
  // One gold trace up the face, from the slot to the visor, in four lengths: one for each study.
  const traceMats = [];
  for (let i = 0; i < 4; i++) {
    const y0 = -1.9 + i * 0.4, y1 = y0 + 0.34;
    const pts = [];
    for (let k = 0; k <= 10; k++) { const y = y0 + ((y1 - y0) * k) / 10; pts.push(new THREE.Vector3(0, y, 3.0 * Math.sqrt(Math.max(0, 1 - (y / 3.3) ** 2)) + 0.014)); }
    const m = new THREE.MeshStandardMaterial({ color: '#100a04', emissive: new THREE.Color(C.glow), emissiveIntensity: 0 });
    add(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.03, 8), m);
    traceMats.push(m);
  }
  rig.add(head);
  head.updateMatrixWorld(true);
  const slotPos = head.localToWorld(new THREE.Vector3(0, -1.95, 2.36)); // the top of the slot
  const n = new THREE.Vector3(0, 1, 0);
  key.position.copy(head.position).add(new THREE.Vector3(-8, 9, 12));
  key.target.position.copy(head.position);
  rim.position.copy(head.position).add(new THREE.Vector3(6, 4, -10));
  rim.target.position.copy(head.position);
  visorLight.position.copy(head.position).add(new THREE.Vector3(0, -0.6, 4.4));

  // ---------------------------------------------------------------- the four study coins, still on their string, beside the box
  const colX = slotPos.x + 3.75, colZ = slotPos.z + 0.75, colBottom = slotPos.y + 0.35;
  const coins = STUDIES.map(() => {
    const holder = new THREE.Group(); // the coin faces along the holder's +z
    const c = coin();
    c.scale.setScalar(COIN_R);
    holder.add(c);
    rig.add(holder);
    return holder;
  });
  const silk = new THREE.MeshPhysicalMaterial({ color: '#a8783f', roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#f0c890'), sheenRoughness: 0.35 });
  let cord = null;

  // ---------------------------------------------------------------- the hand: rises from the bottom of the frame, cropped at the wrist
  const HAND = 1.2;
  const hand = robotHand({ curl: [[0.28, 0.42, 0.32], [1.1, 1.25, 0.9], [1.2, 1.3, 0.95], [1.25, 1.3, 0.95]], spread: 0.03, thumb: [0.78, 0.5], glow: 0.6 });
  hand.scale.setScalar(HAND);
  rig.add(hand);
  // Fingers up and leaning back over the box, palm to you: the coin sits in the pinch above the thumb and first finger.
  const lean = 0.42;
  const qHand = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, Math.cos(lean), -Math.sin(lean)), new THREE.Vector3(0, Math.sin(lean), Math.cos(lean))));
  const grip = new THREE.Vector3(-0.32, 2.5, 0.72).multiplyScalar(HAND);
  const handFor = (coinPos) => coinPos.clone().sub(grip.clone().applyQuaternion(qHand));
  const restOf = (p) => handFor(p).add(new THREE.Vector3(0.4, -4.2, 0.2));

  // ---------------------------------------------------------------- HUD
  const hud = document.createElement('div');
  hud.className = 'rb';
  hud.innerHTML = `<style>${CSS}</style><p class="rb-c rb-tl">Bob Chung</p><p class="rb-c rb-tr">Studies</p>
    <ol class="rb-rack">${STUDIES.map((s) => `<li><i></i><div><span class="m">${s.n}</span><b>${s.name}</b></div></li>`).join('')}</ol>
    <p class="rb-c rb-bl m">Credits <b>01</b> / 05</p>`;
  hudParent.append(hud);
  const rows = [...hud.querySelectorAll('.rb-rack li')], creditsEl = hud.querySelector('.rb-bl b');

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const target = head.position.clone().add(new THREE.Vector3(1.0, -0.62, 2.2));
  const view = target.clone().add(new THREE.Vector3(0.35, 0.3, 8.6));

  let wasFading = true;
  return {
    head, slotPos, n, target, view,
    /**
     * reveal: 0..1, the visor coming on; coins: 0..4, how far the feeding has gone (k + phase); boot: 0..1; time.
     */
    update({ reveal, coins: cp, boot, time }) {
      // Light and visor.
      const inserted = Math.max(0, Math.min(4, Math.floor(cp + 0.25)));
      // Nothing of the robot shows while you are with the works: its lights come up with the visor.
      const on = ease(reveal);
      key.intensity = 1.1 * on; rim.intensity = 2.6 * on; fill.intensity = 0.5 * on;
      scene.environmentIntensity = 0.32 * on;
      const fadeIn = ease(reveal / 0.45);
      rig.visible = fadeIn > 0.001;
      if (fadeIn < 1 || wasFading) {
        rig.traverse((o) => {
          if (!o.material) return;
          const t = fadeIn < 1;
          if (o.material.transparent !== t && !o.material.userData.alwaysClear) { o.material.transparent = t; o.material.needsUpdate = true; }
          o.material.opacity = fadeIn;
        });
        wasFading = fadeIn < 1;
      }
      visorMat.emissiveIntensity = 1.6 * ease(reveal * 1.4);
      visorLight.intensity = (2 + inserted * 1.2 + boot * 3) * ease(reveal);
      ringMat.emissiveIntensity = (0.4 + 0.9 * (0.5 + 0.5 * Math.sin(time * 3))) * ease(reveal) * (boot > 0 ? 0.6 : 1) + boot;
      traceMats.forEach((m, i) => { m.emissiveIntensity = 2.4 * ease((cp - i - 0.72) / 0.2) + boot * 0.8 * Math.max(0, Math.sin(time * 2 - i)); });
      // The visor's words.
      let lines, typed;
      if (boot > 0) { lines = BOOT; typed = clamp(boot / 0.85); }
      else if (inserted === 0) { lines = ['INSERT COIN', 'Credits 01 / 05']; typed = clamp((reveal - 0.3) / 0.5); }
      else {
        const s = STUDIES[inserted - 1];
        lines = [`${s.n} / 05`, s.name.toUpperCase(), s.line];
        typed = clamp((cp - (inserted - 1) - 0.72) / 0.45);
      }
      screen.draw(lines, typed, Math.floor(time * 2) % 2 === 0);
      // The coins: on the string until taken; the taken one rides in the hand, over the box, and drops in face-on.
      const k = Math.min(3, Math.floor(cp)), q = cp >= 4 ? 1 : cp - k;
      const drop = (j) => (j > k ? ease((q - 0.34) / 0.36) : 0);
      const above = slotPos.clone().add(new THREE.Vector3(0, COIN_R + 0.42, 0));
      let handPos = restOf(new THREE.Vector3(colX, colBottom, colZ)), handQ = qHand, handOn = false;
      coins.forEach((c, j) => {
        const columnPos = new THREE.Vector3(colX, colBottom + (j - k) * SPACING - drop(j) * SPACING, colZ);
        const sway = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(time * 0.9 + j) * 0.18);
        if (j < k || cp >= 4) { c.visible = false; return; }
        c.visible = true;
        if (j > k) { c.position.copy(columnPos); c.quaternion.copy(sway); return; }
        let pos, rot;
        if (q < 0.26) { pos = columnPos; rot = sway; }
        else if (q < 0.6) {
          const f = ease((q - 0.26) / 0.34);
          pos = columnPos.clone().lerp(above, f);
          pos.y += Math.sin(f * Math.PI) * 0.45;
          rot = sway.clone().slerp(qHand, ease((q - 0.26) / 0.1));
        } else {
          // Let go: it falls into the slot.
          const f = clamp((q - 0.6) / 0.14);
          pos = above.clone();
          pos.y -= 1.5 * f * f;
          rot = qHand;
        }
        c.position.copy(pos);
        c.quaternion.copy(rot);
        c.visible = q < 0.74;
        // The hand: up to the coin, carries it, opens over the slot, drops back for the next one (or away after the last).
        const atCoin = handFor(columnPos);
        if (q < 0.26) { const f = ease(q / 0.24); handPos = (k === 0 ? restOf(columnPos) : atCoin).clone().lerp(atCoin, f); }
        else if (q < 0.6) handPos = handFor(pos);
        else {
          const f = ease((q - 0.64) / 0.32);
          const next = handFor(new THREE.Vector3(colX, colBottom, colZ));
          handPos = handFor(above).add(new THREE.Vector3(0, 0.12 * clamp((q - 0.6) / 0.05), 0)).lerp(k === 3 ? restOf(new THREE.Vector3(colX, colBottom, colZ)) : next, f);
        }
        handOn = true;
      });
      hand.visible = cp > 0.001 && (handOn || boot < 0.01);
      hand.position.copy(handPos);
      hand.quaternion.copy(handQ);
      // The string through the coins still on it, up into the dark.
      if (cord) { rig.remove(cord); cord.geometry.dispose(); cord = null; }
      const left = coins.filter((c, j) => cp < 4 && (j > k || (j === k && q < 0.26)));
      if (left.length) {
        const low = Math.min(...left.map((c) => c.position.y)) - 0.32;
        const pts = [];
        for (let y = colBottom + 12; y >= low; y -= 0.25) pts.push(new THREE.Vector3(colX + Math.sin(time * 0.6 + y * 0.3) * 0.015, y, colZ));
        if (pts.length > 1) { cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 6), silk); rig.add(cord); }
      }
      // HUD.
      rows.forEach((r, i) => { r.classList.toggle('in', i < inserted); r.classList.toggle('now', i === k && cp < 4 && i >= inserted); });
      creditsEl.textContent = String(1 + inserted).padStart(2, '0');
      hud.style.opacity = String(ease((reveal - 0.4) / 0.5));
    },
  };
}
