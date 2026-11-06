import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from '~/journey/timeline';
import { movingShare, starShare } from '~/journey/world/void/Dissolve';
import { lookFrame, qaReadFrames, QUESTION_DISTANCES, VOID_LENGTH, voidAt, voidDistance } from '~/journey/world/void/path';

const tl = buildTimeline();

describe('the way through the void', () => {
  it('starts where the tunnel ends', () => {
    expect(voidAt(0, new Vector3()).distanceTo(new Vector3(0, 0, -180))).toBeCloseTo(0, 3);
    expect(voidAt(0, new Vector3(), 216).distanceTo(new Vector3(0, 0, -216))).toBeCloseTo(0, 3);
  });

  it('keeps its shape behind a longer tunnel', () => {
    const near = voidAt(100, new Vector3());
    const far = voidAt(100, new Vector3(), 216);
    expect(far.x).toBeCloseTo(near.x, 6);
    expect(far.y).toBeCloseTo(near.y, 6);
    expect(far.z).toBeCloseTo(near.z - 36, 6);
  });

  it('runs straight on past its end', () => {
    const a = voidAt(VOID_LENGTH + 20, new Vector3());
    const b = voidAt(VOID_LENGTH + 40, new Vector3());
    expect(a.distanceTo(b)).toBeCloseTo(20, 3);
  });

  it('never stops', () => {
    for (let i = 1; i < 500; i++) expect(voidDistance(i / 500)).toBeGreaterThan(voidDistance((i - 1) / 500));
  });

  it('goes from its start to its end', () => {
    expect(voidDistance(0)).toBe(0);
    expect(voidDistance(1)).toBeCloseTo(VOID_LENGTH, 3);
  });

  it('holds six questions, in order', () => {
    expect(QUESTION_DISTANCES).toHaveLength(6);
    for (let i = 1; i < 6; i++) expect(QUESTION_DISTANCES[i]).toBeGreaterThan(QUESTION_DISTANCES[i - 1]);
  });
});

describe('the frames of the void', () => {
  it('reads each question within two frames of the spec, which rounded them', () => {
    qaReadFrames(tl).forEach((f, i) => expect(Math.abs(f - [707, 736, 765, 795, 824, 853][i]), `question ${i}`).toBeLessThanOrEqual(2));
  });

  it('looks back at the frame of the spec', () => {
    expect(Math.abs(lookFrame(tl) - 642)).toBeLessThanOrEqual(2);
  });

  it('moves with a longer flight', () => {
    expect(qaReadFrames(buildTimeline(216))[0] - qaReadFrames(tl)[0]).toBe(43);
  });

});

describe('the tunnel breaking', () => {
  it('starts all wire: no sparks and no stars', () => {
    expect(movingShare(0)).toBe(0);
    expect(starShare(0)).toBe(0);
  });

  it('is sparks in the middle', () => {
    expect(movingShare(0.5)).toBeGreaterThan(0.5);
  });

  it('ends all stars: the sparks fall to none', () => {
    expect(movingShare(1)).toBe(0);
    expect(starShare(1)).toBe(1);
  });

  it('only ever gains stars', () => {
    for (let i = 1; i <= 100; i++) expect(starShare(i / 100)).toBeGreaterThanOrEqual(starShare((i - 1) / 100));
  });
});
