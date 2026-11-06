import { clamp, ramp } from '../math';

/**
 * What plays where on the scroll, as Bob approved it by ear on 2026-11-06: no music before the ending, the sounds of the
 * machine, the portal's one rush, and the way into Let's talk. Frames after the flight move along by `shift` when more
 * projects make it longer. Pure: no audio.
 */

/** Hits and runs are skipped at this many frames a second or more: a long jump plays nothing. */
const JUMP_FRAMES_PER_SECOND = 170;
/** How much softer the machine sounds going back. */
const BACK_LEVEL = 0.42;
/** The last frame of the machine's part of the scroll: anything after it moves with the flight's length. */
const FLIGHT_START = 566;

export type HitName =
  | 'wake' | 'code-drop' | 'code-on' | 'code-land' | 'pad-drop' | 'pad-land' | 'pad-a' | 'pad-b'
  | 'armour-move' | 'wall-1' | 'lid-move' | 'wall-2' | 'wall-3' | 'wall-4' | 'lid-seat' | 'lock'
  | 'ring-spin' | 'legs-slide' | 'ring-seat' | 'drive-1' | 'drive-2' | 'drive-3' | 'legs-seat' | 'stand-up' | 'stands'
  | 'stack-open' | 'stack-stop' | 'stack-1' | 'stack-2' | 'stack-3' | 'stack-4' | 'shield-off' | 'iris-open'
  | 'break' | 'break-end' | 'qa-word' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6';

export const HITS: readonly (readonly [number, HitName])[] = [
  [8, 'wake'],
  [52, 'code-drop'], [70, 'code-on'], [74, 'code-land'],
  [104, 'pad-drop'], [128, 'pad-land'], [131, 'pad-a'], [133, 'pad-b'],
  [156, 'armour-move'], [174, 'wall-1'], [176, 'lid-move'], [177, 'wall-2'], [180, 'wall-3'], [183, 'wall-4'], [194, 'lid-seat'], [198, 'lock'],
  [208, 'ring-spin'], [212, 'legs-slide'], [220, 'ring-seat'], [224, 'drive-1'], [226, 'drive-2'], [228, 'drive-3'], [236, 'legs-seat'], [240, 'stand-up'], [262, 'stands'],
  [278, 'stack-open'], [296, 'stack-stop'], [318, 'stack-1'], [321, 'stack-2'], [324, 'stack-3'], [326, 'stack-4'],
  [333, 'shield-off'], [356, 'iris-open'],
  [630, 'break'], [668, 'qa-word'], [688, 'break-end'], [701, 'q1'], [730, 'q2'], [759, 'q3'], [789, 'q4'], [818, 'q5'], [847, 'q6'],
];

export type RunName = 'typing' | 'iris-teeth' | 'wires' | 'gears';

export const RUNS: readonly { a: number; b: number; every: number; name: RunName }[] = [
  { a: 72, b: 96, every: 1.5, name: 'typing' },
  { a: 338, b: 356, every: 1.1, name: 'iris-teeth' },
  { a: 630, b: 690, every: 1.1, name: 'wires' },
  { a: 692, b: 858, every: 1.7, name: 'gears' },
];

/** Where parts are moving, so the motor runs only then and only while the visitor scrolls. */
export const MOVES: readonly (readonly [number, number])[] = [[52, 76], [104, 130], [156, 196], [208, 262], [276, 296], [312, 326], [332, 356]];

const moved = (frame: number, shift: number): number => (frame >= FLIGHT_START ? frame + shift : frame);

/** The parts the scroll has just passed. */
export function dueHits(prev: number, f: number, framesPerSec: number, shift = 0): { name: HitName; level: number }[] {
  if (framesPerSec >= JUMP_FRAMES_PER_SECOND || f === prev) return [];
  const level = f > prev ? 1 : BACK_LEVEL, lo = Math.min(prev, f), hi = Math.max(prev, f);
  return HITS.filter(([at]) => lo < moved(at, shift) && hi >= moved(at, shift)).map(([, name]) => ({ name, level }));
}

/** The runs with a new tick since the last frame, and the frame each stands at. */
export function dueRuns(prev: number, f: number, framesPerSec: number, shift = 0): { name: RunName; level: number; at: number }[] {
  if (framesPerSec >= JUMP_FRAMES_PER_SECOND || f === prev) return [];
  const level = f > prev ? 1 : BACK_LEVEL, lo = Math.min(prev, f), hi = Math.max(prev, f);
  const due: { name: RunName; level: number; at: number }[] = [];
  for (const run of RUNS) {
    const a = moved(run.a, shift), b = moved(run.b, shift);
    if (hi < a || lo > b) continue;
    if (Math.floor((clamp(lo, a, b) - a) / run.every) !== Math.floor((clamp(hi, a, b) - a) / run.every)) due.push({ name: run.name, level, at: clamp(hi, a, b) });
  }
  return due;
}

/** The two sounds of the way into Let's talk, going forward only. */
export function dueEnding(prev: number, f: number, shift = 0): ('fall' | 'bang')[] {
  if (f <= prev) return [];
  const due: ('fall' | 'bang')[] = [];
  if (prev < 860 + shift && f >= 860 + shift) due.push('fall');
  if (prev < 881 + shift && f >= 881 + shift) due.push('bang');
  return due;
}

export function motorLevel(f: number): number {
  let moving = 0;
  for (const [a, b] of MOVES) moving = Math.max(moving, ramp(f, a, a + 2) * (1 - ramp(f, b - 2, b)));
  return moving;
}

export function motorOn(f: number, framesPerSec: number): boolean {
  return framesPerSec > 0 && motorLevel(f) > 0;
}

/** The machine's hum: quiet at first, fuller as it gets built, gone in the flight, then the power in the gold line. */
export function humLevel(f: number, shift = 0): number {
  return (0.34 + 0.66 * ramp(f, 26, 276)) * (1 - ramp(f, 340, 360)) + 0.6 * ramp(f, 600 + shift, 650 + shift) * (1 - ramp(f, 856 + shift, 880 + shift));
}

/** How much of the flight's sound there is at this frame. */
export function flightLevel(f: number, shift = 0): number {
  return ramp(f, 346, 362) * (1 - ramp(f, 566 + shift, 600 + shift));
}

/** The rush: the flight's one sound, following the scroll's speed, 0 to 1. */
export function rushLevel(f: number, speed: number, shift = 0): number {
  return flightLevel(f, shift) * (0.025 + 0.085 * speed);
}

/** The quiet pad of the end page, and only there. */
export function padLevel(f: number, shift = 0): number {
  return 0.42 * ramp(f, 893 + shift, 926 + shift);
}

/** The sweep that rises into the iris. */
export function risingSweep(f: number): number {
  return ramp(f, 322, 352) * (1 - ramp(f, 352, 368)) * 0.05;
}

/** The scroll's speed as the sounds read it, 0 to 1, from frames a second. */
export function scrollSpeed(framesPerSec: number): number {
  return clamp(framesPerSec / 26);
}

/** Browsers start sound only on a click or a key: after a reload it waits for the next one, if he had sound on. */
export function soundAfterReload(wanted: boolean, gesture: boolean): 'silent' | 'playing' {
  return wanted && gesture ? 'playing' : 'silent';
}
