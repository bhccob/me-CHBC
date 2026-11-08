import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUND } from '~/ui/journey/paper';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string): string => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1].toLowerCase();
const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('the dark purple ground (Bob, 2026-11-08)', () => {
  it('is #130724, and the paper canvas paints the same', () => {
    expect(token('night')).toBe('#130724');
    expect(GROUND).toBe('#130724');
  });

  it('keeps every text colour readable on it', () => {
    for (const name of ['ink', 'gold-title', 'gold-ink', 'cream', 'lilac', 'gold']) expect(ratio(token(name), token('night'))).toBeGreaterThanOrEqual(7);
    for (const name of ['ink-dim', 'dim']) expect(ratio(token(name), token('night'))).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves no stray near-black ground in the styles or the page code', () => {
    const files = [...readdirSync('src/styles').map((f) => join('src/styles', f)), 'src/ui/journey/paper.ts'];
    for (const file of files) expect(readFileSync(file, 'utf8').toLowerCase(), file).not.toContain('#07060b');
  });
});
