import { mix } from '../math';
import type { ObjectKind } from './thoughts';

/**
 * The six objects of light, one for each answer, drawn in gold lines (mock-up 20's `OBJECTS`; spec 2026-11-08 "Into my
 * head", section 5.7). Each is a list of line segments in a unit box, with a brightness for each segment. Pure: no three.
 */

type P = [number, number, number];
type Seg = (a: P, b: P, k?: number) => void;
type Circle = (c: P, r: number, axis: 'x' | 'y' | 'z', n?: number, k?: number) => void;

const DRAW: Record<ObjectKind, (seg: Seg, circle: Circle) => void> = {
  // Plans: a graduation cap.
  cap: (seg, circle) => {
    const top = 0.12, w = 0.62, sq: P[] = [[w, top, 0], [0, top, w], [-w, top, 0], [0, top, -w]];
    for (let i = 0; i < 4; i++) seg(sq[i], sq[(i + 1) % 4]);
    circle([0, top - 0.02, 0], 0.3, 'y');
    circle([0, -0.22, 0], 0.32, 'y');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      seg([Math.cos(a) * 0.3, top - 0.02, Math.sin(a) * 0.3], [Math.cos(a) * 0.32, -0.22, Math.sin(a) * 0.32], 0.6);
    }
    seg([0, top + 0.02, 0], [w * 0.72, top, 0.03]);
    seg([w * 0.72, top, 0.03], [w * 0.74, top - 0.42, 0.03]);
    circle([w * 0.74, top - 0.46, 0.03], 0.04, 'z', 10);
  },
  // Career: a rocket, for the company he wants to start.
  rocket: (seg, circle) => {
    for (const y of [-0.38, 0.0, 0.3]) circle([0, y, 0], 0.17, 'y', 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, x = Math.cos(a) * 0.17, z = Math.sin(a) * 0.17;
      seg([x, -0.38, z], [x, 0.3, z], 0.7);
      seg([x, 0.3, z], [0, 0.68, 0]);
    }
    circle([0, 0.08, 0.17], 0.07, 'z', 16);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5, x = Math.cos(a), z = Math.sin(a);
      seg([x * 0.17, -0.12, z * 0.17], [x * 0.38, -0.46, z * 0.38]);
      seg([x * 0.38, -0.46, z * 0.38], [x * 0.17, -0.38, z * 0.17]);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      seg([Math.cos(a) * 0.1, -0.4, Math.sin(a) * 0.1], [Math.cos(a) * 0.03, -0.72 - (i % 2) * 0.12, Math.sin(a) * 0.03], 0.8);
    }
  },
  // Hobbies: a barbell.
  barbell: (seg, circle) => {
    seg([-0.85, 0, 0], [0.85, 0, 0]);
    for (const k of [-1, 1]) {
      circle([k * 0.5, 0, 0], 0.36, 'x', 36);
      circle([k * 0.58, 0, 0], 0.36, 'x', 36, 0.6);
      circle([k * 0.66, 0, 0], 0.26, 'x', 30);
      circle([k * 0.42, 0, 0], 0.07, 'x', 12);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        seg([k * 0.5, Math.cos(a) * 0.36, Math.sin(a) * 0.36], [k * 0.58, Math.cos(a) * 0.36, Math.sin(a) * 0.36], 0.5);
      }
    }
  },
  // Places: a globe, Aruba to Rotterdam.
  globe: (seg, circle) => {
    const R = 0.52;
    for (let m = 0; m < 4; m++) {
      const a = (m / 4) * Math.PI, p = (u: number): P => [Math.cos(u) * R * Math.cos(a), Math.sin(u) * R, Math.cos(u) * R * Math.sin(a)];
      for (let i = 0; i < 40; i++) seg(p((i / 40) * Math.PI * 2), p(((i + 1) / 40) * Math.PI * 2), 0.5);
    }
    for (const lat of [-0.5, 0, 0.5]) circle([0, Math.sin(lat) * R, 0], Math.cos(lat) * R, 'y', 40, 0.5);
    const ll = (lat: number, lon: number, r = R): P => {
      const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
      return [Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r];
    };
    let prev: P | null = null;
    for (let i = 0; i <= 30; i++) {
      const f = i / 30, p = ll(mix(12.5, 51.9, f), mix(-70, 4.5, f), R * (1 + 0.28 * Math.sin(Math.PI * f)));
      if (prev) seg(prev, p);
      prev = p;
    }
    for (const [la, lo] of [[12.5, -70], [51.9, 4.5]]) circle(ll(la, lo, R * 1.02), 0.05, 'z', 10);
  },
  // Skills: a building block, and code.
  block: (seg, circle) => {
    const h = 0.28, cx = -0.3;
    const v = ([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] as P[]).map(([x, y, z]): P => [cx + x * h, y * h, z * h]);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) seg(v[a], v[b]);
    circle([cx, h + 0.06, 0], 0.11, 'y', 18);
    circle([cx, h, 0], 0.11, 'y', 18, 0.6);
    const X = 0.12;
    seg([X + 0.12, 0.2, 0], [X, 0, 0]);
    seg([X, 0, 0], [X + 0.12, -0.2, 0]);
    seg([X + 0.26, -0.22, 0], [X + 0.36, 0.22, 0]);
    seg([X + 0.5, 0.2, 0], [X + 0.62, 0, 0]);
    seg([X + 0.62, 0, 0], [X + 0.5, -0.2, 0]);
  },
  // This site: a browser window.
  browser: (seg, circle) => {
    const w = 0.62, h = 0.42, r: P[] = [[-w, -h, 0], [w, -h, 0], [w, h, 0], [-w, h, 0]];
    for (let i = 0; i < 4; i++) seg(r[i], r[(i + 1) % 4]);
    seg([-w, h - 0.13, 0], [w, h - 0.13, 0], 0.7);
    for (let i = 0; i < 3; i++) circle([-w + 0.09 + i * 0.09, h - 0.065, 0], 0.025, 'z', 10);
    seg([-w + 0.1, h - 0.27, 0], [0.05, h - 0.27, 0]);
    for (let i = 0; i < 3; i++) seg([-w + 0.1, h - 0.4 - i * 0.1, 0], [w - 0.15 - i * 0.12, h - 0.4 - i * 0.1, 0], 0.55);
  },
};

/** An object's lines: each segment's two ends in `positions` (xyz, xyz), and each end's brightness in `shade`. */
export function objectSegments(kind: ObjectKind): { positions: Float32Array; shade: Float32Array } {
  const pos: number[] = [], shade: number[] = [];
  const seg: Seg = (a, b, k = 1) => {
    pos.push(...a, ...b);
    shade.push(k, k);
  };
  const circle: Circle = (c, r, axis, n = 40, k = 1) => {
    const p = (a: number): P => (axis === 'y' ? [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r] : axis === 'x' ? [c[0], c[1] + Math.cos(a) * r, c[2] + Math.sin(a) * r] : [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]);
    for (let i = 0; i < n; i++) seg(p((i / n) * Math.PI * 2), p(((i + 1) / n) * Math.PI * 2), k);
  };
  DRAW[kind](seg, circle);
  return { positions: Float32Array.from(pos), shade: Float32Array.from(shade) };
}

/** An object as one SVG path in a 100 by 100 box, seen from a little above and to the side: for the calm page. */
export function objectSvgPath(kind: ObjectKind): string {
  const { positions } = objectSegments(kind);
  const yaw = 0.5, pitch = 0.3, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const at = (i: number): string => {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const rx = x * cy + z * sy, rz = -x * sy + z * cy, ry = y * cp - rz * sp;
    return `${(50 + rx * 46).toFixed(1)} ${(50 - ry * 46).toFixed(1)}`;
  };
  let path = '';
  for (let i = 0; i < positions.length; i += 6) path += `M${at(i)}L${at(i + 3)}`;
  return path;
}
