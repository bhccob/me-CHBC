import { describe, expect, it } from 'vitest';
import { AREA_LIGHTS, areaIntensity, blurShare, LIGHT_SCALE, lowLightLevel, sleeveGlow, shadowOpacity } from '~/journey/world/looks';

describe('the machine light', () => {
  it('has the six area lights of the Blender scene', () => {
    expect(AREA_LIGHTS.map((light) => light.name)).toEqual(['key', 'rim', 'strip', 'low', 'top', 'bench']);
  });

  it('turns watts on an area into radiance, scaled to match the renders', () => {
    expect(areaIntensity(100, 2, 2)).toBeCloseTo((100 / (Math.PI * 4)) * LIGHT_SCALE, 6);
  });

  it('keeps the low light off while the floor is above it, as the floor blocked it in Blender', () => {
    expect(lowLightLevel(-0.019)).toBe(0);
    expect(lowLightLevel(-0.145)).toBe(0);
    expect(lowLightLevel(-0.7)).toBe(1);
  });

  it('lets the floor shadow go as the floor drops away, where a wide light would have washed it out', () => {
    expect(shadowOpacity(-0.145)).toBe(0.6);
    expect(shadowOpacity(-1.2)).toBe(0);
  });

  it('lights the sleeve only once it is there, and more as the camera drops through it', () => {
    expect(sleeveGlow(333)).toBe(0);
    expect(sleeveGlow(360)).toBe(1);
  });

  it('blurs a close, wide-open shot by a share of the page, and a far stopped-down one by almost nothing', () => {
    expect(blurShare(60, 2.6, 0.6)).toBeCloseTo(0.068, 2);
    expect(blurShare(38, 14, 7.4)).toBeLessThan(0.001);
  });
});
