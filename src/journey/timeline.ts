import { dwellT } from './head/thoughts';
import { HEAD_FRAMES, headFrameIn, SPIT_T } from './head/time';
import { ramp } from './math';

/**
 * The journey as one table, in frames: the mock's unit of scroll and the code's single timeline value (spec section 4).
 * Frames after the flight move along when more projects make the flight longer. Pure: no DOM, no three.
 */

/** The share of the scroll the first view holds for, before the machine moves. */
export const HOLD = 0.035;

/** How long the shown frame takes to ease toward the scroll, seconds. */
export const SMOOTH_S = 0.13;

/** The scroll one frame takes, CSS px. */
export const SCROLL_PX_PER_FRAME = 30.6;

/**
 * How many times the scroll a frame of the four field sheets takes, Software Engineering to Mechatronics (Bob, 2026-11-07:
 * "scrolling through the studies make it slightly slower so it feels more premium"). Every frame plays as before; only the
 * scroll between them is longer. The head journey paces itself (head/time.ts).
 */
export const STUDIES_PACE = 1.4;

/** The sheets' stretch: from the first sheet starting up to the stack. */
const STUDIES: readonly [number, number] = [44, 278];

/** A stretch of frames the scroll takes `times` slower. */
export interface Pace {
  from: number;
  to: number;
  times: number;
}

/** The flight's length in the mock's distance units, and in frames, with the four projects of the approved mock-up. */
const BASE_FLIGHT_END = 180;
const FRAMES_PER_UNIT = 1.2;
/** The frames the approved mock-up's flight took, from 350 to 566. */
const BASE_FLIGHT_FRAMES = 216;

export type ChapterId = 'who' | 'software' | 'games' | 'security' | 'mechatronics' | 'stack' | 'projects' | 'qa' | 'contact';

export interface Chapter {
  id: ChapterId;
  /** The frame it starts at, which is when the rail shows it as current. */
  from: number;
  /** The frame its link lands on. */
  jump: number;
}

export interface Timeline {
  last: number;
  /** How far the frames after the flight have moved. */
  shift: number;
  flight: [number, number];
  /** The frame each project is read at, oldest first. */
  reads: number[];
  /** The head journey, from the flight's end: the X-ray scan to the scan report (spec 2026-11-08 "Into my head"). */
  head: [number, number];
  /** @deprecated The old void and end page, until their code goes (Into my head plan, Task 12). */
  void: [number, number];
  dissolve: [number, number];
  lookBack: number;
  qaReads: number[];
  collapse: [number, number];
  bang: [number, number];
  settled: number;
  chapters: readonly Chapter[];
  /** The stretches the scroll takes slower, in frames, in order and apart: the sheets. */
  paces: readonly Pace[];
}

/** The timeline for a flight of `flightEnd` distance units, with its projects read at `reads`. */
export function buildTimeline(flightEnd = BASE_FLIGHT_END, reads: readonly number[] = [399, 448, 493, 537], flightFrames?: number): Timeline {
  // The flight's own frame count when its layout gives one (`flightFrames` in flight/layout.ts), else as far as it goes.
  const shift = flightFrames === undefined ? Math.round((flightEnd - BASE_FLIGHT_END) * FRAMES_PER_UNIT) : flightFrames - BASE_FLIGHT_FRAMES;
  const head: [number, number] = [566 + shift, 566 + shift + HEAD_FRAMES];
  const last = head[1];
  return {
    last,
    shift,
    flight: [350, 566 + shift],
    reads: [...reads],
    head,
    void: [566 + shift, 888 + shift],
    dissolve: [630 + shift, 690 + shift],
    lookBack: 642 + shift,
    qaReads: [707, 736, 765, 795, 824, 853].map((f) => f + shift),
    collapse: [858 + shift, 880 + shift],
    bang: [880 + shift, 928 + shift],
    settled: last,
    chapters: [
      { id: 'who', from: 0, jump: 0 },
      { id: 'software', from: 46, jump: 72 },
      { id: 'games', from: 102, jump: 124 },
      { id: 'security', from: 154, jump: 188 },
      { id: 'mechatronics', from: 206, jump: 250 },
      { id: 'stack', from: 278, jump: 302 },
      { id: 'projects', from: 340, jump: 392 },
      // Q&A from the shaft over his head to the spit, its link on the first answer; Contact from the spit.
      { id: 'qa', from: head[0], jump: Math.round(headFrameIn(dwellT(0), head)) },
      { id: 'contact', from: Math.round(headFrameIn(SPIT_T, head)), jump: last },
    ],
    paces: [
      // The four field sheets, which a longer flight does not move.
      { from: STUDIES[0], to: STUDIES[1], times: STUDIES_PACE },
    ],
  };
}

/** How far along the scroll frame `f` stands, in frames of plain scroll: each frame of a paced stretch counts `times`. */
function scrollUnits(f: number, tl: Timeline): number {
  let units = f;
  for (const { from, to, times } of tl.paces) units += (times - 1) * Math.max(0, Math.min(f, to) - from);
  return units;
}

/** The frame at `units` frames of plain scroll: `scrollUnits` the other way. */
function frameOfUnits(units: number, tl: Timeline): number {
  // Walk the stretches in order: the frames before each are plain, the frames inside it take `times` units each.
  let frame = 0;
  let left = units;
  for (const { from, to, times } of tl.paces) {
    if (left <= from - frame) return frame + left;
    left -= from - frame;
    const paced = (to - from) * times;
    if (left <= paced) return from + left / times;
    left -= paced;
    frame = to;
  }
  return frame + left;
}

/** The frame the scroll stands for. */
export function frameFromScroll(scrollY: number, maxScroll: number, tl: Timeline): number {
  const raw = Math.min(1, Math.max(0, scrollY / Math.max(1, maxScroll)));
  return Math.min(tl.last, frameOfUnits(ramp(raw, HOLD, 1) * scrollUnits(tl.last, tl), tl));
}

/** The scroll that stands for a frame. */
export function scrollFromFrame(f: number, maxScroll: number, tl: Timeline): number {
  return (HOLD + (scrollUnits(Math.min(f, tl.last), tl) / scrollUnits(tl.last, tl)) * (1 - HOLD)) * maxScroll;
}

/** The shown frame `dt` seconds on, eased toward `target`. */
export function smoothFrame(shown: number, target: number, dt: number): number {
  return shown + (target - shown) * (1 - Math.exp(-dt / SMOOTH_S));
}

/** The chapter frame `f` is in. */
export function chapterAt(f: number, tl: Timeline): ChapterId {
  let current = tl.chapters[0].id;
  for (const chapter of tl.chapters) if (f >= chapter.from) current = chapter.id;
  return current;
}

/** How much taller than the window the page is, CSS px. The window's height adds to it, so a resize keeps the frame. */
export function trackHeightPx(tl: Timeline): number {
  return scrollUnits(tl.last, tl) * SCROLL_PX_PER_FRAME;
}
