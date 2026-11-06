import { type JSX, useEffect, useRef } from 'react';
import { useTranslator } from '~/i18n/useTranslator';

/** How long each word stays, and how long the roll takes, ms. */
const ROLL_EVERY_MS = 2400;
const ROLL_MS = 700;

export interface FirstViewProps {
  age: number;
}

/** The first thing a visitor reads: from code, to a word that rolls; who Bob is; and the way to the projects. */
export function FirstView({ age }: FirstViewProps): JSX.Element {
  const { t } = useTranslator();
  const hero = t.journey.hero;
  const swap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = swap.current;
    if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const words = [...box.children] as HTMLElement[];
    let current = 0;
    const timers = new Set<number>();
    const roll = setInterval(() => {
      if (document.hidden) return;
      const out = words[current];
      current = (current + 1) % words.length;
      const next = words[current];
      out.style.transform = 'translateY(-110%)';
      next.style.transition = 'none';
      next.style.transform = 'translateY(110%)';
      void next.offsetWidth;
      next.style.transition = '';
      next.style.transform = 'none';
      const reset = window.setTimeout(() => {
        timers.delete(reset);
        if (words[current] === out) return;
        // Out of sight at the top, it goes back under at once: not down through the window.
        out.style.transition = 'none';
        out.style.transform = 'translateY(110%)';
        void out.offsetWidth;
        out.style.transition = '';
      }, ROLL_MS);
      timers.add(reset);
    }, ROLL_EVERY_MS);
    return () => {
      clearInterval(roll);
      for (const timer of timers) clearTimeout(timer);
    };
  }, [hero.words]);

  return (
    <>
      <section id="j-hero" className="j-hero">
        <h1>
          <span>{hero.from}</span>
          <span className="j-to">
            {hero.to}{' '}
            <span ref={swap} className="j-swap">
              {hero.words.map((word, i) => (
                <span key={word} style={i === 0 ? undefined : { transform: 'translateY(110%)' }}>
                  {word}
                </span>
              ))}
            </span>
          </span>
        </h1>
        <p suppressHydrationWarning>{hero.intro.replace('{age}', String(age))}</p>
        <a className="j-go" href="#projects" data-jump="projects">
          {hero.cta}
        </a>
      </section>
      <div id="j-vert" className="j-vert">
        <div className="j-seal">{hero.seal}</div>
        <div className="j-han" lang="zh">
          客家
        </div>
      </div>
    </>
  );
}
