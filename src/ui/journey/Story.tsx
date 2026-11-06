import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';

/** The age he arrives at Rotterdam's story from. */
export const STORY_FROM_AGE = 18;

/** The digits of every age from `from` to `to`, tens and ones, one under the other, ready to roll. */
export function ageReels(from: number, to: number): { tens: string[]; ones: string[] } {
  const ages = Array.from({ length: Math.max(1, to - from + 1) }, (_, i) => from + i);
  return { tens: ages.map((age) => String(Math.floor(age / 10))), ones: ages.map((age) => String(age % 10)) };
}

/** The place the roll stands at. */
export function placeAt(age: number, from: string, to: string): string {
  return age < 0.72 ? from : to;
}

export interface StoryProps {
  age: number;
}

/** Up close on the chip: the large digits roll from 18 to his age, and the place changes from Aruba to Rotterdam. */
export function Story({ age }: StoryProps): JSX.Element {
  const { t } = useTranslator();
  const { tens, ones } = ageReels(STORY_FROM_AGE, age);
  return (
    <section id="j-story" className="j-story">
      <div className="j-num" role="img" aria-label={`${t.journey.story.age}: ${age}`} suppressHydrationWarning>
        <span className="j-digit" aria-hidden="true">
          {tens.map((digit, i) => (
            <span key={i}>{digit}</span>
          ))}
        </span>
        <span className="j-digit" aria-hidden="true">
          {ones.map((digit, i) => (
            <span key={i}>{digit}</span>
          ))}
        </span>
      </div>
      <div id="j-place" className="j-place">
        {t.journey.story.from}
      </div>
    </section>
  );
}

/** Rolls the digits and turns the place, for how far the age has rolled. */
export function updateStory(root: HTMLElement, age: number, words: { from: string; to: string }): void {
  for (const reel of root.querySelectorAll<HTMLElement>('.j-digit')) {
    const steps = reel.children.length - 1;
    const y = `translateY(${(-age * steps * 100).toFixed(2)}%)`;
    for (const digit of reel.children) (digit as HTMLElement).style.transform = y;
  }
  const place = root.querySelector('#j-place');
  const text = placeAt(age, words.from, words.to);
  if (place && place.textContent !== text) place.textContent = text;
}
