import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import ProjectPage from '../../src/app/routes/project';
import { projects } from '../../src/data/projects';
import { nl } from '../../src/i18n/nl';

const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(ProjectPage)));

describe('a project page', () => {
  it('lists the stack and the links a project has', () => {
    const html = render('/projects/jontai-energy/');
    expect(html).toContain(`<dt>${nl.work.stack}</dt>`);
    expect(html).toContain('<li>Next.js</li>');
    expect(html).toContain('href="https://github.com/bhccob/Jontai-Energy"');
  });

  it('gives each picture the size of its file, so the page does not jump when it arrives', async () => {
    for (const project of projects.byDate()) {
      for (const picture of project.pictures) {
        const file = await sharp(new URL(`../../src/assets/projects/${picture.file}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')).metadata();
        expect([picture.width, picture.height], picture.file).toEqual([file.width, file.height]);
      }
    }
    const html = render('/projects/jontai-energy/');
    expect(html.match(/<img [^>]*>/g)?.every((img) => /\swidth="\d+"/.test(img) && /\sheight="\d+"/.test(img))).toBe(true);
  });

  it('gives a project with no live site no link to one', () => {
    expect(render('/projects/jontai-energy/')).not.toContain(nl.pages.site);
  });
});

describe('the headings of a project page (round 22)', () => {
  it('go down one level at a time: the title, then its sections', () => {
    for (const path of ['/projects/jontai-energy/', '/en/projects/cookies-clicker/']) {
      const levels = [...render(path).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
      expect(levels[0], path).toBe(1);
      levels.slice(1).forEach((level, i) => expect(level - levels[i], `${path}: h${levels[i]} then h${level}`).toBeLessThanOrEqual(1));
    }
  });
});
