/** The Lock cursor, Bob's pick: four gold corners and a small dot, with no trail. What it does, pure. */

/** What the corners close around, and fields, which keep their own text cursor. */
export const HOVERABLE = 'a,button,[data-jump],input,textarea,select';

/** How far the corners pinch in when pressed, px. */
export const PINCH = 4;

/** Above this the corners only widen: too big to frame. */
const FRAME_WIDTH = 560;
const FRAME_HEIGHT = 200;

export interface LockTarget {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  len: number;
  locked: boolean;
}

export function lockTarget({ px, py, screen, rect }: { px: number; py: number; screen: boolean; rect: { left: number; top: number; width: number; height: number } | null }): LockTarget {
  if (screen) return { cx: px, cy: py, hw: 50, hh: 32, len: 12, locked: false };
  if (rect) {
    if (rect.width > 0 && rect.width < FRAME_WIDTH && rect.height < FRAME_HEIGHT) {
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, hw: rect.width / 2 + 9, hh: rect.height / 2 + 7, len: 9, locked: true };
    }
    return { cx: px, cy: py, hw: 20, hh: 20, len: 8, locked: false };
  }
  return { cx: px, cy: py, hw: 13, hh: 13, len: 6, locked: false };
}

/** A corner's spring: the ones on the leading side keep up, the trailing ones come late, so the frame stretches as it moves. */
export function cornerStiffness(sx: number, sy: number, dirX: number, dirY: number, motion: number, locked: boolean): number {
  const lead = (sx * dirX + sy * dirY) * 0.707 * motion;
  return (locked ? 480 : 330) + 230 * lead;
}

/** On a mouse only, and not with reduced motion. */
export function cursorOn(finePointer: boolean, hover: boolean, reduced: boolean): boolean {
  return finePointer && hover && !reduced;
}

/** Moves a spring on by `dt` seconds. */
export function springStep(o: { x: number; v: number }, to: number, stiffness: number, damping: number, dt: number): number {
  o.v += (stiffness * (to - o.x) - 2 * Math.sqrt(stiffness) * damping * o.v) * dt;
  o.x += o.v * dt;
  return o.x;
}
