import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { nl } from '~/i18n/nl';

const INFORMAL = /\b(je|jij|jou|jouw|jezelf)\b/i;

function sentences(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(sentences);
  return [];
}

// The site speaks to its visitor as "u". Bob's own Q&A keeps his "je": those are questions put to him.
describe('the Dutch speaks formally to its visitor', () => {
  it.each([
    ['the journey', nl.journey],
    ['the contact page', nl.contact],
    ['the page not found', nl.notFound],
    ['the end of the old Q&A ring', nl.end.ring],
  ])('%s', (_where, words) => {
    expect(sentences(words).filter((sentence) => INFORMAL.test(sentence))).toEqual([]);
  });

  it('on every project', () => {
    expect(projects.byDate().flatMap((project) => sentences(project.copy('nl'))).filter((sentence) => INFORMAL.test(sentence))).toEqual([]);
  });
});
