/** What the proof harness may read of the journey, behind `?proof` only. */
export interface JourneyDebug {
  frame(): number;
  /** The first frame the loop showed: on a reload in the middle, that place and not a run up to it. */
  first(): number | null;
  /** The time each frame took so far, ms. */
  frameTimes(): number[];
  /** Whether the world has loaded and is drawing. */
  ready(): boolean;
  quality(): number;
  /** Where the stack's labels point, in CSS pixels. */
  anchors(): Record<string, [number, number]> | null;
  /** The sound: whether it is on, how loud, and which of its effects have played. */
  sound(): { on: boolean; running: boolean; context: string; level: number; counts: Record<string, number>; landed: boolean };
}

declare global {
  interface Window {
    __journeyDebug?: JourneyDebug;
  }
}

/** Installs the bridge when the address asks for it. Answers how to take it away. */
export function installJourneyDebug(make: () => JourneyDebug, search: string = window.location.search): () => void {
  if (!new URLSearchParams(search).has('proof')) return () => {};
  window.__journeyDebug = make();
  return () => {
    delete window.__journeyDebug;
  };
}
