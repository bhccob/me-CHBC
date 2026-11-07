import { backOut, ease, mix, ramp } from '../math';
import type { PartName } from './parts';

/**
 * How the machine gets built, frame by frame: ported from `pose` in tools/blender/machine.py, proved against what Blender
 * gives at the review frames. Blender's axes stay: Z up. Pure: no three.
 */

export interface PartPose {
  p: [number, number, number];
  r: [number, number, number];
  s: [number, number, number];
  on: boolean;
}

export interface MachinePose {
  parts: Record<PartName, PartPose>;
  /** Glow of the materials the pose changes. */
  emit: { pulse: number; led: number; key: number; code: number };
  /** Energies of the lights, in Blender's watts. */
  lights: { key: number; rim: number; strip: number; low: number; top: number; bench: number; lamp: number };
  /** How much of the code has typed itself, 0 to 1 in sixteenths. */
  typed: number;
  /** Where the stack's four labels point, in the machine's space. */
  labels: Record<'armour' | 'controls' | 'brain' | 'body', [number, number, number]>;
  /** The opening of the iris: its centre and a point on its edge. */
  iris: { center: [number, number, number]; edge: [number, number, number] };
  /** The mist over the far end of the board on the first view, in metres from the camera: where it starts, where it is whole. */
  mist: { near: number; far: number };
}

/** The iris's radius in the lid, a little wider than its hole as the mock had it. */
const IRIS_EDGE = 0.4 * 1.3;

const LZ = 0.6, WALL_Z = 0.23, HIP_Z = 0.05, L1 = 0.78, L2 = 1.05, Z = 0.0178, BLADES = 9;
const POSTS: readonly (readonly [number, number])[] = [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]];
const DRIVE_R = (0.655 + 0.098) * Math.sqrt(0.5);
const DRIVES: readonly (readonly [number, number])[] = [[-DRIVE_R, DRIVE_R], [DRIVE_R, -DRIVE_R]];
const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** The open box: how high the board, the code and the game rise, where the top goes, and how far the lid tips back. */
const OPEN_BOARD = 0.1, OPEN_CODE = 0.55, OPEN_GAME = 1.05, OPEN_LID_TIP = 0.4, POST_DROP = 0.6;
const OPEN_TOP: readonly [number, number, number] = [0, 0.85, 1.35];
/** The walls fold down this far about their feet: nearly flat. */
const WALL_FOLD = 0.96 * (Math.PI / 2);

/** How much of the first view's night is on at frame `f`: all of it while you read, none once the camera has dived in. */
export function nightShare(f: number): number {
  return 1 - ease(f, 4, 30);
}

/** The first view's light, as shares of the build's own: the studio light down, the parts lit from behind. */
const NIGHT_LIGHT = { key: 0.32, rim: 2.2, strip: 0.4, low: 0.3, top: 1, bench: 1.6, lamp: 1 } as const;
/** How fast the light runs along the traces while you read, in frames a second, and how long one lap takes. */
const IDLE_FPS = 6;
const LAP = 1 / 0.024;

/** How far the light on the traces has run on its own after `seconds` on the first view, in frames of a lap. */
export function idleFrames(seconds: number): number {
  return (seconds * IDLE_FPS) % LAP;
}

/** The traces the light runs along on the board, one path for every third trace on each side, as the model has them. */
const SIGNALS: readonly (readonly (readonly [number, number])[])[] = (() => {
  const out: (readonly (readonly [number, number])[])[] = [];
  for (let side = 0; side < 4; side++) {
    const ca = Math.cos((side * Math.PI) / 2), sa = Math.sin((side * Math.PI) / 2);
    for (const k of [-3, 0, 3]) {
      const o = k * 0.026, spread = k * 0.052, run = 0.2 + Math.abs(k) * 0.012;
      const path: readonly (readonly [number, number])[] = [[0.17, o], [run, o], [run + Math.abs(spread - o), spread], [0.6 - (Math.abs(k) % 3) * 0.05, spread]];
      out.push(path.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca] as const));
    }
  }
  return out;
})();

function along(path: readonly (readonly [number, number])[], t: number): [number, number] {
  const lengths = path.slice(1).map((b, i) => Math.hypot(b[0] - path[i][0], b[1] - path[i][1]));
  let s = (t - Math.floor(t)) * lengths.reduce((sum, l) => sum + l, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (s <= lengths[i]) {
      const u = s / Math.max(lengths[i], 1e-6);
      return [mix(path[i][0], path[i + 1][0], u), mix(path[i][1], path[i + 1][1], u)];
    }
    s -= lengths[i];
  }
  return [path[path.length - 1][0], path[path.length - 1][1]];
}

export function machinePose(f: number, idle = 0): MachinePose {
  const parts = {} as Record<PartName, PartPose>;
  const set = (name: PartName, p: PartPose['p'], on: boolean, r: PartPose['r'] = [0, 0, 0], s: PartPose['s'] = [1, 1, 1]): void => {
    parts[name] = { p, r, s, on };
  };

  // Exploded view: the machine opens like a box so you can see inside: the walls fold down, the lid comes off up and back,
  // and the layers rise straight up. Then it shuts.
  const X = ease(f, 276, 296) * (1 - ease(f, 312, 326));
  const closed = f >= 200 && X <= 0.001;
  const topX = OPEN_TOP[0] * X, topY = OPEN_TOP[1] * X, topZ = OPEN_TOP[2] * X;

  // The board wakes. On the first view its light runs along the traces on its own, like the lights of a city at night.
  const wake = ease(f, 6, 26);
  const night = nightShare(f);
  const boardOn = !closed && f < 334;
  set('board', [0, 0, OPEN_BOARD * X], boardOn);
  SIGNALS.forEach((path, i) => {
    const [x, y] = along(path, (f + idle * night) * 0.024 + i * 0.13);
    set(`pulse-${i}` as PartName, [x, y, Z + 0.004], boardOn);
  });

  // Software: the code layer lands and types itself.
  const d = ease(f, 52, 76);
  const codeOn = f >= 50 && !closed && f < 334;
  set('code', [0, 0, mix(1.5, 0.17, d) + OPEN_CODE * X], codeOn);
  const typed = Math.floor(ramp(f, 72, 96) * 16) / 16;
  set('code-cover', [0, -0.55, 0.0178], codeOn, [0, 0, 0], [1, Math.max(1 - typed, 0.0001) * 1.1, 1]);

  // Games: the controller lands on its own layer.
  const g = ease(f, 104, 130);
  set('game', [0, 0, mix(1.8, 0.34, g < 1 ? backOut(g, 0.9) : 1) + OPEN_GAME * X], f >= 102 && !closed && f < 334);

  // Security: armour closes round them, the lid and shield come down.
  // Open, each wall folds down about its foot, so it lies a little further out and nearly flat.
  const fold = WALL_FOLD * X;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, dist = mix(2.8, 0.7, ease(f, 156 + k * 3, 174 + k * 3)) + WALL_Z * Math.sin(fold);
    const r: PartPose['r'] = [k === 0 ? fold : k === 2 ? -fold : 0, k === 1 ? fold : k === 3 ? -fold : 0, a];
    set(`wall${k}` as PartName, [dist * Math.sin(a), -dist * Math.cos(a), WALL_Z * Math.cos(fold)], f >= 154 && f < 372, r);
  }
  POSTS.forEach(([x, y], i) => set(`post-${i}` as PartName, [x, y, mix(1.9, WALL_Z, ease(f, 164 + i, 178 + i)) - POST_DROP * X], f >= 164 && f < 372 && X <= 0.6));
  const lidOn = f >= 174 && f < 372;
  const lidZ = mix(2.4, LZ, ease(f, 176, 196)) + topZ;
  set('lid', [topX, topY, lidZ], lidOn, [-OPEN_LID_TIP * X, 0, 0]);

  // Iris and shield.
  const openness = ease(f, 338, 356);
  for (let k = 0; k < BLADES; k++) {
    const a = (k / BLADES) * Math.PI * 2;
    set(`blade-pivot-${k}` as PartName, [0.56 * Math.cos(a), 0.56 * Math.sin(a), -0.014 + k * 0.0012], lidOn, [0, 0, a + Math.PI + mix(0.2, 1.32, openness)]);
  }
  const capGone = ease(f, 332, 342);
  const capScale = Math.max(1 - capGone, 0.001);
  set('keycap', [0, 0, 0.012], capGone < 1 && f >= 174, [0, 0, capGone * 2.6], [capScale, capScale, 1]);
  set('sleeve', [0, 0, 0], f >= 334 && f < 382);

  // Mechatronics: the gear ring, the drives, then the legs, and it stands.
  const spin = Math.max(f - 218, 0) * 0.016;
  set('turret', [topX, topY, mix(2.2, LZ + 0.05, ease(f, 208, 222)) + topZ], f >= 206 && f < 372, [0, 0, spin]);
  DRIVES.forEach(([bx, by], i) => {
    const on = f >= 208 && f < 372;
    set(`servo-${i}` as PartName, [bx + topX, by + topY, mix(1.8, LZ + 0.03, ease(f, 210 + i * 2, 224 + i * 2)) + topZ], on);
    set(`pinion-${i}` as PartName, [0, 0, 0.02], on, [0, 0, (-spin * 0.655) / 0.108 + 0.11]);
  });
  const u = ease(f, 240, 262);
  const A = radians(mix(84, 22, u)), B = radians(mix(-102, -68, u)), kneeRel = B - A;
  for (let i = 0; i < 4; i++) {
    const on = f >= 212 && f < 372;
    set(`leg${i}` as PartName, [0, 0, 0], on, [0, 0, Math.PI / 4 + (i * Math.PI) / 2]);
    set(`leg${i}-base` as PartName, [mix(5.5, 1.02, ease(f, 212 + i * 4, 236 + i * 2)), 0, HIP_Z], on);
    set(`leg${i}-upper` as PartName, [0, 0, 0], on, [0, -A, 0]);
    set(`leg${i}-lower` as PartName, [0, 0, 0], on, [0, -kneeRel, 0]);
    set(`leg${i}-foot` as PartName, [L2, 0, 0], on, [0, kneeRel + A, 0]);
  }
  const footZ = HIP_Z + L1 * Math.sin(A) + L2 * Math.sin(B) - 0.04;
  const baseZ = mix(-0.019, -0.145, ease(f, 150, 172));
  set('floor', [0, 0, f >= 212 ? Math.min(footZ, baseZ) : baseZ], f < 368);
  set('floor-cover', [0, 0, 0], f < 334);

  const led = 2.8 * ease(f, 190, 202);
  const outside = 1 - ease(f, 362, 370);
  return {
    parts,
    typed,
    labels: {
      armour: [parts.lid.p[0] + 0.78, parts.lid.p[1] - 0.78, lidZ + 0.03],
      controls: [parts.game.p[0] + 0.63, parts.game.p[1] - 0.63, parts.game.p[2]],
      brain: [parts.code.p[0] + 0.63, parts.code.p[1] - 0.63, parts.code.p[2]],
      body: [0.72, -0.72, 0.3],
    },
    iris: { center: [0, 0, lidZ], edge: [IRIS_EDGE, 0, lidZ] },
    emit: {
      pulse: f < 334 ? Math.max(4 * wake, 5 * night) : 14,
      led: f < 356 ? led : mix(led, 1.5, ease(f, 356, 374)),
      key: (6 + 1.4 * Math.sin(f * 0.25)) * ease(f, 188, 200),
      code: 2.6 * ease(f, 68, 74),
    },
    lights: {
      key: 150 * outside * mix(0.55, 1, ease(f, 8, 40)) * mix(1, NIGHT_LIGHT.key, night),
      rim: 78 * outside * mix(0.5, 1, ease(f, 20, 60)) * mix(1, NIGHT_LIGHT.rim, night),
      strip: 42 * outside * mix(0.6, 1, ease(f, 8, 40)) * mix(1, NIGHT_LIGHT.strip, night),
      low: 18 * outside * mix(1, NIGHT_LIGHT.low, night),
      top: 40 * outside * ease(f, 40, 90) * mix(1, NIGHT_LIGHT.top, night),
      bench: 9 * (1 - ease(f, 150, 180)) * mix(0.5, 1, ease(f, 2, 24)) * mix(1, NIGHT_LIGHT.bench, night),
      lamp: 60 * ease(f, 356, 374) * mix(1, NIGHT_LIGHT.lamp, night),
    },
    mist: { near: mix(60, 0.9, night), far: mix(120, 3, night) },
  };
}
