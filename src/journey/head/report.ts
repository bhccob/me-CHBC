import { clamp, ease } from '../math';

/**
 * The ending's timing in the head's `t`, on the ending's own clock (spec 2026-11-08 "Into my head", section 5.11): the soft
 * big bang behind the report, and the scan line that opens out of the spark and prints the report as it sweeps down. Pure.
 */

/** The scan line: how much shows, how far it has widened out of the spark, and how far down the report it is (0 to 1). */
export function scanLineAt(t: number): { opacity: number; widen: number; down: number } {
  return { opacity: t < 0.958 ? 0 : 1 - ease(t, 0.986, 0.99), widen: ease(t, 0.958, 0.962), down: clamp((t - 0.962) / 0.024) };
}

/** How much of a row is printed, left to right: the line has to pass its top, `rowTop` as a share of the report's height. */
export function rowShown(t: number, rowTop: number): number {
  return clamp((scanLineAt(t).down - rowTop) / 0.09);
}

/** The report's panel: up before the line moves. */
export const reportFrameOpacity = (t: number): number => ease(t, 0.958, 0.965);

/** How strong the soft big bang is against the Universe ending's: under half (Bob: "not too strong"). */
export const SOFT_BANG = 0.45;

/** The soft big bang: the page's flash (peak 0.22), its three octagon rings (0 to 1 each), and how far the universe has grown. */
export function softBangAt(t: number): { flash: number; rings: [number, number, number]; grow: number } {
  return {
    flash: t < 0.958 ? 0 : Math.exp(-(t - 0.958) / 0.004) * 0.22,
    rings: [0, 1, 2].map((k) => ease(t, 0.959 + 0.003 * k, 0.999)) as [number, number, number],
    grow: ease(t, 0.958, 0.99),
  };
}
