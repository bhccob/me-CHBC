import type { Material } from 'three';

/**
 * The approved tunnel was drawn straight to the screen: its own shaders write the screen's values as they are, additively, and
 * only three's built-in materials pass through ACES and the sRGB curve. A render target gets neither from three, so a built-in
 * material drawn into the tunnel's picture does both itself. The picture then holds the screen's values, whatever shows it.
 */

/** The screen's value for a value in linear light. */
export function displayValue(linear: number): number {
  return linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

/** The exposure of the approved mock-up. */
const EXPOSURE = 1.2;

const FUNCTIONS = /* glsl */ `
vec3 displayAcesFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 displayAces(vec3 color) {
  const mat3 inputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= ${(EXPOSURE / 0.6).toFixed(4)};
  color = inputMat * color;
  color = displayAcesFit(color);
  color = outputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 displayEncode(vec3 c) {
  return mix(pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
`;

/** Makes a built-in material write the screen's values into a render target: toned as the mock's lit materials were, if asked. */
export function displayReferred<T extends Material>(material: T, tone: boolean): T {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FUNCTIONS}\nvoid main() {`)
      .replace('#include <tonemapping_fragment>', tone ? 'gl_FragColor.rgb = displayAces(gl_FragColor.rgb);' : '')
      .replace('#include <colorspace_fragment>', 'gl_FragColor.rgb = displayEncode(gl_FragColor.rgb);');
  };
  material.customProgramCacheKey = () => `display-${tone}`;
  return material;
}
