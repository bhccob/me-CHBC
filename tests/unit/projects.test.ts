import { describe, expect, it } from 'vitest';
import { categories } from '../../src/data/categories';
import { PAGES } from '../../src/data/pages';
import { type ProjectData, ProjectCatalog, projects } from '../../src/data/projects';
import { locales } from '../../src/i18n/Translator';

const all = projects.all();
const project = (id: string) => {
  const found = projects.byId(id);
  if (!found) throw new Error(`no project ${id}`);
  return found;
};

describe('categories', () => {
  it('are the kinds of work, in order (Bob, 2026-10-28: "Game Developement, Website, App")', () => {
    expect(categories.all().map((category) => [category.id, category.number, category.label('en')])).toEqual([
      ['app', 1, 'APP'],
      ['website', 2, 'WEBSITE'],
      ['game', 3, 'GAME DEVELOPMENT'],
    ]);
  });

  it('are translated in Dutch', () => {
    expect(categories.all().map((category) => category.label('nl'))).toEqual(['APP', 'WEBSITE', 'GAME-ONTWIKKELING']);
  });

  it('heads the categories by number and kind, in both languages', () => {
    expect(categories.byId('app').heading('en')).toBe('01 — APP');
    expect(categories.byId('website').heading('nl')).toBe('02 — WEBSITE');
    expect(categories.byId('game').heading('en')).toBe('03 — GAME DEVELOPMENT');
    expect(categories.byId('game').heading('nl')).toBe('03 — GAME-ONTWIKKELING');
  });
});

describe('projects', () => {
  it('are two, Jontai Energy then Cookies Clicker (Bob, 2026-11-07: Portle and Steady off for now)', () => {
    expect(all.map((entry) => entry.id)).toEqual(['jontai-energy', 'cookies-clicker']);
    expect(all.map((entry) => entry.order)).toEqual([1, 2]);
  });

  it('have no Portle or Steady for now: no project, page or route of theirs', () => {
    for (const id of ['portle', 'steady']) {
      expect(projects.byId(id), id).toBeUndefined();
      expect(Object.keys(PAGES).some((page) => page.includes(id)), id).toBe(false);
      expect(projects.byRoute(`/projects/${id}/`), id).toBeUndefined();
    }
  });

  it('has no Funcial anywhere: no project, page or route by that id (Bob, 2026-10-28)', () => {
    expect(projects.byId('funcial')).toBeUndefined();
    expect(Object.keys(PAGES).some((page) => page.includes('funcial'))).toBe(false);
    expect(Object.values(PAGES).some((route) => route.includes('funcial'))).toBe(false);
    expect(projects.byRoute('/projects/funcial/')).toBeUndefined();
  });

  it('have unique ids', () => {
    expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length);
  });

  it('files each project under the kind of work it is', () => {
    const known = categories.all().map((category) => category.id);
    for (const entry of all) expect(known, entry.id).toContain(entry.categoryId);
    expect(all.map((entry) => entry.categoryId)).toEqual(['website', 'game']);
  });

  it('each have a page of their own', () => {
    for (const entry of all) expect(projects.route(entry), entry.id).toBe(PAGES[`project-${entry.id}` as keyof typeof PAGES]);
  });

  it('keep the approved palettes and links', () => {
    expect(project('jontai-energy').palette).toEqual({ accent: '#00a650', glow: '#00d16a' });
    expect(project('cookies-clicker').palette).toEqual({ accent: '#c69255', glow: '#ff8a3d' });
    // Bob, 2026-10-29: the repository the site's pictures came from.
    expect(project('jontai-energy').links).toEqual({ repo: 'https://github.com/bhccob/Jontai-Energy' });
    expect(project('cookies-clicker').links).toEqual({ repo: 'https://github.com/bhccob/Cookies-Clicker' });
  });

  it('never list AI or Claude in a stack, nor describe a project with AI', () => {
    for (const entry of all) {
      for (const tool of entry.stack) expect(tool, entry.id).not.toMatch(/\b(AI|Claude)\b/i);
      for (const locale of locales) {
        const copy = entry.copy(locale);
        expect([copy.summary, copy.type, copy.metaDescription].join(' '), `${entry.id} ${locale}`).not.toMatch(/\bAI\b|artificial|kunstmatig|Claude/i);
      }
    }
  });

  it('list the stacks their own sources give', () => {
    expect(project('jontai-energy').stack).toEqual(['Next.js', 'React', 'TypeScript', 'GSAP', 'Lenis', 'Blender']);
    expect(project('cookies-clicker').stack).toEqual(['HTML', 'CSS', 'JavaScript', 'Bootstrap 5', 'localStorage']);
  });

  it('give both a screenshot', () => {
    expect(project('jontai-energy').image).toBeTypeOf('string');
    expect(project('cookies-clicker').image).toBeTypeOf('string');
  });

  it('never call Jontai Energy client work, and never link its company site or the unpublished Rewards work', () => {
    const jontai = project('jontai-energy');
    expect(jontai.links.live).toBeUndefined();
    for (const locale of locales) {
      const text = JSON.stringify(jontai.copy(locale));
      expect(text, locale).not.toMatch(/client work|for a client|klantwerk|voor een klant|opdracht/i);
      expect(text, locale).not.toMatch(/rewards/i);
    }
    expect(JSON.stringify(jontai).toLowerCase()).not.toContain('jontaienergy.com');
  });

  it('say Cookies Clicker is a school project for Web Game Development, made with "a classmate" at most', () => {
    const cookies = project('cookies-clicker');
    expect(cookies.copy('en').type).toMatch(/Web Game Development/);
    expect(cookies.copy('nl').type).toMatch(/Web Game Development/);
    // The classmate is never named (Bob has not decided): the only word for them is "classmate" / "klasgenoot".
    // His own part is not known either, so the role claims nothing about it.
    expect(cookies.copy('en').role).toBe('With a classmate');
    expect(cookies.copy('nl').role).toBe('Samen met een klasgenoot');
  });

  it('find a project by the route of its page, and none by a route that only differs in case', () => {
    expect(projects.byRoute('/projects/jontai-energy/')?.id).toBe('jontai-energy');
    expect(projects.byRoute('/projects/cookies-clicker/')?.id).toBe('cookies-clicker');
    expect(projects.byRoute('/Projects/Jontai-Energy/')).toBeUndefined();
    expect(projects.byRoute('/projects/JONTAI-ENERGY/')).toBeUndefined();
    expect(projects.byRoute('/projects/')).toBeUndefined();
  });

  it('write every project’s page copy in both languages', () => {
    for (const entry of all) {
      for (const locale of locales) {
        const copy = entry.copy(locale);
        for (const key of ['type', 'role', 'summary', 'metaDescription'] as const) expect(copy[key].trim().length, `${entry.id} ${locale} ${key}`).toBeGreaterThan(0);
        // The auditor wants a description of 50-170 characters.
        expect(copy.metaDescription.length, `${entry.id} ${locale}`).toBeGreaterThanOrEqual(50);
        expect(copy.metaDescription.length, `${entry.id} ${locale}`).toBeLessThanOrEqual(170);
      }
    }
  });
});

describe('the projects on the way (spec 2026-10-27-bob-light-path-design.md, goal 6: Way 2)', () => {
  /** Seven copies of the first project's data, ordered 1 to 7, flagged on the way where listed. */
  const sevenStubs = ({ flagged }: { flagged: number[] }): ProjectData[] => {
    const first = (projects as unknown as { items: { data: ProjectData }[] }).items[0]!.data;
    return Array.from({ length: 7 }, (_, k) => ({ ...first, order: k + 1, onPath: flagged.includes(k + 1) }));
  };

  it('puts every project on the way while there are five or fewer', () => {
    expect(projects.onPath().map((p) => p.id)).toEqual(['jontai-energy', 'cookies-clicker']);
    expect(projects.offPath()).toEqual([]);
  });

  it('takes the flagged projects onto the way when there are more than five', () => {
    const seven = new ProjectCatalog(sevenStubs({ flagged: [1, 2, 4, 5, 7] }));
    expect(seven.onPath().map((p) => p.order)).toEqual([1, 2, 4, 5, 7]);
    expect(seven.offPath().map((p) => p.order)).toEqual([3, 6]);
  });

  it('refuses more than five flagged, or none, past five projects', () => {
    expect(() => new ProjectCatalog(sevenStubs({ flagged: [1, 2, 3, 4, 5, 6] })).onPath()).toThrow(/at most 5/);
    expect(() => new ProjectCatalog(sevenStubs({ flagged: [] })).onPath()).toThrow(/at most 5/);
  });
});

// The pictures on each project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, goal 2): made from
// each project's own code, stand-in details only.
describe('pictures', () => {
  it('gives Jontai Energy and Cookies Clicker one wide picture each, with a line under it', () => {
    expect(project('jontai-energy').pictureKind).toBe('wide');
    expect(project('jontai-energy').pictures.map((picture) => picture.file)).toEqual(['jontai-type.webp']);
    expect(project('cookies-clicker').pictureKind).toBe('wide');
    expect(project('cookies-clicker').pictures.map((picture) => picture.file)).toEqual(['cookies-playing.webp']);
  });

  it('links Jontai Energy to its own repository', () => {
    expect(project('jontai-energy').links.repo).toBe('https://github.com/bhccob/Jontai-Energy');
  });

  it('resolves every picture to a built URL', () => {
    for (const entry of all) {
      for (const picture of entry.pictures) expect(typeof entry.pictureUrl(picture.file), `${entry.id} ${picture.file}`).toBe('string');
    }
  });
});
