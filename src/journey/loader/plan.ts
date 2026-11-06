import { ramp } from '../math';

/** What the loader does and when. Pure, and free of three, so that it runs before three.js has arrived. */

export type LoaderPlan = 'full' | 'quick' | 'none';
export type DoorInput = 'with' | 'without' | 'Enter' | 'wheel' | 'touch';
export type DoorChoice = 'with-sound' | 'without-sound';

/** This tab has been through the loader. */
export const SEEN_KEY = 'journey-seen';

/** How long the ink spreads at least, how long it takes to dissolve into the page, and when the page starts to rise, ms. */
export const INK = { min: 4200, land: 1900, landAt: 650 } as const;

/** How long the ink waits for a load that does not finish, ms; then it shows the door anyway. */
export const GIVE_UP_MS = 12_000;

/** Full on a new tab; quick once the tab has seen it, and on a reload; not at all with reduced motion. */
export function loaderPlan({ seenThisTab, reload, reduced }: { seenThisTab: boolean; reload: boolean; reduced: boolean }): LoaderPlan {
  if (reduced) return 'none';
  return seenThisTab || reload ? 'quick' : 'full';
}

/** Which way a visitor goes in. Scrolling goes in without asking and without sound, so nobody is stuck at the door. */
export function doorAction(input: DoorInput): DoorChoice {
  return input === 'with' || input === 'Enter' ? 'with-sound' : 'without-sound';
}

/** How much the two characters show, as the ink reaches them. */
export function inkCharacters(p: number): [number, number] {
  return [ramp(p, 0.16, 0.5), ramp(p, 0.5, 0.86)];
}

/** The load's parts and their shares of the ink: the 3D code, the machine's model, and the first draw. */
export const LOAD_SHARES = { scene: 0.3, model: 0.5, warm: 0.2 } as const;
export type LoadPart = keyof typeof LOAD_SHARES;

export function loadedShare(parts: Partial<Record<LoadPart, number>>): number {
  let total = 0;
  for (const part of Object.keys(LOAD_SHARES) as LoadPart[]) total += LOAD_SHARES[part] * Math.min(1, Math.max(0, parts[part] ?? 0));
  return Math.min(1, Math.round(total * 1e6) / 1e6);
}

/** How far the ink should have spread: with the time, but held back by what has really loaded, and short of the end until it all has. */
export function inkTarget(elapsedMs: number, ready: boolean, gaveUp: boolean, share = 1): number {
  const byTime = Math.min(1, elapsedMs / INK.min);
  if (gaveUp || ready) return byTime;
  return Math.min(byTime, 0.9 * Math.max(0.08, share));
}
