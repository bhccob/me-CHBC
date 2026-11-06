import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { doorAction, GIVE_UP_MS, INK, inkCharacters, inkTarget, LOAD_SHARES, loadedShare, loaderPlan } from '~/journey/loader/plan';
import { InkLoader } from '~/ui/journey/InkLoader';
import { render } from './render';

describe('which loader plays', () => {
  it('plays in full on a new tab', () => {
    expect(loaderPlan({ seenThisTab: false, reload: false, reduced: false })).toBe('full');
  });

  it('is quick once this tab has seen it, and on a reload', () => {
    expect(loaderPlan({ seenThisTab: true, reload: false, reduced: false })).toBe('quick');
    expect(loaderPlan({ seenThisTab: true, reload: true, reduced: false })).toBe('quick');
    expect(loaderPlan({ seenThisTab: false, reload: true, reduced: false })).toBe('quick');
  });

  it('does not play with reduced motion', () => {
    expect(loaderPlan({ seenThisTab: false, reload: false, reduced: true })).toBe('none');
  });
});

describe('the door', () => {
  it('goes in with sound by its button and by the Enter key', () => {
    expect(doorAction('with')).toBe('with-sound');
    expect(doorAction('Enter')).toBe('with-sound');
  });

  it('goes in without sound by its other button, and by scrolling, so nobody is stuck', () => {
    expect(doorAction('without')).toBe('without-sound');
    expect(doorAction('wheel')).toBe('without-sound');
    expect(doorAction('touch')).toBe('without-sound');
  });
});

describe('the ink', () => {
  it('writes one character, then the other', () => {
    expect(inkCharacters(0.1)).toEqual([0, 0]);
    expect(inkCharacters(0.5)).toEqual([1, 0]);
    expect(inkCharacters(1)).toEqual([1, 1]);
  });

  it('takes the times of the mock', () => {
    expect(INK).toEqual({ min: 4200, land: 1900, landAt: 650 });
    expect(GIVE_UP_MS).toBe(12_000);
  });

  it('never reaches the end until the machine is ready', () => {
    expect(inkTarget(10_000, false, false)).toBe(0.9);
    expect(inkTarget(10_000, true, false)).toBe(1);
    expect(inkTarget(2100, true, false)).toBe(0.5);
  });

  it('goes on anyway after the give-up time, so that nobody waits for ever', () => {
    expect(inkTarget(GIVE_UP_MS, false, false)).toBe(0.9);
    expect(inkTarget(GIVE_UP_MS, false, true)).toBe(1);
  });
});

describe('real progress', () => {
  it('adds up the parts by their shares, to exactly 1', () => {
    expect(Object.values(LOAD_SHARES).reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 6);
    expect(loadedShare({})).toBe(0);
    expect(loadedShare({ scene: 1, model: 1, warm: 1 })).toBe(1);
    expect(loadedShare({ model: 0.5 })).toBeCloseTo(LOAD_SHARES.model / 2, 6);
  });
});

describe('the markup', () => {
  it('has both ways in', () => {
    const html = render(InkLoader, { plan: 'full', ready: false, progress: 0, onEnter: () => {}, onLand: () => {}, onDone: () => {} });
    expect(html).toContain(en.journey.loader.withSound);
    expect(html).toContain(en.journey.loader.without);
  });

  it('has nothing to show without a loader', () => {
    expect(render(InkLoader, { plan: 'none', ready: false, progress: 0, onEnter: () => {}, onLand: () => {}, onDone: () => {} })).toBe('');
  });
});
