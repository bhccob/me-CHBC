import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** His six questions, the journey's own, each a `<details>` that opens on its answer. */
export function LiteQa(): JSX.Element {
  const { t } = useTranslator();

  return (
    <LiteSection id="questions" title={t.compass.qa.title}>
      <div className="qa">
        {t.end.questions.map(({ question, answer }) => (
          <details key={question} className="lite-details">
            <summary>
              <span className="summary-text">
                <span>{question}</span>
              </span>
            </summary>
            <div className="details-body">
              <p>{answer ?? t.end.placeholder}</p>
            </div>
          </details>
        ))}
      </div>
    </LiteSection>
  );
}
