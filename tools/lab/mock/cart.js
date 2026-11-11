// LAB ONLY (throwaway): the cartridge for the second extra idea. A generic shape of my own, not any console's.
import { THREE, C, canvasTex, rounded } from './kit.js';

/** The label: the first view itself, shrunk onto the cartridge. */
export function labelTexture() {
  return canvasTex(1200, 1000, (x, w, h) => {
    x.fillStyle = C.page; x.fillRect(0, 0, w, h);
    x.fillStyle = C.ink;
    x.font = '800 300px Barlow'; x.fillText('BOB', 40, 470); x.fillText('CHUNG', 40, 740);
    x.font = '500 26px "IBM Plex Mono"'; x.fillStyle = 'rgba(19,7,36,0.6)';
    x.fillText('▲ THIS END IN', w / 2 - 110, 70);
    x.fillText('BC-2006 · 1 PLAYER', w - 360, h - 50);
    x.font = '500 30px Barlow'; x.fillStyle = C.ink; x.fillText('Bob Chung', 40, 140);
  });
}

/** Its board: four chips (the studies), one empty socket (mechatronics), gold fingers at the edge. */
export function boardTexture() {
  return canvasTex(1600, 1100, (x, w, h) => {
    x.fillStyle = '#1a0827'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(201,154,69,0.55)'; x.lineWidth = 6; x.lineCap = 'round';
    let s = 5;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) {
      let px = r() * w, py = r() * (h - 160);
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 3; k++) { const a = Math.floor(r() * 4) * (Math.PI / 2); const len = 60 + r() * 220; px += Math.cos(a) * len; py += Math.sin(a) * len; x.lineTo(px, py); }
      x.stroke();
    }
    x.fillStyle = '#c99a45';
    for (let i = 0; i < 24; i++) x.fillRect(80 + i * 60, h - 140, 38, 140);
  });
}

export function cartridge() {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: '#1c1a21', roughness: 0.5, metalness: 0.15, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const body = new THREE.Mesh(rounded(2.4, 2.7, 0.32, 0.1), shell);
  g.add(body);
  // Grip ridges at the top, a recessed label, gold contacts showing at the bottom edge.
  for (let i = 0; i < 6; i++) {
    const ridge = new THREE.Mesh(rounded(1.6, 0.045, 0.04, 0.015), shell);
    ridge.position.set(0, 1.18 - i * 0.07, 0.17);
    g.add(ridge);
  }
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.66), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.75 }));
  label.position.set(0, -0.12, 0.162);
  g.add(label);
  const gold = new THREE.MeshPhysicalMaterial({ color: '#c99a45', metalness: 1, roughness: 0.28 });
  for (let i = 0; i < 18; i++) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.01), gold);
    pin.position.set(-0.85 + i * 0.1, -1.32, -0.16);
    g.add(pin);
  }
  return g;
}
