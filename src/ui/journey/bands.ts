import { seeded } from '~/journey/math';
import { grain, mist } from './paper';

/**
 * The image half of each sheet, drawn in code, from the mock's `paintBand`: Seigaiha waves under real code; pixel clouds and
 * a little level; a key-fret lattice round one lock; gear drawings with centre marks.
 */

export type BandKind = 'software' | 'game' | 'cyber' | 'mech';

const SEEDS: Record<BandKind, number> = { software: 11, game: 23, cyber: 37, mech: 51 };
const PALETTES: Record<BandKind, readonly [string, readonly string[]]> = {
  software: ['#101a4a', ['rgba(60,90,210,.28)', 'rgba(20,30,110,.5)', 'rgba(120,150,255,.1)']],
  game: ['#3a1040', ['rgba(190,60,170,.22)', 'rgba(70,16,90,.5)', 'rgba(240,130,210,.08)']],
  cyber: ['#07343a', ['rgba(30,170,150,.22)', 'rgba(6,60,70,.5)', 'rgba(130,240,210,.08)']],
  mech: ['#3a2410', ['rgba(220,150,60,.2)', 'rgba(70,40,14,.5)', 'rgba(255,210,130,.08)']],
};
const GOLD = 'rgba(230,184,74,';
const CODE = ['const machine = new Machine();', 'machine.boot();', 'export function run(task) {', 'await brain.think(task);', 'return result.ok;', 'for (const part of stack)', 'part.connect(bus);', 'if (!armour.locked) throw;'];

function software(x: CanvasRenderingContext2D, w: number, h: number, r: () => number): void {
  const R0 = Math.max(46, w / 26);
  for (let row = -1; row < h / (R0 * 0.5) + 2; row++) {
    for (let col = -1; col < w / (R0 * 2) + 2; col++) {
      const cx = col * R0 * 2 + (row % 2 ? R0 : 0), cy = row * R0 * 0.5 + h * 0.06;
      const near = Math.max(0, 1 - Math.abs(cy / h - 0.82) * 1.4);
      for (let k = 3; k > 0; k--) {
        x.beginPath();
        x.arc(cx, cy, (R0 * k) / 3, Math.PI, 0);
        x.fillStyle = 'rgba(12,18,60,.9)';
        if (k === 3) x.fill();
        x.strokeStyle = `${GOLD}${0.1 + near * 0.3})`;
        x.lineWidth = 1.2;
        x.stroke();
      }
    }
  }
  x.font = `500 ${Math.round(h * 0.034)}px "IBM Plex Mono", monospace`;
  for (const line of CODE) {
    x.fillStyle = `rgba(214,222,255,${0.14 + r() * 0.22})`;
    x.fillText(line, r() * w * 0.82, h * (0.08 + r() * 0.5));
  }
}

function game(x: CanvasRenderingContext2D, w: number, h: number, r: () => number): void {
  const u = Math.max(12, Math.round(w / 92));
  for (let n = 0; n < 9; n++) {
    const cx = r() * w, cy = h * (0.12 + r() * 0.5), rw = 5 + Math.floor(r() * 9), rh = 2 + Math.floor(r() * 3);
    for (let j = -rh; j <= rh; j++) {
      for (let i = -rw; i <= rw; i++) {
        if ((i * i) / (rw * rw) + (j * j) / (rh * rh) > 1 - r() * 0.2) continue;
        x.fillStyle = `rgba(244,190,235,${0.05 + r() * 0.1})`;
        x.fillRect(Math.round((cx + i * u) / u) * u, Math.round((cy + j * u) / u) * u, u - 2, u - 2);
      }
    }
  }
  const gy = h - u * 4;
  for (let i = 0; i * u < w; i++) {
    const hgt = 1 + (Math.sin(i * 0.31) > 0.6 ? 2 : 0) + (i % 23 === 7 ? 3 : 0);
    for (let j = 0; j < hgt + 3; j++) {
      x.fillStyle = `rgba(244,190,235,${j === 0 ? 0.3 : 0.12})`;
      x.fillRect(i * u, gy - hgt * u + j * u + u * 2, u - 2, u - 2);
    }
  }
  for (let n = 0; n < 26; n++) {
    x.fillStyle = `${GOLD}${0.5 + r() * 0.5})`;
    x.fillRect(Math.round((r() * w) / u) * u, Math.round((h * (0.08 + r() * 0.62)) / u) * u, u - 2, u - 2);
  }
  x.strokeStyle = `${GOLD}.34)`;
  x.lineWidth = 2;
  for (let n = 0; n < 7; n++) {
    const dx = r() * w, dy = h * (0.1 + r() * 0.7), z = u * 1.2;
    x.strokeRect(dx - z / 2, dy - z * 1.5, z, z * 3);
    x.strokeRect(dx - z * 1.5, dy - z / 2, z * 3, z);
  }
}

function cyber(x: CanvasRenderingContext2D, w: number, h: number): void {
  const t = Math.max(34, w / 40);
  x.strokeStyle = `${GOLD}.13)`;
  x.lineWidth = 1.4;
  for (let j = 0; j * t < h + t; j++) {
    for (let i = 0; i * t < w + t; i++) {
      const X = i * t, Y = j * t, q = t * 0.2;
      x.beginPath();
      x.moveTo(X, Y);
      x.lineTo(X + t - q, Y);
      x.lineTo(X + t - q, Y + t - q);
      x.lineTo(X + 2 * q, Y + t - q);
      x.lineTo(X + 2 * q, Y + 2 * q);
      x.lineTo(X + t - 2 * q, Y + 2 * q);
      x.lineTo(X + t - 2 * q, Y + t - 2 * q - q / 2);
      x.stroke();
    }
  }
  const cx = w * 0.3, cy = h * 0.6;
  for (let k = 1; k < 9; k++) {
    x.beginPath();
    x.arc(cx, cy, (k * h) / 12, 0, 7);
    x.strokeStyle = `${GOLD}${0.62 - k * 0.062})`;
    x.lineWidth = k === 1 ? 3 : 1.2;
    x.setLineDash(k % 2 ? [2 + k * 3, 5 + k * 2] : []);
    x.stroke();
  }
  x.setLineDash([]);
  const s = h / 22;
  x.fillStyle = `${GOLD}.9)`;
  x.beginPath();
  x.arc(cx, cy - s * 0.5, s, 0, 7);
  x.fill();
  x.beginPath();
  x.moveTo(cx - s * 0.5, cy);
  x.lineTo(cx + s * 0.5, cy);
  x.lineTo(cx + s * 0.9, cy + s * 2);
  x.lineTo(cx - s * 0.9, cy + s * 2);
  x.closePath();
  x.fill();
}

function mech(x: CanvasRenderingContext2D, w: number, h: number): void {
  const gearAt = (cx: number, cy: number, rad: number, teeth: number, a: number): void => {
    const rt = rad * 1.12, rr = rad * 0.92;
    x.beginPath();
    for (let k = 0; k < teeth; k++) {
      const s = (k / teeth) * 6.283 + a, u = 6.283 / teeth;
      ([[0, rr], [0.18, rr], [0.3, rt], [0.62, rt], [0.76, rr]] as const).forEach(([t, q], i) => {
        const X = cx + Math.cos(s + t * u) * q, Y = cy + Math.sin(s + t * u) * q;
        if (k === 0 && i === 0) x.moveTo(X, Y);
        else x.lineTo(X, Y);
      });
    }
    x.closePath();
    x.strokeStyle = `${GOLD}.5)`;
    x.lineWidth = 1.4;
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, rad * 0.32, 0, 7);
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, rad * 0.72, 0, 7);
    x.setLineDash([10, 6, 2, 6]);
    x.strokeStyle = `${GOLD}.26)`;
    x.stroke();
    x.setLineDash([]);
    x.strokeStyle = `${GOLD}.3)`;
    x.beginPath();
    x.moveTo(cx - rt * 1.2, cy);
    x.lineTo(cx + rt * 1.2, cy);
    x.moveTo(cx, cy - rt * 1.2);
    x.lineTo(cx, cy + rt * 1.2);
    x.stroke();
  };
  const G = h * 0.36;
  gearAt(w * 0.16, h * 0.62, G, 26, 0.1);
  const g2 = G * 0.52;
  gearAt(w * 0.16 + (G + g2) * 1.02 * 0.92, h * 0.62 - (G + g2) * 0.4, g2, 14, 0.2);
  const g3 = G * 0.74;
  gearAt(w * 0.16 + (G + g2) * 0.94 + (g2 + g3) * 0.98, h * 0.62 + (g2 + g3) * 0.18 - (G + g2) * 0.4, g3, 20, 0.05);
  x.strokeStyle = `${GOLD}.34)`;
  x.beginPath();
  x.moveTo(w * 0.04, h * 0.95);
  x.lineTo(w * 0.28, h * 0.95);
  x.stroke();
}

/** Draws a sheet's art into its canvas, at the size it stands. */
export function paintBand(canvas: HTMLCanvasElement, kind: BandKind): void {
  const d = Math.min(1.5, devicePixelRatio || 1);
  const w = (canvas.width = Math.round(canvas.clientWidth * d));
  const h = (canvas.height = Math.round(canvas.clientHeight * d));
  const x = canvas.getContext('2d') as CanvasRenderingContext2D;
  const r = seeded(SEEDS[kind]);
  const [ground, tints] = PALETTES[kind];
  x.fillStyle = ground;
  x.fillRect(0, 0, w, h);
  mist(x, w, h, r, tints, 24);
  if (kind === 'software') software(x, w, h, r);
  if (kind === 'game') game(x, w, h, r);
  if (kind === 'cyber') cyber(x, w, h);
  if (kind === 'mech') mech(x, w, h);
  grain(x, w, h, r, 0.03);
  const fade = x.createLinearGradient(0, 0, 0, h * 0.24);
  fade.addColorStop(0, 'rgba(0,0,0,.28)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fade;
  x.fillRect(0, 0, w, h * 0.24);
}
