import { describe, expect, it } from 'vitest';
import { nearAt, screenShare } from '~/journey/world/flight/ProjectStop';
import { wrapLines } from '~/journey/world/flight/wrap';
import { ProjectLinks } from '~/ui/journey/ProjectLinks';
import { escape, render } from './render';

const measure = (s: string): number => s.length * 10;

describe('the words beside a screen', () => {
  const long = 'Een concept-herontwerp voor een winkel op Aruba, waarbij de homepagina verloopt als één Arubaanse dag.';

  it('wrap inside their width', () => {
    expect(wrapLines(long, 300, measure).every((line) => measure(line) <= 300)).toBe(true);
  });

  it('keep every word, in order', () => {
    expect(wrapLines(long, 300, measure).join(' ')).toBe(long);
  });

  it('split a long unbroken word rather than overflow', () => {
    const word = 'Onafgebrokenwoordzonderspatiesdatheellangis';
    const lines = wrapLines(word, 200, measure);
    expect(lines.every((line) => measure(line) <= 200)).toBe(true);
    expect(lines.join('')).toBe(word);
  });

  it('go on after a split word', () => {
    expect(wrapLines('aaaaaaaaaaaaaaaaaaaaaaaaa bb', 100, measure)).toEqual(['aaaaaaaaaa', 'aaaaaaaaaa', 'aaaaa bb']);
  });

  it('have nothing to say about nothing', () => {
    expect(wrapLines('', 100, measure)).toEqual([]);
  });

  it('never loop on a width too small for a single letter', () => {
    expect(wrapLines('abc', 1, measure)).toEqual(['a', 'b', 'c']);
  });
});

describe('a screen', () => {
  it('is about 30% of the page wide on a 16:9 screen, at the reading distance', () => {
    expect(screenShare(2.45, 4.7, 54, 16 / 9)).toBeCloseTo(0.3, 1);
  });
});

describe('a stop nearing', () => {
  it('is fully near at the reading place, and not at all 15 away', () => {
    expect(nearAt(0)).toBe(1);
    expect(nearAt(15)).toBe(0);
    expect(nearAt(7.5)).toBeCloseTo(0.5, 5);
  });
});

describe('the real links under the flight', () => {
  const html = render(ProjectLinks);

  it('hold each project, oldest first', () => {
    expect(html.indexOf('Cookies Clicker')).toBeGreaterThan(-1);
    expect(html.indexOf('Cookies Clicker')).toBeLessThan(html.indexOf('Jontai Energy'));
    expect(html).not.toContain('Steady');
    expect(html).not.toContain('Portle');
  });

  it('hold each one line', () => {
    expect(html).toContain(escape('A browser game built with a classmate around one satisfying loop: click, earn, reinvest.'));
  });

  it('hold its year and kind', () => {
    expect(html).toContain('2025');
    expect(html).toContain('School project');
  });

  it('open a project at its own address, in the language you are in', () => {
    expect(html).toContain('href="/en/projects/jontai-energy/"');
    expect(html).toContain('>Open project<');
    expect(render(ProjectLinks, undefined, '/')).toContain('href="/projects/jontai-energy/"');
  });

  it('give each project the place its page closes to', () => {
    expect(html).toContain('id="project-jontai-energy"');
  });

  it('speak Dutch at the Dutch address', () => {
    expect(render(ProjectLinks, undefined, '/')).toContain('Schoolproject');
  });
});
