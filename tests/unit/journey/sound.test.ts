import { describe, expect, it } from 'vitest';
import { dueEnding, dueHits, dueRuns, HITS, holdSounds, humLevel, MOVES, motorOn, padLevel, risingSweep, rushLevel, scrollSpeed, soundAfterReload } from '~/journey/sound/score';

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

  it('moves the frames after the flight along when the flight is longer', () => {
    expect(dueHits(629, 631, 30).map((hit) => hit.name)).toEqual(['break']);
    expect(dueHits(629, 631, 30, 43)).toEqual([]);
    expect(dueHits(672, 674, 30, 43).map((hit) => hit.name)).toEqual(['break']);
    expect(dueHits(193, 195, 30, 43).map((hit) => hit.name)).toEqual(['lid-seat']);
  });

  it('has the sounds of all four things he asked for', () => {
    const names = HITS.map(([, name]) => name);
    for (const name of ['wake', 'code-land', 'pad-a', 'wall-1', 'lock', 'stand-up', 'stands', 'shield-off', 'iris-open', 'break', 'break-end', 'q1', 'q6']) expect(names).toContain(name);
    expect(dueHits(0, 934, 30).map((hit) => hit.name)).toHaveLength(HITS.length);
  });
});

describe('the small runs that follow the scroll', () => {
  it('ticks while the code types, at its pace', () => {
    expect(dueRuns(72, 73.6, 30).map((run) => run.name)).toEqual(['typing']);
    expect(dueRuns(72, 73, 30)).toEqual([]);
  });

  it('snaps wires as the tunnel breaks, and ticks gears along the Q&A', () => {
    expect(dueRuns(640, 641.2, 30).map((run) => run.name)).toEqual(['wires']);
    expect(dueRuns(700, 702, 30).map((run) => run.name)).toEqual(['gears']);
  });

  it('is silent on a jump', () => {
    expect(dueRuns(72, 73.6, 200)).toEqual([]);
  });

  it('gives the frame it stands at, so the wires can swell', () => {
    expect(dueRuns(640, 641.2, 30)[0].at).toBeCloseTo(641.2);
  });
});

describe('what runs all along', () => {
  it('has no music, chords or hum in the flight: only the rush', () => {
    expect(humLevel(450)).toBe(0);
    expect(padLevel(450)).toBe(0);
    expect(rushLevel(450, 0.5)).toBeGreaterThan(0);
  });

  it('keeps the rush to the flight', () => {
    expect(rushLevel(100, 1)).toBe(0);
    expect(rushLevel(700, 1)).toBe(0);
  });

  it('has the rush follow the scroll', () => {
    expect(rushLevel(450, 1)).toBeGreaterThan(rushLevel(450, 0));
  });

  it('hums while the machine is built, fuller as it grows, and again along the gold line', () => {
    expect(humLevel(26)).toBeCloseTo(0.34);
    expect(humLevel(276)).toBeCloseTo(1);
    expect(humLevel(720)).toBeCloseTo(0.6);
    expect(humLevel(880)).toBe(0);
  });

  it('has no music before the ending', () => {
    expect(padLevel(892)).toBe(0);
    expect(padLevel(926)).toBeCloseTo(0.42);
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

describe('the way to the end page', () => {
  it('falls, then bangs, going forward only', () => {
    expect(dueEnding(859, 861)).toEqual(['fall']);
    expect(dueEnding(880, 882)).toEqual(['bang']);
    expect(dueEnding(882, 880)).toEqual([]);
  });

  it('moves along with a longer flight', () => {
    expect(dueEnding(859, 861, 43)).toEqual([]);
    expect(dueEnding(902, 904, 43)).toEqual(['fall']);
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

describe('holding and letting go on the end page (round 21)', () => {
  it('makes no sound while you hold', () => {
    expect(holdSounds(true, false)).toEqual([]);
  });

  it('plays only the soft whoosh as you let go: no tone, thump or bell', () => {
    expect(holdSounds(false, true)).toEqual([{ name: 'whoosh', level: 0.05, seconds: 1.6 }]);
  });

  it('plays nothing on a let go that had no hold before it', () => {
    expect(holdSounds(false, false)).toEqual([]);
  });
});
