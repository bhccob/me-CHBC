import { describe, expect, it } from 'vitest';
import { layersAt } from '~/journey/layers';
import { buildTimeline } from '~/journey/timeline';

const tl = buildTimeline();
const at = (f: number) => layersAt(f, tl, false);

describe('what the page shows at each frame', () => {
  it('holds the first view, then lets it rise away', () => {
    expect(at(0).hero).toEqual({ opacity: 1, y: -0 });
    expect(at(3).hero.opacity).toBe(1);
    expect(at(22).hero).toEqual({ opacity: 0, y: -40 });
  });

  it('lets the characters go a little sooner', () => {
    expect(at(0).vert.opacity).toBe(1);
    expect(at(14).vert.opacity).toBe(0);
  });

  it('keeps the paper only while it can be seen', () => {
    expect(at(69).paper).toBe(true);
    expect(at(70).paper).toBe(false);
  });

  it('lets the sparks go with the first view', () => {
    expect(at(0).sparks).toBe(1);
    expect(at(26).sparks).toBe(0);
  });

  it('shows the story from the first view to the first sheet', () => {
    expect(at(16).story.opacity).toBe(0);
    expect(at(30).story.opacity).toBe(1);
    expect(at(54).story.opacity).toBe(0);
  });

  it('rolls the age over frames 20 to 42, seven years from 13', () => {
    expect(at(20).age).toBe(0);
    expect(at(42).age).toBe(1);
  });
});
