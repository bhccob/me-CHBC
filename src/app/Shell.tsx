import type { JSX, ReactNode } from 'react';
import { LockCursor } from '~/ui/LockCursor';
import { SiteHeader } from '~/ui/SiteHeader';
import { useNavigationFocus } from './navigationFocus';
import { useRouteAttribute, useRouteHandle } from './routeName';
import { useVisitStart } from './visitStart';

// The root layout's frame: the header, the page and the cursor. Route changes swap only what is inside <main>.
export function Shell({ children }: { children: ReactNode }): JSX.Element {
  // The matched route's handle (src/app/handle.ts): the kind of page.
  const { route } = useRouteHandle();
  useRouteAttribute(route);
  // A page reached by a link takes the focus to <main> (the scroll is root.tsx's ScrollRestoration).
  useNavigationFocus();
  // Where the visit began, for the back link.
  useVisitStart();

  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <LockCursor />
    </>
  );
}
