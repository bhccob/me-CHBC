import { Vector3 } from 'three';
import { type FlightLayout, READ } from '../../flight/layout';
import { clamp, ease, ramp } from '../../math';

/** The one curving path the flight follows, and what its place on that path does to the view and the colour. */

export const FLIGHT_FOV = 54;
const PHONE_FOV = 68;
const FOV_AT_FULL_SPEED = 11;
const BANK = 0.14;

export type Rgb = readonly [number, number, number];

/** The tunnel's colour away from every project. */
export const GOLD: Rgb = [1, 0.7, 0.28];

const amp = (s: number, end: number): number => ease(s, 8, 40) * (1 - ease(s, end - 34, end - 10));

/** The middle of the tunnel at distance `s`: straight at both ends, curving between. */
export function center(s: number, end: number, out: Vector3): Vector3 {
  const a = amp(s, end);
  return out.set(a * (6.2 * Math.sin(s * 0.037 + 0.4) + 2 * Math.sin(s * 0.091)), a * (2.6 * Math.sin(s * 0.049 + 1.1) + 0.9 * Math.sin(s * 0.117)), -s);
}

export interface PathFrame {
  p: Vector3;
  T: Vector3;
  R: Vector3;
  U: Vector3;
}

const behind = new Vector3();
const ahead = new Vector3();
const UP = new Vector3(0, 1, 0);

/** The place at `s` with its three square axes: along, right and up. */
export function frameAt(s: number, end: number): PathFrame {
  const p = center(s, end, new Vector3());
  center(s - 0.4, end, behind);
  center(s + 0.4, end, ahead);
  const T = new Vector3().subVectors(ahead, behind).normalize();
  const R = new Vector3().crossVectors(T, UP).normalize();
  const U = new Vector3().crossVectors(R, T).normalize();
  return { p, T, R, U };
}

/** The lens: wider the faster you go. */
export function fovAt(speed: number, phone: boolean): number {
  return (phone ? PHONE_FOV : FLIGHT_FOV) + speed * FOV_AT_FULL_SPEED;
}

/** How far the camera leans into a bend, for the way the path is heading. */
export function bankAt(T: Vector3): number {
  return clamp(-T.x * 0.55, -BANK, BANK);
}

/** The project whose colour the tunnel is taking, and how far, 0 to 1. */
export function nearestStop(s: number, layout: FlightLayout): { index: number; near: number } {
  let index = -1;
  let near = 0;
  layout.stops.forEach((stop, i) => {
    const n = (1 - ramp(stop.s - READ - s, 2, 14)) * (1 - ease(s, stop.s + 2, stop.s + 10));
    if (n > near) {
      index = i;
      near = n;
    }
  });
  return { index, near };
}

/** The tunnel's colour at `s`: gold, turning to each project's own as you near it. */
export function tintAt(s: number, layout: FlightLayout, tints: readonly Rgb[]): Rgb {
  const { index, near } = nearestStop(s, layout);
  if (index < 0) return GOLD;
  const tint = tints[index];
  return [GOLD[0] * (1 - near) + tint[0] * near, GOLD[1] * (1 - near) + tint[1] * near, GOLD[2] * (1 - near) + tint[2] * near];
}

/** The dark behind everything, in linear light: barely the project's colour, a little more when you are at it. */
export function washAt(tint: Rgb, near: number): Rgb {
  const k = 0.3 + near;
  return [0.0016 + tint[0] * 0.0012 * k, 0.0014 + tint[1] * 0.0009 * k, 0.0028 + tint[2] * 0.0014 * k];
}
