import { catmullRom, ease, ez, mix, ramp } from '../math';

/**
 * The camera on the machine, ported from `place_camera` and `CAM` in tools/blender/machine.py. Blender's axes stay: this
 * world runs with Z up. Pure: no three.
 */

export type Vec3 = [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  /** Lens in mm on a 36 mm sensor, as in Blender. */
  lens: number;
  fstop: number;
  /** How far the camera is focused, the distance to its target. */
  focus: number;
  /** Blender's shift_x: film sideways, in sensor widths, so the machine stands to the right of the words. */
  shift: number;
  /** Radians about the view axis, once in the tunnel. */
  roll: number;
}

// frame, position, target, lens, f-stop, sideways shift
const CAM: readonly (readonly [number, Vec3, Vec3, number, number, number])[] = [
  [0, [1.3, -2.25, 1.65], [0.0, 0.0, 0.0], 50, 7.0, -0.24],
  [12, [1.2, -2.1, 1.52], [0.0, 0.0, 0.0], 50, 7.0, -0.24],
  [34, [0.36, -0.48, 0.21], [0.02, 0.02, 0.03], 60, 2.6, -0.15],
  [48, [0.56, -0.8, 0.44], [0.0, 0.0, 0.04], 55, 3.2, -0.16],
  [72, [1.22, -1.95, 1.5], [0.0, 0.0, 0.1], 50, 5.0, -0.16],
  [100, [1.02, -2.15, 1.75], [0.0, 0.0, 0.14], 50, 6.0, -0.16],
  [126, [-1.05, -2.25, 1.95], [0.0, 0.0, 0.24], 50, 6.0, -0.16],
  [154, [-1.3, -2.55, 2.05], [0.0, 0.0, 0.24], 50, 7.0, -0.16],
  [180, [-2.0, -3.2, 1.8], [0.0, 0.0, 0.24], 50, 8.0, -0.11],
  [206, [-2.4, -3.35, 1.9], [0.0, 0.0, 0.24], 50, 9.0, -0.11],
  [240, [-3.7, -3.5, 1.65], [0.0, 0.0, 0.05], 45, 9.0, -0.1],
  [262, [-4.7, -2.9, 1.2], [0.0, 0.0, -0.06], 40, 10.0, -0.09],
  [274, [-4.5, -3.3, 1.35], [0.0, 0.0, -0.04], 40, 10.0, -0.09],
  [296, [-3.8, -5.3, 4.5], [0.75, -1.15, 0.85], 38, 14.0, -0.04],
  [312, [-3.8, -5.3, 4.5], [0.75, -1.15, 0.85], 38, 14.0, -0.04],
  [328, [-3.9, -3.0, 1.4], [0.0, 0.0, 0.0], 40, 10.0, -0.04],
  [344, [-1.1, -1.3, 4.0], [0.0, 0.0, 0.5], 40, 12.0, 0.0],
  [356, [0.0, -0.05, 2.0], [0.0, 0.0, 0.3], 42, 14.0, 0.0],
];

const TUNNEL: readonly (readonly [number, number])[] = [[356, 2.0], [364, 0.4], [370, -1.3], [378, -5.0], [388, -7.7], [400, -8.2]];

/** The Catmull-Rom spline through the keys' values at `f`. */
function spline(f: number, value: (key: (typeof CAM)[number]) => number): number {
  if (f <= CAM[0][0]) return value(CAM[0]);
  for (let i = 0; i < CAM.length - 1; i++) {
    const a = CAM[i], b = CAM[i + 1];
    if (f <= b[0]) return catmullRom(value(CAM[Math.max(i - 1, 0)]), value(a), value(b), value(CAM[Math.min(i + 2, CAM.length - 1)]), (f - a[0]) / (b[0] - a[0]));
  }
  return value(CAM[CAM.length - 1]);
}

function tunnelZ(f: number): number {
  for (let i = 0; i < TUNNEL.length - 1; i++) {
    const [a, za] = TUNNEL[i], [b, zb] = TUNNEL[i + 1];
    if (f <= b) return mix(za, zb, a >= 370 ? ez(ramp(f, a, b)) : ramp(f, a, b) ** 1.5);
  }
  return TUNNEL[TUNNEL.length - 1][1];
}

const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

export function cameraPose(f: number): CameraPose {
  let position: Vec3, target: Vec3, lens: number, fstop: number, shift: number;
  if (f <= 356) {
    position = [spline(f, (k) => k[1][0]), spline(f, (k) => k[1][1]), spline(f, (k) => k[1][2])];
    target = [spline(f, (k) => k[2][0]), spline(f, (k) => k[2][1]), spline(f, (k) => k[2][2])];
    lens = spline(f, (k) => k[3]);
    fstop = spline(f, (k) => k[4]);
    shift = spline(f, (k) => k[5]);
  } else {
    const z = tunnelZ(f), wob = ease(f, 370, 386);
    position = [Math.sin(f * 0.07) * 0.12 * wob, Math.cos(f * 0.053) * 0.08 * wob - 0.05 * (1 - wob), z];
    target = [Math.sin(f * 0.07) * 0.04 * wob, 0, z - 4];
    lens = mix(42, 32, ease(f, 356, 378));
    fstop = 22;
    shift = 0;
  }
  const k = ease(f, 328, 356);
  const raw: Vec3 = [0, k, 1 - k], rawLength = length(raw);
  let up: Vec3 = [raw[0] / rawLength, raw[1] / rawLength, raw[2] / rawLength];
  const d: Vec3 = [target[0] - position[0], target[1] - position[1], target[2] - position[2]], focus = length(d);
  if (Math.abs((d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / focus) > 0.995) up = [0, 1, 0];
  const roll = f > 356 ? Math.sin(f * 0.04) * 0.03 * ease(f, 370, 386) : 0;
  return { position, target, up, lens, fstop, focus, shift, roll };
}

/** The flipbook's 16:9 frame, which the page covered as an image covers a box. */
const FRAME_ASPECT = 16 / 9;
const SENSOR_HALF = 18;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * The vertical field of view, degrees, for a lens on a page of this shape, cropping as the flipbook did: a wider page loses
 * top and bottom, a narrower one the sides, and a tall one shows the frame at 1.5 times its width.
 */
export function fovFor(lens: number, aspect: number): number {
  const across = SENSOR_HALF / lens;
  if (aspect < 1) return toDegrees(2 * Math.atan(across / 1.5 / aspect));
  return toDegrees(2 * Math.atan(across / Math.max(aspect, FRAME_ASPECT)));
}

const FIT: readonly (readonly [number, number])[] = [[0, 0.9], [34, 1], [48, 1], [64, 0.84], [168, 0.84], [184, 0.76], [208, 0.76], [228, 0.84], [270, 0.84], [292, 0.94], [314, 0.94], [344, 1], [502, 1]];

/** How much smaller than the page's cover the machine stands at frame `f`, so that it leaves the words room. */
export function pageFit(f: number, aspect: number): number {
  if (aspect < 1) return 1;
  if (f > 600) return 0.76;
  for (let i = 1; i < FIT.length; i++) if (f <= FIT[i][0]) return mix(FIT[i - 1][1], FIT[i][1], ease(f, FIT[i - 1][0], FIT[i][0]));
  return 1;
}

/** The point the page fit scales about, in NDC: the right edge, 62% down. */
const FIT_X = 1;
const FIT_Y = -0.24;
/** Where a tall page centres the frame instead: a seventh of the width to the left, 60% down. */
const TALL_X = -0.28;
const TALL_Y = -0.2;

/**
 * Puts the film shift, the page fit and a tall page's offset into a projection matrix (three's column order), in place.
 * A shift moves the picture across by twice its value in NDC; a scale leaves the anchor where it is.
 */
export function fitProjection(m: number[], shift: number, scale: number, aspect: number): void {
  m[0] *= scale;
  m[5] *= scale;
  m[8] = scale * 2 * shift - FIT_X * (1 - scale) - (aspect < 1 ? TALL_X : 0);
  m[9] = -FIT_Y * (1 - scale) - (aspect < 1 ? TALL_Y : 0);
}
