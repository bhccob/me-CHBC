import { describe, expect, it } from 'vitest';
import { buildTree } from '~/ui/journey/paper';

const ys = (tree: ReturnType<typeof buildTree>): number[] => tree.segs.flatMap((s) => [s.y0, s.y1]);
const xs = (tree: ReturnType<typeof buildTree>): number[] => tree.segs.flatMap((s) => [s.x0, s.x1]);

describe('the tree on the first view, from the corner (round 22)', () => {
  const W = 1280, H = 720;
  const tree = buildTree(W, H);

  it('stays along the top: between the menu and 30% down the page', () => {
    expect(Math.min(...ys(tree))).toBeGreaterThanOrEqual(H * 0.1);
    expect(Math.max(...ys(tree))).toBeLessThanOrEqual(H * 0.3);
  });

  it('reaches in from the top right, no further than the middle', () => {
    expect(Math.max(...xs(tree))).toBeGreaterThan(W);
    expect(Math.min(...xs(tree))).toBeGreaterThanOrEqual(W * 0.5);
  });

  it('turns to gold traces, and lights far fewer tips than the tree before it (137)', () => {
    expect(tree.segs.some((s) => s.gold)).toBe(true);
    expect(tree.tips.length).toBeGreaterThan(5);
    expect(tree.tips.length).toBeLessThan(60);
  });

  it('on a phone reaches further across, and stays above a quarter of the page', () => {
    const phone = buildTree(780, 1688);
    expect(Math.min(...xs(phone))).toBeGreaterThanOrEqual(780 * 0.3);
    expect(Math.max(...ys(phone))).toBeLessThanOrEqual(1688 * 0.24);
    expect(Math.min(...ys(phone))).toBeGreaterThanOrEqual(1688 * 0.1);
  });
});
