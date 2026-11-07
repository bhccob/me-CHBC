import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';

/** The age the story starts from, in Aruba (Bob, 2026-11-07: "13 in aruba till 18 - 20 in rotterdam"). */
export const STORY_FROM_AGE = 13;

/** The age he moved to Rotterdam at. */
export const MOVED_AT_AGE = 18;

/** The digits of every age from `from` to `to`, tens and ones, one under the other, ready to roll. */
export function ageReels(from: number, to: number): { tens: string[]; ones: string[] } {
  const ages = Array.from({ length: Math.max(1, to - from + 1) }, (_, i) => from + i);
  return { tens: ages.map((age) => String(Math.floor(age / 10))), ones: ages.map((age) => String(age % 10)) };
}

/** The age the reels stand at, `roll` (0 to 1) of the way from the story's first age to `to`. */
export function shownAge(roll: number, to: number): number {
  return STORY_FROM_AGE + roll * Math.max(0, to - STORY_FROM_AGE);
}

/** The place for the age the reels show: the new one once 18 is more than half in sight. */
export function placeAt(age: number, from: string, to: string): string {
  return age < MOVED_AT_AGE - 0.5 ? from : to;
}

export interface StoryProps {
  age: number;
}

/** Up close on the chip: the large digits roll from 13 to his age, and the place changes from Aruba to Rotterdam at 18. */
export function Story({ age }: StoryProps): JSX.Element {
  const { t } = useTranslator();
  const { tens, ones } = ageReels(STORY_FROM_AGE, age);
  return (
    <section id="j-story" className="j-story">
      <div className="j-num" role="img" aria-label={`${t.journey.story.age}: ${age}`} data-to={age} suppressHydrationWarning>
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

/** Rolls the digits `roll` (0 to 1) of the way, and turns the place at the age they show. */
export function updateStory(root: HTMLElement, roll: number, words: { from: string; to: string }): void {
  for (const reel of root.querySelectorAll<HTMLElement>('.j-digit')) {
    const steps = reel.children.length - 1;
    const y = `translateY(${(-roll * steps * 100).toFixed(2)}%)`;
    for (const digit of reel.children) (digit as HTMLElement).style.transform = y;
  }
  const to = Number(root.querySelector<HTMLElement>('.j-num')?.dataset.to ?? STORY_FROM_AGE);
  const place = root.querySelector('#j-place');
  const text = placeAt(shownAge(roll, to), words.from, words.to);
  if (place && place.textContent !== text) place.textContent = text;
}
