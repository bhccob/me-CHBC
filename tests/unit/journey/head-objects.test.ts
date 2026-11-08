import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { objectSegments, objectSvgPath } from '~/journey/head/objects';
import { CODE_LINES, pourWords } from '~/journey/head/pour';

describe('the objects of light', () => {
  it.each(['cap', 'rocket', 'barbell', 'globe', 'block', 'browser'] as const)('%s is drawn in lines, inside its box', (kind) => {
    const { positions, shade } = objectSegments(kind);
    expect(positions.length % 6).toBe(0);
    expect(positions.length).toBeGreaterThan(60);
    expect(shade.length).toBe(positions.length / 3);
    expect(Math.max(...Array.from(positions, Math.abs))).toBeLessThanOrEqual(1);
    expect(objectSvgPath(kind)).toMatch(/^M[\d.]+ [\d.]+L/);
  });
});

describe('what pours into his head (spec 5.4)', () => {
  it('is what the visitor saw: the fields, every project, the code', () => {
    const en = pourWords('en').map((w) => w.text);
    for (const project of projects.byDate()) expect(en).toContain(project.title);
    expect(en).toEqual(expect.arrayContaining(['Software Engineering', 'Game Development', 'Cybersecurity', 'Mechatronics', 'Rotterdam ← Aruba', ...CODE_LINES]));
  });

  it('keeps the code the same in Dutch, and takes the fields in Dutch', () => {
    expect(pourWords('nl').filter((w) => w.mono).map((w) => w.text)).toEqual(pourWords('en').filter((w) => w.mono).map((w) => w.text));
    expect(pourWords('nl').map((w) => w.text)).toContain('Mechatronica');
  });
});
