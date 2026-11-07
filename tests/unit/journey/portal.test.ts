import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boxesMeet, keepOnPage, layersAt, tagPlace, tagsApart } from '~/journey/layers';
import { machinePose } from '~/journey/machine/choreography';
import { buildTimeline } from '~/journey/timeline';
import { canvasOpaque, irisWindowOn, windowReach } from '~/journey/world/portalWindow';
import { PortalWord } from '~/ui/journey/PortalWord';
import { StackWords } from '~/ui/journey/StackWords';
import { render } from './render';

const tl = buildTimeline();
const at = (f: number) => layersAt(f, tl, false);
const anchors = JSON.parse(readFileSync('tests/fixtures/machine-anchors.json', 'utf8')) as Record<string, Record<'armour' | 'controls' | 'brain' | 'body', { point: number[] }>>;

describe('the window onto the tunnel', () => {
  it('is drawn only from when the shield goes until the camera is inside', () => {
    expect([irisWindowOn(335), irisWindowOn(336), irisWindowOn(345), irisWindowOn(371), irisWindowOn(372)]).toEqual([false, true, true, true, false]);
  });

  it('turns the whole canvas opaque once you are inside', () => {
    expect([canvasOpaque(371), canvasOpaque(372), canvasOpaque(600)]).toEqual([false, true, true]);
  });

  it('opens from nothing as the shield goes', () => {
    expect(windowReach(336)).toBe(0);
    expect(windowReach(340)).toBe(1);
  });

  it('has no edge once the camera is at the opening, since the machine round it is all that is left to hide it', () => {
    expect(windowReach(365)).toBe(1);
    expect(windowReach(366)).toBe(Infinity);
    expect(windowReach(371)).toBe(Infinity);
  });
});

describe('the labels on the stack', () => {
  it('stand where Blender had them as the stack begins to open', () => {
    const { labels } = machinePose(276);
    for (const name of ['armour', 'controls', 'brain', 'body'] as const) {
      labels[name].forEach((value, i) => expect(Math.abs(value - anchors[276][name].point[i]), name).toBeLessThan(1e-3));
    }
  });

  it('follow the parts they name wherever the open box takes them', () => {
    for (const f of [290, 304, 320]) {
      const { labels, parts } = machinePose(f);
      const off = (got: readonly number[], want: readonly number[], name: string): void => got.forEach((value, i) => expect(Math.abs(value - want[i]), `${name} at ${f}`).toBeLessThan(1e-9));
      off(labels.armour, [parts.lid.p[0] + 0.78, parts.lid.p[1] - 0.78, parts.lid.p[2] + 0.03], 'armour');
      off(labels.controls, [parts.game.p[0] + 0.63, parts.game.p[1] - 0.63, parts.game.p[2]], 'controls');
      off(labels.brain, [parts.code.p[0] + 0.63, parts.code.p[1] - 0.63, parts.code.p[2]], 'brain');
    }
  });

  it('keep the iris for the window, at the height of the lid', () => {
    const { iris, parts } = machinePose(345);
    expect(iris.center).toEqual([0, 0, parts.lid.p[2]]);
    expect(iris.edge).toEqual([0.52, 0, parts.lid.p[2]]);
  });

  it('stand beside what they name, the armour and the body further off, as in the mock', () => {
    expect(tagPlace('controls', [500, 300], 1, 1.125)).toEqual([500, 292]);
    expect(tagPlace('armour', [900, 300], 1, 1.125)).toEqual([240, 304]);
    expect(tagPlace('body', [500, 300], 1, 1.125)).toEqual([730, 382]);
  });

  it('on a tall page, a phone or an upright tablet, all stand at their own corners, where the page has room for their words', () => {
    for (const name of ['armour', 'controls', 'brain', 'body'] as const) expect(tagPlace(name, [210, 500], 0.88, 1.17, true), name).toEqual([210, 492]);
    // The tablet's armour that went off its left edge: a stack at 380 px on an 820 x 1180 page.
    expect(tagPlace('armour', [380, 594], 0.54, 1180 / 720, true)[0]).toBeGreaterThan(0);
    expect(tagPlace('armour', [380, 594], 0.54, 1180 / 720)[0]).toBeLessThan(0);
  });

  it('keep their words inside the page, as the body on a tablet turned sideways did not', () => {
    // The body's label, 135 px wide, put at 994 px on a page 1024 px wide.
    expect(keepOnPage(994, 135, 1024, 34)).toBe(855);
    expect(keepOnPage(500, 135, 1024, 34)).toBe(500);
    expect(keepOnPage(-160, 135, 1024, 34)).toBe(34);
  });

  it('know when they reach the rail', () => {
    const rail = { left: 880, top: 260, right: 994, bottom: 510 };
    expect(boxesMeet({ left: 811, top: 427, right: 967, bottom: 457 }, rail, 12)).toBe(true);
    expect(boxesMeet({ left: 700, top: 427, right: 860, bottom: 457 }, rail, 12)).toBe(false);
    expect(boxesMeet({ left: 855, top: 590, right: 990, bottom: 620 }, rail, 12)).toBe(false);
  });

  it('on a tall page, keep clear of the label above them', () => {
    expect(tagsApart([400, 470, 520, 540], [30, 30, 45, 30], 10)).toEqual([400, 470, 520, 575]);
    expect(tagsApart([400, 405], [30, 30], 10)).toEqual([400, 440]);
    expect(tagsApart([], [], 10)).toEqual([]);
  });

  it('show only while the stack is apart', () => {
    expect(at(280).stack).toBe(0);
    expect(at(300).stack).toBe(1);
    expect(at(322).stack).toBe(0);
  });
});

describe('the words', () => {
  it('say what the stack is', () => {
    const html = render(StackWords);
    expect(html).toContain('One machine.');
    expect(html).toContain('Each field I learn is one layer of it.');
    for (const word of ['Armour', 'Cybersecurity', 'Controls', 'Game Development', 'Brain', 'Software Engineering', 'Body', 'Mechatronics']) expect(html).toContain(word);
  });

  it('name the portal as it opens', () => {
    expect(render(PortalWord)).toContain('Projects');
    expect(at(338).portal).toBe(0);
    expect(at(350).portal).toBe(1);
    expect(at(360).portal).toBe(0);
  });
});
