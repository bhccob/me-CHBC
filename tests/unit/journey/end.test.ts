import { describe, expect, it } from 'vitest';
import { addGalaxy, endWordsAt, MAX_GALAXIES, orbitAngles } from '~/journey/end';
import { EndWords } from '~/ui/journey/EndWords';
import { escape, render } from './render';

const DEG = Math.PI / 180;

describe('the cursor on the end page', () => {
  it('swings the camera up to 26 degrees each way, and 15 up and down', () => {
    expect(orbitAngles(1, 1)).toEqual({ yaw: expect.closeTo(26 * DEG), pitch: expect.closeTo(15 * DEG) });
    expect(orbitAngles(-1, -1)).toEqual({ yaw: expect.closeTo(-26 * DEG), pitch: expect.closeTo(-15 * DEG) });
  });

  it('stays still at the middle', () => {
    expect(orbitAngles(0, 0)).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe('your own galaxies', () => {
  it('are at most eight', () => {
    expect(MAX_GALAXIES).toBe(8);
    expect(addGalaxy(Array(8).fill(0), 1)).toHaveLength(8);
  });

  it('let the oldest go to make room', () => {
    const eight = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(addGalaxy(eight, 9)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('simply gather until then', () => {
    expect(addGalaxy([1, 2], 3)).toEqual([1, 2, 3]);
  });
});

describe('the word pulling itself together', () => {
  it('is nothing before the blast has passed', () => {
    expect(endWordsAt(892).page).toBe(0);
    expect(endWordsAt(893).word.opacity).toBe(0);
  });

  it('starts blurred and wide', () => {
    const start = endWordsAt(893);
    expect(start.word.blur).toBeCloseTo(22);
    expect(start.word.spacing).toBeCloseTo(0.42);
  });

  it('ends sharp, at its own tight spacing', () => {
    const end = endWordsAt(919);
    expect(end.word.opacity).toBe(1);
    expect(end.word.blur).toBe(0);
    expect(end.word.spacing).toBeCloseTo(-0.03);
  });

  it('brings the rest of the words in after it has begun', () => {
    expect(endWordsAt(912).rise).toBe(false);
    expect(endWordsAt(913).rise).toBe(true);
  });

  it('comes later on a longer flight', () => {
    expect(endWordsAt(919 + 43, 43).word.blur).toBe(0);
    expect(endWordsAt(919, 43).page).toBe(0);
  });
});

describe('the words of the end page', () => {
  const html = render(EndWords);

  it('come in the order of the spec', () => {
    const order = ['End of portfolio', "Let's talk.", 'Every universe starts small. So does every project.', 'If any of this gave you an idea', 'Move to pull the stars.'];
    order.reduce((at, w) => {
      const i = html.indexOf(escape(w));
      expect(i, w).toBeGreaterThan(at);
      return i;
    }, -1);
  });

  it('hold every way to reach him', () => {
    for (const w of ['bhccob@gmail.com', 'GitHub', '@bhccob', 'Instagram', 'Send a message', 'Back to the start', 'Rotterdam, born in Aruba']) expect(html).toContain(w);
  });

  it('link to where they say', () => {
    expect(html).toContain('href="/en/contact/"');
    expect(html).toContain('href="mailto:bhccob@gmail.com"');
    expect(html).toContain('href="https://github.com/bhccob"');
    expect(html).toContain('href="https://www.instagram.com/bhccob/"');
  });

  it('send a Dutch visitor to the Dutch form', () => {
    expect(render(EndWords, undefined, '/')).toContain('href="/contact/"');
  });

  it('name the year and him', () => {
    expect(html).toContain(`© ${new Date().getFullYear()} Bob Chung`);
  });
});
