import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { NQ, THOUGHTS } from '~/journey/head/thoughts';

/** Thought `i`'s topic key, which every answer has (only the seventh thought, Broca's, has none). */
type TopicKey = 'plans' | 'career' | 'hobbies' | 'places' | 'skills' | 'site';

/**
 * Bob's six answers (spec 2026-11-08 "Into my head", section 5.7): one at a time beside its thought as you pass it, the
 * brain gone quiet behind. Real words, read in order by whoever reads the page another way; the page places and shows each
 * card (applyHead.ts), and the heading above them is the scanner's to show.
 */
export function HeadAnswers(): JSX.Element {
  const { t } = useTranslator();
  const { head } = t.journey;
  return (
    <section id="j-qa" className="j-answers" aria-label={t.journey.rail.qa}>
      <h2 className="j-answers-title">{head.heading.title}</h2>
      {t.end.questions.slice(0, NQ).map(({ question, answer }, i) => {
        const thought = THOUGHTS[i];
        return (
          <article key={i} className="j-answer" data-answer={i}>
            <p className="j-answer-num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </p>
            <p className="j-answer-where">{`${head.topics[thought.key as TopicKey]} · ${head.regions[thought.region]}`}</p>
            <h3>{question}</h3>
            <p className="j-answer-say">{answer ?? t.end.placeholder}</p>
          </article>
        );
      })}
    </section>
  );
}
