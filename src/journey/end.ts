import { ease, ramp } from './math';
import type { Timeline } from './timeline';

/** The end page, as the page keeps time with it. Pure: no three, no DOM. */

const DEG = Math.PI / 180;

/** How far the cursor swings the camera round the centre: `mx` and `my` run from -1 to 1. */
export function orbitAngles(mx: number, my: number): { yaw: number; pitch: number } {
  return { yaw: mx === 0 ? 0 : mx * 26 * DEG, pitch: my === 0 ? 0 : my * 15 * DEG };
}

/** What a finger means once it has moved: more sideways than down moves the view; the rest scrolls. */
export function touchPlan(dx: number, dy: number): 'orbit' | 'scroll' {
  return Math.abs(dx) > Math.abs(dy) ? 'orbit' : 'scroll';
}

/** With no cursor, a gentle slow drift in its place, at `t` seconds. */
export function driftAngles(t: number): { yaw: number; pitch: number } {
  return { yaw: 16 * DEG * Math.sin(t * 0.17), pitch: 8 * DEG * Math.sin(t * 0.11 + 1) };
}

/** How far a pointer's -1 to 1 swings each way: to turn an angle back into one. */
export const ORBIT_YAW = 26 * DEG;
export const ORBIT_PITCH = 15 * DEG;

/** How far out the ring stands: past the page's edges, so that only its corners show and the words have the middle. */
const RING_OUT = 1.85;

/** Where the ring's inner edge reaches, as a share of half the view's height: further on a wide page than on a phone. */
export function ringReach(phone: boolean): number {
  return (phone ? 0.74 : 1.14) * RING_OUT;
}

/** The most galaxies of your own the page keeps. */
export const MAX_GALAXIES = 8;

/** The list with a new one, the oldest gone if it has grown too long. */
export function addGalaxy<T>(list: readonly T[], galaxy: T): T[] {
  return [...list, galaxy].slice(-MAX_GALAXIES);
}

export interface EndWordsLayer {
  /** Whether the page shows at all. */
  page: number;
  /** "Let's talk." pulling itself together out of the blast. */
  word: { opacity: number; blur: number; spacing: number };
  /** Whether the rest of the words have come. */
  rise: boolean;
}

/** The words at frame `f`. `shift` is how far a longer flight moves them. */
export function endWordsAt(f: number, shift = 0): EndWordsLayer {
  const q = ease(f, 893 + shift, 919 + shift);
  return {
    page: f > 892 + shift ? 1 : 0,
    word: { opacity: q, blur: q < 0.995 ? (1 - q) * 22 : 0, spacing: 0.42 + (-0.03 - 0.42) * q },
    rise: f > 912 + shift,
  };
}

/** Whether a press now can start a universe: once the bang has nearly settled. */
export function canHold(f: number, tl: Timeline): boolean {
  return ramp(f, tl.bang[0], tl.bang[1]) >= 0.8;
}
