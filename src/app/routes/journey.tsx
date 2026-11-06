import type { MetaFunction } from 'react-router';
import { JOURNEY_ROUTE } from '~/data/pages';
import { localeFromPath } from '~/i18n/locale';
import { translatorFor } from '~/i18n/useTranslator';
import { head } from '~/seo/head';
import { Journey } from '~/ui/journey/Journey';
import '~/styles/journey.css';
import { HANDLES, type RouteHandle } from '../handle';

// The new home at its review address, only in a build with JOURNEY=1. It takes the home's place at the swap.
export const meta: MetaFunction = ({ location }) => {
  const locale = localeFromPath(location.pathname);
  const { t } = translatorFor(locale);
  return head({ locale, route: JOURNEY_ROUTE, title: t.meta.homeTitle, description: t.meta.homeDescription, noindex: true });
};

export const handle: RouteHandle = HANDLES.journey;

export default Journey;
