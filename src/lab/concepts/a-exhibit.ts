import { gsap } from 'gsap';
import { Vector3 } from 'three';
import { ease, mix } from '~/journey/math';
import { idleFrames, nightShare } from '~/journey/machine/choreography';
import { LabMachine } from '../engine/machine';
import { Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). A · Exhibit. Bob's machine, built part by part as on the live site, but shown like a sculpture:
 * one dark gallery, one soft light from above, a slow orbit that never cuts. The study's big word comes in on its own
 * cream page that slides over the 3D, as an editorial page would, and slides away to show the part arriving. Nothing
 * else on screen.
 */

/** When each study's page covers the machine, and when it has gone again: just before its part lands. */
const PAGES: readonly (readonly [number, number])[] = [
  [30, 46],
  [84, 98],
  [136, 150],
  [188, 202],
];

export async function build({ renderer, root }: BuildContext): Promise<World> {
  const m = new LabMachine();
  // One continuous orbit, about three quarters round; the machine stays in the middle of the frame.
  const shots: Shot[] = [
    { f: 0, pos: [0.15, -2.15, 0.62], look: [0, 0.18, 0.02], fov: 30, blur: 2.2 },
    { f: 30, pos: [0.5, -2.5, 0.95], look: [0, 0.1, 0.06], fov: 30, blur: 2.0 },
    { f: 80, pos: [1.45, -2.45, 1.4], look: [0, 0, 0.16], fov: 30, blur: 1.8 },
    { f: 130, pos: [2.5, -1.45, 1.6], look: [0, 0, 0.26], fov: 30, blur: 1.8 },
    { f: 182, pos: [2.65, 0.85, 1.75], look: [0, 0, 0.3], fov: 30, blur: 1.8 },
    { f: 232, pos: [1.9, 4.0, 1.5], look: [0, 0, 0.0], fov: 31, blur: 1.6 },
    { f: 264, pos: [-1.4, 4.9, 0.7], look: [0, 0, -0.15], fov: 32, blur: 1.4 },
    { f: 300, pos: [-3.9, 3.0, 2.6], look: [0, 0.2, 0.35], fov: 32, blur: 1.3 },
    { f: 318, pos: [-3.7, -1.3, 2.0], look: [0, 0, 0.2], fov: 32, blur: 1.2 },
  ];
  const rig = new Rig(shots);
  const pos = new Vector3(), look = new Vector3();
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.lab-panel'));
  const stage = [root.querySelector('.lab-canvas'), root.querySelector('.lab-backdrop')];

  return {
    scene: m.scene,
    camera: m.camera,
    transparent: true,
    // The live machine's own look (World.ts): the light Bob approved.
    post: { bloom: 0.16, threshold: 1.2, contrast: 1.24, saturation: 1.2 },
    beats: {
      heroOut: [6, 28],
      steps: [
        [50, 60, 92, 100],
        [104, 114, 144, 152],
        [156, 166, 196, 204],
        [208, 218, 262, 272],
      ],
    },
    load: (progress) => m.load(renderer, progress),

    timeline(tl) {
      gsap.set(pages, { yPercent: 100, autoAlpha: 1 });
      // Each page rises over the gallery as the gallery rises away a little slower behind it, then the next view comes up
      // from below as the page leaves: one page of a book over another, never a cut.
      PAGES.forEach(([a, b], i) => {
        const page = pages[i];
        if (!page) return;
        const mid = (a + b) / 2;
        tl.fromTo(page, { yPercent: 100 }, { yPercent: 0, duration: mid - a, ease: 'power3.inOut', immediateRender: false }, a);
        tl.to(page, { yPercent: -100, duration: b - mid, ease: 'power3.inOut' }, mid);
        tl.fromTo(stage, { yPercent: 0 }, { yPercent: -22, duration: mid - a, ease: 'power3.in', immediateRender: false }, a);
        tl.fromTo(stage, { yPercent: 22 }, { yPercent: 0, duration: b - mid, ease: 'power3.out', immediateRender: false }, mid);
      });
    },

    frame(f, nowS, _dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      m.update(f, idleFrames(nowS) * nightShare(f), aspect);
      // A gallery: less of the bench lamp, the key a little softer and the top light stronger.
      m.light({ key: 0.9 * lamp + 0.05, top: 1.35 * lamp, bench: 0.5, rim: 1.1 * lamp + 0.2 });
      const shot = rig.at(f, pos, look);
      m.aim(f, { pos, look, fov: shot.fov }, aspect);
      const after = ease(f, 330, 356);
      return { focus: pos.distanceTo(look), blur: shot.blur * (1 - after), grain: mix(0.022, 0, after), vignette: mix(0.35, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    window: (f) => m.window(f),

    readout(f) {
      const done = [50, 104, 156, 208].filter((at) => f >= at).length;
      return `${String(done).padStart(2, '0')} / 04`;
    },

    dispose() {
      gsap.set(stage, { clearProps: 'transform' });
      m.dispose();
    },
  };
}
