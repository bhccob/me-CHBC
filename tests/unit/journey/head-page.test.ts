import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { answerShown, dwellT } from '~/journey/head/thoughts';
import { frameOpacity, headingOpacity, hudOpacity, labelOpacity, layoutLabels, mapOpacity, shadeOpacity, sliceNumber, statusWords } from '~/journey/head/hud';
import { HeadAnswers } from '~/ui/journey/HeadAnswers';
import { ScanHud } from '~/ui/journey/ScanHud';
import { escape, render } from './render';

describe('the six answers on the page (spec 5.7)', () => {
  it('are real text, numbered, each with its region', () => {
    const html = render(HeadAnswers);
    for (const { question, answer } of en.end.questions) {
      expect(html).toContain(escape(question));
      expect(html).toContain(escape(answer!));
    }
    expect(html).toContain('01');
    expect(html).toContain('Plans · Prefrontal cortex');
  });

  it('are in Dutch on the Dutch page', () => {
    const html = render(HeadAnswers, undefined, '/');
    expect(html).toContain(escape(nl.end.questions[0].question));
    expect(html).toContain(`${nl.journey.head.topics.plans} · ${nl.journey.head.regions.prefrontal}`);
  });

  it('carry the heading for those who read the page another way', () => {
    expect(render(HeadAnswers)).toContain(escape("What's on my mind"));
  });
});

describe('the scanner frame', () => {
  it('comes with the scan, and goes at the spit', () => {
    expect([hudOpacity(0.09), hudOpacity(0.5), hudOpacity(0.96)]).toEqual([0, 1, 0]);
    expect(headingOpacity(0.18)).toBe(1);
    expect([headingOpacity(0.14), headingOpacity(0.22)]).toEqual([0, 0]);
    expect(labelOpacity(0.24, 0)).toBe(1);
    expect(labelOpacity(0.3, 0)).toBe(0);
    // The labels arrive one after another.
    expect(labelOpacity(0.214, 0)).toBeGreaterThan(labelOpacity(0.214, 5));
    // The corners frame the head while it is seen whole.
    expect([frameOpacity(0.2), frameOpacity(0.3)]).toEqual([1, 0]);
  });

  it('shows the side map once you are inside, and quietens it while you read', () => {
    expect(mapOpacity(0.25, 0)).toBe(0);
    expect(mapOpacity(0.4, 0)).toBe(1);
    expect(mapOpacity(0.4, 1)).toBeCloseTo(0.15, 5);
  });

  it('shades the page behind an answer, as far as it shows', () => {
    const T = dwellT(2);
    expect(shadeOpacity(T)).toBeCloseTo(0.95 * answerShown(T, 2), 6);
    expect(shadeOpacity(0.3)).toBe(0);
  });

  it('lays labels out on both sides, apart', () => {
    const out = layoutLabels([[500, 300], [520, 310], [700, 320], [710, 330], [600, 200], [650, 250]], { left: 400, top: 150, right: 800, bottom: 450 }, 1280, [40, 40, 40, 40, 40, 40]);
    expect(new Set(out.map((o) => o.side))).toEqual(new Set([-1, 1]));
    for (const side of [-1, 1]) {
      const ys = out.filter((o) => o.side === side).map((o) => o.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(54);
    }
  });

  it('keeps every label on the page', () => {
    const widths = [180, 180, 180, 180, 180, 180];
    const out = layoutLabels([[40, 300], [60, 360], [1240, 320], [1250, 380], [30, 200], [1270, 250]], { left: 20, top: 150, right: 1260, bottom: 450 }, 1280, [40, 40, 40, 40, 40, 40], widths);
    for (const label of out) {
      expect(label.x).toBeGreaterThanOrEqual(12);
      expect(label.x + 180).toBeLessThanOrEqual(1280 - 12);
    }
  });

  it('carries its words, and decorates for screen readers', () => {
    const html = render(ScanHud);
    expect(html).toContain(escape("What's on my mind"));
    expect(html).toMatch(/class="j-hud"[^>]*aria-hidden="true"/);
    expect(html).toContain('Neural scan · live');
    expect(html).toContain('Bob Chung');
    for (const topic of Object.values(en.journey.head.topics)) expect(html).toContain(topic);
  });
});

describe('the read-out in words', () => {
  const status = en.journey.head.status;
  it('says each status in its language', () => {
    expect(statusWords({ status: 'found', n: 1, region: 'whole', doing: 'sorting', meter: 0 }, status, 'en')).toBe('1 thought found');
    expect(statusWords({ status: 'found', n: 4, region: 'whole', doing: 'sorting', meter: 0 }, status, 'en')).toBe('4 thoughts found');
    expect(statusWords({ status: 'thought', n: 3, region: 'motor', doing: 'moving', meter: 0 }, status, 'en')).toBe('Thought 03 / 06');
    expect(statusWords({ status: 'takingIn', n: 9400, region: 'whole', doing: 'listening', meter: 0 }, status, 'en')).toBe('Taking in 9,400');
    expect(statusWords({ status: 'takingIn', n: 9400, region: 'whole', doing: 'listening', meter: 0 }, nl.journey.head.status, 'nl')).toBe('9.400 opgenomen');
    expect(statusWords({ status: 'scanning', n: 42, region: null, doing: null, meter: 0 }, status, 'en')).toBe('Scanning 42 %');
  });

  it('numbers the scan slice from the neck to the crown', () => {
    expect(sliceNumber(-2.15)).toBe(0);
    expect(sliceNumber(1.4)).toBe(320);
  });
});
