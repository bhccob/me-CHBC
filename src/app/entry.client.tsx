import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { guardFrame } from './frameGuard';

// The built site is never shown inside another site's frame (SECURITY.md, section 5). The dev server is left alone, for
// tools that preview it in a frame.
if (import.meta.env.PROD) guardFrame(window, document.documentElement);

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
