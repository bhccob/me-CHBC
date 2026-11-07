import { useEffect } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';

/** The history entry (its router key) the document was loaded on; set by the first note. */
let loadedOn: string | null = null;
/** The history entry being shown. */
let shown: string | null = null;

/**
 * Notes the location after a navigation, the first load included. A `replace` that replaces the entry the document loaded
 * on (the contact form dropping `?sent=1`, the language switch) moves the start to that entry's new key, so the visit still
 * began here. Without a type the navigation counts as a push.
 */
export function noteLocation(location: { key: string }, navigationType?: NavigationType): void {
  if (loadedOn === null || (navigationType === NavigationType.Replace && shown === loadedOn)) loadedOn = location.key;
  shown = location.key;
}

/**
 * True when the page being shown is the one the visit began on: no client-side navigation came before it. It is true
 * again after navigating away and back to that entry, and after a reload.
 */
export function arrivedDirectly(): boolean {
  return loadedOn === null || loadedOn === shown;
}

/** Forgets where the visit began. For tests: in the browser the module lives as long as the document. */
export function resetVisitStart(): void {
  loadedOn = null;
  shown = null;
}

/** Notes every navigation, so the back link knows whether there is a page of the site to go back to. */
export function useVisitStart(): void {
  const { key } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    noteLocation({ key }, navigationType);
  }, [key, navigationType]);
}
