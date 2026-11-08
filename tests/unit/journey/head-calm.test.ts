import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { CalmJourney } from '~/ui/journey/CalmJourney';
import { escape, render } from './render';

describe('with less motion asked for (spec section 10)', () => {
  const html = render(CalmJourney);

  it('shows the six answers still, each with its region and object', () => {
    for (const { question, answer } of en.end.questions) {
      expect(html).toContain(escape(question));
      expect(html).toContain(escape(answer!));
    }
    expect(html).toContain('Plans · Prefrontal cortex');
    expect(html.match(/<svg[^>]*class="j-calm-object"/g)).toHaveLength(6);
    expect(html).toContain(escape("What's on my mind"));
  });

  it('ends on the printed report, with the three ways and no Email', () => {
    expect(html).toContain('Scan complete');
    expect(html).toContain('Chinese');
    expect(html).toMatch(/class="j-report is-printed"/);
    expect(html).toContain('href="/en/contact/"');
    expect(html).not.toContain('mailto:');
    expect(html).not.toContain('End of portfolio');
  });

  it('is Dutch on the Dutch page', () => {
    const dutch = render(CalmJourney, undefined, '/');
    expect(dutch).toContain(escape(nl.end.questions[0].question));
    expect(dutch).toContain('Chinees');
  });
});
