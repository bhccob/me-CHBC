import { describe, expect, it } from 'vitest';
import { FrameJudge, SLOW_MS, VERY_SLOW_MS } from '~/engine/quality';

describe('FrameJudge', () => {
  /** `count` frames of `ms`, the steps down they asked for. */
  const run = (judge: FrameJudge, ms: number, count: number): number[] => Array.from({ length: count }, () => judge.frame(ms)).filter((d) => d > 0);

  it('asks for nothing while frames hold their time', () => {
    expect(run(new FrameJudge(), 16.7, 500)).toEqual([]);
    expect(run(new FrameJudge(), 5.5, 2000)).toEqual([]);
  });

  it('asks for a step down once it has seen enough slow frames, within a second', () => {
    const judge = new FrameJudge();
    const ms = SLOW_MS + 6;
    expect(run(judge, ms, Math.floor(700 / ms) - 1)).toEqual([]);
    expect(run(judge, ms, 4)).toEqual([1]);
  });

  it('asks for two when they are very slow', () => {
    expect(run(new FrameJudge(), VERY_SLOW_MS + 10, 20)[0]).toBe(2);
  });

  it('does not take a stall for the frame rate', () => {
    const judge = new FrameJudge();
    const asked: number[] = [];
    for (let i = 0; i < 100; i++) asked.push(judge.frame(i % 20 === 0 ? 120 : 16.7));
    expect(asked.filter((d) => d > 0)).toEqual([]);
  });

  it('does not count a sleep as a frame', () => {
    expect(new FrameJudge().frame(5000)).toBe(0);
    expect(run(new FrameJudge(), 1000, 50)).toEqual([]);
  });

  it('starts its count over after a rest', () => {
    const judge = new FrameJudge();
    run(judge, 40, 16);
    judge.rest();
    expect(run(judge, 40, 16)).toEqual([]);
  });

  it('gives up after two steps that did not help: frames held at 30 a second are not the GPU', () => {
    const judge = new FrameJudge();
    expect(run(judge, 33.4, 400).length).toBe(2);
  });

  it('keeps going while the steps do help', () => {
    const judge = new FrameJudge();
    const asked = [...run(judge, 42, 40), ...run(judge, 34, 40), ...run(judge, 28, 60)];
    expect(asked.length).toBeGreaterThanOrEqual(3);
  });
});
