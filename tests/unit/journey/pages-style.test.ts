import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { personLd } from '~/seo/structured';

const base = readFileSync('src/styles/base.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const root = readFileSync('src/app/root.tsx', 'utf8');

describe('the other pages, in the new style', () => {
  it('have left the old fonts behind', () => {
    for (const font of ['Montserrat', 'Unbounded', 'Martian Mono']) {
      expect(base, font).not.toContain(font);
      expect(tokens, font).not.toContain(font);
      expect(root, font.toLowerCase()).not.toContain(font.toLowerCase().replace(' ', '-'));
    }
  });

  it('are set in the journey\'s fonts', () => {
    expect(tokens).toContain("'Barlow'");
    expect(tokens).toContain("'IBM Plex Mono'");
    expect(root).toContain('@fontsource/barlow');
    expect(root).toContain('@fontsource/ibm-plex-mono');
  });

  it('are on the journey\'s colours: its ink, its one gold and its dark', () => {
    expect(tokens).toMatch(/--ink:\s*#f2efe8/);
    expect(tokens).toMatch(/--gold:\s*#e6b84a/);
    expect(tokens).toMatch(/--night:\s*#07060b/);
  });

  it('have the journey\'s header, whatever the page', () => {
    expect(base).toMatch(/\.site-header \.site-name\s*\{[^}]*font:\s*700 15px/);
    expect(base).toMatch(/\.site-header \.header-control\s*\{[^}]*font:\s*500 15px/);
  });

  it('keep every page\'s share image at the same address', () => {
    expect(readFileSync('tools/build/og.mjs', 'utf8')).toContain("'og.jpg'");
    expect(readFileSync('tools/build/og.mjs', 'utf8')).not.toContain('compass-hero');
  });
});

describe('what the page says of him to search engines', () => {
  it('says where he is from, in the new wording', () => {
    expect(personLd().description).toContain('Aruba');
    expect(personLd().description).toContain('mechatronics');
  });

  it('has no leftover field in it', () => {
    expect(String(personLd().description)).not.toContain('{age}');
  });
});

describe('the words the pages share', () => {
  it('are in both languages', () => {
    expect(en.journey.sheets).toHaveLength(nl.journey.sheets.length);
  });
});
