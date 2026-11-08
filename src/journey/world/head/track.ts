import { CatmullRomCurve3, Matrix4, Vector3 } from 'three';
import { clamp } from '../../math';
import { CAMS, DOWN, DOWN_T, dwellT, holdOf, NQ, THOUGHTS } from '../../head/thoughts';
import { HOLD_IN } from '../../head/time';

/**
 * The camera's one way through Bob's head, from the flight's exit down the shaft, round to his side, into the open skull,
 * past the six thoughts, down to his mouth, and out with the spit to the scan report (mock-up 20's `buildTrack`, the ride
 * branch; spec 2026-11-08 "Into my head", sections 5.1 to 5.10). Keys are in the mock's world, head units times `S`, and
 * `place` stands that world in the tunnel's.
 */

/** The mock's world scale: one head unit is this many world units. */
export const S = 14;

export interface Pose {
  pos: Vector3;
  look: Vector3;
  up: Vector3;
}

const Y = new Vector3(0, 1, 0);
const W = (x: number, y: number, z: number): Vector3 => new Vector3(x * S, y * S, z * S);

/** Where the scan report stands, in the mock's world: the ride ends here, looking on. */
const END_POS = new Vector3(0, -5, 62);
const END_LOOK = new Vector3(0, -5, 110);

/** How far ahead of the flight's exit, and how far below it, the shaft's top stands, in world units. */
const SHAFT_AHEAD = 40;
const SHAFT_DROP = 20;
/** The mock's shaft key at t 0.06, which the way bends down into. */
const SHAFT_KEY = new Vector3(0, 132, 0);

/** A monotone cubic through (xs, ys): the mock's `pchip`. */
function pchip(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  const n = xs.length, h: number[] = [], dl: number[] = [], m: number[] = new Array(n);
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

/** A curve through `points`, reached at `times`: even in space along it, paced in time between the keys (mock `timedCurve`). */
function timedCurve(times: readonly number[], points: readonly Vector3[]): (t: number, out: Vector3) => Vector3 {
  const curve = new CatmullRomCurve3([...points], false, 'centripetal');
  curve.arcLengthDivisions = 6000;
  const lengths = curve.getLengths(6000), total = lengths[lengths.length - 1] || 1;
  const us = points.map((_, i) => lengths[Math.round((i / (points.length - 1)) * 6000)] / total);
  for (let i = 1; i < us.length; i++) us[i] = Math.max(us[i], us[i - 1] + 1e-6);
  const u = pchip(times, us);
  return (t, out) => curve.getPointAt(clamp(u(t)), out);
}

/**
 * Stands the mock's world below and ahead of the flight's exit: its up is the world's up, and its -x is the flight's
 * forward on the level, so the camera's up at the top of the shaft points the way it was flying.
 */
export function headPlace(join: Pose): Matrix4 {
  const forward = join.look.clone().sub(join.pos).setY(0);
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  forward.normalize();
  const x = forward.clone().negate(), z = new Vector3().crossVectors(x, Y).normalize();
  const origin = join.pos.clone().addScaledVector(forward, SHAFT_AHEAD).addScaledVector(Y, -(SHAFT_DROP + SHAFT_KEY.y));
  return new Matrix4().makeBasis(x, Y, z).setPosition(origin);
}

/** The camera's way, as a function of the head's `t`. `phone` stands the camera further back while it looks at the whole head. */
export function buildHeadTrack(join: Pose, place: Matrix4, phone: boolean): (t: number, out: Pose) => Pose {
  const toMock = place.clone().invert();
  const keys: [number, Vector3, Vector3, Vector3][] = [];
  const far = phone ? 1.75 : 1;
  const key = (t: number, p: Vector3 | [number, number, number], l: Vector3 | [number, number, number], u: Vector3 | [number, number, number] = Y): void => {
    const P = p instanceof Vector3 ? p.clone() : new Vector3(...p), L = l instanceof Vector3 ? l.clone() : new Vector3(...l);
    if (far > 1 && t >= 0.12 && t <= 0.265) P.sub(L).multiplyScalar(far).add(L);
    keys.push([t, P, L, u instanceof Vector3 ? u.clone() : new Vector3(...u)]);
  };
  // From the flight's exit, bending down into the shaft over his head.
  const jp = join.pos.clone().applyMatrix4(toMock), jl = join.look.clone().applyMatrix4(toMock), ju = join.up.clone().transformDirection(toMock);
  const down = SHAFT_KEY.clone();
  const bend = jp.clone().lerp(down, 0.55).add(new Vector3(0, SHAFT_DROP * 0.35, 0));
  key(0, jp, jl, ju);
  key(0.03, bend, bend.clone().add(new Vector3(-6, -14, 0)), new Vector3(-1, 0.6, 0).normalize());
  key(0.06, down, [0, 40, 0.01], [-1, 0, 0]);
  // Round to his left side, his face toward the page.
  key(0.1, [5, 66, 0], [0, 12, 0], [-1, 0.1, 0]);
  key(0.135, [28, 36, 2], [0, 8, 0], [-0.55, 0.83, 0]);
  key(0.17, [56, 13, 7], [0, 6, 10]);
  key(0.205, [52, 10, 4], [0, 7, 4]);
  key(0.235, [44, 8, 0], [0, 7, 0]);
  // Up and over, and down into the open skull.
  key(0.26, [28, 22, 2], [0, 8, 1]);
  key(0.282, [11, 26, 3], [0, 9, 2.5]);
  key(0.3, [3, 18, 4], [0.3, 7, 3]);
  const poses = CAMS.map((cam, i) => {
    const P = W(...cam), C = W(...THOUGHTS[i].c);
    const dir = C.clone().sub(P), dist = dir.length();
    dir.normalize();
    const right = new Vector3().crossVectors(dir, Y).normalize();
    // The thought sits right of centre, its words to the left.
    return { P, look: C.clone().addScaledVector(right, -dist * 0.42) };
  });
  key(0.316, [0.7, 11, 5], poses[0].look.clone().lerp(new Vector3(0.3, 7, 3), 0.4));
  poses.forEach((d, i) => {
    const nextP = i + 1 < poses.length ? poses[i + 1].P : W(...DOWN[0]);
    const u = nextP.clone().sub(d.P).normalize();
    key(dwellT(i) - holdOf(i), d.P.clone().addScaledVector(u, -0.22), d.look);
    key(dwellT(i) + holdOf(i), d.P.clone().addScaledVector(u, 0.22), d.look);
    if (i + 1 < poses.length) {
      const m = W(...CAMS[i]).lerp(W(...CAMS[i + 1]), 0.5).add(i === NQ - 1 ? new Vector3(0.8, 1.4, 0) : new Vector3());
      key((dwellT(i) + dwellT(i + 1)) / 2, m, m.clone().add(nextP.clone().sub(m).normalize().multiplyScalar(8)));
    }
  });
  // The long way down to the mouth, looking where you are going.
  DOWN.forEach((p, i) => {
    const P = W(...p), next = i + 1 < DOWN.length ? W(...DOWN[i + 1]) : W(0, -0.53, 1.2);
    key(DOWN_T[i], P, P.clone().add(next.clone().sub(P).normalize().multiplyScalar(6)));
  });
  // Held in behind the lips while the pressure builds, then the ride out on the spark, slowing as it slows.
  const LIPS = W(0, -0.53, 0.82);
  key(HOLD_IN[0], W(0, -0.53, 0.47), LIPS.clone().add(new Vector3(0, 0, 14)));
  key(HOLD_IN[1], W(0, -0.53, 0.55), LIPS.clone().add(new Vector3(0, 0, 14)));
  key(0.94, LIPS.clone().add(new Vector3(0, 0.6, 4)), LIPS.clone().add(new Vector3(0, 1.5, 50)));
  key(0.946, LIPS.clone().lerp(END_POS, 0.7), END_LOOK.clone());
  key(0.952, END_POS, END_LOOK);
  key(1, END_POS.clone().add(new Vector3(0, 0, 0.01)), END_LOOK);
  const times = keys.map((k) => k[0]);
  const pos = timedCurve(times, keys.map((k) => k[1]));
  const look = timedCurve(times, keys.map((k) => k[2]));
  const up = timedCurve(times, keys.map((k) => k[3]));
  return (t, out) => {
    pos(t, out.pos).applyMatrix4(place);
    look(t, out.look).applyMatrix4(place);
    up(t, out.up).transformDirection(place);
    return out;
  };
}

