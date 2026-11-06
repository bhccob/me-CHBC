import { flashAt, hintOpacity } from './bang';
import { band, ease, ramp } from './math';
import type { Timeline } from './timeline';

/**
 * What each layer of the page does at frame `f`, in one table, from the mock's `frame()`. The loop writes it to the page
 * (src/ui/journey/applyLayers.ts). Pure: no DOM.
 */

export interface Layer {
  opacity: number;
  y?: number;
}

/** A sheet: whether it is up at all, how far below the page it is (vh), its tilt (degrees), and how much of it and its words show. */
export interface SheetLayer {
  on: boolean;
  y: number;
  tilt: number;
  opacity: number;
  inner: number;
}

/** The frames each sheet slides up over. */
export const sheetWindows: readonly (readonly [number, number])[] = [[44, 66], [98, 120], [152, 174], [204, 226]];

function sheetAt(f: number, n: number): SheetLayer {
  const [a, b] = sheetWindows[n];
  const q = ease(f, a, b);
  const last = n === sheetWindows.length - 1;
  const covered = last ? 0 : ramp(f, sheetWindows[n + 1][1], sheetWindows[n + 1][1] + 2);
  const gone = last ? ease(f, 326, 352) : 0;
  return { on: q > 0 && covered < 1 && gone < 1, y: (1 - q) * 112, tilt: (1 - q) * -2.6, opacity: 1 - gone, inner: last ? 1 - ease(f, 272, 288) : 1 };
}

export const TAG_NAMES = ['armour', 'controls', 'brain', 'body'] as const;
export type TagName = (typeof TAG_NAMES)[number];

/** Where a label's box stands on the page, from where it points, how small the machine stands and how the page scales. */
export function tagPlace(name: TagName, [x, y]: readonly [number, number], fit: number, pageScale: number): [number, number] {
  const k = (fit * pageScale) / 1.125;
  const off = name === 'armour' ? [-660 * k, 12] : name === 'body' ? [230 * k, 90] : [0, 0];
  return [x + off[0], y - 8 + off[1]];
}

export interface LayerStates {
  hero: Layer;
  vert: Layer;
  story: Layer;
  /** How far the age has rolled, 0 to 1. */
  age: number;
  /** Whether the paper is drawn: it sits under the sheets once the first one is up. */
  paper: boolean;
  /** How much of the drifting sparks shows. */
  sparks: number;
  sheets: SheetLayer[];
  /** The stack's words and labels. */
  stack: number;
  /** The word over the opening iris. */
  portal: number;
  /** The page's flash at the bang, and the hint beside the waiting light. */
  flash: number;
  hint: number;
}

export function layersAt(f: number, tl: Timeline, _tall: boolean): LayerStates {
  const heroOut = ease(f, 3, 22);
  return {
    hero: { opacity: 1 - heroOut, y: -heroOut * 40 },
    vert: { opacity: 1 - ease(f, 2, 14) },
    story: { opacity: band(f, 16, 24, 46, 54) },
    age: ease(f, 22, 40),
    paper: f < 70,
    sparks: 1 - ease(f, 4, 26),
    sheets: sheetWindows.map((_, n) => sheetAt(f, n)),
    stack: band(f, 280, 292, 312, 322),
    portal: band(f, 338, 344, 354, 360),
    flash: flashAt(f, tl),
    hint: hintOpacity(f, tl.shift),
  };
}
