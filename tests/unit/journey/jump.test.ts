import { describe, expect, it, vi } from 'vitest';
import { frameForHash, frameOfChapter, glideTo, noteFrame, railOpacity, railQuiet, rememberPlace, takePlace } from '~/journey/jump';
import { buildTimeline, scrollFromFrame } from '~/journey/timeline';

const tl = buildTimeline();

describe('where a hash goes', () => {
  it('knows the two chapters a link may name', () => {
    expect(frameForHash('#projects', tl)).toBe(392);
    expect(frameForHash('#contact', tl)).toBe(934);
  });

  it('knows a project by its stop', () => {
    expect(frameForHash('#project-steady', tl, ['cookies-clicker', 'jontai-energy', 'steady', 'portle'])).toBe(tl.reads[2]);
    expect(frameForHash('#project-nope', tl, ['steady'])).toBeNull();
  });

  it('leaves anything else alone', () => {
    expect(frameForHash('#nope', tl)).toBeNull();
    expect(frameForHash('', tl)).toBeNull();
  });
});

describe('the chapters', () => {
  it('lands each on its frame', () => {
    expect([frameOfChapter('who', tl), frameOfChapter('stack', tl), frameOfChapter('qa', tl), frameOfChapter('contact', tl)]).toEqual([0, 302, 668, 934]);
  });

  it('the first view is the very top, not the end of its hold', () => {
    const win = { scrollTo: vi.fn(), innerHeight: 800, document: { documentElement: { scrollHeight: 2800 } } };
    glideTo(0, tl, false, win as never);
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('glides along the scroll, and goes at once with reduced motion', () => {
    const win = { scrollTo: vi.fn(), innerHeight: 800, document: { documentElement: { scrollHeight: 2800 } } };
    glideTo(392, tl, false, win as never);
    expect(win.scrollTo).toHaveBeenLastCalledWith({ top: scrollFromFrame(392, 2000, tl), behavior: 'smooth' });
    glideTo(392, tl, true, win as never);
    expect(win.scrollTo).toHaveBeenLastCalledWith({ top: scrollFromFrame(392, 2000, tl), behavior: 'auto' });
  });
});

describe('the rail', () => {
  it('fades in after the first view and out at the collapse', () => {
    expect([railOpacity(0, tl), railOpacity(22, tl), railOpacity(859, tl), railOpacity(870, tl)]).toEqual([0, 1, 1, 0]);
  });

  it('keeps only its current word while the machine stands up under it', () => {
    expect([railQuiet(200), railQuiet(250), railQuiet(280)]).toEqual([false, true, false]);
  });

  it('fades out later when the flight is longer', () => {
    expect(railOpacity(870, buildTimeline(216))).toBe(1);
  });
});

describe('your place, across a change of language', () => {
  const store = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> => {
    const held = new Map<string, string>();
    return { getItem: (key) => held.get(key) ?? null, setItem: (key, value) => void held.set(key, value), removeItem: (key) => void held.delete(key) };
  };

  it('is kept once, and read once', () => {
    const storage = store();
    noteFrame(300);
    rememberPlace(storage);
    expect(takePlace(storage)).toBe(300);
    expect(takePlace(storage)).toBeNull();
  });

  it('is nothing where no journey is showing', () => {
    const storage = store();
    noteFrame(null);
    rememberPlace(storage);
    expect(takePlace(storage)).toBeNull();
  });

  it('ignores what it cannot read', () => {
    const storage = store();
    storage.setItem('journey-place', 'nonsense');
    expect(takePlace(storage)).toBeNull();
  });
});
