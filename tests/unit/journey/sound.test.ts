import { describe, expect, it } from 'vitest';
import { dueHits, dueRuns, HITS, humLevel, MOVES, motorOn, risingSweep, rushLevel, scrollSpeed, soundAfterReload } from '~/journey/sound/score';

describe('what plays as the scroll passes it', () => {
  it('plays a part as the scroll passes its frame', () => {
    expect(dueHits(193, 195, 30).map((hit) => hit.name)).toEqual(['lid-seat']);
  });

  it('plays it once, at full level, going forward', () => {
    expect(dueHits(193, 195, 30)[0].level).toBe(1);
    expect(dueHits(195, 196, 30)).toEqual([]);
  });

  it('plays it softer going back', () => {
    expect(dueHits(195, 193, 30)[0].level).toBeCloseTo(0.42);
  });

  it('plays nothing on a jump, so that no pile of sounds fires', () => {
    expect(dueHits(100, 900, 900)).toEqual([]);
    expect(dueHits(193, 195, 170)).toEqual([]);
    expect(dueHits(193, 195, 169)).toHaveLength(1);
  });

  it('keeps the machine’s parts where they are when the flight is longer', () => {
    expect(dueHits(193, 195, 30, 43).map((hit) => hit.name)).toEqual(['lid-seat']);
  });

  it('has the sounds of all four things he asked for', () => {
    const names = HITS.map(([, name]) => name);
    for (const name of ['wake', 'code-land', 'pad-a', 'wall-1', 'lock', 'stand-up', 'stands', 'shield-off', 'iris-open']) expect(names).toContain(name);
    expect(dueHits(0, 934, 30).map((hit) => hit.name)).toHaveLength(HITS.length);
    // Past the flight the scroll plays none: his head has its own sounds, on its own clock (head-sound.test.ts).
    expect(dueHits(566, 1600, 30)).toEqual([]);
  });
});

describe('the small runs that follow the scroll', () => {
  it('ticks while the code types, at its pace', () => {
    expect(dueRuns(72, 73.6, 30).map((run) => run.name)).toEqual(['typing']);
    expect(dueRuns(72, 73, 30)).toEqual([]);
  });

  it('runs nothing past the flight', () => {
    expect(dueRuns(566, 1600, 30)).toEqual([]);
  });

  it('is silent on a jump', () => {
    expect(dueRuns(72, 73.6, 200)).toEqual([]);
  });

  it('gives the frame it stands at', () => {
    expect(dueRuns(72, 73.6, 30)[0].at).toBeCloseTo(73.6);
  });
});

describe('what runs all along', () => {
  it('has no music, chords or hum in the flight: only the rush', () => {
    expect(humLevel(450)).toBe(0);
    expect(rushLevel(450, 0.5)).toBeGreaterThan(0);
  });

  it('keeps the rush to the flight', () => {
    expect(rushLevel(100, 1)).toBe(0);
    expect(rushLevel(700, 1)).toBe(0);
  });

  it('has the rush follow the scroll', () => {
    expect(rushLevel(450, 1)).toBeGreaterThan(rushLevel(450, 0));
  });

  it('hums while the machine is built, fuller as it grows, and not after', () => {
    expect(humLevel(26)).toBeCloseTo(0.34);
    expect(humLevel(276)).toBeCloseTo(1);
    expect(humLevel(720)).toBe(0);
  });

  it('sweeps up once, into the iris', () => {
    expect(risingSweep(322)).toBe(0);
    expect(risingSweep(352)).toBeGreaterThan(0.04);
    expect(risingSweep(368)).toBe(0);
  });

  it('runs the motor only while parts move and he scrolls', () => {
    expect(MOVES).toContainEqual([104, 130]);
    expect(motorOn(120, 30)).toBe(true);
    expect(motorOn(120, 0)).toBe(false);
    expect(motorOn(140, 30)).toBe(false);
  });
});

describe('after a reload', () => {
  it('stays silent until the next click or key, as browsers ask, then goes on if he had sound on', () => {
    expect(soundAfterReload(true, false)).toBe('silent');
    expect(soundAfterReload(true, true)).toBe('playing');
    expect(soundAfterReload(false, true)).toBe('silent');
  });

  it('reads the scroll speed the way the sounds do', () => {
    expect(scrollSpeed(0)).toBe(0);
    expect(scrollSpeed(13)).toBe(0.5);
    expect(scrollSpeed(100)).toBe(1);
  });
});
