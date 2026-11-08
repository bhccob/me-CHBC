import { readFileSync, statSync } from 'node:fs';
// @ts-expect-error opentype.js ships no types
import opentype from 'opentype.js';
import { describe, expect, it } from 'vitest';

const FILE = 'public/fonts/hakka.otf';

describe("the journey's fonts", () => {
  it('has the brush face for its two characters and no more than that', () => {
    const bytes = readFileSync(FILE);
    const hakka = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(hakka.charToGlyph('客').index).toBeGreaterThan(0);
    expect(hakka.charToGlyph('家').index).toBeGreaterThan(0);
    expect(statSync(FILE).size).toBeLessThanOrEqual(40_000);
  });

  it('serves every face from the site itself, since the CSP allows no other', () => {
    const css = readFileSync('src/styles/journey.css', 'utf8');
    expect(css).toContain("url('/fonts/hakka.otf')");
    expect(css).not.toMatch(/https?:\/\//);
    for (const face of ['@fontsource/barlow/latin-500.css', '@fontsource/barlow/latin-800.css', '@fontsource/barlow/latin-600-italic.css', '@fontsource/ibm-plex-mono/latin-500.css']) expect(css).toContain(face);
  });

  it('names the colours of the spec', () => {
    const css = readFileSync('src/styles/journey.css', 'utf8');
    // The ground is the tokens' --night, dark purple since 2026-11-08 (palette.test.ts).
    expect(css).toMatch(/--j-bg:\s*var\(--night\)/);
    for (const value of ['#f2efe8', '#e6b84a', '#0c0e1d', '#d4dbff', '#150b1a', '#f4cdec', '#07141a', '#bdf0e2', '#17100a', '#f5dcae']) expect(css).toContain(value);
  });
});
