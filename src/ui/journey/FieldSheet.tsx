import type { CSSProperties, JSX } from 'react';
import type { Dictionary } from '~/i18n/en';
import type { BandKind } from './bands';

export const BAND_KINDS: readonly BandKind[] = ['software', 'game', 'cyber', 'mech'];

export interface FieldSheetProps {
  sheet: Dictionary['journey']['sheets'][number];
  /** Its place among the sheets, from 0. */
  n: number;
}

/**
 * A field of Bob's, as a coloured sheet that slides over the last, behind the machine, with art below. Its giant word and
 * its facts stand over the machine (Bob, 2026-11-07): drawn again on a layer above the 3D that moves with the sheet, while
 * the words in the sheet stay for a screen reader and for selecting the text.
 */
export function FieldSheet({ sheet, n }: FieldSheetProps): JSX.Element {
  const style = { '--paper': `var(--j-sheet-${n}-paper)`, '--word': `var(--j-sheet-${n}-word)` } as CSSProperties;
  const [first, ...rest] = sheet.titleBlock.split(' · ');
  const words = sheet.title.map((word) => <span key={word}>{word}</span>);
  const facts = sheet.facts.map((fact) => (
    <div key={fact.label}>
      <dt>{fact.label}</dt>
      <dd>{fact.value}</dd>
    </div>
  ));
  return (
    <>
      <section id={`j-sheet-${n}`} className="j-sheet" data-sheet={n} style={style}>
        <div className="j-inner">
          <canvas className="j-band" data-kind={BAND_KINDS[n]} aria-hidden="true" />
          <div className="j-rule" />
          <dl className="j-trio">{facts}</dl>
          <h2 className="j-title">{words}</h2>
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
      <div id={`j-sheet-word-${n}`} className="j-sheet-word" data-sheet={n} style={style} aria-hidden="true">
        <div className="j-inner">
          <dl className="j-trio">{facts}</dl>
          <div className="j-title">{words}</div>
        </div>
      </div>
    </>
  );
}
