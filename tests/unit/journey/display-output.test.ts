import { MeshStandardMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { displayReferred, displayValue } from '~/journey/world/displayOutput';

const TAIL = 'void main() {\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>\n}';
const compiled = (tone: boolean): string => {
  const material = displayReferred(new MeshStandardMaterial(), tone);
  const shader = { fragmentShader: TAIL } as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader.fragmentShader;
};

describe('the screen values', () => {
  it('follow the sRGB curve', () => {
    expect(displayValue(0)).toBe(0);
    expect(displayValue(0.001)).toBeCloseTo(0.01292, 6);
    expect(displayValue(1)).toBeCloseTo(1, 6);
    expect(displayValue(0.214)).toBeCloseTo(0.5, 2);
  });
});

describe('a built-in material in the tunnel', () => {
  it('encodes for itself, since a render target will not', () => {
    expect(compiled(false)).toContain('gl_FragColor.rgb = displayEncode(gl_FragColor.rgb);');
    expect(compiled(false)).not.toContain('<colorspace_fragment>');
  });

  it('tones only when asked', () => {
    expect(compiled(true)).toContain('gl_FragColor.rgb = displayAces(gl_FragColor.rgb);');
    expect(compiled(false)).not.toContain('gl_FragColor.rgb = displayAces');
    expect(compiled(false)).not.toContain('<tonemapping_fragment>');
  });

  it('keeps fog after the encoding, as three does', () => {
    const out = compiled(true);
    expect(out.indexOf('<fog_fragment>')).toBeGreaterThan(out.indexOf('displayEncode(gl_FragColor.rgb);'));
  });

  it('keeps toned and untoned programs apart', () => {
    expect(displayReferred(new MeshStandardMaterial(), true).customProgramCacheKey()).not.toBe(displayReferred(new MeshStandardMaterial(), false).customProgramCacheKey());
  });
});
