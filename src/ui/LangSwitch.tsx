import { type JSX, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { routeFromPath } from '~/i18n/locale';
import { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';
import { rememberPlace } from '~/journey/jump';
import { langPathWhileOpen, nothingOpened, openedProject, watchOpened } from './journey/openProject';

/**
 * A link to the same page in the other language. It shows that language's code ("EN", "NL"), and its name is the
 * code followed by the dictionary's `nav.switchTo`, so the name begins with what a sighted visitor reads (WCAG 2.5.3,
 * label in name). `switchTo` is written in that other language, so the link carries its `lang`.
 *
 * It replaces the history entry instead of adding one: the same page in another language is not a step
 * in the story, so Back and Escape must not undo it (see `arrivedDirectly` in state/routeSync.ts), and it
 * keeps the visitor's place in the page (`preventScrollReset`). The link keeps its address, which is what
 * crawlers and a visit without script use.
 */
export function LangSwitch(): JSX.Element {
  const { otherLocale, t } = useTranslator();
  const { pathname } = useLocation();
  const code = otherLocale.toUpperCase();
  const navigate = useNavigate();
  // With a project open over the flight, the router knows only the page under it. The link's address is the project's in
  // the other language; a plain click changes the language where you are, and the journey sets the address.
  const open = useSyncExternalStore(watchOpened, openedProject, nothingOpened);
  const under = Translator.pathFor(otherLocale, routeFromPath(pathname));

  return (
    <Link
      to={open ? langPathWhileOpen(`/projects/${open.id}/`, otherLocale) : under}
      replace
      preventScrollReset
      lang={otherLocale}
      hrefLang={otherLocale}
      aria-label={`${code} – ${t.nav.switchTo}`}
      className="header-control"
      onClick={(event) => {
        rememberPlace();
        if (!open || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void navigate(under, { replace: true, preventScrollReset: true });
      }}
    >
      {code}
    </Link>
  );
}
