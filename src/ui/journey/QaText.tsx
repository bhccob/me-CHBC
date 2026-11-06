import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';

/** Bob's questions and answers as real words. On screen they are drawn in the 3D, so these are for whoever reads the page another way. */
export function QaText(): JSX.Element {
  const { t } = useTranslator();
  return (
    <section id="j-qa" className="j-qa-text" aria-label={t.journey.rail.qa}>
      <h2>{t.journey.qaWord}</h2>
      <dl>
        {t.end.questions.map(({ question, answer }) => (
          <div key={question}>
            <dt>{question}</dt>
            <dd>{answer ?? t.end.placeholder}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
