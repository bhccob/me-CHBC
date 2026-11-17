import { type RouteConfig, index, route } from '@react-router/dev/routes';
import { labEnabled, PAGES, type PageId } from '../data/pages';
import { defaultLocale, locales, Translator } from '../i18n/Translator';
import { PAGE_KINDS } from './handle';

// The module that renders each page is the one of its kind (src/app/handle.ts). The three projects
// share one module: it reads which one from the URL, and the same module serves both locales, so
// every route names its own id.
const moduleOf = (page: PageId): string => `routes/${PAGE_KINDS[page]}.tsx`;

// NL is the default locale at the root; EN repeats every page under /en/. The list comes
// from PAGES (src/data/pages.ts), the same list that drives the prerender and the sitemap.
const ordered = [defaultLocale, ...locales.filter((locale) => locale !== defaultLocale)];

const pages = ordered.flatMap((locale) =>
  (Object.keys(PAGES) as PageId[]).map((page) => {
    const id = `${page}-${locale}`;
    const path = Translator.pathFor(locale, PAGES[page]); // '/', '/en/projects/jontai-energy/', ...
    // Case-sensitive, like the host: GitHub Pages has no /Projects/Jontai-Energy/, so the router must not match one
    // either (it falls through to the not-found route, and its scene is none).
    return path === '/' ? index(moduleOf(page), { id }) : route(path.slice(1), moduleOf(page), { id, caseSensitive: true });
  }),
);

// The opening's lab, only with LAB=1: throwaway previews, never prerendered (src/data/pages.ts).
const lab = labEnabled() ? [route('lab/:id', 'routes/lab.tsx', { id: 'lab', caseSensitive: true })] : [];

export default [...pages, ...lab, route('*', 'routes/not-found.tsx', { id: 'not-found' })] satisfies RouteConfig;
