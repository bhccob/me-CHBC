import type { JSX } from 'react';
import type { Dictionary } from '~/i18n/en';
import { railOpacity } from '~/journey/jump';
import { chapterAt, type Timeline } from '~/journey/timeline';

export interface ChapterRailProps {
  timeline: Timeline;
  labels: Dictionary['journey']['rail'];
}

/** The chapters on the right: the current one in gold, each a button that glides there. Hidden on a phone. */
export function ChapterRail({ timeline, labels }: ChapterRailProps): JSX.Element {
  return (
    <nav id="j-rail" className="j-rail" aria-label={labels.label}>
      {timeline.chapters.map((chapter) => (
        <button key={chapter.id} type="button" data-jump={chapter.id}>
          {labels[chapter.id]}
          <i aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

/** What the rail shows at frame `f`. */
export function updateRail(rail: HTMLElement, f: number, tl: Timeline): void {
  const opacity = railOpacity(f, tl);
  rail.style.opacity = opacity.toFixed(3);
  rail.style.visibility = opacity > 0.002 ? 'visible' : 'hidden';
  const current = chapterAt(f + 1, tl);
  for (const button of rail.querySelectorAll('button')) {
    const on = button.dataset.jump === current;
    if (button.hasAttribute('aria-current') !== on) button.toggleAttribute('aria-current', on);
  }
}
