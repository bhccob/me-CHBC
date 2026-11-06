import type { CSSProperties, JSX } from 'react';
import type { Dictionary } from '~/i18n/en';
import type { BandKind } from './bands';

export const BAND_KINDS: readonly BandKind[] = ['software', 'game', 'cyber', 'mech'];

export interface FieldSheetProps {
  sheet: Dictionary['journey']['sheets'][number];
  /** Its place among the sheets, from 0. */
  n: number;
}

/** A field of Bob's, as a coloured sheet that slides over the last: a giant word behind the machine, art below, and its facts. */
export function FieldSheet({ sheet, n }: FieldSheetProps): JSX.Element {
  const style = { '--paper': `var(--j-sheet-${n}-paper)`, '--word': `var(--j-sheet-${n}-word)` } as CSSProperties;
  const [first, ...rest] = sheet.titleBlock.split(' · ');
  return (
    <section id={`j-sheet-${n}`} className="j-sheet" style={style}>
      <div className="j-inner">
        <canvas className="j-band" data-kind={BAND_KINDS[n]} aria-hidden="true" />
        <div className="j-rule" />
        <dl className="j-trio">
          {sheet.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <h2>
          {sheet.title.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </h2>
        <div className="j-line">
          <b>{sheet.line.lead}</b> {sheet.line.rest}
        </div>
        <div className="j-block">
          <b>{first}</b>
          {rest.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
