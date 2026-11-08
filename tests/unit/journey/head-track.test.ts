import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildHeadTrack, headPlace } from '~/journey/world/head/track';

const join = { pos: new Vector3(0, 0, -180), look: new Vector3(0, 0, -190), up: new Vector3(0, 1, 0) };
const way = buildHeadTrack(join, headPlace(join), false);
const pose = (t: number) => way(t, { pos: new Vector3(), look: new Vector3(), up: new Vector3() });

describe("the camera's one way through his head", () => {
  it('starts exactly where the flight ends, looking the same way', () => {
    const p = pose(0);
    expect(p.pos.distanceTo(join.pos)).toBeLessThan(1e-3);
    expect(p.look.clone().sub(p.pos).normalize().dot(new Vector3(0, 0, -1))).toBeGreaterThan(0.999);
  });

  it('never jumps: no step is more than three times the larger of its neighbours', () => {
    const dt = 0.0005, steps: number[] = [];
    for (let t = 0; t < 1 - dt; t += dt) steps.push(pose(t).pos.distanceTo(pose(t + dt).pos));
    for (let i = 1; i < steps.length - 1; i++) expect(steps[i], `t ${(i * dt).toFixed(4)}`).toBeLessThanOrEqual(3 * Math.max(steps[i - 1], steps[i + 1]) + 0.02);
  });

  it('looks straight down the shaft by t 0.06', () => {
    const p = pose(0.06);
    expect(p.look.clone().sub(p.pos).normalize().y).toBeLessThan(-0.95);
  });
});
