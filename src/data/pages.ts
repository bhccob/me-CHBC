import { defaultLocale, locales, Translator } from '../i18n/Translator';

export type PageId =
  | 'home'
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
  'project-jontai-energy': '/projects/jontai-energy/',
  'project-cookies-clicker': '/projects/cookies-clicker/',
  lite: '/lite/',
  contact: '/contact/',
};

/**
 * The opening's lab: throwaway previews of the new opening at /lab/<id>/, only in a dev server or build run with LAB=1.
 * Never prerendered, never in the sitemap. Read in Node only (routes.ts); deleted with the lab.
 */
export const LAB_IDS = ['b', 'd'] as const;
export function labEnabled(): boolean {
  return process.env.LAB === '1';
}

/** Every page in every locale, Dutch (at the root) first, then English (under /en/). Each path ends in `/`. */
export function pagePaths(): string[] {
  const ordered = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];
  return ordered.flatMap((locale) => Object.values(PAGES).map((route) => Translator.pathFor(locale, route)));
}
