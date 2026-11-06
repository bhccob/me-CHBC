import { CatmullRomCurve3, Vector3 } from 'three';
import { clamp, ease, mix, ramp } from '../../math';
import type { Timeline } from '../../timeline';

/**
 * Past the portal: you come out of its far end, swing round to see it from outside, then follow a gold line home. The way
 * is drawn for a flight of 180 and stands behind a longer one, shifted back by the difference.
 */

const BASE_END = 180;

/** The mirror floor. */
export const FLOOR = -7;
/** How far before a question you read it. */
export const QREAD = 4.9;

const POINTS: [number, number, number][] = [[0, 0, -180], [0, -0.3, -192], [0.8, -1.4, -206], [5, -3, -219], [14, -4.2, -229], [26, -4.7, -233], [37, -4.8, -227], [44, -4.8, -214], [46, -4.8, -198]];
for (let z = -184; z <= 16; z += 14) POINTS.push([46 + 0.35 * Math.sin(z * 0.08), -4.8, z]);
POINTS.push([46.9, -4.8, 22]);

const curve = new CatmullRomCurve3(POINTS.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
curve.arcLengthDivisions = 3000;
const WHOLE = curve.getLength();

/** The length of the way you travel. A little more of it lies ahead at the end. */
export const VOID_LENGTH = WHOLE - 6;

const tangent = new Vector3();

/** The way at distance `d`, behind a flight of `end`. */
export function voidAt(d: number, out: Vector3, end = BASE_END): Vector3 {
  if (d <= WHOLE) curve.getPointAt(clamp(d / WHOLE), out);
  else {
    curve.getPointAt(1, out);
    out.addScaledVector(curve.getTangentAt(1, tangent), d - WHOLE);
  }
  out.z -= end - BASE_END;
  return out;
}

const probe = new Vector3();

/** The distance along the way at which it reaches a depth, on its long straight. */
function distanceOfDepth(z: number): number {
  let lo = VOID_LENGTH * 0.28;
  let hi = VOID_LENGTH + 6;
  for (let i = 0; i < 48; i++) {
    const m = (lo + hi) / 2;
    voidAt(m, probe);
    if (probe.z < z) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Where the six questions stand. */
export const QUESTION_DISTANCES: readonly number[] = [-140, -114, -88, -62, -36, -10].map(distanceOfDepth);
/** Where the big Q&A stands. */
export const QA_WORD_DISTANCE = distanceOfDepth(-160);
/** Where you look back at the tunnel from. */
export const LOOK_DISTANCE = distanceOfDepth(-204);

const TABLE_SIZE = 3000;
const table = new Float64Array(TABLE_SIZE + 1);
for (let i = 1; i <= TABLE_SIZE; i++) {
  const d = (i / TABLE_SIZE) * VOID_LENGTH;
  let slow = 0.72 * ease(d, LOOK_DISTANCE - 12, LOOK_DISTANCE - 3) * (1 - ease(d, LOOK_DISTANCE + 11, LOOK_DISTANCE + 19));
  for (const q of QUESTION_DISTANCES) {
    const r = q - QREAD;
    slow = Math.max(slow, 0.86 * ease(d, r - 6.5, r - 3) * (1 - ease(d, r + 0.5, r + 2.8)));
  }
  slow = Math.max(slow, 0.7 * ease(d, VOID_LENGTH - 24, VOID_LENGTH - 6));
  table[i] = table[i - 1] + 1 / (1 - 0.9 * slow);
}
for (let i = 1; i <= TABLE_SIZE; i++) table[i] /= table[TABLE_SIZE];

/** The distance along the way, for how far through its frames it is, 0 to 1. Slow to read, slow to look back, never still. */
export function voidDistance(t: number): number {
  let lo = 0;
  let hi = TABLE_SIZE;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (table[m] <= t) lo = m;
    else hi = m;
  }
  const u = (t - table[lo]) / Math.max(1e-9, table[hi] - table[lo]);
  return ((lo + clamp(u)) / TABLE_SIZE) * VOID_LENGTH;
}

const frameOf = (d: number, [from, to]: readonly [number, number]): number => Math.round(from + table[Math.round((d / VOID_LENGTH) * TABLE_SIZE)] * (to - from));

/** The frame each question is read at. */
export function qaReadFrames(tl: Timeline): number[] {
  return QUESTION_DISTANCES.map((q) => frameOf(q - QREAD, tl.void));
}

/** The frame you look back at the tunnel. */
export function lookFrame(tl: Timeline): number {
  return frameOf(LOOK_DISTANCE, tl.void);
}

/** Where the camera is and looks in the void. */
export interface VoidPose {
  place: Vector3;
  look: Vector3;
  T: Vector3;
  R: Vector3;
  U: Vector3;
  roll: number;
  /** How far you have arrived at the end of the way, 0 to 1. */
  arrive: number;
  /** How much of the pointer counts, 0 to 1. */
  sway: number;
  /** How much of the speed still widens the lens. */
  lens: number;
}

const UP = new Vector3(0, 1, 0);
const behind = new Vector3();
const ahead = new Vector3();
const aim = new Vector3();
/** How the camera tips down a little as it arrives, so that the horizon sits low. */
const END_PITCH = Math.atan(0.2 / 7.1);

const endPoint = voidAt(VOID_LENGTH, new Vector3());
const endHeading = voidAt(VOID_LENGTH + 3, new Vector3()).sub(endPoint).setY(0).normalize();
const endForward = endHeading.clone().multiplyScalar(Math.cos(END_PITCH)).add(new Vector3(0, -Math.sin(END_PITCH), 0)).normalize();
const END_LIFT = 10 * Math.tan(END_PITCH);

/** The camera at distance `d` along the way. */
export function voidPose(d: number, end: number, out: VoidPose): VoidPose {
  voidAt(d, out.place, end);
  out.T.subVectors(voidAt(d + 0.5, ahead, end), out.place).normalize();
  out.R.crossVectors(out.T, UP).normalize();
  out.U.crossVectors(out.R, out.T).normalize();

  voidAt(Math.max(0, d - 5), behind, end);
  voidAt(d + 5, ahead, end);
  const turn = new Vector3().subVectors(ahead, out.place).normalize().cross(new Vector3().subVectors(out.place, behind).normalize()).y;

  voidAt(d + 11, out.look, end);
  out.look.y = out.place.y + 0.32;
  // Halfway round, you look back at where you came from.
  const back = ease(d, LOOK_DISTANCE - 10, LOOK_DISTANCE - 1) * (1 - ease(d, LOOK_DISTANCE + 12, LOOK_DISTANCE + 24));
  out.look.lerp(aim.set(0, -1, -(end * 92) / BASE_END), back);
  out.roll = clamp(turn * 1.1, -0.26, 0.26) * (1 - ease(d, LOOK_DISTANCE - 6, LOOK_DISTANCE + 6));

  // And at the end you stop, looking on along the way.
  out.arrive = ease(d, VOID_LENGTH - 34, VOID_LENGTH - 2);
  aim.copy(out.place).addScaledVector(endForward, 10);
  aim.y += END_LIFT;
  out.look.lerp(aim, out.arrive);

  out.sway = 1 - 0.94 * ease(d, VOID_LENGTH - 34, VOID_LENGTH - 4);
  out.lens = 1 - ease(d, VOID_LENGTH - 30, VOID_LENGTH - 8);
  return out;
}

/** How far through the void the frame is, as a distance along the way; none before it starts. */
export function voidDistanceAt(f: number, tl: Timeline): number {
  return f > tl.void[0] ? voidDistance(ramp(f, tl.void[0], tl.void[1])) : 0;
}

/** The lens at the end of the way. */
export const endFov = (phone: boolean): number => (phone ? 68 : 52);

/** How much of the tunnel's own look gives way to the void's, 0 to 1. */
export function voidOpening(f: number, tl: Timeline): number {
  return ease(f, tl.void[0] - 8, tl.void[0] + 12);
}

/** How far the tunnel's walls reach before they fade. */
export const wallReach = (opening: number): number => mix(92, 520, opening);
