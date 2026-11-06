import type { CSSProperties, JSX } from 'react';
import { Link } from 'react-router';
import machineStill from '~/assets/journey/machine-still.webp?url';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';

const ARROW = (
  <i className="j-arrow" aria-hidden="true">
    ↗
  </i>
);

/**
 * The journey without its motion: a normal page that scrolls, with the same words and links on the same colours, and stills
 * for the moving parts. For a visitor who asks for less motion, and, with a pointer to Lite, where the 3D cannot run.
 */
export function CalmJourney({ litePointer = false }: { litePointer?: boolean }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const words = t.journey;
  const github = profile.socials.find((social) => social.id === 'github')!;
  const instagram = profile.socials.find((social) => social.id === 'instagram')!;

  return (
    <div id="top" className="j-calm">
      {litePointer && (
        <p className="j-calm-note" role="status">
          {words.calm.fallback} <Link to={i18n.path(PAGES.lite)}>{words.calm.lite}</Link>
        </p>
      )}

      <section className="j-calm-hero">
        <h1>
          {words.hero.from} {words.hero.to}{' '}
          {words.hero.words.map((word) => (
            <em key={word}>{word} </em>
          ))}
        </h1>
        <p>{words.hero.intro.replace('{age}', String(profile.ageOn()))}</p>
        <a className="j-calm-go" href="#projects">
          {words.hero.cta}
        </a>
      </section>

      {words.sheets.map((sheet, n) => (
        <section key={sheet.title.join(' ')} className="j-calm-sheet" style={{ '--j-calm-paper': `var(--j-sheet-${n}-paper)`, '--j-calm-word': `var(--j-sheet-${n}-word)` } as CSSProperties}>
          <h2>{sheet.title.join(' ')}</h2>
          <p className="j-calm-line">
            <strong>{sheet.line.lead}</strong> {sheet.line.rest}
          </p>
          <dl>
            {sheet.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <p className="j-calm-block">{sheet.titleBlock}</p>
        </section>
      ))}

      <section className="j-calm-stack">
        <img src={machineStill} alt={words.hero.machineAlt} width={1440} height={810} loading="lazy" decoding="async" />
        <h2>{words.stack.title}</h2>
        <p>{words.stack.text}</p>
      </section>

      <section id="projects" className="j-calm-projects">
        <h2>{words.portal.word}</h2>
        {projects.byDate().map((project) => {
          const copy = project.copy(locale);
          const { images, screens } = project.flight;
          return (
            <article key={project.id} className={screens === 'phones' ? 'j-calm-project is-phones' : 'j-calm-project'}>
              <div className="j-calm-pictures">
                {images.map((file, n) => (
                  <img key={file} src={`/flight/${file}`} alt={project.pictures[n]?.alt[locale] ?? project.title} loading="lazy" decoding="async" />
                ))}
              </div>
              <div>
                <h3>{project.title}</h3>
                <p className="j-calm-kind">
                  <span>{project.year}</span> {copy.flightKind}
                </p>
                <p>{copy.flightLine}</p>
                <Link className="j-calm-go" to={i18n.path(projects.route(project))} aria-label={`${words.flight.open}: ${project.title}`}>
                  {words.flight.open}
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="j-calm-qa">
        <h2>{words.qaWord}</h2>
        <dl>
          {t.end.questions.map(({ question, answer }) => (
            <div key={question}>
              <dt>{question}</dt>
              <dd>{answer ?? t.end.placeholder}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="contact" className="j-calm-end">
        <p className="j-end-kicker">{words.end.kicker}</p>
        <h2>{words.end.title}</h2>
        <p className="j-end-promise">{words.end.promise}</p>
        <p className="j-end-note">{words.end.note}</p>
        <nav aria-label={words.end.reach}>
          <a href={`mailto:${profile.email}`}>
            <span>{words.end.email}</span>
            <b>
              {profile.email} {ARROW}
            </b>
          </a>
          <a href={github.url} target="_blank" rel="noopener noreferrer">
            <span>{words.end.github}</span>
            <b>
              {github.handle} {ARROW}
            </b>
          </a>
          <a href={instagram.url} target="_blank" rel="noopener noreferrer">
            <span>{words.end.instagram}</span>
            <b>
              {instagram.handle} {ARROW}
            </b>
          </a>
          <Link to={i18n.path(PAGES.contact)}>
            <span>{words.rail.contact}</span>
            <b>
              {words.end.message} {ARROW}
            </b>
          </Link>
        </nav>
        <div className="j-calm-bar">
          <span suppressHydrationWarning>
            © {new Date().getFullYear()} {profile.name}
          </span>
          <span>{words.end.place}</span>
          <a href="#top">
            {words.end.top} <span aria-hidden="true">↑</span>
          </a>
        </div>
      </section>
    </div>
  );
}
