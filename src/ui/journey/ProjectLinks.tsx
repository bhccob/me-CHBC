import type { JSX } from 'react';
import { projects } from '~/data/projects';
import { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';

/**
 * The flight's projects as real words and real links, oldest first. The words on screen are drawn in the 3D, so these are for
 * whoever reads the page another way. Only the project you are at shows its link, placed under its words as you fly.
 */
export function ProjectLinks(): JSX.Element {
  const { locale, t } = useTranslator();
  return (
    <section id="j-projects" className="j-projects" aria-label={t.journey.rail.projects}>
      {projects.byDate().map((project) => {
        const copy = project.copy(locale);
        return (
          <article key={project.id} id={`project-${project.id}`} className="j-project" data-project={project.id}>
            <h3>{project.title}</h3>
            <p>
              {project.year}, {copy.flightKind}
            </p>
            <p>{copy.flightLine}</p>
            <a className="j-open" href={Translator.pathFor(locale, projects.route(project))} aria-label={`${t.journey.flight.open}: ${project.title}`}>
              {t.journey.flight.open}
            </a>
          </article>
        );
      })}
    </section>
  );
}
