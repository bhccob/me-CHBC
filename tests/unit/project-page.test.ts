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
    const html = render('/projects/steady/');
    expect(html).toContain(`<dt>${nl.work.stack}</dt>`);
    expect(html).toContain('<li>Expo (SDK 58)</li>');
    expect(html).toContain('href="https://github.com/bhccob/steady"');
  });

  it('gives each picture the size of its file, so the page does not jump when it arrives', async () => {
    for (const project of projects.byDate()) {
      for (const picture of project.pictures) {
        const file = await sharp(new URL(`../../src/assets/projects/${picture.file}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')).metadata();
        expect([picture.width, picture.height], picture.file).toEqual([file.width, file.height]);
      }
    }
    const html = render('/projects/steady/');
    expect(html.match(/<img [^>]*>/g)?.every((img) => /\swidth="\d+"/.test(img) && /\sheight="\d+"/.test(img))).toBe(true);
  });

  it('gives a project with no live site no link to one', () => {
    expect(render('/projects/steady/')).not.toContain(nl.pages.site);
  });
});
