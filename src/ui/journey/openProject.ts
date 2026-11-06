import { localeFromPath, routeFromPath } from '~/i18n/locale';
import { type Locale, Translator } from '~/i18n/Translator';

/**
 * A project opened over the flight (spec 2026-11-05-bob-machine-rebuild-design.md, section 9). It changes the address with
 * `history.pushState` and not through the router, so that the journey and its scroll stay where they are under it. Back
 * closes it, and the close goes back: there is one way out of it.
 */

export interface OpenedProject {
  id: string;
  /** The frame it was opened at. */
  f: number;
}

let opened: OpenedProject | null = null;
let afterClose: (() => void) | null = null;
const watchers = new Set<() => void>();

const set = (next: OpenedProject | null): void => {
  opened = next;
  for (const watcher of watchers) watcher();
};

export const openedProject = (): OpenedProject | null => opened;
export const nothingOpened = (): OpenedProject | null => null;

export function watchOpened(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

/** Where a project's close goes on a direct visit: its stop in the flight. */
export function closeHref(id: string, locale: Locale): string {
  return `${Translator.pathFor(locale, '/')}#project-${id}`;
}

/** The address a page has in another language. */
export function langPathWhileOpen(pathname: string, locale: Locale): string {
  return Translator.pathFor(locale, routeFromPath(pathname));
}

/** The address of a project, in the language of an address. */
const projectPath = (id: string, pathname: string): string => Translator.pathFor(localeFromPath(pathname), `/projects/${id}/`);

export function openProject(id: string, f: number): void {
  if (opened?.id === id) return;
  history.pushState({ ...(history.state as object | null), journeyProject: id }, '', projectPath(id, location.pathname));
  set({ id, f });
}

/** Closes it by going back. `then` runs once it has. */
export function closeProject(then?: () => void): void {
  if (!opened) return;
  afterClose = then ?? null;
  history.back();
}

/** What a step through the history means here. Answers whether it was this one's, so the router need not hear of it. */
export function popped(state: unknown, f = 0): boolean {
  const id = (state as { journeyProject?: unknown } | null)?.journeyProject;
  if (typeof id === 'string') {
    set({ id, f });
    return true;
  }
  if (!opened) return false;
  set(null);
  const then = afterClose;
  afterClose = null;
  then?.();
  return true;
}

let journey: { frame: () => number; home: () => string } | null = null;

/**
 * Hears Back and Forward before the router does, since the router never knew of this step. On the window, listeners run in
 * the order they were added whatever their phase, so this one must be added before the router is made: root.tsx calls it as
 * it loads. With no journey on the page it stands aside.
 */
export function gateHistory(): void {
  addEventListener('popstate', (event) => {
    if (!journey || !popped(event.state, journey.frame())) return;
    event.stopImmediatePropagation();
    // After a change of language, the step back lands on the old language's address.
    if (!opened && location.pathname !== journey.home()) history.replaceState(history.state, '', journey.home());
  });
}

/** The journey is on the page: `home` is its address. Answers its leaving. */
export function listenToHistory(frame: () => number, home: () => string): () => void {
  journey = { frame, home };
  return () => {
    journey = null;
  };
}
