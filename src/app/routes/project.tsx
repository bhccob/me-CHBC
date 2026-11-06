import { type MetaFunction, useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { projects } from '~/data/projects';
import { localeFromPath, routeFromPath } from '~/i18n/locale';
import { translatorFor, useTranslator } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { notFoundMeta } from '~/seo/notFound';
import { breadcrumbLd, projectLd } from '~/seo/structured';
import { closeHref } from '~/ui/journey/openProject';
import { NotFoundPage } from '~/ui/NotFoundPage';
import { ProjectSheet } from '~/ui/ProjectSheet';
import { HANDLES, type RouteHandle } from '../handle';

export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  // The projects share this module, so the path says which. A path that names none of them
  // (a real page under another spelling) gets the not-found page, never an error.
  const project = projects.byRoute(routeFromPath(location.pathname));
  if (!project) return notFoundMeta(locale);
  const route = projects.route(project);
  return head({
    locale,
    route,
    // "Steady · Work": the same project page in both languages needs a title of its own in each.
    title: `${project.title} · ${t.nav.work}`,
    description: project.copy(locale).metaDescription,
    jsonLd: [
      projectLd(project, locale),
      breadcrumbLd(locale, [
        { name: profile.name, route: PAGES.home },
        { name: project.title, route },
      ]),
    ],
  });
};

export const handle: RouteHandle = HANDLES.project;

// A direct visit: the same page as over the flight, on its own and with no 3D needed. Its close goes to its stop in the flight.
export default function ProjectPage() {
  const { t, locale } = useTranslator();
  const project = projects.byRoute(routeFromPath(useLocation().pathname));
  if (!project) return <NotFoundPage />;
  return (
    <article className="ps-page">
      <ProjectSheet id={project.id} headingId={`ps-${project.id}`} Heading="h1" />
      <a className="ps-back" href={closeHref(project.id, locale)}>
        <span aria-hidden="true">←</span> {t.journey.flight.back}
      </a>
    </article>
  );
}
