import { BlendFunction, Effect } from 'postprocessing';
import { HalfFloatType, type PerspectiveCamera, ShaderMaterial, Uniform, Vector2, Vector3, WebGLRenderTarget, type WebGLRenderer, type Scene } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/** The tunnel's picture from linear light to the screen's: ACES, as the approved mock drew it. */
const ACES = /* glsl */ `
vec3 acesFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 inputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 outputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.2 / 0.6;
  color = inputMat * color;
  color = acesFit(color);
  color = outputMat * color;
  return clamp(color, 0.0, 1.0);
}
`;

class WindowEffect extends Effect {
  constructor() {
    super(
      'IrisWindow',
      /* glsl */ `
      uniform sampler2D tunnel;
      uniform vec2 center;
      uniform float reach;
      uniform vec2 size;
      ${ACES}
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = inputColor;
        if (reach <= 0.0) return;
        float inside = 1.0 - smoothstep(reach - 1.5, reach, distance(uv * size, center));
        float through = inside * (1.0 - inputColor.a);
        if (through <= 0.0) return;
        outputColor = vec4(inputColor.rgb + aces(texture2D(tunnel, uv).rgb) * through, inputColor.a + through);
      }
    `,
      {
        blendFunction: BlendFunction.SRC,
        uniforms: new Map<string, Uniform>([
          ['tunnel', new Uniform(null)],
          ['center', new Uniform(new Vector2())],
          ['reach', new Uniform(0)],
          ['size', new Uniform(new Vector2(1, 1))],
        ]),
      },
    );
  }
}

const point = new Vector3();

/** Where a 3D point stands in the canvas's pixels. */
export function canvasPoint(at: readonly [number, number, number], camera: PerspectiveCamera, size: Vector2): [number, number] {
  point.set(at[0], at[1], at[2]).project(camera);
  return [((point.x + 1) / 2) * size.x, ((point.y + 1) / 2) * size.y];
}

/** The tunnel's picture: drawn apart, then shown through the iris under the machine, and alone once you are inside. */
export class IrisWindow {
  readonly effect = new WindowEffect();
  private readonly target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  private readonly quad: FullScreenQuad;
  private readonly size = new Vector2(1, 1);

  constructor() {
    this.effect.uniforms.get('tunnel')!.value = this.target.texture;
    this.quad = new FullScreenQuad(
      new ShaderMaterial({
        uniforms: { tunnel: new Uniform(this.target.texture) },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D tunnel;
          varying vec2 vUv;
          ${ACES}
          void main() {
            gl_FragColor = vec4(aces(texture2D(tunnel, vUv).rgb), 1.0);
            #include <colorspace_fragment>
          }
        `,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }

  resize(renderer: WebGLRenderer): void {
    renderer.getDrawingBufferSize(this.size);
    this.target.setSize(this.size.x, this.size.y);
    (this.effect.uniforms.get('size')!.value as Vector2).copy(this.size);
  }

  /** Where the circle stands, from the iris's centre and a point on its edge, and how far it has opened. */
  place(center: readonly [number, number, number], edge: readonly [number, number, number], camera: PerspectiveCamera, reach: number): void {
    const [cx, cy] = canvasPoint(center, camera, this.size);
    const [ex, ey] = canvasPoint(edge, camera, this.size);
    (this.effect.uniforms.get('center')!.value as Vector2).set(cx, cy);
    this.effect.uniforms.get('reach')!.value = Math.hypot(ex - cx, ey - cy) * reach;
  }

  /** The circle shut: the machine's picture alone. */
  close(): void {
    this.effect.uniforms.get('reach')!.value = 0;
  }

  drawTunnel(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  /** The tunnel alone on the canvas. */
  present(renderer: WebGLRenderer): void {
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }

  dispose(): void {
    this.target.dispose();
    this.quad.dispose();
    this.quad.material.dispose();
    this.effect.dispose();
  }
}
