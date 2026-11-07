import { describe, expect, it } from 'vitest';
import { nl } from '~/i18n/nl';
import { ageReels, MOVED_AT_AGE, placeAt, shownAge, Story, STORY_FROM_AGE } from '~/ui/journey/Story';
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

describe('the story (Bob, 2026-11-07: "13 in aruba till 18 - 20 in rotterdam")', () => {
  it('starts at 13 and turns to Rotterdam at 18', () => {
    expect(STORY_FROM_AGE).toBe(13);
    expect(MOVED_AT_AGE).toBe(18);
  });

  it('rolls from 13 to his age, whatever that is', () => {
    expect(ageReels(13, 20)).toEqual({ tens: ['1', '1', '1', '1', '1', '1', '1', '2'], ones: ['3', '4', '5', '6', '7', '8', '9', '0'] });
    expect(ageReels(13, 21).ones.at(-1)).toBe('1');
  });

  it('says Aruba up to 17 and Rotterdam from 18, by the age the reels show', () => {
    expect(placeAt(13, 'Aruba', 'Rotterdam')).toBe('Aruba');
    expect(placeAt(17, 'Aruba', 'Rotterdam')).toBe('Aruba');
    expect(placeAt(17.49, 'Aruba', 'Rotterdam')).toBe('Aruba');
    expect(placeAt(17.5, 'Aruba', 'Rotterdam')).toBe('Rotterdam');
    expect(placeAt(20, 'Aruba', 'Rotterdam')).toBe('Rotterdam');
  });

  it('reads the age the reels stand at from how far they have rolled', () => {
    expect(shownAge(0, 20)).toBe(13);
    expect(shownAge(5 / 7, 20)).toBeCloseTo(18, 6);
    expect(shownAge(1, 20)).toBe(20);
  });

  it('shows the age, 13 at the top of the reels, and the first place in the markup', () => {
    const html = render(Story, { age: 20 });
    expect(html).toContain('aria-label="Age: 20"');
    expect(html).toContain('data-to="20"');
    expect(html).toContain('Aruba');
  });
});
