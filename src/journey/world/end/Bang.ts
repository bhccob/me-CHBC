import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Quaternion, RingGeometry, type Scene, ShaderMaterial, Sprite, SpriteMaterial, type Texture, type Vector3 } from 'three';
import { RINGS } from '../../bang';
import { clamp, ease } from '../../math';
import { displayReferred } from '../displayOutput';
import type { TunnelUniforms } from '../flight/tunnelParts';

/** Soft noise, for the gas of the first moments. */
export const NOISE_GLSL = /* glsl */ `
  float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }
  float vn(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=.5,v=0.; for(int i=0;i<4;i++){ v+=a*vn(p); p=p*2.03+vec3(7.1,3.3,1.7); a*=.5; } return v; }
`;

/** Light added on, in a colour: picture-ready, as everything in the tunnel's picture. */
export function glowing(r: number, g: number, b: number, map?: Texture): SpriteMaterial {
  const material = new SpriteMaterial({ map: map ?? null, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, fog: false });
  material.color.setRGB(r, g, b);
  return displayReferred(material, false);
}

function ringMaterial(r: number, g: number, b: number): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, fog: false, side: DoubleSide });
  material.color.setRGB(r, g, b);
  return displayReferred(material, false);
}

interface Ring {
  core: Mesh<RingGeometry, MeshBasicMaterial>;
  glow: Mesh<RingGeometry, MeshBasicMaterial>;
  at: number;
}

/** The point everything falls into, then the flash, the seven rings that are the portal's own shape, and the first gas. */
export class Bang {
  private readonly group = new Group();
  private readonly seed: Sprite;
  private readonly rings: Ring[] = [];
  private readonly nebula: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly scene: Scene;

  constructor(scene: Scene, uniforms: TunnelUniforms, point: Vector3, glow: Texture) {
    this.scene = scene;
    this.group.position.copy(point);
    this.group.visible = false;
    scene.add(this.group);

    this.seed = new Sprite(glowing(1, 0.86, 0.6, glow));
    this.seed.renderOrder = 7;
    this.group.add(this.seed);

    const ring = (inner: number, outer: number): Mesh<RingGeometry, MeshBasicMaterial> => {
      const mesh = new Mesh(new RingGeometry(inner, outer, 8, 1, Math.PI / 8), ringMaterial(1, 0.74, 0.34));
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    for (let i = 0; i < RINGS; i++) this.rings.push({ core: ring(0.985, 1), glow: ring(0.91, 1.05), at: i * 0.045 });

    this.nebula = new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        uniforms: { uA: { value: 0 }, uGrow: { value: 0.01 }, uTime: uniforms.uTime },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        toneMapped: false,
        vertexShader: 'varying vec2 vU; void main(){ vU=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: /* glsl */ `uniform float uA,uGrow,uTime; varying vec2 vU; ${NOISE_GLSL}
          void main(){
            vec2 u=vU/max(.001,uGrow); float r=length(u);
            if(r>1.) discard;
            vec3 p=vec3(u*2.4,uTime*.012);
            float n=fbm(p+vec3(fbm(p*1.6+3.),fbm(p*1.6+8.),0.)*1.5);
            float n2=fbm(p*3.1+7.);
            float k=smoothstep(1.,.08,r);
            vec3 c=mix(vec3(.3,.2,.62),vec3(1.,.58,.2),smoothstep(.62,.0,r)*.85+n2*.18);
            gl_FragColor=vec4(c*pow(n,2.3)*k*k*uA,1.);
          }`,
      }),
    );
    this.nebula.frustumCulled = false;
    this.nebula.renderOrder = -3.5;
    this.nebula.scale.setScalar(660);
    this.group.add(this.nebula);
  }

  update(fall: number, bang: number, now: number, facing: Quaternion): void {
    const on = fall > 0;
    this.group.visible = on;
    if (!on) return;
    this.group.quaternion.copy(facing);
    const pre = ease(fall, 0.45, 1);
    const flash = bang > 0 ? Math.exp(-bang * 26) : 0;
    this.seed.material.opacity = bang > 0 ? flash : pre * (0.7 + 0.3 * Math.sin(now / 70));
    this.seed.scale.setScalar(bang > 0 ? 40 + 900 * (1 - Math.exp(-bang * 22)) : 3 + 16 * pre);
    for (const { core, glow, at } of this.rings) {
      const t = clamp((bang - at) / 0.55);
      const shown = t > 0 && t < 1;
      core.visible = glow.visible = shown;
      if (!shown) continue;
      const size = (1 - Math.pow(1 - t, 3)) * 420 + 1;
      core.scale.setScalar(size);
      glow.scale.setScalar(size);
      const left = (1 - t) * (1 - t);
      core.material.opacity = 0.9 * left;
      glow.material.opacity = 0.13 * left;
    }
    const { uniforms } = this.nebula.material;
    uniforms.uGrow.value = 0.02 + 0.98 * (1 - Math.pow(1 - bang, 2.6));
    uniforms.uA.value = 0.2 * ease(bang, 0.04, 0.5);
    this.nebula.visible = bang > 0;
  }

  /** All of it or none, for drawing it once before anything shows. */
  show(on: boolean): void {
    this.group.visible = on;
    this.nebula.visible = on;
    for (const { core, glow } of this.rings) core.visible = glow.visible = on;
  }

  dispose(): void {
    this.seed.material.dispose();
    for (const { core, glow } of this.rings) {
      core.geometry.dispose();
      core.material.dispose();
      glow.geometry.dispose();
      glow.material.dispose();
    }
    this.nebula.geometry.dispose();
    this.nebula.material.dispose();
    this.scene.remove(this.group);
  }
}
