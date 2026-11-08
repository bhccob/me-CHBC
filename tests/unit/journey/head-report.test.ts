import { describe, expect, it } from 'vitest';
import { reportFrameOpacity, rowShown, scanLineAt, softBangAt } from '~/journey/head/report';

describe('the scan line prints the report (spec 5.11)', () => {
  it('opens at the spark, sweeps down, and fades', () => {
    expect(scanLineAt(0.957).opacity).toBe(0);
    expect(scanLineAt(0.962)).toMatchObject({ opacity: 1, widen: 1, down: 0 });
    expect(scanLineAt(0.974).down).toBeCloseTo(0.5, 6);
    expect(scanLineAt(0.99).opacity).toBe(0);
  });

  it('prints a row only once the line has passed it', () => {
    expect(rowShown(0.974, 0.6)).toBe(0);
    expect(rowShown(0.986, 0.6)).toBe(1);
  });

  it('the panel is up before the line moves', () => expect(reportFrameOpacity(0.965)).toBe(1));
});

describe('the soft big bang (Bob: not too strong)', () => {
  it('flashes at 0.22 at most, with three rings, and grows over the ending', () => {
    expect(softBangAt(0.958).flash).toBeCloseTo(0.22, 6);
    expect(softBangAt(0.97).flash).toBeLessThan(0.02);
    expect(softBangAt(0.97).rings).toHaveLength(3);
    expect([softBangAt(0.958).grow, softBangAt(0.99).grow]).toEqual([0, 1]);
  });
});
