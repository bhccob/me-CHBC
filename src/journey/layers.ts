import { band, ease } from './math';
import type { Timeline } from './timeline';

/**
 * What each layer of the page does at frame `f`, in one table, from the mock's `frame()`. The loop writes it to the page
 * (src/ui/journey/applyLayers.ts). Pure: no DOM.
 */

export interface Layer {
  opacity: number;
  y?: number;
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
}

export function layersAt(f: number, _tl: Timeline, _tall: boolean): LayerStates {
  const heroOut = ease(f, 3, 22);
  return {
    hero: { opacity: 1 - heroOut, y: -heroOut * 40 },
    vert: { opacity: 1 - ease(f, 2, 14) },
    story: { opacity: band(f, 16, 24, 46, 54) },
    age: ease(f, 22, 40),
    paper: f < 70,
    sparks: 1 - ease(f, 4, 26),
  };
}
