import type { gsap } from 'gsap';
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

/** LAB ONLY (throwaway). What a concept gives the stage. Frames are the site's own: 0 to 372 is the opening. */

export interface Look {
  /** Focus distance, world units. */
  focus: number;
  /** Bokeh scale; 0 takes the depth of field off. */
  blur: number;
  grain: number;
  vignette: number;
  /** A warm flash over everything, 0 to 1. */
  flash: number;
  light: number;
}

export interface Beats {
  /** The hero leaves over these frames. */
  heroOut: readonly [number, number];
  /** Each step's words: in over [a, b], out over [c, d]. */
  steps: readonly (readonly [number, number, number, number])[];
}

export interface BuildContext {
  renderer: WebGLRenderer;
  reduce: boolean;
  /** The lab page's DOM, for words and backdrops tied to the 3D. */
  root: HTMLElement;
}

/** Where the tunnel shows through: a circle in the world (its centre and a point on its edge) opened `reach` of the way. */
export interface Window {
  center: readonly [number, number, number];
  edge: readonly [number, number, number];
  reach: number;
}

export interface World {
  scene: Scene;
  camera: PerspectiveCamera;
  beats: Beats;
  /** The scene draws over the page (no background of its own): the backdrop behind the canvas is the concept's. */
  transparent?: boolean;
  /** The post chain: bloom strength and threshold, and the look's contrast and saturation. */
  post?: { bloom: number; threshold: number; contrast: number; saturation: number };
  /** Adds the world's own scroll-driven tweens to the timeline (in frames). */
  timeline(tl: gsap.core.Timeline): void;
  introStyle?: 'rise' | 'fill';
  intro?(tl: gsap.core.Timeline): void;
  /** After the timeline has been sought to `f`: the camera, the uniforms, and the look of this frame. */
  frame(f: number, nowS: number, dt: number, width: number, height: number, lamp: number): Look;
  /** Where the tunnel shows through at frame `f`, while it does. */
  window?(f: number): Window | null;
  /** A line for the corner. */
  readout(f: number): string;
  /** Readies what the first draw needs (models, textures). */
  load?(onProgress: (share: number) => void): Promise<void>;
  pointer?(x: number, y: number): void;
  dispose(): void;
}

export type ConceptId = 'b' | 'd';
