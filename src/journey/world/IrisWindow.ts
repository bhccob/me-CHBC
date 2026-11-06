import { BlendFunction, Effect } from 'postprocessing';
import { BufferGeometry, Float32BufferAttribute, Mesh, OrthographicCamera, type PerspectiveCamera, Scene, ShaderMaterial, Uniform, Vector2, Vector3, WebGLRenderTarget, type WebGLRenderer } from 'three';

/** The tunnel's picture holds the screen's values, as the approved mock drew them. The chain under the machine works in linear light and encodes at its end. */
const FROM_SCREEN = /* glsl */ `
vec3 fromScreen(vec3 c) {
  return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, vec3(lessThanEqual(c, vec3(0.04045))));
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
      ${FROM_SCREEN}
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = inputColor;
        if (reach <= 0.0) return;
        float inside = 1.0 - smoothstep(reach - 1.5, reach, distance(uv * size, center));
        float through = inside * (1.0 - inputColor.a);
        if (through <= 0.0) return;
        outputColor = vec4(inputColor.rgb + fromScreen(texture2D(tunnel, uv).rgb) * through, inputColor.a + through);
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
  private readonly target = new WebGLRenderTarget(1, 1, { samples: 4 });
  private readonly screen = new Scene();
  private readonly screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly triangle: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly size = new Vector2(1, 1);

  constructor() {
    this.effect.uniforms.get('tunnel')!.value = this.target.texture;
    const cover = new BufferGeometry()
      .setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
      .setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.triangle = new Mesh(
      cover,
      new ShaderMaterial({
        uniforms: { tunnel: new Uniform(this.target.texture) },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D tunnel;
          varying vec2 vUv;
          void main() {
            gl_FragColor = vec4(texture2D(tunnel, vUv).rgb, 1.0);
          }
        `,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.triangle.frustumCulled = false;
    this.screen.add(this.triangle);
  }

  /** The anti-aliasing of the tunnel's picture. */
  setSamples(samples: number): void {
    if (this.target.samples === samples) return;
    this.target.dispose();
    this.target.samples = samples;
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
    this.effect.uniforms.get('reach')!.value = Number.isFinite(reach) ? Math.hypot(ex - cx, ey - cy) * reach : 4 * (this.size.x + this.size.y);
  }

  /** The circle shut: the machine's picture alone. */
  close(): void {
    this.effect.uniforms.get('reach')!.value = 0;
  }

  drawTunnel(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    // The scene's background leaves its colour as the clear colour, which the machine's pass would then clear with: opaque, and no window.
    renderer.setClearAlpha(0);
  }

  /** The tunnel alone on the canvas. */
  present(renderer: WebGLRenderer): void {
    renderer.setRenderTarget(null);
    renderer.render(this.screen, this.screenCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.triangle.geometry.dispose();
    this.triangle.material.dispose();
    this.effect.dispose();
  }
}
