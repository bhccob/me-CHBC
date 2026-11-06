/**
 * What the journey draws at each step of its speed ladder, best first. The look on a strong GPU is the top step, as approved.
 * Each step gives up what shows least for what it costs: resolution first, then the anti-aliasing and the depth of field, then
 * the stars, galaxies, clouds and wall screens. Nothing here is built again or compiled again: every part changes in place.
 */

export interface JourneyQuality {
  /** What this step costs a frame, ms per million pixels drawn, on the weak GPU of `BENCH_REFERENCE_MS`, measured there. */
  cost: number;
  /** The highest device pixel ratio the canvas draws at. */
  pixelRatio: number;
  /** The anti-aliasing's samples. */
  samples: number;
  /** The shares of the stars, the galaxies' stars, the clouds and the wall screens that are drawn, 0 to 1. */
  stars: number;
  galaxies: number;
  clouds: number;
  wallScreens: number;
  /** The bloom's strength: none takes its passes off altogether. */
  bloom: number;
  dof: boolean;
  /** The machine's moving shadow: off, it stays as it was last drawn. */
  shadow: boolean;
  /** The void's reflections. */
  mirror: boolean;
}

const LADDER: readonly Readonly<JourneyQuality>[] = [
  { cost: 40, pixelRatio: 1.5, samples: 4, stars: 1, galaxies: 1, clouds: 1, wallScreens: 1, bloom: 0.16, dof: true, shadow: true, mirror: true },
  { cost: 38, pixelRatio: 1.25, samples: 4, stars: 1, galaxies: 1, clouds: 1, wallScreens: 1, bloom: 0.16, dof: true, shadow: true, mirror: true },
  { cost: 36, pixelRatio: 1, samples: 4, stars: 1, galaxies: 1, clouds: 1, wallScreens: 1, bloom: 0.16, dof: true, shadow: true, mirror: true },
  { cost: 24, pixelRatio: 1, samples: 0, stars: 1, galaxies: 1, clouds: 1, wallScreens: 1, bloom: 0.16, dof: true, shadow: true, mirror: true },
  { cost: 20, pixelRatio: 1, samples: 0, stars: 1, galaxies: 1, clouds: 1, wallScreens: 1, bloom: 0.16, dof: false, shadow: true, mirror: true },
  { cost: 9, pixelRatio: 1, samples: 0, stars: 0.6, galaxies: 0.6, clouds: 0.5, wallScreens: 0.5, bloom: 0.16, dof: false, shadow: false, mirror: false },
  { cost: 6, pixelRatio: 0.85, samples: 0, stars: 0.35, galaxies: 0.35, clouds: 0.25, wallScreens: 0.25, bloom: 0, dof: false, shadow: false, mirror: false },
];

/** A phone or a tablet starts this far down: it has the pixels of a laptop and the GPU of a phone, and never the reflection. */
const COARSE_FROM = 2;

/** How many steps the ladder has for this pointer. */
export function journeySteps(finePointer: boolean): number {
  return finePointer ? LADDER.length : LADDER.length - COARSE_FROM;
}

/** The quality at `step`, 0 being the best: past the end is the last, a bad step is the first. */
export function journeyQuality(step: number, finePointer: boolean): JourneyQuality {
  const at = Number.isNaN(step) ? 0 : Math.max(0, Math.floor(step));
  if (finePointer) return { ...LADDER[Math.min(LADDER.length - 1, at)] };
  return { ...LADDER[Math.min(LADDER.length - 1, at + COARSE_FROM)], mirror: false };
}
