import { describe, expect, it } from 'vitest';
import { readoutAt } from '~/journey/head/readout';
import { answerShown, dwellT, dwellWeights, THOUGHTS } from '~/journey/head/thoughts';

describe('the six thoughts (spec 5.7)', () => {
  it("are read at the mock's stops, and Broca's area after them", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => dwellT(i).toFixed(3))).toEqual(['0.371', '0.444', '0.516', '0.589', '0.661', '0.734']);
    expect(dwellT(6)).toBe(0.795);
  });

  it('sit where the spec puts them, each with its object', () => {
    expect(THOUGHTS.map((x) => [x.key, x.region, x.doing, x.object])).toEqual([
      ['plans', 'prefrontal', 'planning', 'cap'],
      ['career', 'frontal', 'deciding', 'rocket'],
      ['hobbies', 'motor', 'moving', 'barbell'],
      ['places', 'parietal', 'place', 'globe'],
      ['skills', 'cerebellum', 'practice', 'block'],
      ['site', 'wernicke', 'language', 'browser'],
      ['speech', 'broca', 'speaking', null],
    ]);
  });

  it('light one at a time, fully at the stop and nearly dark halfway between', () => {
    expect(dwellWeights(dwellT(2))[2]).toBe(1);
    expect(dwellWeights(dwellT(2)).filter((w) => w > 0)).toHaveLength(1);
    expect(dwellWeights((dwellT(2) + dwellT(3)) / 2).every((w) => w < 0.1)).toBe(true);
    expect(answerShown(dwellT(4), 4)).toBe(1);
    expect(answerShown(dwellT(4), 3)).toBe(0);
  });
});

describe("the scanner's read-out (spec 6)", () => {
  const w = (t: number) => dwellWeights(t);
  const none = [0, 0, 0, 0, 0, 0, 0, 0];

  it('says what is happening, from the scan to the spit', () => {
    expect(readoutAt(0.12, w(0.12), 0, none)).toMatchObject({ status: 'scanning', n: 55 });
    expect(readoutAt(0.175, w(0.175), 0, none)).toMatchObject({ status: 'takingIn', region: 'whole', doing: 'listening' });
    expect(readoutAt(0.25, w(0.25), 0, none)).toMatchObject({ status: 'found', n: 6, doing: 'sorting' });
    expect(readoutAt(0.3, w(0.3), 0, none)).toMatchObject({ status: 'goingIn', region: 'prefrontal' });
    expect(readoutAt(dwellT(3), w(dwellT(3)), 0, none)).toMatchObject({ status: 'thought', n: 4, region: 'parietal', doing: 'place' });
    expect(readoutAt(0.8, w(0.8), 0, none)).toMatchObject({ status: 'words', region: 'broca' });
    expect(readoutAt(0.845, w(0.845), 0, none)).toMatchObject({ status: 'down', region: 'brainstem' });
    expect(readoutAt(0.87, w(0.87), 0, none)).toMatchObject({ status: 'jaw', region: 'jaw' });
    expect(readoutAt(0.9, w(0.9), 0.5, none)).toMatchObject({ status: 'holding', region: 'mouth', meter: 0.5 });
    expect(readoutAt(0.95, w(0.95), 0, none)).toMatchObject({ status: 'spitting', region: 'mouth' });
  });

  it('between two answers names the nearer, not the first', () => {
    const t = (dwellT(2) + dwellT(3)) / 2 + 0.01;
    expect(readoutAt(t, w(t), 0, none)).toMatchObject({ status: 'thought', n: 4 });
  });
});
