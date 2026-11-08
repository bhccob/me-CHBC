import { type JSX, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import { NQ } from '~/journey/head/thoughts';
import { reportDate } from './applyHead';

/**
 * The end of the journey: the scan report, printed by the scan line the spark opens into, over a soft big bang (spec
 * 2026-11-08 "Into my head", section 5.11; mock-up 20's ending 12). What the scan found, with his heritage, then "Let's
 * talk." and the ways to reach him: GitHub, Instagram and Send a message (Bob: no Email, "send a message is the same").
 * The page prints and shows it each frame (applyHead.ts); `printed` stands it finished on the calm page, every row shown and
 * no scan line.
 */
export function ScanReport({ printed = false }: { printed?: boolean }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const words = t.journey.head.report;
  const end = t.journey.end;
  const social = (id: 'github' | 'instagram') => profile.socials.find((item) => item.id === id)!;
  const time = useRef<HTMLSpanElement>(null);
  // The visitor's own now, in their language: only once the page is theirs, so the prerender holds no stale date.
  useEffect(() => {
    if (time.current) time.current.textContent = reportDate(new Date(), locale);
  }, [locale]);
  const rows: [string, JSX.Element | string][] = [
    [words.subject, profile.name],
    [words.basedIn, words.basedInValue],
    [words.bornIn, words.bornInValue],
    [words.heritage, words.heritageValue],
    [words.thoughtsRead, `${NQ} / ${NQ}`],
    [words.stillMissing, <i key="missing">{words.stillMissingValue}</i>],
  ];
  return (
    <section id="j-end" className={printed ? 'j-report is-printed' : 'j-report'} aria-labelledby="j-end-word">
      <div className="j-report-panel">
        <div className="j-report-frame" aria-hidden="true" />
        <p className="j-report-row j-report-head">
          <span>
            <b aria-hidden="true">●</b> {words.complete}
          </span>
          <span ref={time} className="j-report-time" />
        </p>
        <div className="j-report-top">
          <dl className="j-report-rows">
            {rows.map(([key, value]) => (
              <div key={key} className="j-report-row">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <figure className="j-report-plate" aria-hidden="true">
            <canvas />
            <figcaption>{words.scan}</figcaption>
          </figure>
        </div>
        <div className="j-report-row j-report-next">
          <p>{words.nextStep}</p>
          <h2 id="j-end-word">{end.title}</h2>
        </div>
        <div className="j-report-row j-report-acts">
          <nav id="contact" aria-label={end.reach}>
            <a href={social('github').url} target="_blank" rel="noopener noreferrer">
              {end.github} <span aria-hidden="true">↗</span>
            </a>
            <a href={social('instagram').url} target="_blank" rel="noopener noreferrer">
              {end.instagram} <span aria-hidden="true">↗</span>
            </a>
            <Link to={i18n.path(PAGES.contact)}>
              {end.message} <span aria-hidden="true">→</span>
            </Link>
          </nav>
        </div>
        {printed ? null : <div className="j-report-band" aria-hidden="true" />}
      </div>
      <p className="j-report-bar">
        <span suppressHydrationWarning>
          © {new Date().getFullYear()} {profile.name}
        </span>
        <span>{end.place}</span>
        <a href="#top" data-jump="who">
          {end.top} <span aria-hidden="true">↑</span>
        </a>
      </p>
    </section>
  );
}
