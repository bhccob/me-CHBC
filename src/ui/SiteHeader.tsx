import type { JSX, MouseEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { routeFromPath } from '~/i18n/locale';
import { useTranslator } from '~/i18n/useTranslator';
import { SoundButton } from './journey/SoundButton';
import { LangSwitch } from './LangSwitch';

/** The id of the header's nav, which on a phone is the menu the Menu button opens (a popover). */
export const MENU_ID = 'site-menu';

/**
 * A click in the open menu that follows a link closes it: a link the router handles changes the page under the
 * menu without reloading, so the popover would stay open over the new page. A click that is not on a link (the 3D
 * switch) leaves it open, and a nav that is not an open popover (a laptop's row) is left alone.
 */
export function closeMenuOnLink(event: MouseEvent<HTMLElement>): void {
  const menu = event.currentTarget;
  const target = event.target as Partial<Pick<Element, 'closest'>> | null;
  if (typeof target?.closest !== 'function' || !target.closest('a')) return;
  if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
}

/**
 * The bar every page shows: the way past the header to the content, the name, and the language switch. On the home
 * page the name, Projects and Contact move through the journey and the sound button sits with them; on the other
 * pages the name goes home and Contact goes to the contact page. It lives in the root layout, so it never remounts.
 *
 * On a phone (720 px wide or less) the header is one row, the name and a Menu button, and the nav is a popover the
 * button opens. The popover is the browser's own, so it opens and closes without script, Escape and a tap outside
 * close it, and the button tells assistive technology whether it is open.
 */
export function SiteHeader(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const { pathname } = useLocation();
  const onJourney = routeFromPath(pathname) === PAGES.home;

  return (
    <>
      <a className="skip-link" href="#main">
        {t.nav.skip}
      </a>
      <header className="site-header">
        {onJourney ? (
          <a className="site-name" href="#top" aria-label={t.nav.home} data-jump="who">
            Bob Chung
          </a>
        ) : (
          <Link className="site-name" to={i18n.path(PAGES.home)} aria-label={t.nav.home}>
            Bob Chung
          </Link>
        )}
        <button type="button" className="menu-toggle" popoverTarget={MENU_ID}>
          <span className="menu-label-open">{t.nav.menu}</span>
          <span className="menu-label-close">{t.nav.close}</span>
          <span className="menu-bars" aria-hidden="true" />
        </button>
        <nav id={MENU_ID} className="header-nav" aria-label={t.nav.menu} popover="auto" onClick={closeMenuOnLink}>
          {/* Bob (2026-10-30): "remove the Over mij and Werk in the header": Contact alone, and the language. */}
          <div className="menu-links">
            {onJourney ? (
              <>
                <SoundButton />
                <a className="header-control" href="#projects" data-jump="projects">
                  {t.journey.rail.projects}
                </a>
                <a className="header-control header-cta" href="#contact" data-jump="contact">
                  {t.journey.rail.contact}
                </a>
              </>
            ) : (
              <Link className="header-control" to={i18n.path(PAGES.contact)}>
                {t.nav.contact}
              </Link>
            )}
          </div>
          <div className="menu-extras">
            <LangSwitch />
          </div>
        </nav>
      </header>
    </>
  );
}
