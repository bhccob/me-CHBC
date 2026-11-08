import { describe, expect, it } from 'vitest';
import { dueCues, HEAD_CUES, pressureAt, printCues } from '~/journey/head/cues';

describe('the head journey sounds in step', () => {
  it('plays each cue once, going forward', () => {
    expect(dueCues(0.11, 0.12, false)).toEqual([{ cue: 'lid', n: 0 }]);
    expect(dueCues(0.2, 0.25, false).filter((c) => c.cue === 'label')).toHaveLength(6);
  });

  it('plays nothing going back, and nothing on a jump', () => {
    expect(dueCues(0.99, 0.5, false)).toEqual([]);
    expect(dueCues(0.2, 1, true)).toEqual([]);
  });

  it('has a cue for each of the seven thoughts and the six trips between them', () => {
    expect(HEAD_CUES.filter((c) => c.cue === 'thought')).toHaveLength(7);
    expect(HEAD_CUES.filter((c) => c.cue === 'corridor')).toHaveLength(6);
  });

  it('ticks each printed row, and pings the title', () => {
    expect(printCues(0.962, 0.986, [0.1, 0.5, 0.8], 2)).toEqual([{ cue: 'print', n: 0 }, { cue: 'print', n: 1 }, { cue: 'printTitle', n: 2 }]);
  });

  it('builds the pressure behind the lips and lets it go at the spit', () => {
    expect([pressureAt(0.88), pressureAt(0.93), pressureAt(0.94)]).toEqual([0, 1, 0]);
  });
});
