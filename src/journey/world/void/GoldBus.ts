import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, type IUniform, Mesh, ShaderMaterial, Vector3 } from 'three';
import { clamp, seeded } from '../../math';
import { FLOOR, LOOK_DISTANCE, QUESTION_DISTANCES, VOID_LENGTH, voidAt } from './path';

/** The sideways step the line makes at a stop: the other way each time, half as far at the first. */
export function busStep(i: number): number {
  return (i % 2 ? -1 : 1) * 1.5 * (i ? 1 : 0.5);
}

/** How far the line stands from the way, at distance `d`: it steps at 9 before each stop. */
export function busOffsetAt(d: number): number {
  let offset = 0;
  QUESTION_DISTANCES.forEach((q, i) => {
    offset += busStep(i) * clamp((d - (q - 9)) / 1.8);
  });
  return offset;
}

const OFFSETS = [-0.84, -0.5, -0.26, -0.09, 0.09, 0.26, 0.5, 0.84];

/** The bus of gold lines on the floor, that takes you to each question and home. */
export function makeBus(end: number, time: IUniform<number>): { mesh: Mesh<BufferGeometry, ShaderMaterial>; on: IUniform<number> } {
  const r = seeded(2112);
  const start = LOOK_DISTANCE - 4;
  // The way itself, once: every line follows it.
  const spine: { x: number; z: number; rx: number; rz: number; d: number; offset: number }[] = [];
  const p = new Vector3();
  const q = new Vector3();
  for (let d = start; d <= VOID_LENGTH + 15; d += 0.5) {
    voidAt(d, p, end);
    voidAt(d + 0.4, q, end);
    const t = q.sub(p).normalize();
    spine.push({ x: p.x, z: p.z, rx: -t.z, rz: t.x, d, offset: busOffsetAt(d) });
  }
  const position: number[] = [];
  const along: number[] = [];
  const index: number[] = [];
  let count = 0;
  for (const from of OFFSETS) {
    const seed = r();
    const width = 0.011 + r() * 0.012;
    const first = count;
    for (const row of spine) {
      const o = from + row.offset;
      const x = row.x + row.rx * o;
      const z = row.z + row.rz * o;
      position.push(x + row.rx * width, FLOOR + 0.012, z + row.rz * width, x - row.rx * width, FLOOR + 0.012, z - row.rz * width);
      along.push(row.d, seed, -1, row.d, seed, 1);
      count += 2;
    }
    for (let i = 0; i < spine.length - 1; i++) {
      const a = first + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(position, 3)).setAttribute('aD', new Float32BufferAttribute(along, 3)).setIndex(index);
  const on: IUniform<number> = { value: 0 };
  const mesh = new Mesh(
    geometry,
    new ShaderMaterial({
      uniforms: { uTime: time, uOn: on },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      vertexShader: 'attribute vec3 aD; varying vec3 vD; varying float vL; void main(){ vD=aD; vec4 mv=modelViewMatrix*vec4(position,1.); vL=length(mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: /* glsl */ `uniform float uTime,uOn; varying vec3 vD; varying float vL;
        void main(){
          float p=fract(vD.x*.03+vD.y*3.-uTime*(.12+vD.y*.08));
          float pulse=pow(p,30.);
          float far=smoothstep(170.,10.,vL);
          gl_FragColor=vec4(vec3(1.,.72,.3)*(.3+2.2*pulse)*far*uOn,1.);
        }`,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -4;
  return { mesh, on };
}
