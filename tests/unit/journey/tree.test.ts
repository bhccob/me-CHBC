import { describe, expect, it } from 'vitest';
import { buildTree } from '~/ui/journey/paper';

describe('the tree on the first view, calmer (round 21)', () => {
  // Before this round, at 1280 by 720: 412 lit tips, a trunk 23 px thick and gold lines up to 4 px.
  const tree = buildTree(1280, 720);

  it('lights a third of the tips it did', () => {
    expect(tree.tips.length).toBe(Math.ceil(412 / 3));
  });

  it('draws its branches half as thick, the wood and the gold', () => {
    expect(Math.max(...tree.segs.map((s) => s.w))).toBeCloseTo(22.95 / 2, 1);
    expect(Math.max(...tree.segs.filter((s) => s.gold).map((s) => s.w))).toBeCloseTo(4.04 / 2, 1);
  });

  it('keeps its shape: the same branches, in the same places', () => {
    expect(tree.segs).toHaveLength(1528);
  });
});
