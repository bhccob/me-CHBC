import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PAGES } from '../../src/data/pages';
import { en } from '../../src/i18n/en';
import { routeFromPath } from '../../src/i18n/locale';
import { nl } from '../../src/i18n/nl';
import { Translator } from '../../src/i18n/Translator';
import { LangSwitch } from '../../src/ui/LangSwitch';
import { stripMarkup } from '../../src/ui/Markup';
import { closeMenuOnLink, MENU_ID, SiteHeader } from '../../src/ui/SiteHeader';

const render = (path: string, component: FunctionComponent): string =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(component)));

/** The attributes of the first element of the markup, decoded. */
const attributes = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...(/^<\w+([^>]*)>/.exec(html)?.[1] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value.replace(/&quot;/g, '"').replace(/&amp;/g, '&')]),
  );

/** The text a sighted visitor reads: the markup without its tags. */
const visibleText = (html: string): string => stripMarkup(html);

/** The links and buttons of the markup, in the order of the page, each with its attributes and its visible text. */
const controlsOf = (html: string): { tag: string; attrs: Record<string, string>; text: string }[] =>
  [...html.matchAll(/<(a|button)\b[^>]*>.*?<\/\1>/gs)].map(([markup, tag]) => ({ tag, attrs: attributes(markup), text: visibleText(markup) }));

describe('the language switch', () => {
  it.each([
    ['/lite/', 'EN', nl.nav.switchTo],
    ['/en/lite/', 'NL', en.nav.switchTo],
  ])('on %s its name starts with the visible "%s", then says what it does (WCAG 2.5.3, label in name)', (path, code, says) => {
    const html = render(path, LangSwitch);
    const label = attributes(html)['aria-label'] ?? '';
    expect(visibleText(html)).toBe(code);
    expect(label.startsWith(`${code} `)).toBe(true);
    expect(label).toContain(says);
  });
});

describe('the header', () => {
  it.each([
    ['/lite/', nl, 'nl' as const],
    ['/en/contact/', en, 'en' as const],
    ['/projects/steady/', nl, 'nl' as const],
  // Bob (2026-10-30): "remove the Over mij and Werk in the header".
  ])('on %s it lists the name, Contact and the language switch, in that order', (path, t, locale) => {
    const controls = controlsOf(render(path, SiteHeader));
    const other = locale === 'en' ? 'nl' : 'en';
    const at = (route: string): string => Translator.pathFor(locale, route);
    expect(controls.map((control) => (control.tag === 'button' ? (control.attrs.role ?? control.attrs.class) : control.attrs.href))).toEqual([
      '#main',
      at(PAGES.home),
      'menu-toggle',
      at(PAGES.contact),
      Translator.pathFor(other, routeFromPath(path)),
    ]);
    expect(controls.map((control) => control.text)).toEqual([t.nav.skip, 'Bob Chung', t.nav.menu + t.nav.close, t.nav.contact, other.toUpperCase()]);
    expect(controls[1].attrs.class).toBe('site-name');
    expect(controls[1].attrs['aria-label']).toBe(t.nav.home);
    expect(controls.some((control) => control.attrs.href === at(PAGES.lite))).toBe(false);
  });

  it.each([
    ['/', nl, 'nl' as const],
    ['/en/', en, 'en' as const],
  ])('on the home, %s, the name, Projects and Contact move through the journey, beside the sound', (path, t, locale) => {
    const controls = controlsOf(render(path, SiteHeader));
    const other = locale === 'en' ? 'nl' : 'en';
    const links = controls.filter((control) => control.tag === 'a');
    expect(links.map((link) => link.attrs.href)).toEqual(['#main', '#top', '#projects', '#contact', Translator.pathFor(other, '/')]);
    expect(links.map((link) => link.text).slice(1, 4)).toEqual(['Bob Chung', t.journey.rail.projects, t.journey.rail.contact]);
    expect(links[1].attrs['aria-label']).toBe(t.nav.home);
    expect(controls.some((control) => control.tag === 'button' && control.attrs.class !== 'menu-toggle')).toBe(true);
  });
});

describe('the phone menu (option A, 2026-10-22)', () => {
  it.each([
    ['/', nl],
    ['/en/projects/steady/', en],
  ])('on %s the Menu button opens the nav as a popover, by the browser alone (no script needed)', (path, t) => {
    const html = render(path, SiteHeader);
    const toggle = /<button[^>]*class="menu-toggle"[^>]*>/.exec(html)?.[0] ?? '';
    // HTML attribute names ignore case: React writes `popoverTarget`, which the browser reads as `popovertarget`.
    const toggleAttrs = Object.fromEntries(Object.entries(attributes(toggle)).map(([name, value]) => [name.toLowerCase(), value]));
    expect(toggleAttrs.popovertarget).toBe(MENU_ID);
    expect(attributes(toggle).type).toBe('button');
    const nav = /<nav[^>]*>/.exec(html)?.[0] ?? '';
    expect(attributes(nav).id).toBe(MENU_ID);
    expect(attributes(nav).popover).toBe('auto');
    expect(attributes(nav)['aria-label']).toBe(t.nav.menu);
    // The button says Menu, or close while the menu is open (the stylesheet shows one of the two); its bars are decoration.
    expect(toggle.length).toBeGreaterThan(0);
    expect(html).toContain(`<span class="menu-label-open">${t.nav.menu}</span>`);
    expect(html).toContain(`<span class="menu-label-close">${t.nav.close}</span>`);
    expect(html).toContain('<span class="menu-bars" aria-hidden="true"></span>');
  });

  it('closes the open menu when a link in it is followed, and stays open for a press that is no link', () => {
    const calls: string[] = [];
    const menu = { hidePopover: () => calls.push('hide'), matches: (selector: string) => selector === ':popover-open' };
    const link = { closest: (selector: string) => (selector === 'a' ? {} : null) };
    const button = { closest: () => null };
    closeMenuOnLink({ currentTarget: menu, target: button } as never);
    expect(calls).toEqual([]);
    closeMenuOnLink({ currentTarget: menu, target: link } as never);
    expect(calls).toEqual(['hide']);
    // A laptop's nav is never an open popover: nothing to close; nor is a target that is not an element.
    closeMenuOnLink({ currentTarget: { ...menu, matches: () => false }, target: link } as never);
    closeMenuOnLink({ currentTarget: menu, target: null } as never);
    expect(calls).toEqual(['hide']);
  });
});
