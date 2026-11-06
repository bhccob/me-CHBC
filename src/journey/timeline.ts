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

/** The flight's length in the mock's distance units, and in frames, with the four projects of the approved mock-up. */
const BASE_FLIGHT_END = 180;
const FRAMES_PER_UNIT = 1.2;

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
  void: [number, number];
  dissolve: [number, number];
  lookBack: number;
  qaReads: number[];
  collapse: [number, number];
  bang: [number, number];
  settled: number;
  chapters: readonly Chapter[];
}

/** The timeline for a flight of `flightEnd` distance units, with its projects read at `reads`. */
export function buildTimeline(flightEnd = BASE_FLIGHT_END, reads: readonly number[] = [399, 448, 493, 537]): Timeline {
  const shift = Math.round((flightEnd - BASE_FLIGHT_END) * FRAMES_PER_UNIT);
  const last = 934 + shift;
  return {
    last,
    shift,
    flight: [350, 566 + shift],
    reads: [...reads],
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
      { id: 'qa', from: 640 + shift, jump: 668 + shift },
      { id: 'contact', from: 856 + shift, jump: last },
    ],
  };
}

/** The frame the scroll stands for. */
export function frameFromScroll(scrollY: number, maxScroll: number, tl: Timeline): number {
  const raw = Math.min(1, Math.max(0, scrollY / Math.max(1, maxScroll)));
  return ramp(raw, HOLD, 1) * tl.last;
}

/** The scroll that stands for a frame. */
export function scrollFromFrame(f: number, maxScroll: number, tl: Timeline): number {
  return (HOLD + (Math.min(f, tl.last) / tl.last) * (1 - HOLD)) * maxScroll;
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
  return tl.last * SCROLL_PX_PER_FRAME;
}
