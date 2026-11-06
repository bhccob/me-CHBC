import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { TAG_NAMES } from '~/journey/layers';

/** "One machine": what the four layers are, while they stand apart, with a label that follows each. */
export function StackWords(): JSX.Element {
  const { t } = useTranslator();
  const { title, text, labels } = t.journey.stack;
  return (
    <>
      <section id="j-stack" className="j-stack">
        <h2>{title}</h2>
        <p>{text}</p>
      </section>
      {TAG_NAMES.map((name) => (
        <div key={name} className={name === 'armour' ? 'j-tag j-tag-left' : 'j-tag'} data-tag={name}>
          <b>{labels[name].name}</b>
          {labels[name].field}
        </div>
      ))}
    </>
  );
}
