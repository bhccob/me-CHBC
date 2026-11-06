import { Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flashAt, hintOpacity, playBang, RINGS } from '~/journey/bang';
import { layersAt } from '~/journey/layers';
import { buildTimeline, scrollFromFrame } from '~/journey/timeline';
import { bangShare, collapseShare, fallPoint, voidLeftAfter } from '~/journey/world/end/Collapse';
import { VOID_LENGTH, voidAt } from '~/journey/world/void/path';

const tl = buildTimeline();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the flash', () => {
  it('peaks at 0.42, and no higher', () => {
    let top = 0;
    for (let f = 870; f < 934; f += 0.25) top = Math.max(top, flashAt(f, tl));
    expect(top).toBeCloseTo(0.42, 2);
  });

  it('is short: gone ten frames after the bang starts', () => {
    expect(flashAt(tl.bang[0], tl)).toBeCloseTo(0, 6);
    expect(flashAt(tl.bang[0] + 10, tl)).toBeCloseTo(0, 6);
    expect(flashAt(tl.bang[0] + 20, tl)).toBeCloseTo(0, 6);
  });

  it('moves with a longer flight', () => {
    const longer = buildTimeline(216);
    expect(flashAt(tl.bang[0] + 5, tl)).toBeCloseTo(flashAt(longer.bang[0] + 5, longer), 6);
  });
});

describe('the rings', () => {
  it('are seven', () => {
    expect(RINGS).toBe(7);
  });
});

describe('the hint beside the light', () => {
  it('shows only while the light waits', () => {
    expect([hintOpacity(860), hintOpacity(875), hintOpacity(890)]).toEqual([0, 0.9, 0]);
  });

  it('waits later on a longer flight', () => {
    expect(hintOpacity(875 + 43, 43)).toBe(0.9);
    expect(hintOpacity(875, 43)).toBe(0);
  });

  it('is in the layers', () => {
    expect(layersAt(875, tl, false).hint).toBe(0.9);
    expect(layersAt(885, tl, false).flash).toBeGreaterThan(0.3);
  });
});

describe('everything falling', () => {
  it('starts at the collapse and is over at the bang', () => {
    expect(collapseShare(tl.collapse[0], tl)).toBe(0);
    expect(collapseShare(tl.collapse[1], tl)).toBe(1);
    expect(bangShare(tl.bang[0], tl)).toBe(0);
    expect(bangShare(tl.bang[1], tl)).toBe(1);
  });

  it('takes the floor and the sky with it', () => {
    expect(voidLeftAfter(1, 0)).toBe(1);
    expect(voidLeftAfter(1, 1)).toBe(0);
    expect(voidLeftAfter(0.5, 0)).toBe(0.5);
  });

  it('falls to one point at the end of the line, far along it', () => {
    const point = fallPoint(180, new Vector3());
    const end = voidAt(VOID_LENGTH, new Vector3());
    expect(point.distanceTo(end)).toBeCloseTo(220, 3);
    expect(point.y).toBeCloseTo(end.y, 6);
    expect(fallPoint(216, new Vector3()).z).toBeCloseTo(point.z - 36, 6);
  });
});

describe('letting it go', () => {
  /** A browser's page, enough for this, with its frames run by hand. */
  function fakePage(reduced: boolean) {
    const tops: number[] = [];
    let next: ((now: number) => void) | null = null;
    vi.stubGlobal('scrollY', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('document', { documentElement: { scrollHeight: 30_800 } });
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    vi.stubGlobal('performance', { now: () => 0 });
    vi.stubGlobal('scrollTo', ({ top }: { top: number }) => tops.push(top));
    vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
      next = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      next = null;
    });
    vi.stubGlobal('addEventListener', () => {});
    vi.stubGlobal('removeEventListener', () => {});
    return { tops, run: (now: number) => next?.(now) };
  }

  it('scrolls to the end over 4.2 seconds', () => {
    const { tops, run } = fakePage(false);
    playBang(tl);
    run(2100);
    expect(tops.at(-1)).toBeGreaterThan(1000);
    expect(tops.at(-1)).toBeLessThan(30_000);
    run(4200);
    expect(tops.at(-1)).toBeCloseTo(scrollFromFrame(tl.last, 30_000, tl), 3);
  });

  it('goes at once with less motion asked for', () => {
    const { tops } = fakePage(true);
    playBang(tl);
    expect(tops.at(-1)).toBeCloseTo(scrollFromFrame(tl.last, 30_000, tl), 3);
  });
});
