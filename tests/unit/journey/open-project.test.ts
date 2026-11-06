import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameForHash } from '~/journey/jump';
import { buildTimeline } from '~/journey/timeline';
import { closeHref, closeProject, langPathWhileOpen, openedProject, openProject, popped, watchOpened } from '~/ui/journey/openProject';
import { ProjectSheet } from '~/ui/ProjectSheet';
import { render } from './render';

const tl = buildTimeline();

/** A browser's history, enough for this. */
function fakeHistory(path: string) {
  const pushed: { state: unknown; url: string }[] = [];
  const back = vi.fn();
  vi.stubGlobal('history', {
    state: { idx: 3, key: 'k' },
    pushState: (state: unknown, _: string, url: string) => pushed.push({ state, url }),
    replaceState: vi.fn(),
    back,
  });
  vi.stubGlobal('location', { pathname: path });
  return { pushed, back };
}

afterEach(() => {
  popped(null);
  vi.unstubAllGlobals();
});

describe('the address of a project', () => {
  it('closes to its stop in the flight, in its language', () => {
    expect(closeHref('steady', 'nl')).toBe('/#project-steady');
    expect(closeHref('steady', 'en')).toBe('/en/#project-steady');
  });

  it('lands at its stop', () => {
    expect(frameForHash('#project-steady', tl, ['cookies-clicker', 'jontai-energy', 'steady', 'portle'])).toBe(tl.reads[2]);
  });

  it('keeps the language link right while it is open', () => {
    expect(langPathWhileOpen('/projects/steady/', 'en')).toBe('/en/projects/steady/');
    expect(langPathWhileOpen('/en/projects/steady/', 'nl')).toBe('/projects/steady/');
  });
});

describe('opening a project', () => {
  it('changes the address, without leaving the page', () => {
    const { pushed } = fakeHistory('/en/journey/');
    openProject('steady', 493);
    expect(pushed).toHaveLength(1);
    expect(pushed[0].url).toBe('/en/projects/steady/');
    expect(openedProject()).toMatchObject({ id: 'steady', f: 493 });
  });

  it('keeps the router its own marks in the history', () => {
    const { pushed } = fakeHistory('/journey/');
    openProject('portle', 537);
    expect(pushed[0].state).toMatchObject({ idx: 3, key: 'k', journeyProject: 'portle' });
    expect(pushed[0].url).toBe('/projects/portle/');
  });

  it('does not stack the same project twice', () => {
    const { pushed } = fakeHistory('/journey/');
    openProject('portle', 537);
    openProject('portle', 537);
    expect(pushed).toHaveLength(1);
  });

  it('closes by going back, so that Back and the close do the same', () => {
    const { back } = fakeHistory('/journey/');
    openProject('portle', 537);
    closeProject();
    expect(back).toHaveBeenCalledTimes(1);
    expect(openedProject()).not.toBeNull();
    expect(popped(null)).toBe(true);
    expect(openedProject()).toBeNull();
  });

  it('runs what was asked for once it has closed', () => {
    fakeHistory('/journey/');
    openProject('portle', 537);
    const then = vi.fn();
    closeProject(then);
    expect(then).not.toHaveBeenCalled();
    popped(null);
    expect(then).toHaveBeenCalledTimes(1);
  });

  it('does nothing to close when nothing is open', () => {
    const { back } = fakeHistory('/journey/');
    closeProject();
    expect(back).not.toHaveBeenCalled();
  });

  it('opens again on Forward, at the frame it stands at', () => {
    fakeHistory('/journey/');
    expect(popped({ journeyProject: 'steady' }, 493)).toBe(true);
    expect(openedProject()).toMatchObject({ id: 'steady', f: 493 });
  });

  it('leaves every other Back to the router', () => {
    fakeHistory('/journey/');
    expect(popped({ idx: 1 })).toBe(false);
  });

  it('tells those watching', () => {
    fakeHistory('/journey/');
    const heard = vi.fn();
    const stop = watchOpened(heard);
    openProject('steady', 493);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    popped(null);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('the page of a project', () => {
  const html = render(ProjectSheet, { id: 'jontai-energy', headingId: 'x' });

  it('holds its title, words and case', () => {
    expect(html).toContain('Jontai');
    expect(html).toContain('Energy');
    expect(html).toContain('Concept website');
    expect(html).toContain('<h2');
  });

  it('holds its way out to the live site', () => {
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('says it in Dutch at a Dutch address', () => {
    expect(render(ProjectSheet, { id: 'jontai-energy', headingId: 'x' }, '/')).toContain('Conceptwebsite');
  });

  it('is nothing for a project that does not exist', () => {
    expect(render(ProjectSheet, { id: 'none', headingId: 'x' })).toBe('');
  });
});
