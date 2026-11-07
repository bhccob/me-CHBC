import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the contact page', () => {
  for (const [path, locale, t] of [
    ['/contact/', 'nl', nl],
    ['/en/contact/', 'en', en],
  ] as const) {
    it(`keeps the form's title an h2, under its h1, in ${locale}`, async () => {
      // The contact page reads its key as it is imported: with one, the form is in its HTML, so the page is imported
      // afresh under the key, with the React and the router it renders with.
      vi.stubEnv('PUBLIC_WEB3FORMS_KEY', 'abc');
      vi.resetModules();
      const [{ default: ContactPage }, react, server, router] = await Promise.all([
        import('~/app/routes/contact'),
        import('react'),
        import('react-dom/server'),
        import('react-router'),
      ]);
      const html = server.renderToStaticMarkup(react.createElement(router.MemoryRouter, { initialEntries: [path] }, react.createElement(ContactPage)));
      expect(html.match(/<form\b/g)).toHaveLength(1);
      for (const id of ['contact-name', 'contact-email', 'contact-subject', 'contact-message', 'contact-form-title']) {
        expect(html.match(new RegExp(`\\sid="${id}"`, 'g')), id).toHaveLength(1);
      }
      expect(html).toContain(`<h2 id="contact-form-title" class="form-title">${t.contact.formTitle}</h2>`);
      expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('id="contact-form-title"'));
    });
  }
});
