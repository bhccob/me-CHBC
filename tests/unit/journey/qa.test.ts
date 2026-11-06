import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { busOffsetAt, busStep } from '~/journey/world/void/GoldBus';
import { QUESTION_DISTANCES } from '~/journey/world/void/path';
import { questionSide } from '~/journey/world/void/Questions';
import { QaText } from '~/ui/journey/QaText';
import { escape, render } from './render';

describe('the real words of the Q&A', () => {
  const english = render(QaText);
  const dutch = render(QaText, undefined, '/');

  it('hold each of his questions and answers, unchanged', () => {
    for (const q of en.end.questions) {
      expect(english).toContain(escape(q.question));
      expect(english).toContain(escape(q.answer!));
    }
  });

  it('hold them in Dutch at a Dutch address', () => {
    for (const q of nl.end.questions) {
      expect(dutch).toContain(escape(q.question));
      expect(dutch).toContain(escape(q.answer!));
    }
  });

  it('are six', () => {
    expect(en.end.questions).toHaveLength(6);
    expect(nl.end.questions).toHaveLength(6);
  });

  it('say Q&A', () => {
    expect(english).toContain(escape(en.journey.qaWord));
  });
});

describe('along the line', () => {
  it('has its questions on alternating sides', () => {
    expect([0, 1, 2].map(questionSide)).toEqual([1, -1, 1]);
  });

  it('steps sideways at each stop, half as far at the first', () => {
    expect([0, 1, 2, 3, 4, 5].map(busStep)).toEqual([0.75, -1.5, 1.5, -1.5, 1.5, -1.5]);
  });

  it('runs straight before the first stop', () => {
    expect(busOffsetAt(QUESTION_DISTANCES[0] - 20)).toBe(0);
  });

  it('has made each step by the time you read its question', () => {
    expect(busOffsetAt(QUESTION_DISTANCES[0] - 5)).toBeCloseTo(0.75);
    expect(busOffsetAt(QUESTION_DISTANCES[1] - 5)).toBeCloseTo(-0.75);
    expect(busOffsetAt(QUESTION_DISTANCES[5] - 5)).toBeCloseTo(-0.75);
  });

  it('never steps further than its own width from the middle', () => {
    for (let d = 0; d < 400; d += 1) expect(Math.abs(busOffsetAt(d))).toBeLessThanOrEqual(1.5);
  });
});
