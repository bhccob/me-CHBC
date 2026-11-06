import { AdditiveBlending, BufferAttribute, BufferGeometry, type IUniform, Points, ShaderMaterial, Vector3 } from 'three';
import { clamp, seeded, TAU } from '../../math';
import { center } from '../flight/path';
import type { TunnelUniforms } from '../flight/tunnelParts';
import { FLOOR } from './path';

/**
 * The tunnel breaking: its walls come apart, wire by wire, into gold sparks that fly off and become the void's stars. Each
 * point leaves at its own moment, so how many have left and how many have arrived follow from how far the break has gone.
 */

const COUNT = 16000;
const BASE_END = 180;

/** The share of points that have arrived as stars. */
export function starShare(dissolve: number): number {
  if (dissolve <= 0) return 0;
  return clamp((dissolve * 1.6 - 1) / 0.6);
}

/** The share of points that are on their way: sparks. */
export function movingShare(dissolve: number): number {
  if (dissolve <= 0) return 0;
  return clamp((dissolve * 1.6) / 0.6) - starShare(dissolve);
}

function sparkMaterial(uniforms: Record<string, IUniform>): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `uniform float uDis,uTime,uPx,uGain;
      attribute vec3 aB; attribute vec4 aS; varying float vA; varying vec3 vCol;
      void main(){
        float t1=clamp(uDis*1.6-aS.x*.6,0.,1.), e1=t1*t1*(3.-2.*t1);
        vec3 b=aB;
        b.xz+=vec2(sin(uTime*.1+aS.w*40.),cos(uTime*.08+aS.y*40.))*.25;
        vec3 p=mix(position,b,e1);
        p.y+=sin(t1*3.14159)*(2.+aS.y*7.);
        vCol=vec3(1.,.76,.36);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;
        float dist=max(.5,length(mv.xyz));
        float base=(1.+aS.y*2.2)*(1.+sin(t1*3.14159)*.9);
        gl_PointSize=clamp(base*uPx*(aS.z>.5?11.:60.)/dist,1.2,12.);
        float tw=.72+.28*sin(uTime*(.7+aS.x)+aS.w*30.);
        vA=smoothstep(0.,.1,t1)*tw*(.5+aS.y*.6)*uGain;
      }`,
    fragmentShader: /* glsl */ `varying float vA; varying vec3 vCol;
      void main(){ vec2 q=gl_PointCoord-.5; float d=length(q); float a=smoothstep(.5,.1,d); gl_FragColor=vec4(vCol*a*vA*1.2,1.); }`,
  });
}

export interface Sparks {
  points: Points<BufferGeometry, ShaderMaterial>;
  mirror: Points<BufferGeometry, ShaderMaterial>;
  pixels: IUniform<number>;
}

/** The points, each with its place on the wall and its place in the sky, and their reflection. */
export function makeSparks(end: number, uniforms: TunnelUniforms): Sparks {
  const r = seeded(31337);
  const from = new Float32Array(COUNT * 3);
  const to = new Float32Array(COUNT * 3);
  const own = new Float32Array(COUNT * 4);
  const at = new Vector3();
  const back = end - BASE_END;
  for (let i = 0; i < COUNT; i++) {
    const sA = 6 + r() * (end - 6);
    const th = r() * TAU;
    const rad = 3.1 + r() * 2.3;
    center(sA, end, at);
    from[i * 3] = at.x + Math.cos(th) * rad;
    from[i * 3 + 1] = at.y + Math.sin(th) * rad;
    from[i * 3 + 2] = at.z;
    const near = r() < 0.42;
    if (near) {
      to[i * 3] = 46 + (r() - 0.5) * 44;
      to[i * 3 + 1] = FLOOR + 0.6 + r() * 16;
      to[i * 3 + 2] = -200 + r() * 250 - back;
    } else {
      const a = r() * TAU;
      const reach = 60 + r() * 320;
      to[i * 3] = 46 + Math.cos(a) * reach;
      to[i * 3 + 1] = FLOOR + 1 + Math.pow(r(), 1.5) * 220;
      to[i * 3 + 2] = -60 + Math.sin(a) * reach - back;
    }
    own[i * 4] = r();
    own[i * 4 + 1] = r();
    own[i * 4 + 2] = near ? 1 : 0;
    own[i * 4 + 3] = r();
  }
  const geometry = new BufferGeometry()
    .setAttribute('position', new BufferAttribute(from, 3))
    .setAttribute('aB', new BufferAttribute(to, 3))
    .setAttribute('aS', new BufferAttribute(own, 4));
  const pixels: IUniform<number> = { value: 1 };
  const shared = { uDis: uniforms.uDis, uTime: uniforms.uTime, uPx: pixels };
  const points = new Points(geometry, sparkMaterial({ ...shared, uGain: { value: 1 } }));
  points.frustumCulled = false;
  points.renderOrder = 5;
  const mirror = new Points(geometry, sparkMaterial({ ...shared, uGain: { value: 0.26 } }));
  mirror.frustumCulled = false;
  mirror.scale.y = -1;
  mirror.position.y = 2 * FLOOR;
  mirror.renderOrder = -3;
  return { points, mirror, pixels };
}
