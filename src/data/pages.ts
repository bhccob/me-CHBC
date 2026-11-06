import { defaultLocale, locales, Translator } from '../i18n/Translator';

export type PageId =
  | 'home'
  | 'project-steady'
  | 'project-portle'
  | 'project-jontai-energy'
  | 'project-cookies-clicker'
  | 'lite'
  | 'contact';

/**
 * Every page of the site as a locale-neutral route, the form `Translator.pathFor`
 * takes. This list drives the prerender, the sitemap and the redirect checks.
 */
export const PAGES: Record<PageId, string> = {
  home: '/',
  'project-steady': '/projects/steady/',
  'project-portle': '/projects/portle/',
  'project-jontai-energy': '/projects/jontai-energy/',
  'project-cookies-clicker': '/projects/cookies-clicker/',
  lite: '/lite/',
  contact: '/contact/',
};

/**
 * The new home's review address, beside the old home until the swap (plan 2026-11-06-bob-machine-rebuild, Task 1). Only with
 * JOURNEY=1 at build time; not a page of `PAGES`, so the sitemap and the deployed site never see it.
 */
export const JOURNEY_ROUTE = '/journey/';
export const JOURNEY_PATHS = ['/journey/', '/en/journey/'] as const;

/** Whether this build has the review address. */
export function journeyEnabled(): boolean {
  return typeof process !== 'undefined' && process.env.JOURNEY === '1';
}

/** Every page in every locale, Dutch (at the root) first, then English (under /en/). Each path ends in `/`. */
export function pagePaths(): string[] {
  const ordered = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];
  return ordered.flatMap((locale) => Object.values(PAGES).map((route) => Translator.pathFor(locale, route)));
}
