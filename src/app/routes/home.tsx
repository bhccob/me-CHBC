import type { MetaFunction } from 'react-router';
import { PAGES } from '~/data/pages';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { personLd, websiteLd } from '~/seo/structured';
import { Journey } from '~/ui/journey/Journey';
import '~/styles/journey.css';
import { HANDLES, type RouteHandle } from '../handle';

// The home page: the journey (spec 2026-11-05-bob-machine-rebuild-design.md).
export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({
    locale,
    route: PAGES.home,
    title: t.meta.homeTitle,
    description: t.meta.homeDescription,
    jsonLd: [personLd(), websiteLd()],
  });
};

export const handle: RouteHandle = HANDLES.home;

export default Journey;
