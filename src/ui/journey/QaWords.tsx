import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { PHONE_TYPE, type QuestionText } from '~/journey/qaType';

/**
 * On a phone: his questions and answers set in type over the 3D, where the 3D's own words would come out soft. The 3D says
 * where each one stands and how much of it shows, frame by frame (`updateQaWords`); everywhere else nothing here shows. The
 * words for those who read the page another way are in `QaText`, so these are hidden from them.
 */
export function QaWords(): JSX.Element {
  const { t } = useTranslator();
  return (
    <div id="j-qa-words" className="j-qa-words" aria-hidden="true">
      {t.end.questions.map(({ question, answer }, n) => (
        // By place, not by words: a new language keeps the same elements.
        <div key={n} className="j-qa-q">
          <p className="j-qa-ask">{question}</p>
          <p className="j-qa-say">{answer ?? t.end.placeholder}</p>
        </div>
      ))}
    </div>
  );
}

export interface QaWordsElements {
  box: HTMLElement;
  ask: HTMLElement;
  say: HTMLElement;
  on: boolean;
}

/** The elements `updateQaWords` moves, found once. */
export function qaWordsIn(root: HTMLElement | null): QaWordsElements[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('.j-qa-q')).map((box) => ({
    box,
    ask: box.querySelector<HTMLElement>('.j-qa-ask')!,
    say: box.querySelector<HTMLElement>('.j-qa-say')!,
    on: false,
  }));
}

/** The first line of the answer sits this share of its size lower in type than on the plate (Barlow's ascent, line 1.31). */
const ANSWER_LIFT = 0.055;
/** The room kept clear at each side of a phone's page, CSS px, as the rest of the phone's page keeps (journey.css). */
export const QA_GUTTER = 18;

/**
 * Where a question's words go on a page `pageWidth` wide: where the 3D stands them, made smaller round their middle when they
 * would run past the page's edges (the plates reach past them as you read, by a few pixels to a few dozen). Smaller as a
 * whole, so the lines break where they did.
 */
export function fitQuestion(w: QuestionText, pageWidth: number): { unit: number; width: number; x: number; titleY: number; answerY: number; answerDx: number } {
  const room = Math.max(1, pageWidth - 2 * QA_GUTTER);
  const fit = Math.min(1, room / Math.max(1, w.width));
  const width = w.width * fit;
  const middle = w.titleX + w.width / 2;
  const x = Math.min(Math.max(middle - width / 2, QA_GUTTER), pageWidth - QA_GUTTER - width);
  return { unit: w.unit * fit, width, x, titleY: w.titleY, answerY: w.titleY + (w.answerY - w.titleY) * fit, answerDx: (w.answerX - w.titleX) * fit };
}

function place(el: HTMLElement, x: number, y: number, size: number, width: number, a: number, reveal: number): void {
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  el.style.fontSize = `${size.toFixed(2)}px`;
  el.style.width = `${width.toFixed(1)}px`;
  el.style.opacity = a.toFixed(3);
  el.style.setProperty('--r', reveal.toFixed(3));
}

/** Sets each question's words where the 3D says, this frame, inside the page; none where it shows none, or with none given. */
export function updateQaWords(elements: readonly QaWordsElements[], words: readonly QuestionText[] | null, pageWidth: number): void {
  elements.forEach((el, i) => {
    const w = words?.[i];
    const show = w !== undefined && w.shown && w.unit > 0 && (w.titleA > 0.002 || w.answerA > 0.002);
    if (show !== el.on) {
      el.box.style.visibility = show ? 'visible' : 'hidden';
      el.on = show;
    }
    if (!show || !w) return;
    const at = fitQuestion(w, pageWidth);
    const ask = PHONE_TYPE.question * at.unit;
    const say = PHONE_TYPE.answer * at.unit;
    const inset = PHONE_TYPE.inset * at.unit;
    place(el.ask, at.x, at.titleY + inset, ask, at.width, w.titleA, w.titleReveal);
    place(el.say, at.x + at.answerDx, at.answerY - ANSWER_LIFT * say, say, at.width, w.answerA, w.answerReveal);
  });
}
