import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeHead, encodeHead } from '~/journey/head/headBin';
import { brainSdf, headOutline, headSdf } from '~/journey/head/shape';

describe("Bob's head, from the mock's distance fields", () => {
  it('is inside at its middle, outside far off, crown at 1.22', () => {
    expect(headSdf(0, 0, 0)).toBeLessThan(0);
    expect(headSdf(0, 3, 0)).toBeGreaterThan(0);
    expect(Math.abs(headSdf(0, 1.22, -0.05))).toBeLessThan(0.04);
  });

  it('has a brain in each half', () => {
    expect(brainSdf(0.25, 0.47, -0.08)).toBeLessThan(0);
    expect(brainSdf(-0.25, 0.47, -0.08)).toBeLessThan(0);
    expect(brainSdf(0.25, 1.2, -0.08)).toBeGreaterThan(0);
  });

  it('draws a side outline of head and brain', () => {
    const { head, brain } = headOutline();
    expect(head.length).toBeGreaterThan(200);
    expect(brain.length).toBeGreaterThan(100);
  });
});

describe('head.bin', () => {
  it('round-trips, within its quantizing', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0.5, -0.25, -1, 1, 1]);
    const [back] = decodeHead(encodeHead([{ name: 'brainDust', positions, extra: new Float32Array([0, 0.5, 1]) }]));
    expect(back.name).toBe('brainDust');
    back.positions.forEach((v, i) => expect(v).toBeCloseTo(positions[i], 3));
    back.extra!.forEach((v, i) => expect(v).toBeCloseTo([0, 0.5, 1][i], 2));
  });

  it('keeps an index and normals', () => {
    const [back] = decodeHead(encodeHead([{ name: 'skin', positions: new Float32Array(9), normals: new Float32Array([0, 1, 0, 0, 1, 0, 1, 0, 0]), index: new Uint32Array([0, 1, 2]), extra: new Float32Array([0, 1, 1]) }]));
    expect(Array.from(back.index!)).toEqual([0, 1, 2]);
    expect(back.normals![1]).toBeCloseTo(1, 1);
    expect(Array.from(back.extra!)).toEqual([0, 1, 1]);
  });

  it('holds skin with its lid, brain and brain dust, in at most 3 MB', () => {
    expect(existsSync('public/models/head.bin')).toBe(true);
    const file = readFileSync('public/models/head.bin');
    expect(file.byteLength).toBeLessThanOrEqual(3 * 1024 * 1024);
    const parts = decodeHead(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    expect(parts.map((p) => p.name)).toEqual(['skin', 'brain', 'brainDust']);
    expect(new Set(parts[0].extra)).toEqual(new Set([0, 1]));
  });
});
