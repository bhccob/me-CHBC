import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { projects } from '~/data/projects';
import { journeyMode } from '~/journey/mode';
import { CalmJourney } from '~/ui/journey/CalmJourney';
import { Journey } from '~/ui/journey/Journey';
import { escape, render } from './render';

describe('which journey a visitor gets', () => {
  it('is the live one where it can run', () => {
    expect(journeyMode({ webgl: 'ok', reduced: false, failed: false })).toBe('live');
  });

  it('is the calm one when less motion is asked for', () => {
    expect(journeyMode({ webgl: 'ok', reduced: true, failed: false })).toBe('calm');
  });

  it('points to Lite with no 3D, a software one, or when it failed', () => {
    expect(journeyMode({ webgl: 'none', reduced: false, failed: false })).toBe('lite-link');
    expect(journeyMode({ webgl: 'software', reduced: false, failed: false })).toBe('lite-link');
    expect(journeyMode({ webgl: 'ok', reduced: false, failed: true })).toBe('lite-link');
    expect(journeyMode({ webgl: 'ok', reduced: true, failed: true })).toBe('lite-link');
  });
});

describe('the words in the HTML, before any script', () => {
  const html = render(Journey);

  it('hold each field', () => {
    for (const sheet of en.journey.sheets) expect(html).toContain(escape(sheet.line.lead));
  });

  it('hold each project', () => {
    for (const project of projects.all()) expect(html).toContain(project.title);
  });

  it('hold each question', () => {
    for (const q of en.end.questions) expect(html).toContain(escape(q.question));
  });

  it('hold the way to reach him', () => {
    expect(html).toContain('bhccob@gmail.com');
  });

  it('say where to go without script', () => {
    expect(html).toContain('<noscript>');
  });
});

describe('the calm journey', () => {
  const english = render(CalmJourney);
  const dutch = render(CalmJourney, undefined, '/');

  it('has every field, with its facts', () => {
    for (const sheet of en.journey.sheets) {
      expect(english).toContain(escape(sheet.title.join(' ')));
      expect(english).toContain(escape(sheet.line.rest));
      for (const fact of sheet.facts) expect(english).toContain(escape(fact.value));
    }
  });

  it('has every project oldest first, with its line and a link to its page', () => {
    const order = projects.byDate().map((project) => english.indexOf(project.title));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const project of projects.all()) {
      expect(english).toContain(escape(project.copy('en').flightLine));
      expect(english).toContain(`href="/en/projects/${project.id}/"`);
    }
  });

  it('has his questions and answers, unchanged', () => {
    for (const q of en.end.questions) {
      expect(english).toContain(escape(q.question));
      expect(english).toContain(escape(q.answer!));
    }
  });

  it('has the end page\'s words and every way to reach him', () => {
    for (const words of ["Let's talk.", 'Every universe starts small.', 'bhccob@gmail.com', '@bhccob', 'Send a message', 'Rotterdam, born in Aruba']) expect(english).toContain(escape(words));
    expect(english).toContain('href="/en/contact/"');
  });

  it('has nothing of the toy, which is not there', () => {
    expect(english).not.toContain('Move to pull the stars');
  });

  it('lets the header\'s links land', () => {
    expect(english).toContain('id="projects"');
    expect(english).toContain('id="contact"');
  });

  it('speaks Dutch at the Dutch address', () => {
    expect(dutch).toContain(escape(nl.journey.sheets[0].line.rest));
    expect(dutch).toContain(escape(nl.end.questions[0].question));
  });

  it('points to Lite only when it stands in for what failed', () => {
    expect(english).not.toContain(escape(en.journey.calm.lite));
    expect(render(CalmJourney, { litePointer: true })).toContain(escape(en.journey.calm.lite));
    expect(render(CalmJourney, { litePointer: true })).toContain('href="/en/lite/"');
  });
});
