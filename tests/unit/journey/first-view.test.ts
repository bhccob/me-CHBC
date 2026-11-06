import { describe, expect, it } from 'vitest';
import { nl } from '~/i18n/nl';
import { ageReels, placeAt, Story } from '~/ui/journey/Story';
import { FirstView } from '~/ui/journey/FirstView';
import { render } from './render';

describe('the first view', () => {
  const html = render(FirstView, { age: 20 });

  it('says who it is, with the age it is given', () => {
    expect(html).toContain('From code');
    expect(html).toContain('I&#x27;m Bob Chung, 20. Born and raised in Aruba, now in Rotterdam, studying software and heading for mechatronics.');
  });

  it('has the one heading of the page', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it('holds all three words that roll, each in the markup', () => {
    for (const word of ['games.', 'security.', 'machines.']) expect(html).toContain(word);
  });

  it('goes to the flight from its button', () => {
    expect(html).toContain('See my projects');
    expect(html).toContain('href="#projects"');
    expect(html).toContain('data-jump="projects"');
  });

  it('has the Hakka characters and the seal, marked as Chinese', () => {
    expect(html).toContain('客家');
    expect(html).toContain('PROGRAMMER');
    expect(html).toContain('lang="zh"');
  });

  it('is Dutch at the root', () => {
    expect(render(FirstView, { age: 20 }, '/journey/')).toContain(nl.journey.hero.from);
  });
});

describe('the story', () => {
  it('rolls from 18 to his age, whatever that is', () => {
    expect(ageReels(18, 20)).toEqual({ tens: ['1', '1', '2'], ones: ['8', '9', '0'] });
    expect(ageReels(18, 21)).toEqual({ tens: ['1', '1', '2', '2'], ones: ['8', '9', '0', '1'] });
  });

  it('turns from Aruba to Rotterdam late in the roll', () => {
    expect(placeAt(0.71, 'Aruba', 'Rotterdam')).toBe('Aruba');
    expect(placeAt(0.72, 'Aruba', 'Rotterdam')).toBe('Rotterdam');
  });

  it('shows the age and the first place in the markup', () => {
    const html = render(Story, { age: 20 });
    expect(html).toContain('aria-label="Age: 20"');
    expect(html).toContain('Aruba');
  });
});
