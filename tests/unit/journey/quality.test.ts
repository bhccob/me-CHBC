import { describe, expect, it } from 'vitest';
import { startStep } from '~/engine/quality';
import { journeyQuality, journeySteps } from '~/journey/quality';
import { stageFor, stagesToLoad } from '~/journey/stages';
import { buildTimeline } from '~/journey/timeline';

const tl = buildTimeline();

describe('the speed ladder', () => {
  const a = journeyQuality(0, true);
  const b = journeyQuality(1, true);
  const z = journeyQuality(99, true);

  it('gives up resolution first', () => {
    expect(b.pixelRatio).toBeLessThan(a.pixelRatio);
    expect([b.stars, b.galaxies, b.clouds, b.wallScreens]).toEqual([a.stars, a.galaxies, a.clouds, a.wallScreens]);
  });

  it('ends with fewer stars, galaxies, clouds and wall screens', () => {
    expect(z.stars).toBeLessThan(a.stars);
    expect(z.galaxies).toBeLessThan(a.galaxies);
    expect(z.clouds).toBeLessThan(a.clouds);
    expect(z.wallScreens).toBeLessThan(a.wallScreens);
  });

  it('keeps the approved look at its top', () => {
    expect(a).toMatchObject({ stars: 1, galaxies: 1, clouds: 1, wallScreens: 1, dof: true, mirror: true });
    expect(a.bloom).toBeGreaterThan(0);
  });

  it('only ever gets cheaper', () => {
    for (let step = 1; step < journeySteps(true); step++) expect(journeyQuality(step, true).cost).toBeLessThan(journeyQuality(step - 1, true).cost);
  });

  it('reads a step past its end as the last, and a bad one as the first', () => {
    expect(journeyQuality(99, true)).toEqual(journeyQuality(journeySteps(true) - 1, true));
    expect(journeyQuality(Number.NaN, true)).toEqual(a);
    expect(journeyQuality(-1, true)).toEqual(a);
  });

  it('starts a phone below the top, with no reflection', () => {
    const phone = journeyQuality(0, false);
    expect(phone.pixelRatio).toBeLessThan(a.pixelRatio);
    expect(phone.mirror).toBe(false);
  });
});

describe('where a GPU starts on the ladder', () => {
  const screen = { width: 1920, height: 1080 };
  const costs = Array.from({ length: journeySteps(true) }, (_, step) => journeyQuality(step, true));

  it('is the top for a strong one', () => {
    expect(startStep(0.5, screen, 1, costs)).toBe(0);
  });

  it('is lower for a weak one', () => {
    expect(startStep(13, screen, 1, costs)).toBeGreaterThan(0);
  });

  it('is the top with no timing, for the frames to judge', () => {
    expect(startStep(null, screen, 1, costs)).toBe(0);
    expect(startStep(Number.NaN, screen, 1, costs)).toBe(0);
    expect(startStep(-1, screen, 1, costs)).toBe(0);
  });

  it('is the last step for the weak GPU the costs were measured on, at 1080p, so it never resizes mid-journey', () => {
    expect(startStep(13, screen, 1, costs)).toBe(costs.length - 1);
    expect(startStep(52, screen, 1, costs)).toBe(costs.length - 1);
  });

  it('is lower on more pixels', () => {
    expect(startStep(3, { width: 3840, height: 2160 }, 1, costs)).toBeGreaterThanOrEqual(startStep(3, { width: 1280, height: 720 }, 1, costs));
  });
});

describe('the stages of the journey', () => {
  it('follow the frames', () => {
    expect(stageFor(0, tl)).toBe('machine');
    expect(stageFor(339, tl)).toBe('machine');
    expect(stageFor(340, tl)).toBe('flight');
    expect(stageFor(600, tl)).toBe('void');
    expect(stageFor(900, tl)).toBe('end');
  });

  it('load the current one first', () => {
    expect(stagesToLoad(0, tl, new Set())).toEqual(['machine']);
    expect(stagesToLoad(900, tl, new Set(['machine']))[0]).toBe('end');
  });

  it('load nothing more at the first view', () => {
    expect(stagesToLoad(0, tl, new Set(['machine']))).toEqual([]);
    expect(stagesToLoad(200, tl, new Set(['machine']))).toEqual([]);
  });

  it('load the next once it is within 80 frames', () => {
    expect(stagesToLoad(300, tl, new Set(['machine']))).toEqual(['flight']);
    expect(stagesToLoad(261, tl, new Set(['machine']))).toEqual(['flight']);
    expect(stagesToLoad(259, tl, new Set(['machine']))).toEqual([]);
  });

  it('do not load what has come', () => {
    expect(stagesToLoad(300, tl, new Set(['machine', 'flight']))).toEqual([]);
  });

  it('move with a longer flight', () => {
    const longer = buildTimeline(216);
    expect(stageFor(600, longer)).toBe('flight');
    expect(stageFor(640, longer)).toBe('void');
  });
});
