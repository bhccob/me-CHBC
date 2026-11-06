import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { flightLayout } from '~/journey/flight/layout';
import { bankAt, center, FLIGHT_FOV, fovAt, frameAt, nearestStop, tintAt, washAt } from '~/journey/world/flight/path';

const real = flightLayout([{ id: 'a', year: 2025 }, { id: 'b', year: 2026 }, { id: 'c', year: 2026 }, { id: 'd', year: 2026 }]);
const tints: [number, number, number][] = [[1, 0.6, 0.24], [1, 0.78, 0.42], [0.98, 0.86, 0.66], [0.58, 0.5, 1]];

describe('the path through the tunnel', () => {
  it('starts straight at the mouth', () => {
    expect(center(0, 180, new Vector3()).length()).toBeCloseTo(0, 6);
  });

  it('runs on down the depth, one unit a unit', () => {
    expect(center(100, 180, new Vector3()).z).toBe(-100);
  });

  it('curves in the middle, and straightens at the far end', () => {
    expect(Math.abs(center(90, 180, new Vector3()).x) + Math.abs(center(90, 180, new Vector3()).y)).toBeGreaterThan(0.5);
    expect(center(180, 180, new Vector3()).x).toBeCloseTo(0, 6);
  });

  it('has a frame with square axes at every point', () => {
    const { T, R, U } = frameAt(77, 180);
    expect(T.dot(R)).toBeCloseTo(0, 6);
    expect(R.dot(U)).toBeCloseTo(0, 6);
    expect(T.length()).toBeCloseTo(1, 6);
  });

  it('stays straight longer with a longer flight', () => {
    expect(center(170, 216, new Vector3()).x).not.toBeCloseTo(center(170, 180, new Vector3()).x, 3);
  });
});

describe('the feel of the flight', () => {
  it('widens with speed', () => {
    expect(fovAt(0, false)).toBe(FLIGHT_FOV);
    expect(fovAt(1, false)).toBe(FLIGHT_FOV + 11);
    expect(fovAt(0, true)).toBe(68);
  });

  it('banks into bends, gently', () => {
    expect(bankAt(new Vector3(1, 0, 0))).toBeCloseTo(-0.14);
    expect(bankAt(new Vector3(-0.1, 0, 0))).toBeCloseTo(0.055);
  });
});

describe('the colour of the tunnel', () => {
  it('takes on the project you are nearing', () => {
    expect(tintAt(real.stops[3].s, real, tints)).toEqual([0.58, 0.5, 1]);
  });

  it('is gold away from them', () => {
    const gold = tintAt(0, real, tints);
    expect(gold[0]).toBe(1);
    expect(gold[1]).toBeCloseTo(0.7);
    expect(gold[2]).toBeCloseTo(0.28);
  });

  it('knows which stop is nearest, and how near', () => {
    expect(nearestStop(0, real)).toEqual({ index: -1, near: 0 });
    expect(nearestStop(real.stops[1].s, real)).toEqual({ index: 1, near: 1 });
    expect(nearestStop(real.stops[1].s + 20, real).index).not.toBe(1);
  });
});

describe('the dark behind the tunnel', () => {
  it('is barely there, and a little more of the project when you are at it', () => {
    const away = washAt([1, 0.6, 0.24], 0);
    const at = washAt([1, 0.6, 0.24], 1);
    expect(away[0]).toBeCloseTo(0.00196, 6);
    expect(at[0]).toBeGreaterThan(away[0]);
    expect(at[0]).toBeLessThan(0.004);
  });
});
