/* scroll → chapter progress. No DOM at import time: the build uses this file too. */
import { clamp } from "./util.ts";

/** chapter order by piece number: Me first, then the five studies */
export const ORDER = [5, 0, 1, 2, 3, 4];
/** extra screens of scroll with the finished wall standing still */
export const HOLD = 0.4;
export const HERO_END = 0.09;
/** the Me chapter's four stops (as a share of the chapter): the name, then one stop for each quarter turn of the piece */
export const ME_STOPS = [0.3, 0.49, 0.65, 0.81];
/** where in the Me chapter each quarter turn happens. the fourth brings side 1 back to the front as the camera leaves */
export const ME_TURNS: [number, number][] = [[0.36, 0.46], [0.52, 0.62], [0.68, 0.78], [0.84, 0.93]];
export const UNIT = 0.91 / 7.2; // 2.2 units for Me, 1 for each of the other five
export const START: number[] = [];
export const DUR: number[] = [];
/** chapter number (1..6) of each piece */
export const CH: number[] = [];
(() => {
  let a = HERO_END;
  for (let c = 0; c < 6; c++) {
    DUR[c] = UNIT * (c === 0 ? 2.2 : 1); // the Me chapter is longer: the name animation, then three quarter turns of the piece
    START[c] = a;
    a += DUR[c];
    CH[ORDER[c]] = c + 1;
  }
})();

export interface Scroll {
  vh: number; y: number; workTop: number; endTop: number; maxY: number;
  /** 0..1 over the 3D journey, before easing */
  target: number;
  /** the pieces close into the wall */
  dc: number;
  /** the wall rides up with the work page */
  dop: number;
  /** the last page is coming into view */
  ep: number;
  /** the assembly of the lock on the last page */
  A: number;
}

export function readScroll(workEl: HTMLElement, endEl: HTMLElement, s: Scroll): Scroll {
  const vh = window.innerHeight, y = window.scrollY, workTop = workEl.offsetTop, endTop = endEl.offsetTop;
  s.vh = vh; s.y = y; s.workTop = workTop; s.endTop = endTop;
  s.maxY = document.documentElement.scrollHeight - vh;
  s.target = clamp(y / Math.max(1, workTop - (2 + HOLD) * vh), 0, 1);
  /* the wall assembles across the whole step from Directions (about 3.28 screens above the work list) to the wall's
     stop (1.22): it starts a quarter screen after Directions and is whole just before the stop, so there is no pause */
  s.dc = clamp((y - (workTop - 3.0 * vh)) / (1.6 * vh), 0, 1);
  s.dop = clamp((y - (workTop - vh)) / vh, 0, 1);
  s.ep = clamp((y + vh - endTop) / vh, 0, 1);
  s.A = clamp((y - (endTop - 0.6 * vh)) / (1.6 * vh), 0, 1);
  return s;
}

/** where the menu's "About" lands: on the name, side 1 of the Me piece */
export const aboutTop = (workTop: number, vh: number) => (START[0] + DUR[0] * ME_STOPS[0]) * Math.max(1, workTop - (2 + HOLD) * vh);
