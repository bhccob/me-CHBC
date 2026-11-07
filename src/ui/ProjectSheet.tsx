import type { CSSProperties, JSX } from 'react';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import '~/styles/project-sheet.css';

/** The colour of a project, for its accents. */
const tintOf = (tint: readonly [number, number, number]): string => `rgb(${tint.map((v) => Math.round(v * 255)).join(' ')})`;

/**
 * A project's own page: its words, its links, its pictures and how it was made. The same over the flight and on a direct
 * visit, dark and readable with no 3D (spec 2026-11-05-bob-machine-rebuild-design.md, section 9).
 */
export function ProjectSheet({ id, headingId, Heading = 'h2' }: { id: string; headingId: string; Heading?: 'h1' | 'h2' }): JSX.Element | null {
  const { t, locale } = useTranslator();
  const project = projects.byId(id);
  if (!project) return null;
  const copy = project.copy(locale);
  const phones = project.pictureKind === 'phones';
  const sections = [
    { title: t.project.overview, text: copy.overview },
    { title: t.project.build, text: copy.build },
    { title: t.project.focus, text: copy.focus },
  ].filter(({ text }) => text);

  return (
    <div className="ps" style={{ '--ps-tint': tintOf(project.flight.tint) } as CSSProperties}>
      <div className="ps-intro">
        <div>
          <p className="ps-kicker">
            <span>{project.year}</span> {copy.flightKind}
          </p>
          <Heading id={headingId} className="ps-title">
            {project.flight.titleLines.map((line) => (
              <span key={line}>{line} </span>
            ))}
          </Heading>
        </div>
        <div className="ps-text">
          <p className="ps-lead">{copy.summary}</p>
          <dl className="ps-facts">
            <div>
              <dt>{t.work.role}</dt>
              <dd>{copy.role}</dd>
            </div>
            <div>
              <dt>{t.work.type}</dt>
              <dd>{copy.type}</dd>
            </div>
            {project.stack.length > 0 && (
              <div>
                <dt>{t.work.stack}</dt>
                <dd>
                  <ul className="ps-tools">
                    {project.stack.map((tool) => (
                      <li key={tool}>{tool}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
          {(project.links.live || project.links.repo) && (
            <p className="ps-links">
              {project.links.live && (
                <a className="ps-link ps-first" href={project.links.live} target="_blank" rel="noopener noreferrer">
                  {t.pages.site} <span aria-hidden="true">→</span>
                </a>
              )}
              {project.links.repo && (
                <a className="ps-link" href={project.links.repo} target="_blank" rel="noopener noreferrer">
                  {t.work.github} <span aria-hidden="true">→</span>
                </a>
              )}
            </p>
          )}
        </div>
      </div>
      {project.pictures.length > 0 && (
        <div className={phones ? 'ps-media ps-phones' : 'ps-media ps-wide'}>
          {(phones ? project.pictures : project.pictures.slice(0, 1)).map((picture) => (
            <figure key={picture.file}>
              <img src={project.pictureUrl(picture.file) ?? undefined} width={picture.width} height={picture.height} alt={picture.alt[locale]} loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      )}
      {project.pictureCaption(locale) && <p className="ps-caption">{project.pictureCaption(locale)}</p>}
      {sections.length > 0 && (
        <div className="ps-case">
          {sections.map(({ title, text }) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
