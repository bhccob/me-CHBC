import { describe, expect, it } from 'vitest';
import { HEAD_CUES } from '~/journey/head/cues';
import { playHeadCue, pourTickChance, rumbleLevel, setRumble } from '~/journey/sound/headEffects';
import { HITS, humLevel, RUNS } from '~/journey/sound/score';
import { fakeAudio } from './sound-fake';

describe('the head journey sounds (spec 6a)', () => {
  it('has a sound for every cue', () => {
    const a = fakeAudio();
    for (const { cue, n } of HEAD_CUES) expect(() => playHeadCue(a, cue, n)).not.toThrow();
    for (const cue of ['print', 'printTitle'] as const) expect(() => playHeadCue(a, cue, 0)).not.toThrow();
  });

  it('pings the six labels at one pitch, so they make no melody', () => {
    const pitches = [0, 1, 2, 3, 4, 5].map((k) => {
      const a = fakeAudio();
      playHeadCue(a, 'label', k);
      return a.pitches[0];
    });
    expect(new Set(pitches).size).toBe(1);
  });

  it('gives each thought its own soft tone', () => {
    const pitches = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = fakeAudio();
      playHeadCue(a, 'thought', i);
      return a.pitches[0];
    });
    expect(new Set(pitches).size).toBe(7);
  });

  it('opens the soft big bang with the scan’s sweep and a low boom', () => {
    const a = fakeAudio();
    playHeadCue(a, 'softBang', 0);
    expect(a.pitches).toContain(160);
    expect(a.pitches).toContain(70);
  });

  it('rumbles with the pressure behind his lips, and ticks while things pour in', () => {
    expect(rumbleLevel(0.5)).toBe(0);
    expect(rumbleLevel(0.93)).toBeCloseTo(0.6, 2);
    expect(rumbleLevel(0.9)).toBeLessThan(rumbleLevel(0.92));
    expect(rumbleLevel(0.95)).toBe(0);
    expect(() => setRumble(fakeAudio(), 0.4)).not.toThrow();
    expect(pourTickChance(0.1, 1 / 60)).toBe(0);
    expect(pourTickChance(0.16, 1 / 60)).toBeCloseTo(9 / 60, 5);
    expect(pourTickChance(0.25, 1 / 60)).toBe(0);
  });
});

describe('the old sounds are gone', () => {
  it('no longer plays the gold line, the gears or the break', () => {
    const hits = HITS.map(([, name]) => name as string);
    for (const gone of ['break', 'break-end', 'qa-word', 'q1', 'q6']) expect(hits).not.toContain(gone);
    const runs = RUNS.map((run) => run.name as string);
    expect(runs).not.toContain('gears');
    expect(runs).not.toContain('wires');
  });

  it('has no hum along the old gold line', () => {
    expect(humLevel(700)).toBe(0);
  });
});
