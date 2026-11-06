import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

/** A component's markup as the prerender makes it, at the given address, English by default. */
export function render<P extends object>(component: FunctionComponent<P>, props?: P, path = '/en/'): string {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(component, (props ?? {}) as P)));
}

/** The text as the markup holds it. */
export const escape = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
