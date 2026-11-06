import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flightLayout } from '~/journey/flight/layout';
import { digitPlaces, gatePlaces, irisOpening, yearDigits } from '~/journey/world/flight/Gates';
import { readGlbJson } from './glb';

const real = flightLayout([{ id: 'a', year: 2025 }, { id: 'b', year: 2026 }, { id: 'c', year: 2026 }, { id: 'd', year: 2026 }]);

describe('the gate model', () => {
  const nodes = readGlbJson('public/models/gate.glb').nodes.map((n) => n.name);

  it('has every digit, so that any year can be built', () => {
    for (let d = 0; d <= 9; d++) expect(nodes).toContain(`digit-${d}`);
  });

  it('has the frame, four gears and twelve blades', () => {
    expect(nodes).toContain('frame');
    for (let k = 0; k < 4; k++) expect(nodes).toContain(`gear-${k}`);
    for (let k = 0; k < 12; k++) expect(nodes).toContain(`blade-${k}`);
  });

  it('has the gear of the questions', () => {
    expect(nodes).toContain('qgear');
  });

  it('stays small', () => {
    expect(statSync('public/models/gate.glb').size).toBeLessThanOrEqual(1_200_000);
  });

  it('needs no decoder the page does not allow', () => {
    const { extensionsUsed = [] } = readGlbJson('public/models/gate.glb');
    expect(extensionsUsed).not.toContain('KHR_draco_mesh_compression');
    expect(extensionsUsed).not.toContain('EXT_meshopt_compression');
  });
});

describe('a year', () => {
  it('is its digits, whatever the year', () => {
    expect(yearDigits(2027)).toEqual(['2', '0', '2', '7']);
  });

  it('lines its digits up round the middle, by how wide each is', () => {
    expect(digitPlaces([1, 1, 1, 1])).toEqual([-1.5, -0.5, 0.5, 1.5]);
    expect(digitPlaces([2, 1])).toEqual([-0.5, 1]);
  });
});

describe('where the gates stand', () => {
  it('stands a gate at every place in the layout, and a year gate at each year', () => {
    const places = gatePlaces(real);
    expect(places.filter((p) => p.year === undefined).map((p) => p.s)).toEqual(real.gates);
    expect(places.filter((p) => p.year !== undefined)).toEqual([{ s: 20, year: 2025 }, { s: 60, year: 2026 }]);
  });
});

describe('a year gate', () => {
  it('stays shut far off, and opens as you reach it', () => {
    expect(irisOpening(26)).toBe(0);
    expect(irisOpening(9)).toBe(1);
    expect(irisOpening(17.5)).toBeCloseTo(0.5, 5);
  });
});
