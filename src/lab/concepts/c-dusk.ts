import { Vector3 } from 'three';
import { ease, mix } from '~/journey/math';
import { idleFrames } from '~/journey/machine/choreography';
import { LabMachine } from '../engine/machine';
import { Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). C · Dusk. Bob's machine, built part by part as on the live site, outdoors: against an Aruban
 * sunset, seen low, in silhouette with a gold rim. The sun goes down as you scroll; by the time the machine stands it is
 * night and its own lights are the light. The sky, the sun and the sea are drawn on the page behind the canvas and kept
 * in line with the 3D camera (horizon and sun projected every frame).
 */

const SUN_AZIMUTH = new Vector3(0.18, 1, 0).normalize();

export async function build({ renderer, root }: BuildContext): Promise<World> {
  const m = new LabMachine();
  // Low, looking into the sun: the machine between you and the light.
  const shots: Shot[] = [
    { f: 0, pos: [0.3, -2.3, 0.2], look: [0.05, 1, 0.22], fov: 30, blur: 2.4 },
    { f: 40, pos: [0.55, -2.6, 0.32], look: [0, 1, 0.24], fov: 30, blur: 2.2 },
    { f: 100, pos: [1.0, -3.0, 0.45], look: [0, 1, 0.28], fov: 30, blur: 2.0 },
    { f: 160, pos: [1.5, -4.0, 0.55], look: [0, 1, 0.3], fov: 30, blur: 1.8 },
    { f: 220, pos: [1.2, -5.0, 0.3], look: [0, 1, 0.12], fov: 31, blur: 1.6 },
    { f: 266, pos: [0.8, -5.9, -0.35], look: [0, 1, 0.0], fov: 32, blur: 1.4 },
    { f: 300, pos: [-1.6, -5.6, 0.55], look: [0, 1, 0.2], fov: 32, blur: 1.4 },
    { f: 318, pos: [-3.2, -4.2, 1.3], look: [0, 0, 0.2], fov: 32, blur: 1.2 },
  ];
  const rig = new Rig(shots);
  const pos = new Vector3(), look = new Vector3();
  const backdrop = root.querySelector<HTMLElement>('.lab-backdrop');
  const far = new Vector3();
  let rimPlaced = false;

  return {
    scene: m.scene,
    camera: m.camera,
    transparent: true,
    post: { bloom: 0.22, threshold: 1.1, contrast: 1.24, saturation: 1.18 },
    beats: {
      heroOut: [6, 28],
      steps: [
        [46, 58, 94, 102],
        [100, 112, 146, 154],
        [152, 164, 200, 206],
        [206, 218, 264, 274],
      ],
    },
    load: (progress) => m.load(renderer, progress),

    timeline() {},

    frame(f, nowS, _dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      // The board's traces run on their own at dusk too, like a town's lights coming on.
      m.update(f, idleFrames(nowS), aspect);
      const rim = m.rimLight();
      if (rim && !rimPlaced) {
        // The rim comes from the sun: behind the machine, low.
        rim.position.set(SUN_AZIMUTH.x * 4, SUN_AZIMUTH.y * 4, 0.7);
        rim.lookAt(0, 0, 0.2);
        rimPlaced = true;
      }
      const night = ease(f, 110, 290);
      if (rim) rim.color.setRGB(1, mix(0.62, 0.55, night), mix(0.32, 0.6, night));
      // Silhouette: little front light, a strong warm rim that cools and fades as the sun goes.
      m.light({ key: mix(0.18, 0.08, night) * lamp + 0.02, strip: 0.08, top: mix(0.25, 0.1, night), bench: 0.5, low: 0.6, rim: mix(1.9, 1.1, night) * lamp + 0.2 });

      const shot = rig.at(f, pos, look);
      m.aim(f, { pos, look, fov: shot.fov }, aspect);

      // The page's sky in line with the camera: the horizon at eye level, the sun low over it, sinking.
      if (backdrop) {
        const camera = m.camera;
        const forward = new Vector3();
        camera.getWorldDirection(forward);
        forward.z = 0;
        forward.normalize();
        far.copy(camera.position).addScaledVector(forward, 5000);
        far.project(camera);
        const hy = (-far.y * 0.5 + 0.5) * height;
        const altitude = mix(0.07, -0.05, ease(f, 0, 300));
        const sun = camera.position.clone().addScaledVector(SUN_AZIMUTH, 5000);
        sun.z = camera.position.z + 5000 * altitude;
        sun.project(camera);
        const sx = (sun.x * 0.5 + 0.5) * width, sy = (-sun.y * 0.5 + 0.5) * height;
        const inside = ease(f, 326, 346);
        backdrop.style.setProperty('--hy', `${hy.toFixed(1)}px`);
        backdrop.style.setProperty('--sx', `${sx.toFixed(1)}px`);
        backdrop.style.setProperty('--sy', `${sy.toFixed(1)}px`);
        backdrop.style.setProperty('--night', Math.min(1, night + inside).toFixed(3));
      }
      const after = ease(f, 330, 356);
      return { focus: pos.distanceTo(look), blur: shot.blur * (1 - after), grain: mix(0.026, 0, after), vignette: mix(0.42, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    window: (f) => m.window(f),

    readout(f) {
      const minutes = Math.round(ease(f, 0, 300) * 52);
      return `Aruba · 18:${String(minutes).padStart(2, '0')}`;
    },

    dispose() {
      m.dispose();
    },
  };
}
