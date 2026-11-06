import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { cornerStiffness, cursorOn, HOVERABLE, lockTarget, PINCH } from '~/journey/cursor/lock';

describe('where the four corners go', () => {
  it('stand round the pointer at rest, about 26 px apart', () => {
    expect(lockTarget({ px: 5, py: 6, screen: false, rect: null })).toEqual({ cx: 5, cy: 6, hw: 13, hh: 13, len: 6, locked: false });
  });

  it('close around a link or button, whatever its size', () => {
    expect(lockTarget({ px: 5, py: 6, screen: false, rect: { left: 10, top: 20, width: 100, height: 40 } })).toEqual({ cx: 60, cy: 40, hw: 59, hh: 27, len: 9, locked: true });
  });

  it('only widen a little over something too big to frame', () => {
    expect(lockTarget({ px: 5, py: 6, screen: false, rect: { left: 0, top: 0, width: 560, height: 40 } })).toEqual({ cx: 5, cy: 6, hw: 20, hh: 20, len: 8, locked: false });
    expect(lockTarget({ px: 5, py: 6, screen: false, rect: { left: 0, top: 0, width: 100, height: 200 } })).toEqual({ cx: 5, cy: 6, hw: 20, hh: 20, len: 8, locked: false });
  });

  it('open a window over a project, about 100 by 64 px', () => {
    expect(lockTarget({ px: 5, py: 6, screen: true, rect: null })).toEqual({ cx: 5, cy: 6, hw: 50, hh: 32, len: 12, locked: false });
  });

  it('take a project over a link under it', () => {
    expect(lockTarget({ px: 5, py: 6, screen: true, rect: { left: 10, top: 20, width: 100, height: 40 } }).hw).toBe(50);
  });

  it('pinch in by 4 px when pressed', () => {
    expect(PINCH).toBe(4);
  });
});

describe('how the corners follow', () => {
  it('keeps up on the leading side, and comes late on the trailing side', () => {
    expect(cornerStiffness(1, 1, 0.707, 0.707, 1, false)).toBeGreaterThan(cornerStiffness(-1, -1, 0.707, 0.707, 1, false));
  });

  it('is even when nothing moves', () => {
    expect(cornerStiffness(1, 1, 0, 0, 0, false)).toBe(cornerStiffness(-1, -1, 0, 0, 0, false));
  });

  it('snaps faster onto something it locks to', () => {
    expect(cornerStiffness(1, 1, 0, 0, 0, true)).toBeGreaterThan(cornerStiffness(1, 1, 0, 0, 0, false));
  });
});

describe('where the cursor shows', () => {
  it('shows on a mouse only, and not with reduced motion', () => {
    expect([cursorOn(true, true, false), cursorOn(false, false, false), cursorOn(true, true, true)]).toEqual([true, false, false]);
  });

  it('frames fields too', () => {
    expect(HOVERABLE).toContain('input');
    expect(HOVERABLE).toContain('textarea');
  });

  it('has its one word in both languages', () => {
    expect(en.journey.cursor.open).toBe('OPEN');
    expect(nl.journey.cursor.open).toBe('OPEN');
  });
});
