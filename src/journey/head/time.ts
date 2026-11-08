import { clamp } from '../math';
import type { Timeline } from '../timeline';

/**
 * The head's own time `t`, 0 to 1, from the frames after the flight, at mock-up 20's pace: slow through the scan and the
 * trip to the mouth, as Bob asked. And the ending's own clock, which runs on time from the spit so its sound stays in step
 * (spec 2026-11-08 "Into my head", section 4). Pure: no three, no DOM.
 */

/** The head journey's frames: the mock's 28,500 px track at 30.6 px a frame. */
export const HEAD_FRAMES = 930;

/** The mock's pace: (share of the head's scroll, t), joined by a monotone cubic. */
export const SLOW: readonly (readonly [number, number])[] = [[0, 0], [0.082, 0.09], [0.4, 0.335], [0.95, 0.885], [0.979, 0.932], [1, 1]];

/** The spit: from here the ending runs on its clock. */
export const SPIT_T = 0.932;
/** Held in behind the lips while the pressure builds. */
export const HOLD_IN = [0.885, 0.93] as const;
/** How long the ending takes from the spit, seconds. */
export const FINALE_S = 4.8;
/** How far above the spit the scroll must go back before the clock rewinds. */
const REWIND = 0.004;

/** A monotone cubic through the points (the mock's `pchip`): it never overshoots, so `t` never runs back. */
function pchip(points: readonly (readonly [number, number])[]): (x: number) => number {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]), n = xs.length;
  const h: number[] = [], dl: number[] = [], m: number[] = new Array(n);
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

const pace = pchip(SLOW);

/** `t` at frame `f` of a head journey standing at `head`. */
export function headTIn(f: number, head: readonly [number, number]): number {
  return pace(clamp((f - head[0]) / (head[1] - head[0])));
}

/** The frame of a head journey standing at `head` where `t` falls: `headTIn` the other way. */
export function headFrameIn(t: number, head: readonly [number, number]): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (pace(mid) < t) lo = mid;
    else hi = mid;
  }
  return head[0] + ((lo + hi) / 2) * (head[1] - head[0]);
}

/** The head's `t` at frame `f`: 0 before the head, 1 after it. */
export const headT = (f: number, tl: Pick<Timeline, 'head'>): number => headTIn(f, tl.head);

/** The frame where the head's `t` falls. */
export const headFrame = (t: number, tl: Pick<Timeline, 'head'>): number => headFrameIn(t, tl.head);

/** The ending's clock: when, in seconds, the scroll reached the spit; null until it does. */
export interface EndClock {
  at: number | null;
}

/**
 * The `t` everything reads. Before the spit it is the scroll's. From the spit it runs on time over `FINALE_S`, whatever the
 * scroll does, and it rewinds once the scroll goes back above the spit. Arriving by a jump (Contact, a reload) lands
 * finished. Changes `clock`.
 */
export function endClock(clock: EndClock, tScroll: number, nowS: number, jumped: boolean): number {
  if (tScroll < SPIT_T - REWIND) {
    clock.at = null;
    return tScroll;
  }
  if (tScroll >= SPIT_T && clock.at === null) clock.at = jumped ? nowS - FINALE_S : nowS;
  if (clock.at === null) return tScroll;
  return SPIT_T + (1 - SPIT_T) * clamp((nowS - clock.at) / FINALE_S);
}
