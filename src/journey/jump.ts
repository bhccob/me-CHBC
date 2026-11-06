import { ease } from './math';
import { type ChapterId, scrollFromFrame, type Timeline } from './timeline';

/** Where a link or a hash lands on the journey. Pure, but for `glideTo`, which takes its window. */

export function frameOfChapter(id: ChapterId, tl: Timeline): number {
  return tl.chapters.find((chapter) => chapter.id === id)?.jump ?? 0;
}

/** The frame a hash stands for: `#projects`, `#contact`, or `#project-<id>`, that project's stop; null for any other. */
export function frameForHash(hash: string, tl: Timeline, stopIds: readonly string[] = []): number | null {
  if (hash === '#projects') return frameOfChapter('projects', tl);
  if (hash === '#contact') return frameOfChapter('contact', tl);
  if (hash.startsWith('#project-')) {
    const index = stopIds.indexOf(hash.slice('#project-'.length));
    return index >= 0 ? (tl.reads[index] ?? null) : null;
  }
  return null;
}

type ScrollWindow = Pick<Window, 'scrollTo' | 'innerHeight'> & { document: { documentElement: { scrollHeight: number } } };

/** Goes to a frame along the scroll, or at once with reduced motion. Frame 0 is the very top, not the end of its hold. */
export function glideTo(f: number, tl: Timeline, reduce: boolean, win: ScrollWindow = window): void {
  const max = win.document.documentElement.scrollHeight - win.innerHeight;
  win.scrollTo({ top: f <= 0 ? 0 : scrollFromFrame(f, max, tl), behavior: reduce ? 'auto' : 'smooth' });
}

/** The rail: in after the first view, out at the collapse. */
export function railOpacity(f: number, tl: Timeline): number {
  const out = tl.collapse[0] + 2;
  return ease(f, 8, 22) * (1 - ease(f, out, out + 10));
}

const PLACE_KEY = 'journey-place';
type PlaceStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let shownFrame: number | null = null;

/** Says what frame the journey is showing; null when it has gone. */
export function noteFrame(f: number | null): void {
  shownFrame = f;
}

/** Keeps the place for the page about to replace this one, as the language link does. */
export function rememberPlace(storage: PlaceStore = sessionStorage): void {
  if (shownFrame !== null) storage.setItem(PLACE_KEY, String(shownFrame));
}

/** The place kept for this page, read once. */
export function takePlace(storage: PlaceStore = sessionStorage): number | null {
  const held = storage.getItem(PLACE_KEY);
  if (held === null) return null;
  storage.removeItem(PLACE_KEY);
  const f = Number(held);
  return Number.isFinite(f) ? f : null;
}
