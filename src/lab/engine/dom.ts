import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { Camera, Vector3 } from 'three';
import type { Beats } from '../concepts/types';

gsap.registerPlugin(SplitText);

/**
 * LAB ONLY (throwaway). The page's words: every word is real DOM text, split into lines and characters, and moved by the
 * same scrubbed timeline as the 3D, so scrolling back plays it backwards.
 */

export interface Splits {
  name: SplitText;
  steps: SplitText[];
  revert(): void;
}

export function splitWords(root: HTMLElement): Splits {
  const name = SplitText.create(root.querySelector<HTMLElement>('.lab-name')!, { type: 'lines,chars', mask: 'lines' });
  const steps = Array.from(root.querySelectorAll<HTMLElement>('.lab-step-title')).map((el) => SplitText.create(el, { type: 'lines,chars', mask: 'lines' }));
  return {
    name,
    steps,
    revert() {
      name.revert();
      for (const split of steps) split.revert();
    },
  };
}

/** The hero's first entrance, on time rather than scroll, once the loader has gone. */
export function heroIntro(root: HTMLElement, splits: Splits, reduce: boolean, style: 'rise' | 'fill' = 'rise'): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const line = root.querySelector('.lab-line'), cue = root.querySelector('.lab-cue'), mark = root.querySelector('.lab-mark'), readout = root.querySelector('.lab-readout');
  if (reduce) {
    tl.fromTo([root.querySelector('.lab-name'), line, cue, mark, readout], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: 0.08 });
    return tl;
  }
  if (style === 'fill') tl.fromTo(splits.name.chars, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out', stagger: 0.07 }, 1.15);
  else tl.fromTo(splits.name.chars, { yPercent: 108 }, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.035 }, 0.15);
  tl.fromTo(line, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out' }, 0.75)
  tl.fromTo([mark, readout], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power2.out' }, 1.0)
    .fromTo(cue, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 1.25);
  return tl;
}

/** The words' part of the scrubbed timeline: the hero leaving, each step in and out, the letterbox. */
export function wordsTimeline(tl: gsap.core.Timeline, root: HTMLElement, beats: Beats, splits: Splits, reduce: boolean): void {
  const hero = root.querySelector('.lab-hero');
  const cue = root.querySelector('.lab-cue');
  const [h0, h1] = beats.heroOut;
  // Explicit start values: the hero's entrance may still be running when the scroll first moves.
  tl.fromTo(cue, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, duration: 6, ease: 'power1.in', immediateRender: false }, 1);
  if (reduce) tl.fromTo(hero, { autoAlpha: 1 }, { autoAlpha: 0, duration: h1 - h0, immediateRender: false }, h0);
  else {
    tl.fromTo(splits.name.chars, { yPercent: 0, opacity: 1 }, { yPercent: -108, duration: (h1 - h0) * 0.75, stagger: ((h1 - h0) * 0.25) / Math.max(1, splits.name.chars.length), ease: 'power2.in', immediateRender: false }, h0);
    tl.fromTo(root.querySelector('.lab-line'), { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -12, duration: (h1 - h0) * 0.6, ease: 'power2.in', immediateRender: false }, h0);
  }
  const steps = Array.from(root.querySelectorAll<HTMLElement>('.lab-step'));
  beats.steps.forEach(([a, b, c, d], i) => {
    const step = steps[i];
    if (!step) return;
    const n = step.querySelector('.lab-step-n'), line = step.querySelector('.lab-step-line');
    tl.set(step, { autoAlpha: 1 }, a);
    if (reduce) tl.fromTo(step, { opacity: 0 }, { opacity: 1, duration: b - a, immediateRender: false }, a);
    else {
      tl.fromTo(splits.steps[i].chars, { yPercent: 110 }, { yPercent: 0, duration: (b - a) * 0.8, stagger: ((b - a) * 0.2) / Math.max(1, splits.steps[i].chars.length), ease: 'expo.out', immediateRender: false }, a);
      tl.fromTo([n, line], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: (b - a) * 0.7, ease: 'expo.out', stagger: (b - a) * 0.15, immediateRender: false }, a + (b - a) * 0.2);
    }
    tl.to(step, { autoAlpha: 0, y: reduce ? 0 : -18, duration: d - c, ease: 'power2.in' }, c);
  });
  const [b0, b1, b2, b3] = beats.bars;
  const bars = root.querySelectorAll('.lab-bar');
  if (b1 > b0) {
    tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: b1 - b0, ease: 'power2.inOut', immediateRender: false }, b0);
    tl.to(bars, { scaleY: 0, duration: b3 - b2, ease: 'power2.inOut' }, b2);
  }
  // Everything of the opening's chrome is gone before the tunnel is alone.
  tl.to(root.querySelectorAll('.lab-mark, .lab-readout, .lab-tag'), { autoAlpha: 0, duration: 16 }, 340);
  tl.set({}, {}, 372);
}

/** Where a world point stands on the page, CSS px; z > 1 means behind the camera. */
export function toPage(point: Vector3, camera: Camera, width: number, height: number, out: [number, number, number]): [number, number, number] {
  const p = point.clone().project(camera);
  out[0] = (p.x * 0.5 + 0.5) * width;
  out[1] = (-p.y * 0.5 + 0.5) * height;
  out[2] = p.z;
  return out;
}

/**
 * The CSS matrix3d that maps an element `w` by `h` px (origin top left) onto the quad tl, tr, br, bl on the page: a
 * projective map, so DOM text can sit on a 3D screen and stay real, crisp text.
 */
export function quadMatrix(w: number, h: number, q: readonly (readonly [number, number])[]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, hh: number;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; hh = 0;
  } else {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    hh = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
  }
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => v.toFixed(8)).join(',')})`;
}
