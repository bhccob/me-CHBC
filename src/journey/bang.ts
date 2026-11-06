import { band, ramp } from './math';
import { scrollFromFrame, type Timeline } from './timeline';

/** The bang, as the page keeps time with it. He said the sun was too strong: this is kept short and soft. */

/** The octagon shock rings, in the portal's own shape. */
export const RINGS = 7;

/** How long the bang takes when you let it go, ms. */
const PLAY_MS = 4200;

/** The page's flash: a short, soft swell, at most 0.42. */
export function flashAt(f: number, tl: Timeline): number {
  return Math.max(0, Math.sin(Math.PI * ramp(f, tl.bang[0], tl.bang[0] + 10))) * 0.42;
}

/** "Click the light": while the light waits. `shift` is how far a longer flight moves it. */
export function hintOpacity(f: number, shift = 0): number {
  return band(f, 868 + shift, 872 + shift, 880 + shift, 883 + shift) * 0.9;
}

/** Whether a click now lets the light go. */
export function lightWaiting(f: number, shift = 0): boolean {
  return f > 866 + shift && f < 882 + shift;
}

/** Lets it go: scrolls to the end by itself, at once with less motion asked for. A wheel, a touch or a key takes over. */
export function playBang(tl: Timeline): void {
  const from = scrollY;
  const to = scrollFromFrame(tl.last, document.documentElement.scrollHeight - innerHeight, tl);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scrollTo({ top: to, behavior: 'auto' });
    return;
  }
  const start = performance.now();
  let frame = 0;
  const events = ['wheel', 'touchstart', 'keydown'];
  const stop = (): void => {
    cancelAnimationFrame(frame);
    for (const name of events) removeEventListener(name, stop);
  };
  const go = (now: number): void => {
    const q = Math.min(1, (now - start) / PLAY_MS);
    const eased = q * q * (3 - 2 * q);
    scrollTo({ top: from + (to - from) * eased, behavior: 'auto' });
    if (q < 1) frame = requestAnimationFrame(go);
    else stop();
  };
  for (const name of events) addEventListener(name, stop, { passive: true });
  frame = requestAnimationFrame(go);
}
