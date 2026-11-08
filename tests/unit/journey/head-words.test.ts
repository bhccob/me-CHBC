import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe("the head journey's words", () => {
  it('stand in both languages, key for key', () => expect(keys(nl.journey.head).sort()).toEqual(keys(en.journey.head).sort()));

  it("say Bob's heritage as the site already does, and no Status line", () => {
    expect(en.journey.head.report).toMatchObject({ heritage: 'Heritage', heritageValue: 'Chinese' });
    expect(nl.journey.head.report).toMatchObject({ heritage: 'Afkomst', heritageValue: 'Chinees' });
    expect(keys(en.journey.head.report)).not.toContain('status');
  });

  it('name every region, doing and topic the head uses', () => {
    expect(Object.keys(en.journey.head.regions)).toEqual(['prefrontal', 'frontal', 'motor', 'parietal', 'cerebellum', 'wernicke', 'broca', 'whole', 'brainstem', 'jaw', 'mouth']);
    expect(Object.keys(en.journey.head.topics)).toEqual(['plans', 'career', 'hobbies', 'places', 'skills', 'site']);
    expect(en.journey.head.status.thought).toContain('{n}');
  });
});
