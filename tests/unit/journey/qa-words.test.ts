import { describe, expect, it } from 'vitest';
import { noQuestionText, type QuestionText } from '~/journey/qaType';
import { fitQuestion, QA_GUTTER } from '~/ui/journey/QaWords';

const words = (over: Partial<QuestionText>): QuestionText => ({ ...noQuestionText(), shown: true, unit: 100, titleA: 1, answerA: 1, titleReveal: 1, answerReveal: 1, ...over });

describe('the questions\' words on a phone', () => {
  it('stand where the 3D stands them while they fit the page', () => {
    const at = fitQuestion(words({ width: 300, titleX: 40, titleY: 400, answerX: 41, answerY: 520 }), 390);
    expect(at).toEqual({ unit: 100, width: 300, x: 40, titleY: 400, answerY: 520, answerDx: 1 });
  });

  it('come in from the edges, smaller round their middle, where the plates reach past them', () => {
    // As measured in Edge at 390 x 844: question 5's plate from -16 to 423.
    const at = fitQuestion(words({ width: 430, titleX: -11, titleY: 389, answerX: -3, answerY: 542 }), 390);
    expect(at.x).toBeGreaterThanOrEqual(QA_GUTTER);
    expect(at.x + at.width).toBeLessThanOrEqual(390 - QA_GUTTER + 1e-9);
    expect(at.width).toBeCloseTo(390 - 2 * QA_GUTTER, 9);
    // Smaller as a whole: the size and the room shrink together, so the lines break where they did.
    expect(at.unit / 100).toBeCloseTo(at.width / 430, 9);
    expect(at.answerY - at.titleY).toBeCloseTo((542 - 389) * (at.width / 430), 9);
  });

  it('keep inside the page when they stand off to one side', () => {
    const at = fitQuestion(words({ width: 300, titleX: 120 }), 390);
    expect(at.x + at.width).toBeLessThanOrEqual(390 - QA_GUTTER);
    expect(at.width).toBe(300);
  });
});
