import { Vector3 } from 'three';
import { catmullRom, clamp } from '~/journey/math';

/**
 * LAB ONLY (throwaway). One continuous camera through keyframes: the path is a Catmull-Rom spline through the keys'
 * positions, and the frame-to-key mapping is a monotone cubic, so the camera never stops at a key and never runs back.
 */

export type V3 = readonly [number, number, number];

export interface Shot {
  /** The frame this key is reached at. */
  f: number;
  pos: V3;
  look: V3;
  /** Vertical field of view at 16:9, degrees. */
  fov: number;
  /** Where the lens is focused, world units; the distance to `look` when left out. */
  focus?: number;
  /** How much the background blurs, 0 to about 8 (the effect's bokeh scale). */
  blur?: number;
  roll?: number;
}

/** A monotone cubic through (xs, ys): never overshoots. */
export function pchip(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length;
  if (n === 1) return () => ys[0];
  const h: number[] = [], dl: number[] = [], m: number[] = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    dl[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  m[0] = dl[0];
  m[n - 1] = dl[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (dl[i - 1] * dl[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const t = (x - xs[lo]) / h[lo], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h[lo] * m[lo] + (-2 * t3 + 3 * t2) * ys[lo + 1] + (t3 - t2) * h[lo] * m[lo + 1];
  };
}

export interface RigPose {
  fov: number;
  focus: number;
  blur: number;
  roll: number;
}

export class Rig {
  private readonly shots: readonly Shot[];
  private readonly index: (f: number) => number;
  private readonly fov: (f: number) => number;
  private readonly focus: (f: number) => number;
  private readonly blur: (f: number) => number;
  private readonly roll: (f: number) => number;

  constructor(shots: readonly Shot[]) {
    this.shots = shots;
    const fs = shots.map((s) => s.f);
    this.index = pchip(fs, shots.map((_, i) => i));
    this.fov = pchip(fs, shots.map((s) => s.fov));
    this.focus = pchip(fs, shots.map((s) => s.focus ?? Math.hypot(s.pos[0] - s.look[0], s.pos[1] - s.look[1], s.pos[2] - s.look[2])));
    this.blur = pchip(fs, shots.map((s) => s.blur ?? 0));
    this.roll = pchip(fs, shots.map((s) => s.roll ?? 0));
  }

  private along(u: number, pick: (s: Shot) => V3, out: Vector3): Vector3 {
    const n = this.shots.length;
    const i = Math.min(n - 2, Math.max(0, Math.floor(u)));
    const t = clamp(u - i);
    const at = (k: number): V3 => pick(this.shots[Math.min(n - 1, Math.max(0, k))]);
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    return out.set(catmullRom(a[0], b[0], c[0], d[0], t), catmullRom(a[1], b[1], c[1], d[1], t), catmullRom(a[2], b[2], c[2], d[2], t));
  }

  /** The camera at frame `f`: position and look point into the vectors, the rest returned. */
  at(f: number, pos: Vector3, look: Vector3): RigPose {
    const u = this.index(f);
    this.along(u, (s) => s.pos, pos);
    this.along(u, (s) => s.look, look);
    return { fov: this.fov(f), focus: this.focus(f), blur: Math.max(0, this.blur(f)), roll: this.roll(f) };
  }
}

/**
 * A field of view that keeps most of the 16:9 picture's width on a tall screen, so a phone sees the same subject, a
 * little wider rather than cut down the middle.
 */
export function fovFor(fov16x9: number, aspect: number): number {
  if (aspect >= 1.2) return fov16x9;
  const half = (fov16x9 * Math.PI) / 360;
  const keep = 0.6 + 0.4 * clamp((aspect - 0.45) / 0.75);
  const wide = 2 * Math.atan((Math.tan(half) * (16 / 9) * keep) / aspect);
  return Math.min(84, (wide * 180) / Math.PI);
}
