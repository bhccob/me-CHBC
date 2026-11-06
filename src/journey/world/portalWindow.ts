import { ramp } from '../math';

/**
 * The opening in the machine, where you already see the live tunnel. Pure: no three.
 * From frame 336 the tunnel is drawn too, and shows inside a circle at the iris, under the machine's own picture. By 372 the
 * camera is inside the sleeve, the machine is gone, and the canvas is the tunnel alone.
 */

export function irisWindowOn(f: number): boolean {
  return f >= 336 && f < 372;
}

export function canvasOpaque(f: number): boolean {
  return f >= 372;
}

/** How far the circle has opened as the shield goes, 0 to 1. */
export function windowReach(f: number): number {
  return ramp(f, 336, 340);
}
