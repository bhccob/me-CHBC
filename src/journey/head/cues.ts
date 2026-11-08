import { ease } from '../math';
import { scanLineAt } from './report';
import { DOWN_T, dwellT, holdOf } from './thoughts';
import { HOLD_IN, SPIT_T } from './time';

/**
 * Every sound of the head journey, at its place in the head's `t` (spec 2026-11-08 "Into my head", section 6a; mock
 * `draw()`'s sound block). Before the spit `t` follows the scroll; from the spit it runs on the ending's clock, so the
 * ending's sounds stay in step with its picture. Pure: no audio.
 */

export type HeadCue = 'scan' | 'lid' | 'label' | 'dive' | 'thought' | 'corridor' | 'down' | 'spit' | 'gather' | 'softBang' | 'print' | 'printTitle';

export const HEAD_CUES: readonly { t: number; cue: HeadCue; n: number }[] = [
  { t: 0.093, cue: 'scan', n: 0 },
  { t: 0.115, cue: 'lid', n: 0 },
  ...[0, 1, 2, 3, 4, 5].map((k) => ({ t: 0.205 + 0.008 * k, cue: 'label' as const, n: k })),
  { t: 0.3, cue: 'dive', n: 0 },
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: dwellT(i) - holdOf(i) - 0.008, cue: 'thought' as const, n: i })),
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: (dwellT(i) + dwellT(i + 1)) / 2 - 0.012, cue: 'corridor' as const, n: i })),
  ...DOWN_T.map((at, i) => ({ t: at - 0.006, cue: 'down' as const, n: i })),
  { t: SPIT_T, cue: 'spit', n: 0 },
  { t: 0.95, cue: 'gather', n: 0 },
  { t: 0.958, cue: 'softBang', n: 0 },
].sort((a, b) => a.t - b.t);

/** The cues passed from `prevT` to `t`: going forward only, and none on a jump, which would play them all at once. */
export function dueCues(prevT: number, t: number, jumped: boolean): { cue: HeadCue; n: number }[] {
  if (jumped || t <= prevT) return [];
  return HEAD_CUES.filter((c) => prevT < c.t && t >= c.t).map(({ cue, n }) => ({ cue, n }));
}

/**
 * The report's rows the scan line has just reached: a tick each, and a ping for the title's row. `rowTops` are each row's
 * top as a share of the report's height, measured by the page.
 */
export function printCues(prevT: number, t: number, rowTops: readonly number[], titleRow: number): { cue: 'print' | 'printTitle'; n: number }[] {
  if (t <= prevT) return [];
  const from = scanLineAt(prevT).down, to = scanLineAt(t).down;
  return rowTops.flatMap((top, n) => (from < top && to >= top ? [{ cue: n === titleRow ? ('printTitle' as const) : ('print' as const), n }] : []));
}

/** The pressure behind the lips: it builds while he holds it in, and goes at the spit. */
export const pressureAt = (t: number): number => ease(t, HOLD_IN[0], HOLD_IN[1]) * (1 - ease(t, SPIT_T, SPIT_T + 0.004));
