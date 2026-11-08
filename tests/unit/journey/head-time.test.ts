import { describe, expect, it } from 'vitest';
import { endClock, FINALE_S, headFrame, headT, HEAD_FRAMES, SPIT_T } from '~/journey/head/time';
import { buildTimeline } from '~/journey/timeline';

const tl = buildTimeline();
const at = (share: number) => tl.head[0] + share * HEAD_FRAMES;

describe("the head's time, at the mock's pace", () => {
  it('starts where the flight ends and runs 930 frames', () => {
    expect(tl.head).toEqual([566, 1496]);
    expect(tl.last).toBe(1496);
  });

  it('goes slowly through the scan and the trip to the mouth (Bob)', () => {
    expect(headT(tl.head[0], tl)).toBe(0);
    expect(headT(at(0.082), tl)).toBeCloseTo(0.09, 6);
    expect(headT(at(0.4), tl)).toBeCloseTo(0.335, 6);
    expect(headT(at(0.979), tl)).toBeCloseTo(SPIT_T, 6);
    for (let f = tl.head[0]; f < tl.head[1]; f += 3) expect(headT(f + 3, tl)).toBeGreaterThanOrEqual(headT(f, tl));
  });

  it('turns back into frames', () => {
    for (const t of [0.05, 0.371, 0.734, 0.9]) expect(headT(headFrame(t, tl), tl)).toBeCloseTo(t, 4);
  });
});

describe("the ending's own clock (Bob: the sound was out of step)", () => {
  it('follows the scroll before the spit', () => {
    expect(endClock({ at: null }, 0.9, 10, false)).toBe(0.9);
  });

  it('runs from the spit to 1 over 4.8 s by time', () => {
    const clock = { at: null };
    expect(endClock(clock, SPIT_T, 10, false)).toBeCloseTo(SPIT_T, 6);
    expect(endClock(clock, SPIT_T, 10 + FINALE_S / 2, false)).toBeCloseTo(SPIT_T + (1 - SPIT_T) / 2, 6);
    expect(endClock(clock, SPIT_T, 10 + FINALE_S + 3, false)).toBe(1);
  });

  it('rewinds above the spit', () => {
    const clock = { at: 10 };
    expect(endClock(clock, 0.9279, 12, false)).toBeCloseTo(0.9279, 6);
    expect(clock.at).toBeNull();
  });

  it('lands finished on a jump to Contact', () => {
    expect(endClock({ at: null }, SPIT_T + 0.01, 50, true)).toBe(1);
  });
});
