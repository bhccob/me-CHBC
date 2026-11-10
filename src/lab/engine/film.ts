import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * LAB ONLY (throwaway). The film's own look, after tone mapping: a soft vignette, fine grain that keeps black black, and
 * a warm flash for passing through glass. Alpha stays as it came, so the seam's hole still lets the tunnel through.
 */
const FRAGMENT = /* glsl */ `
uniform float grain;
uniform float vignette;
uniform float flash;
uniform float seed;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
  c *= 1.0 - vignette * smoothstep(0.32, 1.05, length(d) * 1.08);
  float n = hash(floor(uv * resolution) + seed * vec2(113.1, 71.7)) - 0.5;
  c *= 1.0 + n * grain * 3.2;
  c += n * grain * 0.01;
  c = mix(c, vec3(1.0, 0.9, 0.74), flash);
  outputColor = vec4(max(c, 0.0), inputColor.a);
}
`;

export class FilmEffect extends Effect {
  constructor() {
    super('LabFilm', FRAGMENT, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ['grain', new Uniform(0.03)],
        ['vignette', new Uniform(0.5)],
        ['flash', new Uniform(0)],
        ['seed', new Uniform(0)],
      ]),
    });
  }

  set(grain: number, vignette: number, flash: number, seed: number): void {
    this.uniforms.get('grain')!.value = grain;
    this.uniforms.get('vignette')!.value = vignette;
    this.uniforms.get('flash')!.value = flash;
    this.uniforms.get('seed')!.value = seed;
  }
}
