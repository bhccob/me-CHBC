import type { RouteConfigEntry } from '@react-router/dev/routes';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import Home from '../../src/app/routes/home';
import routes from '../../src/app/routes';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';

const render = (path: string): string => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Home)));

const slashed = (path: string): string => `/${path}/`.replace(/\/+/g, '/');

/** The URL path of every route entry, as the router builds it. */
function routePaths(entries: readonly RouteConfigEntry[], parent = ''): string[] {
  return entries.flatMap((entry) => {
    const path = entry.path ? `${parent}/${entry.path}` : parent;
    const own = entry.index || entry.path ? [slashed(path)] : [];
    return [...own, ...routePaths(entry.children ?? [], path)];
  });
}

/** Every file under a folder of the repo. */
function sourceFiles(folder: string): string[] {
  const root = fileURLToPath(new URL(`../../${folder}`, import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
  return walk(root).filter((path) => /\.(ts|tsx|css)$/.test(path));
}

describe('the home page is the journey', () => {
  it.each([
    ['/', nl],
    ['/en/', en],
  ] as const)('%s opens on the first view', (path, t) => {
    const html = render(path);
    expect(html).toContain(t.journey.hero.cta);
    expect(html).toContain('id="j-hero"');
  });

  it('has no review address any more', async () => {
    const paths = routePaths(await routes);
    expect(paths).not.toContain('/journey/');
    expect(paths).not.toContain('/en/journey/');
  });

  it('keeps nothing of the old scenes, their scroll or their models', () => {
    const left = sourceFiles('src').filter((file) => /VirtualScroll|SceneHost|scene\/bob|engine\/bob/.test(readFileSync(file, 'utf8')));
    expect(left).toEqual([]);
  });
});
