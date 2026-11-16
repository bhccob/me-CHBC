/* scroll → chapter progress. No DOM at import time: the build uses this file too. */
import { clamp } from "./util.ts";

/** chapter order by piece number: Me first, then the five studies */
export const ORDER = [5, 0, 1, 2, 3, 4];
/** extra screens of scroll with the finished wall standing still */
export const HOLD = 0.4;
export const HERO_END = 0.09;
/** where in the Me chapter the six about-me lines start, and how much of the chapter they take */
export const ME_A = 0.36, ME_L = 0.46;
export const UNIT = 0.91 / 7.8;
export const START: number[] = [];
export const DUR: number[] = [];
/** chapter number (1..6) of each piece */
export const CH: number[] = [];
(() => {
  let a = HERO_END;
  for (let c = 0; c < 6; c++) {
    DUR[c] = UNIT * (c === 0 ? 2.8 : 1); // the Me chapter is much longer: the name animation, then six lines with room to read each
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
  s.dc = clamp((y - (workTop - (2 + HOLD) * vh)) / (0.95 * vh), 0, 1);
  s.dop = clamp((y - (workTop - vh)) / vh, 0, 1);
  s.ep = clamp((y + vh - endTop) / vh, 0, 1);
  s.A = clamp((y - (endTop - 0.6 * vh)) / (1.6 * vh), 0, 1);
  return s;
}

/** where the menu's "About" lands: on the first of the six lines */
export const aboutTop = (workTop: number, vh: number) => (START[0] + DUR[0] * (ME_A + ME_L / 12)) * Math.max(1, workTop - (2 + HOLD) * vh);
