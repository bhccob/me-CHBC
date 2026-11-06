import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, type IUniform, Mesh, ShaderMaterial } from 'three';
import { clamp, seeded, TAU } from '../../math';
import { FLOOR } from '../void/path';
import { frameAt, type PathFrame } from './path';

/** What every part of the tunnel reads, set once a frame. */
export interface TunnelUniforms {
  [name: string]: IUniform;
  uDis: IUniform<number>;
  uTint: IUniform<Color>;
  uTime: IUniform<number>;
  uCalm: IUniform<number>;
  uFar: IUniform<number>;
  uVoid: IUniform<number>;
}

export function tunnelUniforms(): TunnelUniforms {
  return { uDis: { value: 0 }, uTint: { value: new Color() }, uTime: { value: 0 }, uCalm: { value: 0 }, uFar: { value: 92 }, uVoid: { value: 0 } };
}

const COMMON = 'uniform float uDis; uniform vec3 uTint; uniform float uTime; uniform float uCalm; uniform float uFar; uniform float uGain;';
const ALONG = 'attribute vec3 aD; varying vec3 vD; varying float vL; void main(){ vD=aD; vec4 mv=modelViewMatrix*vec4(position,1.); vL=length(mv.xyz); gl_Position=projectionMatrix*mv; }';

interface Vertex {
  x: number;
  y: number;
  z: number;
  a: readonly [number, number, number];
}

/** Rows of vertices across, with quads between neighbouring rows. */
class Strips {
  private readonly position: number[] = [];
  private readonly along: number[] = [];
  private readonly index: number[] = [];
  private count = 0;

  add(rows: readonly (readonly Vertex[])[]): void {
    const start = this.count;
    const w = rows[0].length;
    for (const row of rows) {
      for (const v of row) {
        this.position.push(v.x, v.y, v.z);
        this.along.push(v.a[0], v.a[1], v.a[2]);
        this.count++;
      }
    }
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < w - 1; j++) {
        const a = start + i * w + j;
        const b = a + 1;
        const c = a + w;
        const d = c + 1;
        this.index.push(a, b, c, b, d, c);
      }
    }
  }

  geometry(): BufferGeometry {
    return new BufferGeometry()
      .setAttribute('position', new Float32BufferAttribute(this.position, 3))
      .setAttribute('aD', new Float32BufferAttribute(this.along, 3))
      .setIndex(this.index);
  }
}

function glowing(uniforms: TunnelUniforms, gain: number, fragmentShader: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...uniforms, uGain: { value: gain } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    vertexShader: ALONG,
    fragmentShader,
  });
}

/** The same strips, standing upside down under the void's floor: fainter, and shown only out there. */
function mirrored(geometry: BufferGeometry, uniforms: TunnelUniforms, gain: number, shader: string): Mesh {
  const mirror = new Mesh(geometry, glowing(uniforms, gain, shader));
  mirror.frustumCulled = false;
  mirror.scale.y = -1;
  mirror.position.y = 2 * FLOOR;
  mirror.visible = false;
  return mirror;
}

const WIRE_SHADER = /* glsl */ `${COMMON} varying vec3 vD; varying float vL;
  float hash(float n){ return fract(sin(n)*43758.5453); }
  void main(){
    float s=vD.x, seed=vD.y;
    float gap=smoothstep(.28,.34,fract(s*(.012+seed*.018)+seed*7.));
    float p=fract(s*(.018+seed*.03)-uTime*(.09+seed*.16)-seed*13.);
    float pulse=pow(p,46.);
    vec3 base=mix(vec3(1.,.7,.28),uTint,.72);
    float near=smoothstep(.2,5.,vL), far=smoothstep(uFar,uFar*.22,vL);
    float brk=step(hash(floor(s*1.3)+seed*91.),1.-uDis*1.15);
    vec3 c=base*(.13*gap+1.5*pulse)*(1.-.62*uCalm);
    gl_FragColor=vec4(c*near*far*brk*uGain,1.);
  }`;

const RING_SHADER = /* glsl */ `${COMMON} varying vec3 vD; varying float vL;
  void main(){
    float v=abs(vD.z);
    float core=smoothstep(.06,.0,v), glow=pow(1.-v,3.)*.22;
    vec3 base=mix(vec3(1.,.72,.3),uTint,.75);
    float near=smoothstep(.3,3.5,vL), far=smoothstep(uFar*.76,uFar*.09,vL);
    float brk=step(vD.y,1.-uDis*1.2);
    gl_FragColor=vec4(base*(core*.6+glow)*near*far*brk*(1.-.55*uCalm)*uGain,1.);
  }`;

/** Gold traces on the walls: long wires that step sideways at 45 degrees, with light racing along them. */
export function makeWires(end: number, uniforms: TunnelUniforms): { mesh: Mesh; mirror: Mesh } {
  const r = seeded(4242);
  const strips = new Strips();
  const frames: PathFrame[] = [];
  for (let s = -14; s <= end; s++) frames.push(frameAt(s, end));
  for (let t = 0; t < 84; t++) {
    const seed = r();
    const rad = 3.5 + r() * 1.9;
    const width = 0.009 + r() * 0.02;
    let th = r() * TAU;
    let goal = th;
    let next = -10 + r() * 14;
    const rows: Vertex[][] = [];
    frames.forEach((f, i) => {
      const s = i - 14;
      if (s > next) {
        goal = th + (r() < 0.5 ? -1 : 1) * (0.18 + r() * 0.2);
        next = s + 8 + r() * 30;
      }
      th += clamp(goal - th, -0.07, 0.07);
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      const px = f.p.x + f.R.x * cos * rad + f.U.x * sin * rad;
      const py = f.p.y + f.R.y * cos * rad + f.U.y * sin * rad;
      const pz = f.p.z + f.R.z * cos * rad + f.U.z * sin * rad;
      const wx = (f.U.x * cos - f.R.x * sin) * width;
      const wy = (f.U.y * cos - f.R.y * sin) * width;
      const wz = (f.U.z * cos - f.R.z * sin) * width;
      rows.push([
        { x: px + wx, y: py + wy, z: pz + wz, a: [s, seed, -1] },
        { x: px - wx, y: py - wy, z: pz - wz, a: [s, seed, 1] },
      ]);
    });
    strips.add(rows);
  }
  const geometry = strips.geometry();
  const mesh = new Mesh(geometry, glowing(uniforms, 1, WIRE_SHADER));
  mesh.frustumCulled = false;
  return { mesh, mirror: mirrored(geometry, uniforms, 0.34, WIRE_SHADER) };
}

/** Thin octagon rings of light between the gates. */
export function makeRings(end: number, uniforms: TunnelUniforms): { mesh: Mesh; mirror: Mesh } {
  const r = seeded(777);
  const strips = new Strips();
  for (let s = 2; s <= end; s += 3.6) {
    const f = frameAt(s, end);
    const seed = r();
    const rad = 3.05 + r() * 0.12;
    const row = (radius: number, v: number): Vertex[] => {
      const out: Vertex[] = [];
      for (let k = 0; k <= 8; k++) {
        const a = ((k + 0.5) / 8) * TAU;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        out.push({ x: f.p.x + f.R.x * x + f.U.x * y, y: f.p.y + f.R.y * x + f.U.y * y, z: f.p.z + f.R.z * x + f.U.z * y, a: [s, seed, v] });
      }
      return out;
    };
    strips.add([row(rad - 0.1, -1), row(rad, 0), row(rad + 0.1, 1)]);
  }
  const geometry = strips.geometry();
  const mesh = new Mesh(geometry, glowing(uniforms, 1, RING_SHADER));
  mesh.frustumCulled = false;
  return { mesh, mirror: mirrored(geometry, uniforms, 0.3, RING_SHADER) };
}

export interface StreakUniforms {
  [name: string]: IUniform;
  uTravel: IUniform<number>;
  uSpeed: IUniform<number>;
}

/** Streaks, held by the camera: they stretch with your speed, so going fast feels fast. */
export function makeStreaks(uniforms: TunnelUniforms): { mesh: Mesh; speed: StreakUniforms } {
  const r = seeded(9090);
  const n = 1100;
  const data: number[] = [];
  const corner: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const th = r() * TAU;
    const rad = 1.6 + Math.pow(r(), 0.6) * 6.5;
    const z0 = r() * 76;
    const w = 0.004 + r() * 0.007;
    const tone = r();
    for (const [sx, h] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
      data.push(th, rad, z0, w);
      corner.push(sx, h, tone);
    }
    const b = i * 4;
    index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const geometry = new BufferGeometry()
    .setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 12), 3))
    .setAttribute('aData', new Float32BufferAttribute(data, 4))
    .setAttribute('aUv', new Float32BufferAttribute(corner, 3))
    .setIndex(index);
  const speed: StreakUniforms = { uTravel: { value: 0 }, uSpeed: { value: 0 } };
  const material = new ShaderMaterial({
    uniforms: { ...speed, uTint: uniforms.uTint, uDis: uniforms.uVoid },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `uniform float uTravel,uSpeed; attribute vec4 aData; attribute vec3 aUv; varying float vA; varying float vT;
      void main(){
        float z=mod(aData.z+uTravel,76.)-70.;
        float len=.25+uSpeed*(5.+aData.y*2.2);
        z-=(1.-aUv.y)*len;
        vec2 dir=vec2(cos(aData.x),sin(aData.x)), tn=vec2(-dir.y,dir.x);
        vec3 p=vec3(dir*aData.y+tn*aUv.x*aData.w*(1.+uSpeed), z);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        vA=smoothstep(-70.,-34.,z)*smoothstep(1.,-3.,z)*(min(uSpeed,1.2)*.8)*mix(1.,.15,aUv.y<.5?1.:0.);
        vT=aUv.z;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uTint; uniform float uDis; varying float vA; varying float vT;
      void main(){ vec3 c=mix(mix(vec3(1.,.74,.34),uTint,.6),vec3(1.,.95,.85),step(.82,vT)); gl_FragColor=vec4(c*vA*(1.-uDis),1.); }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, speed };
}
