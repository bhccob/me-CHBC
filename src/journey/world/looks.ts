/**
 * The machine's light, from tools/blender/machine.py, so that the live picture stands next to the Cycles renders Bob
 * approved. Positions are Blender's, Z up. Pure: no three.
 */

export type LightName = 'key' | 'rim' | 'strip' | 'low' | 'top' | 'bench';

export interface AreaLight {
  name: LightName;
  position: [number, number, number];
  target: [number, number, number];
  width: number;
  height: number;
  color: [number, number, number];
}

export const AREA_LIGHTS: readonly AreaLight[] = [
  { name: 'key', position: [-2.6, -1.8, 4.4], target: [0, 0, 0], width: 3.2, height: 3.2, color: [1.0, 0.96, 0.9] },
  { name: 'rim', position: [3.6, 3.2, 0.55], target: [0, 0, 0.1], width: 2.0, height: 2.0, color: [0.62, 0.52, 1.0] },
  { name: 'strip', position: [3.0, 2.2, 2.3], target: [0, 0, 0.2], width: 5.0, height: 0.32, color: [1.0, 0.95, 0.88] },
  { name: 'low', position: [1.6, -3.4, -0.25], target: [0, 0, 0.3], width: 1.8, height: 1.8, color: [1.0, 0.72, 0.34] },
  { name: 'top', position: [0.2, 0.2, 3.6], target: [0, 0, 0], width: 2.4, height: 2.4, color: [1.0, 0.95, 0.88] },
  { name: 'bench', position: [-0.5, 0.7, 1.3], target: [0, 0, 0], width: 1.0, height: 1.0, color: [1.0, 0.86, 0.68] },
];

/** How the lights compare with Blender's, found by holding the live picture next to the renders. */
export const LIGHT_SCALE = 0.85;
/** The same for what glows: LEDs, the keyhole, the light on the traces, the code screen. */
export const GLOW_SCALE = 0.8;

/** Blender's watts on an area light as three's RectAreaLight intensity: radiance, power over area and pi. */
export function areaIntensity(watts: number, width: number, height: number): number {
  return (watts / (Math.PI * width * height)) * LIGHT_SCALE;
}

/** The low light stands under the floor, which blocked it in Blender until the machine stands up and the floor drops. */
export function lowLightLevel(floorZ: number): number {
  return Math.min(1, Math.max(0, (-floorZ - 0.25) / 0.2));
}

/** The floor catches the machine's shadow while it stands on it; a wide light washed the shadow out as the floor dropped away. */
export function shadowOpacity(floorZ: number): number {
  return 0.6 * (1 - Math.min(1, Math.max(0, (-floorZ - 0.2) / 0.9)));
}

/** How much the sleeve's own lights show on its wall, which Cycles lit by itself. */
export function sleeveGlow(f: number): number {
  return Math.min(1, Math.max(0, (f - 334) / 18));
}

/** How wide the blur of the far background is, as a share of the page's width, for a lens, an f-stop and a focus distance (m). */
export function blurShare(lens: number, fstop: number, focus: number): number {
  const f = lens / 1000;
  return (f * f) / (fstop * Math.max(focus - f, 0.001)) / 0.036;
}
