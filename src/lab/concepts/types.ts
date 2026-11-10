import type { gsap } from 'gsap';
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { Chip } from '../engine/chip';

/** LAB ONLY (throwaway). What a concept gives the stage. Frames are the site's own: 0 to 372 is the opening. */

export interface Look {
  /** Focus distance, world units. */
  focus: number;
  /** Bokeh scale; 0 takes the depth of field off. */
  blur: number;
  grain: number;
  vignette: number;
  /** A warm flash over everything, 0 to 1 (passing through glass). */
  flash: number;
  /** The lamp: 0 dark, 1 on. */
  light: number;
}

export interface Beats {
  /** The hero leaves over these frames. */
  heroOut: readonly [number, number];
  /** Each step's label: in over [a, b], out over [c, d]. */
  steps: readonly (readonly [number, number, number, number])[];
  /** The letterbox: in over [a, b], out over [c, d]. */
  bars: readonly [number, number, number, number];
}

export interface BuildContext {
  renderer: WebGLRenderer;
  reduce: boolean;
  /** The lab page's DOM, for labels pinned to the 3D. */
  root: HTMLElement;
}

export interface World {
  scene: Scene;
  camera: PerspectiveCamera;
  chip: Chip;
  beats: Beats;
  /** Adds the world's own scroll-driven tweens to the timeline (in frames). */
  timeline(tl: gsap.core.Timeline): void;
  /** How the name enters after the loader: its letters rise (default), or fill in once something has drawn them. */
  introStyle?: 'rise' | 'fill';
  /** Adds to the hero's entrance, which runs on time (seconds), not scroll. */
  intro?(tl: gsap.core.Timeline): void;
  /** After the timeline has been sought to `f`: the camera, the uniforms, and the look of this frame. `lamp` is the light coming on after the loader, 0 to 1. */
  frame(f: number, nowS: number, dt: number, width: number, height: number, lamp: number): Look;
  /** One line of instrument read-out for the corner. */
  readout(f: number): string;
  /** A render the world needs before the main one (a screen showing a live view). */
  prerender?(renderer: WebGLRenderer, f: number): void;
  pointer?(x: number, y: number): void;
  dispose(): void;
}

export type ConceptId = 'a' | 'b' | 'c' | 'd' | 'e';
