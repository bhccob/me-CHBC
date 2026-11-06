import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { layersAt, sheetWindows } from '~/journey/layers';
import { buildTimeline } from '~/journey/timeline';
import { BAND_KINDS, FieldSheet } from '~/ui/journey/FieldSheet';
import { render } from './render';

const tl = buildTimeline();
const at = (f: number) => layersAt(f, tl, false);

describe('the four sheets over the scroll', () => {
  it('slide up at the frames the spec gives', () => {
    expect(sheetWindows).toEqual([[44, 66], [98, 120], [152, 174], [204, 226]]);
  });

  it('come from below with a slight tilt, then lie flat', () => {
    expect(at(44).sheets[0].y).toBe(112);
    expect(at(66).sheets[0]).toMatchObject({ y: 0, tilt: -0 });
    expect(at(55).sheets[0].tilt).toBeCloseTo(-1.3, 5);
  });

  it('are out of sight before they start', () => {
    expect(at(40).sheets[0].on).toBe(false);
    expect(at(50).sheets[0].on).toBe(true);
  });

  it('are put away once the next has covered them', () => {
    expect(at(120).sheets[0].on).toBe(true);
    expect(at(122).sheets[0].on).toBe(false);
    expect(at(120).sheets[1].on).toBe(true);
  });

  it('keep only the last, whose words fade before its paper', () => {
    expect(at(250).sheets[3].inner).toBe(1);
    expect(at(288).sheets[3].inner).toBe(0);
    expect(at(288).sheets[3].opacity).toBe(1);
    expect(at(352).sheets[3].on).toBe(false);
  });
});

describe('a sheet', () => {
  const html = render(FieldSheet, { sheet: en.journey.sheets[3], n: 3 });

  it('has its giant word as a heading', () => {
    expect(html).toContain('Mechatronics');
    expect(html).toContain('Engineering');
    expect(html).toMatch(/<h2/);
  });

  it('has its facts as real text', () => {
    expect(html).toContain('Interested and exploring');
    expect(html).toContain('Sensors, motors, circuits');
  });

  it('has its line and its title block, the first part in gold', () => {
    expect(html).toContain('<b>The body.</b>');
    expect(html).toContain('<b>HBO, next</b>');
    expect(html).toContain('Sheet 4 of 4');
  });

  it('takes its colours and its art from its place', () => {
    expect(html).toContain('--paper:var(--j-sheet-3-paper)');
    expect(BAND_KINDS).toEqual(['software', 'game', 'cyber', 'mech']);
    expect(html).toContain('data-kind="mech"');
  });
});
