import { AdditiveBlending, BackSide, BufferGeometry, DoubleSide, Float32BufferAttribute, type IUniform, LineSegments, Mesh, type Object3D, PlaneGeometry, type Scene, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { ease, mix, seeded, TAU } from '../../math';
import type { Timeline } from '../../timeline';
import { frameAt, type PathFrame } from '../flight/path';
import type { TunnelUniforms } from '../flight/tunnelParts';
import { makeSparks, type SparkControls, type Sparks } from './Dissolve';
import { makeBus } from './GoldBus';
import { FLOOR, LOOK_DISTANCE } from './path';

const BASE_END = 180;

/** What each frame gives the void. */
export interface VoidFrame {
  f: number;
  /** How far along the way through the void. */
  distance: number;
  dissolve: number;
  /** How far the void has opened, 0 to 1. */
  opening: number;
  /** How much of its floor and sky is left. */
  voidLeft: number;
  /** How far everything has fallen, and how far the bang has gone. */
  fall: number;
  bang: number;
  dt: number;
  camera: Vector3;
}

function tubeGeometry(end: number): BufferGeometry {
  const position: number[] = [];
  const along: number[] = [];
  const r = seeded(808);
  const on = (f: PathFrame, th: number, rad: number): Vector3 => f.p.clone().addScaledVector(f.R, Math.cos(th) * rad).addScaledVector(f.U, Math.sin(th) * rad);
  const segment = (p: Vector3, q: Vector3, s: number, seed: number): void => {
    position.push(p.x, p.y, p.z, q.x, q.y, q.z);
    along.push(s, seed, s + 1, seed);
  };
  const frames = new Map<number, PathFrame>();
  const frame = (s: number): PathFrame => {
    let f = frames.get(s);
    if (!f) {
      f = frameAt(s, end);
      frames.set(s, f);
    }
    return f;
  };
  for (let k = 0; k < 16; k++) {
    const seed = r();
    const th = (k / 16) * TAU + TAU / 32;
    const rad = k % 2 ? 3.9 + r() * 1.2 : 3.28;
    for (let s = 0; s < end; s += 2) segment(on(frame(s), th, rad), on(frame(s + 2), th, rad), s, seed);
  }
  for (let s = 2; s <= end; s += 3.6) {
    const f = frame(s);
    const seed = r();
    for (let k = 0; k < 8; k++) segment(on(f, ((k + 0.5) / 8) * TAU, 3.28), on(f, ((k + 1.5) / 8) * TAU, 3.28), s, seed);
  }
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(position, 3)).setAttribute('aL', new Float32BufferAttribute(along, 2));
}

function tubeMaterial(uniforms: TunnelUniforms, out: { value: number }, gain: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uDis: uniforms.uDis, uOut: out, uGain: { value: gain } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: 'attribute vec2 aL; varying vec2 vL; void main(){ vL=aL; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */ `uniform float uTime,uDis,uOut,uGain; varying vec2 vL;
      float hash(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        float p=fract(vL.x*.012+vL.y*5.-uTime*.1);
        float brk=step(hash(floor(vL.x*.5)+vL.y*91.),1.-uDis*1.2);
        gl_FragColor=vec4(vec3(1.,.72,.3)*(.34+1.5*pow(p,14.))*brk*uOut*uGain,1.);
      }`,
  });
}

/**
 * Out of the portal: a black mirror floor with a faint gold dot grid, a thin gold horizon, the tunnel seen from outside as a
 * glowing wire tube over its reflection, and the sparks it breaks into. It stands in the tunnel's own scene, since the void
 * shows the tunnel.
 */
export class VoidScene {
  private readonly scene: Scene;
  private readonly sky: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly floor: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly tube: LineSegments<BufferGeometry, ShaderMaterial>;
  private readonly tubeMirror: LineSegments<BufferGeometry, ShaderMaterial>;
  private readonly tubeOut = { value: 0 };
  private readonly sparks: Sparks;
  private readonly bus: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly busOn: IUniform<number>;
  /** The tunnel's own reflections: the walls, standing upside down under the floor. */
  private readonly wallMirrors: readonly Object3D[];
  private readonly timeline: Timeline;
  private mirrorsAllowed = true;
  private mirrorsOn = false;
  private drift = 0;

  constructor(scene: Scene, uniforms: TunnelUniforms, end: number, timeline: Timeline, wallMirrors: readonly Object3D[]) {
    this.scene = scene;
    this.timeline = timeline;
    this.wallMirrors = wallMirrors;

    this.sky = new Mesh(
      new SphereGeometry(700, 32, 20),
      new ShaderMaterial({
        uniforms: { uVoid: uniforms.uVoid },
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        transparent: true,
        vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: /* glsl */ `uniform float uVoid; varying vec3 vD;
          void main(){
            float a=abs(vD.y);
            vec3 c=vec3(1.,.66,.3)*(pow(1.-a,420.)*.42+pow(1.-a,60.)*.05+pow(1.-a,10.)*.014)+vec3(.34,.3,.62)*pow(1.-a,4.)*.014;
            gl_FragColor=vec4(c,uVoid);
          }`,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;

    this.floor = new Mesh(
      new PlaneGeometry(2400, 2400),
      new ShaderMaterial({
        uniforms: { uVoid: uniforms.uVoid, uDim: { value: 1 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
        vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
        fragmentShader: /* glsl */ `uniform float uVoid,uDim; varying vec3 vW;
          void main(){
            float d=length(vW.xz-cameraPosition.xz);
            vec2 g=abs(fract(vW.xz/2.)-.5)*2.;
            float w=fwidth(vW.x)/2.+fwidth(vW.z)/2.;
            float dot_=1.-smoothstep(.0,.05+w*2.,length(1.-g));
            float fade=smoothstep(150.,6.,d);
            vec3 c=vec3(1.,.74,.36)*dot_*fade*.5*uDim;
            vec3 base=vec3(.0035,.003,.006);
            gl_FragColor=vec4(base+c,uVoid*.96);
          }`,
      }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(46, FLOOR, -100 - (end - BASE_END));
    this.floor.renderOrder = -6;
    this.floor.frustumCulled = false;

    const geometry = tubeGeometry(end);
    this.tube = new LineSegments(geometry, tubeMaterial(uniforms, this.tubeOut, 1));
    this.tube.frustumCulled = false;
    this.tubeMirror = new LineSegments(geometry, tubeMaterial(uniforms, this.tubeOut, 0.3));
    this.tubeMirror.frustumCulled = false;
    this.tubeMirror.scale.y = -1;
    this.tubeMirror.position.y = 2 * FLOOR;

    this.sparks = makeSparks(end, uniforms);
    const bus = makeBus(end, uniforms.uTime);
    this.bus = bus.mesh;
    this.busOn = bus.on;
    scene.add(this.sky, this.floor, this.bus, this.tube, this.tubeMirror, this.sparks.points, this.sparks.mirror);
    this.show(false);
  }

  /** The size of a spark, for the page's pixels. */
  setPixels(pixelRatio: number, height: number): void {
    this.sparks.pixels.value = pixelRatio * Math.max(0.8, height / 800) * 1.15;
  }

  /** The reflections, which the speed ladder can drop. */
  allowMirrors(on: boolean): void {
    this.mirrorsAllowed = on;
  }

  /** What the fall, the bang and the end page do to the points. */
  get sparkControls(): SparkControls {
    return this.sparks.controls;
  }

  /** How large a spark is drawn: the galaxies share it. */
  get sparkPixels(): IUniform<number> {
    return this.sparks.pixels;
  }

  update({ f, distance, dissolve, opening, voidLeft, fall, bang, dt, camera }: VoidFrame): void {
    const on = voidLeft > 0.002;
    this.sky.visible = this.floor.visible = on;
    this.sky.position.copy(camera);
    this.mirrorsOn = this.mirrorsAllowed && opening > 0.5 && dissolve < 1;
    for (const mirror of this.wallMirrors) mirror.visible = this.mirrorsOn;
    this.tubeOut.value = ease(distance, 12, 34);
    this.tube.visible = this.tubeOut.value > 0.002 && dissolve < 1;
    this.tubeMirror.visible = this.tube.visible && this.mirrorsAllowed;
    this.sparks.points.visible = dissolve > 0;
    this.sparks.mirror.visible = dissolve > 0 && voidLeft > 0.02 && this.mirrorsAllowed;
    const { controls } = this.sparks;
    controls.uImp.value = fall;
    controls.uBang.value = bang;
    this.drift = bang > 0.4 ? this.drift + dt * 1.1 : 0;
    controls.uDrift.value = this.drift;
    const start = this.timeline.collapse[0];
    this.floor.material.uniforms.uDim.value = mix(1, 0.3, ease(f, start + 2, start + 28));
    this.busOn.value = ease(distance, LOOK_DISTANCE - 2, LOOK_DISTANCE + 16) * (1 - ease(f, start + 4, start + 24)) * (1 - ease(fall, 0, 0.6));
    this.bus.visible = this.busOn.value > 0.002;
  }

  /** All of it or none, for drawing it once before anything shows. */
  show(on: boolean): void {
    this.sky.visible = this.floor.visible = this.bus.visible = this.tube.visible = this.tubeMirror.visible = this.sparks.points.visible = this.sparks.mirror.visible = on;
    for (const mirror of this.wallMirrors) mirror.visible = on;
  }

  dispose(): void {
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.bus.geometry.dispose();
    this.bus.material.dispose();
    this.tube.geometry.dispose();
    this.tube.material.dispose();
    this.tubeMirror.material.dispose();
    this.sparks.points.geometry.dispose();
    this.sparks.points.material.dispose();
    this.sparks.mirror.material.dispose();
    this.scene.remove(this.sky, this.floor, this.bus, this.tube, this.tubeMirror, this.sparks.points, this.sparks.mirror);
  }
}
