import { BufferGeometry, type Color, Float32BufferAttribute, Mesh, type Scene, type ShaderMaterial, type Texture } from 'three';
import { ease, mix } from '../../math';
import { frameAt } from './path';
import { screenMaterial } from './textures';

const RADIUS = 2.88;
const SEEN_AHEAD = 44;
/** Before and after a stop: how far from it, and how far round the wall. */
const SPOTS: readonly (readonly [number, number])[] = [[-23, 2.3], [-14, -0.75], [10, 3.75], [17, 0.95]];

interface WallScreen {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  s: number;
  dim: number;
}

function bentOntoTheWall(aspect: number, s0: number, angle: number, end: number): BufferGeometry {
  const arc = aspect < 1 ? 0.42 : 0.86;
  const length = (RADIUS * arc) / aspect;
  const floor = Math.sin(angle) < 0;
  const segments = 22;
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= 4; j++) {
    for (let i = 0; i <= segments; i++) {
      const a = angle + (i / segments - 0.5) * arc;
      const f = frameAt(s0 + (j / 4 - 0.5) * length, end);
      const p = f.p.clone().addScaledVector(f.R, Math.cos(a) * RADIUS).addScaledVector(f.U, Math.sin(a) * RADIUS);
      position.push(p.x, p.y, p.z);
      uv.push(floor ? i / segments : 1 - i / segments, floor ? j / 4 : 1 - j / 4);
    }
  }
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < segments; i++) {
      const q = j * (segments + 1) + i;
      index.push(q, q + 1, q + segments + 1, q + 1, q + segments + 2, q + segments + 1);
    }
  }
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(position, 3)).setAttribute('uv', new Float32BufferAttribute(uv, 2)).setIndex(index);
}

/** The same screen bent onto the tunnel's wall, four times round each stop, so that you see the work while you fly. They step back while you read. */
export class WallScreens {
  private readonly screens: WallScreen[] = [];
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  add(pictures: readonly Texture[], phones: boolean, stop: { s: number; side: 1 | -1 }, tint: Color, end: number): void {
    const aspect = phones ? 1170 / 2532 : 1440 / 900;
    const dim = phones ? 0.62 : 1;
    SPOTS.forEach(([off, angle], i) => {
      const s = stop.s + off;
      const geometry = bentOntoTheWall(aspect, s, angle * stop.side + (stop.side < 0 ? Math.PI : 0), end);
      const material = screenMaterial(pictures[i], 0, 0.012, aspect, tint);
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      this.scene.add(mesh);
      this.screens.push({ mesh, s, dim });
    });
  }

  get count(): number {
    return this.screens.length;
  }

  update(s: number, calm: number, dissolve: number): void {
    for (const { mesh, s: at, dim } of this.screens) {
      const distance = at - s;
      const seen = distance > -3 && distance < SEEN_AHEAD && dissolve < 0.4;
      mesh.visible = seen;
      if (!seen) continue;
      mesh.material.uniforms.uA.value = ease(SEEN_AHEAD - distance, 0, 18) * ease(distance, -2.5, -0.5) * (1 - 0.9 * calm);
      mesh.material.uniforms.uOn.value = mix(0.28, 0.82, ease(26 - distance, 0, 20)) * dim;
    }
  }

  showAll(): void {
    for (const { mesh } of this.screens) mesh.visible = true;
  }

  dispose(): void {
    for (const { mesh } of this.screens) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
