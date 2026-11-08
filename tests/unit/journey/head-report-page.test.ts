import { describe, expect, it } from 'vitest';
import { nl } from '~/i18n/nl';
import { reportDate } from '~/ui/journey/applyHead';
import { ScanReport } from '~/ui/journey/ScanReport';
import { escape, render } from './render';

describe('the scan report (spec 5.11)', () => {
  const html = render(ScanReport);

  it('reports what the scan found, with his heritage and no Status line', () => {
    for (const word of ['Scan complete', 'Bob Chung', 'Rotterdam', 'Aruba', 'Chinese', '6 / 6', '1 · yours', 'Next step', escape("Let's talk.")]) expect(html).toContain(word);
    expect(html).not.toContain('Status');
  });

  it('offers GitHub, Instagram and Send a message, and no Email', () => {
    expect(html).toContain('github.com');
    expect(html).toContain('instagram.com');
    expect(html).toContain('href="/en/contact/"');
    expect(html).toContain('Send a message');
    expect(html).not.toContain('mailto:');
    expect(html).not.toMatch(/>Email</);
  });

  it('keeps the old end page’s words out', () => {
    for (const gone of ['End of portfolio', 'Every universe starts small', 'Hold anywhere']) expect(html).not.toContain(gone);
  });

  it('is the page’s contact: its title, its links and the way back up', () => {
    expect(html).toMatch(/<h2 id="j-end-word"[^>]*>Let&#x27;s talk\.<\/h2>/);
    expect(html).toContain('<nav id="contact"');
    expect(html).toContain('data-jump="who"');
  });

  it('says the same in Dutch', () => {
    const dutch = render(ScanReport, undefined, '/');
    expect(dutch).toContain(nl.journey.head.report.heritageValue);
    expect(dutch).toContain('Chinees');
    expect(dutch).toContain('href="/contact/"');
  });
});

describe('the report’s date', () => {
  const when = new Date(2026, 10, 8, 20, 4);
  it('is the visitor’s now, in their language’s way', () => {
    expect(reportDate(when, 'en')).toBe('08 Nov 2026 · 20:04');
    expect(reportDate(when, 'nl')).toBe('08 nov 2026 · 20:04');
  });
});
