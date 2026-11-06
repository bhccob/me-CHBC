import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';

/** The big word over the opening iris. */
export function PortalWord(): JSX.Element {
  const { t } = useTranslator();
  return (
    <section id="j-portal" className="j-portal">
      <h2>{t.journey.portal.word}</h2>
    </section>
  );
}
