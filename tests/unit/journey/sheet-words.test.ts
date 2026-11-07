import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

/**
 * A sheet's facts stand in three columns of about 100 px on a 360 px phone, at 14 px (journey.css). A word longer than
 * about 15 letters does not fit one, and ran into the next column (2026-11-07, Dutch: "cybersecuritybedrijf" and
 * "firmwarebeveiliging"). A long word carries a soft hyphen (U+00AD) where it may break; on a wide page none shows.
 */
const SOFT_HYPHEN = '­';
const LONGEST = 15;

describe("the sheets' facts on a phone", () => {
  for (const [lang, dictionary] of [['en', en], ['nl', nl]] as const) {
    it(`has no ${lang} word too long for a phone's column without a place to break`, () => {
      const tooLong = dictionary.journey.sheets
        .flatMap((sheet) => sheet.facts.map((fact) => fact.value))
        .flatMap((value) => value.split(/[\s,]+/))
        .filter((word) => word.split(SOFT_HYPHEN).some((part) => part.length > LONGEST));
      expect(tooLong).toEqual([]);
    });
  }

  it('reads the same with its soft hyphens taken out', () => {
    const facts = nl.journey.sheets[2].facts.map((fact) => fact.value.replaceAll(SOFT_HYPHEN, ''));
    expect(facts).toContain('Stagiair bij een cybersecuritybedrijf');
    expect(facts).toContain('DevSecOps, firmwarebeveiliging');
  });
});
