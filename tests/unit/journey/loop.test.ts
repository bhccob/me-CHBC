import { describe, expect, it } from 'vitest';
import { MAX_DT, startLoop } from '~/journey/loop';
import { buildTimeline, scrollFromFrame } from '~/journey/timeline';

const tl = buildTimeline();
/** The scroll of frame 467, on a page with 1000 px to scroll. */
const AT_467 = scrollFromFrame(467, 1000, tl);

/** A loop on a hand-turned clock. */
function run(reduce: boolean, ys: readonly number[], times: readonly number[]): { f: number; dt: number }[] {
  const seen: { f: number; dt: number }[] = [];
  let next: ((now: number) => void) | null = null;
  let at = 0;
  const stop = startLoop({
    timeline: tl,
    reduce,
    onFrame: (f, dt) => seen.push({ f, dt }),
    scroll: () => ({ y: ys[at], max: 1000 }),
    raf: (callback) => {
      next = callback;
      return 1;
    },
    cancel: () => {
      next = null;
    },
  });
  for (at = 0; at < times.length; at++) (next as unknown as (now: number) => void)(times[at]);
  stop();
  return seen;
}

describe('the loop', () => {
  it('lands on the scroll as it stands on its first tick, so a reload shows that place', () => {
    const [first] = run(false, [AT_467], [100]);
    expect(first.f).toBeCloseTo(467, 6);
    expect(first.dt).toBe(0);
  });

  it('then eases toward the scroll', () => {
    const [first, second] = run(false, [35, AT_467], [100, 116]);
    expect(first.f).toBeCloseTo(0, 6);
    expect(second.f).toBeGreaterThan(0);
    expect(second.f).toBeLessThan(467);
  });

  it('follows the scroll at once with reduced motion', () => {
    expect(run(true, [35, AT_467], [100, 116])[1].f).toBeCloseTo(467, 6);
  });

  it('does not believe a long step, so a return from sleep does not jump the story', () => {
    expect(run(false, [0, 0], [100, 60_000])[1].dt).toBe(MAX_DT);
  });

  it('stops when asked', () => {
    let calls = 0;
    let next: ((now: number) => void) | null = null;
    const stop = startLoop({
      timeline: tl,
      reduce: false,
      onFrame: () => calls++,
      scroll: () => ({ y: 0, max: 1 }),
      raf: (callback) => {
        next = callback;
        return 7;
      },
      cancel: (handle) => {
        expect(handle).toBe(7);
        next = null;
      },
    });
    stop();
    expect(next).toBeNull();
    expect(calls).toBe(0);
  });
});
