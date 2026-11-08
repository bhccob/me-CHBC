import type { CSSProperties, JSX } from 'react';
import { Link } from 'react-router';
import machineStill from '~/assets/journey/machine-still.webp?url';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { objectSvgPath } from '~/journey/head/objects';
import { NQ, THOUGHTS } from '~/journey/head/thoughts';
import { ScanReport } from './ScanReport';

type TopicKey = 'plans' | 'career' | 'hobbies' | 'places' | 'skills' | 'site';

/**
 * The journey without its motion: a normal page that scrolls, with the same words and links on the same colours, and stills
 * for the moving parts. For a visitor who asks for less motion, and, with a pointer to Lite, where the 3D cannot run.
 */
export function CalmJourney({ litePointer = false }: { litePointer?: boolean }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const words = t.journey;
  const head = words.head;

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

      <section className="j-calm-qa" aria-labelledby="j-calm-qa-title">
        <p className="j-calm-eyebrow">{head.heading.eyebrow}</p>
        <h2 id="j-calm-qa-title">{head.heading.title}</h2>
        {t.end.questions.slice(0, NQ).map(({ question, answer }, i) => {
          const thought = THOUGHTS[i];
          return (
            <article key={question} className="j-calm-answer">
              <svg className="j-calm-object" viewBox="0 0 100 100" aria-hidden="true">
                <path d={objectSvgPath(thought.object!)} />
              </svg>
              <div>
                <p className="j-calm-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="j-calm-where">{`${head.topics[thought.key as TopicKey]} · ${head.regions[thought.region]}`}</p>
                <h3>{question}</h3>
                <p>{answer ?? t.end.placeholder}</p>
              </div>
            </article>
          );
        })}
      </section>

      <ScanReport printed />
    </div>
  );
}
