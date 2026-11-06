import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** The fields he works in, in the journey's own words: what each is, and the part of the machine it stands for. */
export function LiteFields(): JSX.Element {
  const { t } = useTranslator();
  const { stack, sheets } = t.journey;

  return (
    <LiteSection id="fields" title={stack.title}>
      <p className="lead">{stack.text}</p>
      <ol className="lite-rows">
        {sheets.map((sheet) => (
          <li key={sheet.title.join(' ')}>
            <h3 className="lite-item-title">{sheet.title.join(' ')}</h3>
            <p>
              <strong>{sheet.line.lead}</strong> {sheet.line.rest}
            </p>
            <dl className="terms">
              {sheet.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </LiteSection>
  );
}
