import type { JSX } from 'react';
import { Link } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';

const ARROW = (
  <i className="j-arrow" aria-hidden="true">
    ↗
  </i>
);

/** The end page's words: the one bright thing over the universe behind them. */
export function EndWords(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const words = t.journey.end;
  const social = (id: 'github' | 'instagram') => profile.socials.find((item) => item.id === id)!;
  const github = social('github');
  const instagram = social('instagram');
  return (
    <section id="j-end" className="j-end" aria-labelledby="j-end-word">
      <div id="j-end-hub" className="j-end-hub">
        <p className="j-end-kicker j-rise">{words.kicker}</p>
        <h2 id="j-end-word">{words.title}</h2>
        <p className="j-end-promise j-rise">{words.promise}</p>
        <p className="j-end-note j-rise">{words.note}</p>
        <p id="j-end-toy" className="j-end-toy j-rise">
          {words.toy}
        </p>
      </div>
      <nav className="j-rise" aria-label={words.reach}>
        <a href={`mailto:${profile.email}`}>
          <span>{words.email}</span>
          <b>
            {profile.email} {ARROW}
          </b>
        </a>
        <a href={github.url} target="_blank" rel="noopener noreferrer">
          <span>{words.github}</span>
          <b>
            {github.handle} {ARROW}
          </b>
        </a>
        <a href={instagram.url} target="_blank" rel="noopener noreferrer">
          <span>{words.instagram}</span>
          <b>
            {instagram.handle} {ARROW}
          </b>
        </a>
        <Link to={i18n.path(PAGES.contact)}>
          <span>{t.journey.rail.contact}</span>
          <b>
            {words.message} {ARROW}
          </b>
        </Link>
      </nav>
      <div className="j-end-bar j-rise">
        <span suppressHydrationWarning>
          © {new Date().getFullYear()} {profile.name}
        </span>
        <span>{words.place}</span>
        <a href="#top" data-jump="who">
          {words.top} <span aria-hidden="true">↑</span>
        </a>
      </div>
    </section>
  );
}
