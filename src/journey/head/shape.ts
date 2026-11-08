import { clamp, ease, mix } from '../math';

/**
 * Bob's head and brain as distance fields, ported line for line from mock-up 20 (spec 2026-11-08 "Into my head", section 3).
 * Head units are about 10 cm: y up, the face toward +z, chin near -0.97, crown at 1.22. The proportions are Bob's approved
 * ones; the head is code, never his photos. Negative inside, positive outside. Pure: no three, no DOM.
 */

/** The mock's `smooth(a, b, x)`, which the site's math calls `ease(x, a, b)`. */
const smooth = (a: number, b: number, x: number): number => ease(x, a, b);

function ell(x: number, y: number, z: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / rx, qy = py / ry, qz = pz / rz;
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

function cone(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number): number {
  const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - mix(r1, r2, h);
}

/**
 * The jaw's lower edge: flat under the chin for a moment, then one straight line back to a crisp angle, then steeply up the
 * back of the jaw toward the ear.
 */
const J = { cz: 0.62, cy: -0.955, az: -0.22, ay: -0.7 };
const jawY = (z: number): number => (z < J.az ? J.ay + (J.az - z) * 2.4 : J.cy + (J.ay - J.cy) * clamp(((J.cz - z) / (J.cz - J.az) - 0.08) / 0.92));

/** The lower face as one smooth mass from the cheeks down, its jaw square, not a V. */
function lowMass(x: number, y: number, z: number): number {
  const s = clamp((J.cz - z) / (J.cz - J.az));
  const jw = mix(0.24, 0.56, Math.pow(s, 0.6));
  const rx = mix(0.61, jw, smooth(-0.12, -0.7, y));
  const px = x / rx, py = (y + 0.62) / 1.0, pz = (z - 0.18) / 0.6;
  return smax((Math.sqrt(px * px + py * py + pz * pz) - 1) * Math.min(rx, 0.6), jawY(z) - y, 0.07);
}

/** A head on the classic thirds, with Bob's broad face and full lips, a broad chin, and a neck a little narrower than the jaw. */
export function headSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = ell(x, y, z, 0, 0.33, -0.12, 0.76, 0.88, 0.95); // cranium
  d = smin(d, ell(x, y, z, 0, 0.3, 0.32, 0.6, 0.6, 0.56), 0.14); // forehead
  d = smin(d, cone(ax, y, z, 0, 0.27, 0.84, 0.38, 0.28, 0.67, 0.055, 0.045), 0.08); // brow
  d = smin(d, ell(ax, y, z, 0.42, 0.0, 0.46, 0.22, 0.14, 0.3), 0.12); // cheekbones
  d = smin(d, lowMass(x, y, z), 0.12); // cheeks and jaw
  d = smin(d, ell(x, y, z, 0, -0.3, 0.46, 0.44, 0.4, 0.38), 0.16); // mid-face
  d = smin(d, ell(x, y, z, 0, -0.52, 0.52, 0.3, 0.26, 0.26), 0.14); // round of the mouth
  d = smin(d, ell(x, y, z, 0, -0.82, 0.62, 0.21, 0.12, 0.12), 0.1); // chin, broad
  d = smax(d, -ell(ax, y, z, 0.27, 0.13, 0.8, 0.15, 0.08, 0.1), 0.04); // eye sockets
  d = smin(d, ell(ax, y, z, 0.27, 0.12, 0.68, 0.095, 0.075, 0.095), 0.03); // eyes
  d = smin(d, cone(x, y, z, 0, 0.13, 0.8, 0, -0.24, 0.93, 0.045, 0.07), 0.07); // nose
  d = smin(d, ell(x, y, z, 0, -0.26, 0.92, 0.08, 0.07, 0.065), 0.05); // nose tip
  d = smin(d, ell(ax, y, z, 0.11, -0.31, 0.82, 0.085, 0.06, 0.07), 0.05); // nostrils
  d = smin(d, ell(x, y, z, 0, -0.47, 0.795, 0.22, 0.062, 0.07), 0.04); // upper lip
  d = smin(d, ell(x, y, z, 0, -0.6, 0.76, 0.2, 0.068, 0.07), 0.04); // lower lip
  d = smin(d, ell(ax, y, z, 0.71, -0.03, -0.4, 0.055, 0.26, 0.15), 0.06); // ears, lying close
  d = smax(d, -ell(ax, y, z, 0.76, -0.05, -0.38, 0.025, 0.16, 0.08), 0.03);
  const h = Math.max(0, -0.6 - y) / 1.4, cz = -0.24 - 0.12 * h;
  const neck = Math.max((Math.hypot(x / 0.5, (z - cz) / 0.44) - 1) * 0.5, Math.max(-2.05 - y, y + 0.45));
  return smin(d, neck, mix(0.24, 0.06, smooth(-0.5, 0.05, z))); // soft into the back of the skull, a clean angle under the jaw
}

/** The brain: two halves with the gap between them on the middle line, the cerebellum and the brainstem, and its folds. */
export function brainSdf(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0.25, 0.51, -0.08, 0.29, 0.36, 0.64);
  d = smax(d, 0.014 - ax, 0.03);
  d = smin(d, ell(x, y, z, 0, 0.06, -0.5, 0.34, 0.16, 0.22), 0.08);
  d = smin(d, cone(x, y, z, 0, 0.18, -0.22, 0, -0.42, -0.16, 0.085, 0.085), 0.1);
  const f = Math.sin(x * 23 + 1.7 * Math.sin(z * 14)) * Math.sin(z * 20 + 1.5 * Math.sin(y * 16)) * Math.sin(y * 18 + 1.2 * Math.sin(x * 12));
  return d + 0.022 * f;
}

/** Where the mouth is, in head units. */
export const MOUTH_Y = -0.533;
export const MOUTH_Z = 0.8;
export const MOUTH_W = 0.23;

/** Where the skull comes apart for the lid. */
export const cutY = (z: number): number => 0.56 + 0.06 * z;

/** Which piece a point of the skin belongs to with the lid: 1 above the cut, 0 below (mock `pieceOf`, style 2). */
export function pieceOf(_x: number, y: number, z: number): 0 | 1 {
  return y < cutY(z) ? 0 : 1;
}

/** A line of the outline, in the side view's (z, y). */
export type Seg = [[number, number], [number, number]];

/** The zero line of `f` over a grid, as segments (mock `contour`): the side view's outline. */
export function contour(f: (z: number, y: number) => number, z0: number, z1: number, y0: number, y1: number, step: number): Seg[] {
  const nz = Math.ceil((z1 - z0) / step), ny = Math.ceil((y1 - y0) / step), v = new Float32Array((nz + 1) * (ny + 1)), segs: Seg[] = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nz; i++) v[j * (nz + 1) + i] = f(z0 + i * step, y0 + j * step);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nz; i++) {
      const a = v[j * (nz + 1) + i], b = v[j * (nz + 1) + i + 1], c = v[(j + 1) * (nz + 1) + i + 1], d = v[(j + 1) * (nz + 1) + i];
      const zA = z0 + i * step, yA = y0 + j * step, p: [number, number][] = [];
      if (a < 0 !== b < 0) p.push([zA + (a / (a - b)) * step, yA]);
      if (b < 0 !== c < 0) p.push([zA + step, yA + (b / (b - c)) * step]);
      if (c < 0 !== d < 0) p.push([zA + step - (c / (c - d)) * step, yA + step]);
      if (d < 0 !== a < 0) p.push([zA, yA + step - (d / (d - a)) * step]);
      if (p.length >= 2) segs.push([p[0], p[1]]);
      if (p.length === 4) segs.push([p[2], p[3]]);
    }
  }
  return segs;
}

/** The side map's box, in head units (mock MZ0..MZ1, MY0..MY1). */
export const OUTLINE_BOX = { z0: -1.25, z1: 1.25, y0: -1.55, y1: 1.35 } as const;

let outline: { head: Seg[]; brain: Seg[] } | null = null;

/** The head and brain seen from the side, as the scanner's side map and the report draw them. Worked out once. */
export function headOutline(): { head: Seg[]; brain: Seg[] } {
  const { z0, z1, y0, y1 } = OUTLINE_BOX;
  outline ??= {
    head: contour((z, y) => headSdf(0, y, z), z0, z1, y0, y1, 0.018),
    brain: contour((z, y) => brainSdf(0.25, y, z), z0, z1, y0, y1, 0.014),
  };
  return outline;
}
