import { type ComponentType, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import Home from '~/app/routes/home';
import Lite from '~/app/routes/lite';
import ProjectPage from '~/app/routes/project';
import { projects } from '~/data/projects';
import { redirects } from '~/data/redirects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

// Porfael was renamed Portle (Bob, 2026-10-29: "update my project to current projects"; spec
// 2026-10-29-bob-stack-3-design.md, goal 5): its name, words, tools, links and a picture from its own repository.

const LOCALES = [
  ['nl', nl, ''],
  ['en', en, '/en']
] as const;

const render = (path: string, page: ComponentType): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(page)));

describe('Portle', () => {
  const portle = projects.byId('portle')!;

  it('shows Portle, not Porfael', () => {
    expect(projects.all().map((p) => p.id)).toEqual(['steady', 'portle', 'jontai-energy', 'cookies-clicker']);
    expect(portle.title).toBe('Portle');
    for (const [, t, prefix] of LOCALES) {
      const pages = [
        render(`${prefix}/`, Home),
        render(`${prefix}/lite/`, Lite),
        render(`${prefix}/projects/portle/`, ProjectPage)
      ];
      expect(pages[0]).toContain('id="project-portle"');
      expect(pages[1]).toContain('Portle');
      expect(pages[2]).toMatch(/<h1[^>]*><span>Portle <\/span><\/h1>/);
      expect(pages[2]).toContain(t === nl ? portle.copy('nl').summary : portle.copy('en').summary);
      for (const html of pages) expect(html).not.toMatch(/porfael/i);
    }
  });

  it('says what it is in its own words, in both languages', () => {
    expect(portle.copy('en')).toMatchObject({
      type: 'Web app · Personal project, in early access',
      role: 'Sole developer',
      summary:
        'A private archive for your portfolio, your investment theses and the friends you trust with them: one portfolio across your accounts, theses with their revisions, a paper-trading lab, a journal, and Guilds and Relics. In early access.'
    });
    expect(portle.copy('nl')).toMatchObject({
      type: 'Webapp · Eigen project, in early access',
      role: 'Enige ontwikkelaar',
      summary:
        'Een privéarchief voor uw portfolio, uw beleggingsthesen en de vrienden aan wie u ze toevertrouwt: één portefeuille over uw rekeningen heen, theses met hun revisies, een oefenlab voor trades, een dagboek, en Gildes en Relics. In early access.'
    });
    expect(portle.copy('en').metaDescription).toMatch(/^Portle: a private archive for your portfolio, your investment theses and the friends you trust with them/);
    expect(portle.copy('nl').metaDescription).toMatch(/^Portle: een privéarchief voor uw portfolio, uw beleggingsthesen en de vrienden aan wie u ze toevertrouwt/);
    expect(portle.stack).toEqual(['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Drizzle', 'PostgreSQL', 'Better Auth']);
    expect([portle.year, portle.categoryId, portle.order]).toEqual([2026, 'app', 2]);
  });

  it("links Portle's repository and its live site", () => {
    expect(portle.links).toEqual({ repo: 'https://github.com/bhccob/Portle', live: 'https://portle-azure.vercel.app' });
    for (const [, t, prefix] of LOCALES) {
      const page = render(`${prefix}/projects/portle/`, ProjectPage);
      expect(page).toContain('href="https://portle-azure.vercel.app"');
      expect(page).toContain('href="https://github.com/bhccob/Portle"');
      expect(page).toContain(t.pages.site);
      expect(page).toContain(t.work.github);
    }
    // A site, not a download.
    expect([nl.pages.site, en.pages.site]).toEqual(['Naar de site', 'Visit the site']);
  });

  it("forwards Porfael's old addresses", () => {
    expect(redirects).toContainEqual({ from: '/projects/porfael/', to: '/projects/portle/', locale: 'nl' });
    expect(redirects).toContainEqual({ from: '/en/projects/porfael/', to: '/en/projects/portle/', locale: 'en' });
    expect(projects.byRoute('/projects/portle/')?.id).toBe('portle');
    expect(projects.byRoute('/projects/porfael/')).toBeUndefined();
  });

  it('shows one picture of Portle', () => {
    expect(portle.pictureKind).toBe('wide');
    expect(portle.pictures).toEqual([
      {
        file: 'portle-portfolio.webp',
        alt: { nl: 'Portle: het portfolio-overzicht van een voorbeeldlid', en: "Portle: an example member's portfolio overview" }
      }
    ]);
    expect(portle.pictureCaption('nl')).toBe('Portle in early access, met voorbeeldgegevens');
    expect(portle.pictureCaption('en')).toBe('Portle in early access, with example data');
    expect(typeof portle.pictureUrl('portle-portfolio.webp')).toBe('string');
    expect(render('/projects/portle/', ProjectPage)).toContain('alt="Portle: het portfolio-overzicht van een voorbeeldlid"');
  });
});
