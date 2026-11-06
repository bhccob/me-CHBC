import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

describe("the journey's words: Bob's own, exact", () => {
  const s = en.journey.sheets;

  it('holds his facts on the four sheets', () => {
    expect(s[0].facts).toContainEqual({ label: 'Stack', value: 'Full-stack' });
    expect(s[0].facts).toContainEqual({ label: 'Studied', value: 'MBO 4, Rotterdam' });
    expect(s[0].facts).toContainEqual({ label: 'Built', value: 'Web apps, mobile apps and websites' });
    expect(s[1].facts).toContainEqual({ label: 'Engine', value: 'Godot, Roblox Studio' });
    expect(s[1].facts).toContainEqual({ label: 'Built', value: 'Browser, Roblox and platform games' });
    expect(s[2].facts).toContainEqual({ label: 'Now', value: 'Intern at a cybersecurity company' });
    expect(s[2].facts).toContainEqual({ label: 'Possible direction', value: 'DevSecOps, firmware security' });
    expect(s[3].facts).toContainEqual({ label: 'Next', value: 'HBO' });
    expect(s[3].facts).toContainEqual({ label: 'Interested and exploring', value: 'Sensors, motors, circuits' });
    expect(s[3].facts).toContainEqual({ label: 'Goal', value: "Own company or a master's degree" });
  });

  it('has four sheets, not five, and says so', () => {
    expect(s.map((x) => x.titleBlock)).toEqual([
      'MBO, now · Sheet 1 of 4 · Systems Builder',
      'MBO, now · Sheet 2 of 4 · Systems Builder',
      'Internship, now · Sheet 3 of 4 · Systems Builder',
      'HBO, next · Sheet 4 of 4 · Systems Builder',
    ]);
  });

  it('names each sheet and what its layer is', () => {
    expect(s.map((x) => x.title)).toEqual([['Software', 'Engineering'], ['Game', 'Development'], ['Cybersecurity', 'Intern'], ['Mechatronics', 'Engineering']]);
    expect(s.map((x) => x.line.lead)).toEqual(['The brain.', 'The controls.', 'The armour.', 'The body.']);
  });

  it('keeps the first view', () => {
    expect(en.journey.hero.words).toEqual(['games.', 'security.', 'machines.']);
    expect(en.journey.hero.seal).toBe('PROGRAMMER');
    expect(en.journey.hero.intro).toBe("I'm Bob Chung, {age}. Born and raised in Aruba, now in Rotterdam, studying software and heading for mechatronics.");
    expect(en.journey.hero.cta).toBe('See my projects');
  });

  it('keeps the end page', () => {
    expect(en.journey.end.title).toBe("Let's talk.");
    expect(en.journey.end.kicker).toBe('End of portfolio');
    expect(en.journey.end.promise).toBe('Every universe starts small. So does every project.');
    expect(en.journey.end.note).toBe('If any of this gave you an idea, a project or a question, I would like to hear it.');
    expect(en.journey.end.toy).toBe('Move to pull the stars. Hold anywhere and let go to start your own universe.');
    expect(en.journey.end.message).toBe('Send a message');
    expect(en.journey.collapse.hint).toBe('Click the light to let it go, or keep scrolling');
  });

  it('keeps the way in, and the stack', () => {
    expect(en.journey.loader).toMatchObject({ withSound: 'Enter with sound', without: 'Enter without' });
    expect(en.journey.stack.title).toBe('One machine.');
    expect(en.journey.stack.text).toBe('Each field I learn is one layer of it. Together they make something that thinks, responds, stays safe and moves.');
    expect(en.journey.stack.labels).toEqual({
      armour: { name: 'Armour', field: 'Cybersecurity' },
      controls: { name: 'Controls', field: 'Game Development' },
      brain: { name: 'Brain', field: 'Software Engineering' },
      body: { name: 'Body', field: 'Mechatronics' },
    });
  });

  it('has the Dutch for all of it, shaped the same', () => {
    expect(Object.keys(nl.journey)).toEqual(Object.keys(en.journey));
    expect(nl.journey.sheets.map((x) => x.facts.length)).toEqual(s.map((x) => x.facts.length));
    expect(nl.journey.hero.words).toHaveLength(3);
    expect(nl.journey.hero.intro).toContain('{age}');
    // His title and the sheet count stay in the Dutch, as the sheets are numbered there too.
    for (const sheet of nl.journey.sheets) expect(sheet.titleBlock).toContain('Systems Builder');
  });
});
