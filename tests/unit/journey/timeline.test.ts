import { describe, expect, it } from 'vitest';
import { band, backOut, catmullRom, clamp, ease, ez, mix, ramp, seeded } from '~/journey/math';
import { buildTimeline, chapterAt, frameFromScroll, HOLD, QA_PACE, SCROLL_PX_PER_FRAME, scrollFromFrame, SMOOTH_S, smoothFrame, trackHeightPx } from '~/journey/timeline';

describe('the timeline, as spec section 4 has it', () => {
  const tl = buildTimeline();

  it('holds the journey in frames', () => {
    expect([tl.last, tl.shift, tl.flight, tl.void, tl.dissolve, tl.collapse, tl.bang, tl.settled]).toEqual([934, 0, [350, 566], [566, 888], [630, 690], [858, 880], [880, 928], 934]);
    expect(tl.reads).toEqual([399, 448, 493, 537]);
    expect(tl.lookBack).toBe(642);
    expect(tl.qaReads).toEqual([707, 736, 765, 795, 824, 853]);
  });

  it('names the nine chapters, where each starts and where its link lands', () => {
    expect(tl.chapters.map((c) => c.id)).toEqual(['who', 'software', 'games', 'security', 'mechatronics', 'stack', 'projects', 'qa', 'contact']);
    expect(tl.chapters.map((c) => c.from)).toEqual([0, 46, 102, 154, 206, 278, 340, 640, 856]);
    expect(tl.chapters.map((c) => c.jump)).toEqual([0, 72, 124, 188, 250, 302, 392, 668, 934]);
    expect([chapterAt(45, tl), chapterAt(46, tl), chapterAt(339, tl), chapterAt(340, tl), chapterAt(856, tl)]).toEqual(['who', 'software', 'stack', 'projects', 'contact']);
  });

  it('pushes everything after the flight along by 1.2 frames per unit of a longer flight', () => {
    const longer = buildTimeline(216);
    expect([longer.shift, longer.flight[1], longer.last, longer.qaReads[0], longer.lookBack]).toEqual([43, 609, 977, 750, 685]);
    expect(longer.chapters.map((c) => c.from)).toEqual([0, 46, 102, 154, 206, 278, 340, 683, 899]);
    expect(longer.chapters.at(-1)?.jump).toBe(977);
    expect(longer.reads).toEqual([399, 448, 493, 537]);
  });

  it('takes the reading stops it is given', () => {
    expect(buildTimeline(180, [1, 2]).reads).toEqual([1, 2]);
  });
});

describe('scroll to frame', () => {
  const tl = buildTimeline();

  it('holds the first view for the first 3.5% of the scroll', () => {
    expect(HOLD).toBe(0.035);
    expect(frameFromScroll(0, 1000, tl)).toBe(0);
    expect(frameFromScroll(35, 1000, tl)).toBeCloseTo(0, 6);
    expect(frameFromScroll(1000, 1000, tl)).toBe(934);
  });

  it('goes there and back', () => {
    expect(scrollFromFrame(frameFromScroll(420, 1000, tl), 1000, tl)).toBeCloseTo(420, 3);
    expect(frameFromScroll(scrollFromFrame(420, 1000, tl), 1000, tl)).toBeCloseTo(420, 3);
  });

  it('never leaves the journey', () => {
    expect(frameFromScroll(-50, 1000, tl)).toBe(0);
    expect(frameFromScroll(2000, 1000, tl)).toBe(934);
    expect(frameFromScroll(10, 0, tl)).toBe(934);
  });

  it('eases toward the scroll over about 0.13 s, whatever the frame rate', () => {
    expect(SMOOTH_S).toBe(0.13);
    expect(smoothFrame(0, 100, 0.13)).toBeCloseTo(63.2, 1);
    expect(smoothFrame(0, 100, 0.065)).toBeCloseTo(100 * (1 - Math.exp(-0.5)), 3);
    expect(smoothFrame(50, 50, 0.1)).toBe(50);
  });

  it('sizes the track from the frames, so a resize keeps the frame', () => {
    expect(SCROLL_PX_PER_FRAME).toBe(30.6);
    // The questions' 168 frames take twice the scroll.
    expect(trackHeightPx(tl)).toBeCloseTo((934 + 168) * 30.6, 3);
    expect(trackHeightPx(buildTimeline(216))).toBeCloseTo((977 + 168) * 30.6, 3);
  });
});

describe('the questions take the scroll slower (Bob, 2026-11-07: "the Q&A scrolling is too fast")', () => {
  const tl = buildTimeline();
  const max = 10_000;
  const scrollFor = (from: number, to: number, timeline = tl) => scrollFromFrame(to, max, timeline) - scrollFromFrame(from, max, timeline);

  it('runs from the end of the break to the collapse, twice over', () => {
    expect(QA_PACE).toBe(2);
    expect(tl.pace).toEqual({ from: 690, to: 858, times: 2 });
    expect(buildTimeline(216).pace).toEqual({ from: 733, to: 901, times: 2 });
  });

  it('gives a frame of the questions twice the scroll of any other frame', () => {
    expect(scrollFor(720, 721)).toBeCloseTo(2 * scrollFor(300, 301), 6);
    expect(scrollFor(870, 871)).toBeCloseTo(scrollFor(300, 301), 6);
  });

  it('gives each question about 1800 px of scroll, where it had about 900', () => {
    const page = trackHeightPx(tl) / (1 - HOLD);
    const perQuestion = scrollFromFrame(736, page, tl) - scrollFromFrame(707, page, tl);
    expect(perQuestion).toBeCloseTo(29 * 2 * SCROLL_PX_PER_FRAME, 0);
  });

  it('still goes there and back, inside the questions and past them', () => {
    for (const f of [0, 300, 690, 700, 777.5, 858, 900, 934]) {
      expect(frameFromScroll(scrollFromFrame(f, max, tl), max, tl)).toBeCloseTo(f, 6);
    }
    expect(frameFromScroll(max, max, tl)).toBe(934);
  });
});

describe('the small math the journey shares', () => {
  it('clamps, ramps and eases', () => {
    expect([clamp(2), clamp(-1), clamp(5, 0, 10)]).toEqual([1, 0, 5]);
    expect([ramp(5, 0, 10), ramp(-1, 0, 10), ramp(11, 0, 10)]).toEqual([0.5, 0, 1]);
    expect(ez(0.5)).toBe(0.5);
    expect(ease(5, 0, 10)).toBe(0.5);
    expect(mix(2, 4, 0.5)).toBe(3);
  });

  it('bands up and down', () => {
    expect([band(0, 1, 2, 3, 4), band(2.5, 1, 2, 3, 4), band(4, 1, 2, 3, 4)]).toEqual([0, 1, 0]);
  });

  it('overshoots with backOut, ending at 1', () => {
    expect(backOut(1)).toBe(1);
    expect(backOut(0.7)).toBeGreaterThan(1);
  });

  it('draws the same numbers from the same seed', () => {
    const a = seeded(7), b = seeded(7);
    expect([a(), a()]).toEqual([b(), b()]);
  });

  it('passes through its middle points with catmullRom', () => {
    expect(catmullRom(0, 1, 2, 3, 0)).toBe(1);
    expect(catmullRom(0, 1, 2, 3, 1)).toBe(2);
    expect(catmullRom(0, 1, 2, 3, 0.5)).toBeCloseTo(1.5, 6);
  });
});
