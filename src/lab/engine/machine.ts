import { type Object3D, RectAreaLight, Vector3, type WebGLRenderer } from 'three';
import codeScreenUrl from '~/assets/journey/code-screen.webp?url';
import { cameraPose, fovFor as lensFov } from '~/journey/machine/camera';
import { machinePose } from '~/journey/machine/choreography';
import { ease, mix } from '~/journey/math';
import { AREA_LIGHTS, type LightName } from '~/journey/world/looks';
import { MachineScene } from '~/journey/world/MachineScene';
import { irisWindowOn, windowReach } from '~/journey/world/portalWindow';
import type { Window } from '../concepts/types';
import { fovFor } from './rig';

/**
 * LAB ONLY (throwaway). Bob's machine, the live site's own: the Blender model (public/models/machine.glb) and its build
 * order (`machinePose`), unchanged. A concept only restages it: its own camera, its own light levels, its own page around
 * it. From frame 316 the camera hands over to the live one, which dives through the iris into the tunnel. Z is up.
 */
export class LabMachine {
  readonly machine = new MachineScene(codeScreenUrl);
  private readonly lights = new Map<LightName, RectAreaLight>();
  private readonly pos = new Vector3();
  private readonly look = new Vector3();
  private readonly up = new Vector3();

  get scene() {
    return this.machine.scene;
  }

  get camera() {
    return this.machine.camera;
  }

  /** Loads the model, then readies every part's shaders at once, so nothing compiles mid-scroll. */
  async load(renderer: WebGLRenderer, onProgress: (share: number) => void): Promise<void> {
    await this.machine.load(onProgress);
    let n = 0;
    for (const child of this.scene.children) {
      if (child instanceof RectAreaLight) this.lights.set(AREA_LIGHTS[n++].name, child);
    }
    this.machine.showAll();
    const restore = this.machine.drawEverything();
    renderer.compile(this.scene, this.camera);
    restore();
    this.machine.update(0);
  }

  part(name: string): Object3D | undefined {
    return this.scene.getObjectByName(name);
  }

  /** Puts every part where frame `f` has it (and the live camera, which `aim` then replaces). */
  update(f: number, idle = 0, aspect = 16 / 9): void {
    this.machine.resize(aspect, 1);
    this.machine.update(f, idle);
  }

  /** Scales the live light rig after `update`: a concept's own light on the same machine. */
  light(scale: Partial<Record<LightName, number>>): void {
    for (const [name, k] of Object.entries(scale) as [LightName, number][]) {
      const light = this.lights.get(name);
      if (light) light.intensity *= k;
    }
  }

  rimLight(): RectAreaLight | undefined {
    return this.lights.get('rim');
  }

  /**
   * The camera: the concept's shot until `from`, the live camera from `to`, blended between. `shot` is in Z-up world
   * space; `fov` is vertical at 16:9.
   */
  aim(f: number, shot: { pos: Vector3; look: Vector3; fov: number }, aspect: number, from = 316, to = 336): void {
    const live = cameraPose(f);
    const k = ease(f, from, to);
    this.pos.copy(shot.pos).lerp(new Vector3(...live.position), k);
    this.look.copy(shot.look).lerp(new Vector3(...live.target), k);
    this.up.set(0, 0, 1).lerp(new Vector3(...live.up), k).normalize();
    const camera = this.camera;
    camera.position.copy(this.pos);
    camera.up.copy(this.up);
    camera.lookAt(this.look);
    if (live.roll !== 0) camera.rotateZ(live.roll * k);
    camera.fov = mix(fovFor(shot.fov, aspect), lensFov(live.lens, aspect), k);
    camera.aspect = aspect;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /** Where the tunnel shows through: the live site's own iris, from frame 336. */
  window(f: number): Window | null {
    if (!irisWindowOn(f)) return null;
    const { iris } = machinePose(f);
    return { center: iris.center, edge: iris.edge, reach: windowReach(f) };
  }

  dispose(): void {
    this.machine.dispose();
  }
}
