import type { Locale } from '~/i18n/Translator';
import type { Box } from '../layers';
import { clamp, ease } from '../math';
import type { Readout, StatusKey } from './readout';
import { answerShown, NQ } from './thoughts';

/**
 * The scanner on the page, as numbers: when each part of its frame shows, where the six labels stand, and what the read-out
 * says (spec 2026-11-08 "Into my head", sections 5.2 to 5.7 and 6; mock lines 1544-1579 and 3101-3152). Pure.
 */

const smooth = (a: number, b: number, x: number): number => ease(x, a, b);

/** The frame as a whole: it comes with the scan and goes as the spark leaves the mouth. */
export const hudOpacity = (t: number): number => smooth(0.092, 0.112, t) * (1 - smooth(0.935, 0.955, t));

/** "What's on my mind", while things pour in. */
export const headingOpacity = (t: number): number => smooth(0.145, 0.165, t) * (1 - smooth(0.196, 0.212, t));

/** Thought `k`'s label: one after another as the scanner finds them, gone as you go in. */
export function labelOpacity(t: number, k: number): number {
  const lt = 0.205 + 0.008 * k;
  return smooth(lt, lt + 0.008, t) * (1 - smooth(0.27, 0.288, t));
}

/** The four corners round the head, while it is seen whole. */
export const frameOpacity = (t: number): number => hudOpacity(t) * smooth(0.095, 0.11, t) * (1 - smooth(0.25, 0.29, t));

/** The side map, once you are inside, quiet while you read. */
export const mapOpacity = (t: number, reading: number): number => hudOpacity(t) * smooth(0.27, 0.3, t) * (1 - 0.85 * reading);

/** The read-out, quieter while you read. */
export const readoutOpacity = (t: number, reading: number): number => hudOpacity(t) * (1 - 0.75 * reading);

/** Whether you are inside his head: the ruler is for the outside. */
const insideAt = (t: number): number => smooth(0.302, 0.318, t) * (1 - smooth(0.902, 0.912, t));

export const rulerOpacity = (t: number): number => hudOpacity(t) * (1 - insideAt(t));

/** How far the answer being read shows: the largest of the six, as the 3D works it out. */
export function readingAt(t: number): number {
  let reading = 0;
  for (let i = 0; i < NQ; i++) reading = Math.max(reading, answerShown(t, i));
  return reading;
}

/** The shade that gives an answer the page: as far as it shows. */
export const shadeOpacity = (t: number): number => readingAt(t) * 0.95;

/** The violet glow over his world: with the dark purple ground, from where the flight leaves off. */
export const glowOpacity = (t: number): number => smooth(0, 0.04, t);

/** An answer coming into focus as it shows: a little smaller and blurred, then sharp (mock lines 2977-2987). */
export function cardEntry(shown: number): { scale: number; blur: number } {
  const k = 1 - shown;
  return { scale: 0.94 + 0.06 * (1 - k * k), blur: shown < 0.995 ? k * 6 : 0 };
}

/** The scan's slice, numbered from the neck (0) to the crown (320): `y` in head units. */
export const sliceNumber = (y: number): number => Math.round(((y + 2.15) / 3.55) * 320);

/** The read-out's status in words: `{n}` filled in, one thought said so, numbers as the language writes them. */
export function statusWords(readout: Readout, words: Record<StatusKey | 'foundOne', string>, locale: Locale): string {
  const { status, n } = readout;
  if (status === 'found' && n === 1) return words.foundOne;
  const shown = status === 'thought' ? String(n).padStart(2, '0') : status === 'takingIn' ? new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB').format(n) : String(n);
  return words[status].replace('{n}', shown);
}

/** Where a label stands: its left edge, the line its leader runs along, its top, and the side of the head it is on. */
export interface LabelPlace {
  x: number;
  y: number;
  top: number;
  side: -1 | 1;
}

/** How far apart two labels on one side stand, and how far out from the head's box, in CSS px. */
const LABEL_GAP = 54;
const LABEL_OUT = 56;
const EDGE = 12;

/**
 * Lays the six labels out beside the head (mock `layoutLabels`): each on the side of the head its region shows on, those on
 * one side apart from each other in the order they stand, and every one kept on the page. `points` are the regions on the
 * page, `heights` and `widths` the labels' sizes as drawn.
 */
export function layoutLabels(points: readonly [number, number][], box: Box, pageWidth: number, heights: readonly number[], widths: readonly number[] = heights.map(() => 0)): LabelPlace[] {
  const cx = (box.left + box.right) / 2, half = (box.right - box.left) / 2;
  const out: LabelPlace[] = points.map(([x, y]) => ({ x, y, top: y, side: x < cx ? -1 : 1 }));
  for (const side of [-1, 1] as const) {
    const column = out.map((place, k) => ({ place, k, y: points[k][1] })).filter(({ place }) => place.side === side).sort((a, b) => a.y - b.y);
    let last = -Infinity;
    for (const { place, k, y } of column) {
      const line = Math.max(y, last + LABEL_GAP);
      last = line;
      const w = widths[k] ?? 0;
      const x = side < 0 ? cx - half - LABEL_OUT - w : cx + half + LABEL_OUT;
      place.x = clamp(x, EDGE, Math.max(EDGE, pageWidth - EDGE - w));
      place.y = line;
      place.top = line - (heights[k] ?? 0) / 2;
    }
  }
  return out;
}
