import type { Vector3 } from 'three';
import { ease, ramp } from '../../math';
import type { Timeline } from '../../timeline';
import { endFrame } from '../void/path';

/** After the last question the stars, floor and gold lines all fall into one point of light at the end of the line. */

/** How far on the point lies from where you stop. */
const FALL_DISTANCE = 220;

/** How far everything has fallen, 0 to 1. */
export const collapseShare = (f: number, tl: Timeline): number => ramp(f, tl.collapse[0], tl.collapse[1]);

/** How far the bang has gone, 0 to 1. */
export const bangShare = (f: number, tl: Timeline): number => ramp(f, tl.bang[0], tl.bang[1]);

/** How much of the void's floor and sky is left, for how far it had opened and how far it has fallen. */
export const voidLeftAfter = (opening: number, fall: number): number => opening * (1 - ease(fall, 0.1, 0.72));

/** The point it all falls into. */
export function fallPoint(end: number, out: Vector3): Vector3 {
  const { point, heading } = endFrame(end);
  return out.copy(point).addScaledVector(heading, FALL_DISTANCE);
}
