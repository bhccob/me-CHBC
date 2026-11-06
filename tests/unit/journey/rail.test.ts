import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { buildTimeline } from '~/journey/timeline';
import { ChapterRail } from '~/ui/journey/ChapterRail';

describe('the chapter rail', () => {
  const html = renderToStaticMarkup(createElement(ChapterRail, { timeline: buildTimeline(), labels: en.journey.rail }));

  it('names all nine chapters, in order', () => {
    const words = ['Who', 'Software', 'Games', 'Security', 'Mechatronics', 'Stack', 'Projects', 'Q&amp;A', 'Contact'];
    let at = -1;
    for (const word of words) {
      const here = html.indexOf(word);
      expect(here, word).toBeGreaterThan(at);
      at = here;
    }
  });

  it('is real buttons a keyboard can reach, each saying where it goes', () => {
    expect(html.match(/<button/g)).toHaveLength(9);
    expect(html).toContain('data-jump="projects"');
    expect(html).toContain('aria-label="Chapters"');
  });
});
