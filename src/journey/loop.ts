import { frameFromScroll, smoothFrame, type Timeline } from './timeline';

/** The longest step the loop believes, seconds: a return from sleep or a background tab must not jump the story. */
export const MAX_DT = 0.05;

export interface LoopDeps {
  timeline: Timeline;
  /** Reduced motion: the frame follows the scroll at once. */
  reduce: boolean;
  /** Called once a frame with the shown frame, the step in seconds and the time in ms. */
  onFrame: (f: number, dt: number, now: number) => void;
  /** Where the page is; the window's scroll by default. */
  scroll?: () => { y: number; max: number };
  raf?: (callback: (now: number) => void) => number;
  cancel?: (handle: number) => void;
}

const windowScroll = (): { y: number; max: number } => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight });

/**
 * The one loop of the journey: it turns the scroll into the frame everything else reads. The first tick lands on the scroll
 * as it stands, so a reload in the middle of the journey shows that place and not a run up to it. Answers how to stop it.
 */
export function startLoop({ timeline, reduce, onFrame, scroll = windowScroll, raf = requestAnimationFrame, cancel = cancelAnimationFrame }: LoopDeps): () => void {
  let shown: number | null = null;
  let last = 0;
  let handle = 0;
  const tick = (now: number): void => {
    const dt = shown === null ? 0 : Math.min(MAX_DT, (now - last) / 1000);
    last = now;
    const { y, max } = scroll();
    const target = frameFromScroll(y, max, timeline);
    shown = shown === null || reduce ? target : smoothFrame(shown, target, dt);
    onFrame(shown, dt, now);
    handle = raf(tick);
  };
  handle = raf(tick);
  return () => cancel(handle);
}
