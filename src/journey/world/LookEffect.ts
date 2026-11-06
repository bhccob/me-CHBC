import { BlendFunction, Effect } from 'postprocessing';
import { Uniform } from 'three';

/**
 * Blender's "AgX - Medium High Contrast" look, which three's AgX lacks: after the tone mapping, deeper shadows and more
 * colour, so the live picture holds the depth of the approved renders. Alpha stays, so the page still shows through.
 */
const FRAGMENT = /* glsl */ `
uniform float contrast;
uniform float saturation;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = pow(max(inputColor.rgb, vec3(0.0)), vec3(contrast));
  float grey = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(mix(vec3(grey), c, saturation), inputColor.a);
}
`;

export class LookEffect extends Effect {
  constructor(contrast = 1.24, saturation = 1.2) {
    super('LookEffect', FRAGMENT, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ['contrast', new Uniform(contrast)],
        ['saturation', new Uniform(saturation)],
      ]),
    });
  }
}
