import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layersAt, tagPlace } from '~/journey/layers';
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
});

describe('the labels on the stack', () => {
  it('follow the parts Blender says they point at', () => {
    for (const f of [276, 290, 304, 320]) {
      const { labels } = machinePose(f);
      for (const name of ['armour', 'controls', 'brain', 'body'] as const) {
        labels[name].forEach((value, i) => expect(Math.abs(value - anchors[f][name].point[i]), `${name} at ${f}`).toBeLessThan(1e-3));
      }
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
