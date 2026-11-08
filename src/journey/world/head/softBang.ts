import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Mesh, type Object3D, type PerspectiveCamera, PlaneGeometry, Points, ShaderMaterial, Sprite, Vector3 } from 'three';
import type { JourneyQuality } from '../../quality';
import { softBangAt, SOFT_BANG } from '../../head/report';
import { ease, seeded } from '../../math';
import { headSprite, lines } from './draw';

/**
 * The soft big bang behind the scan report (spec 2026-11-08 "Into my head", section 5.11; Bob: "big bang in the background
 * but not too strong"): the first gas, coloured puffs thrown out, four spiral galaxies settling round the report, and three
 * octagon rings running out from where the spark landed. Ported from mock-up 20's universe (its ending 12), every alpha at
 * `SOFT_BANG`, without the visitor's own galaxies. Light added on light, as everything in the head is.
 */

const ADD = { transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending } as const;
const smooth = (a: number, b: number, x: number): number => ease(x, a, b);

const NOISE_GLSL = /* glsl */ `
  float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }
  float vn(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=.5,v=0.; for(int i=0;i<4;i++){ v+=a*vn(p); p=p*2.03+vec3(7.1,3.3,1.7); a*=.5; } return v; }`;

/** The four galaxies, in the end view's own frame: across, up and away, as shares of the distance; size; seed; arms; tilt. */
const GALAXIES: [number, number, number, number, number, number, number, number][] = [
  [-0.63, 0.32, 0.14, 0.26, 11, 2, 1.16, 0.32],
  [0.68, -0.34, 0.05, 0.32, 23, 3, 1.3, -0.5],
  [0.58, 0.42, 0.27, 0.18, 37, 2, 1.1, 0.8],
  [-0.77, -0.44, -0.32, 0.37, 51, 2, 1.42, 0.14],
];
const GALAXY_STARS = 5200;

interface Puff { sp: Sprite; dir: Vector3; dist: number; size: number; op: number; spin: number; turn: number }

export class SoftBang {
  private readonly root = new Group();
  private readonly uTime = { value: 0 };
  private readonly uPx = { value: 800 };
  private readonly nebula: { mesh: Mesh; m: ShaderMaterial };
  private readonly puffTex: CanvasTexture;
  private readonly puffs: Puff[] = [];
  private readonly galaxies: { p: Points; m: ShaderMaterial; o: [number, number, number]; size: number }[] = [];
  private readonly rings: { g: Group; m: ShaderMaterial }[] = [];
  private readonly at = new Vector3();
  private depth = 48;
  private depthScale = 48 / 38;
  private puffsShown = 24;

  constructor(parent: Object3D) {
    parent.add(this.root);
    this.root.visible = false;

    // The first gas: a cloud that billows out of the bang.
    const nm = new ShaderMaterial({
      uniforms: { uA: { value: 0 }, uGrow: { value: 0.01 }, uTime: this.uTime },
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
      ...ADD,
    });
    const nmesh = new Mesh(new PlaneGeometry(1, 1), nm);
    nmesh.frustumCulled = false;
    this.root.add(nmesh);
    this.nebula = { mesh: nmesh, m: nm };

    // The coloured gas thrown out.
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d') as CanvasRenderingContext2D, rp = seeded(6060);
    for (let i = 0; i < 70; i++) {
      const a = rp() * Math.PI * 2, d = Math.pow(rp(), 1.5) * 86, px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d, rad = 18 + rp() * 40;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, `rgba(255,255,255,${0.05 + rp() * 0.1})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
    }
    this.puffTex = new CanvasTexture(c);
    {
      const r = seeded(7070), tones = [[1, 0.58, 0.2], [0.82, 0.36, 0.3], [0.42, 0.3, 0.8], [0.3, 0.24, 0.62], [1, 0.72, 0.36]];
      for (let i = 0; i < 24; i++) {
        const tone = tones[Math.floor(r() * tones.length)];
        const mat = headSprite(this.puffTex, new Color(tone[0], tone[1], tone[2]));
        const turn = r() * Math.PI * 2;
        mat.rotation = turn;
        const sp = new Sprite(mat);
        this.root.add(sp);
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        this.puffs.push({ sp, dir: new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.62, Math.sin(ph) * Math.sin(th)), dist: 0.32 + Math.pow(r(), 0.7) * 1.1, size: 0.4 + r() * 0.9, op: 0.03 + r() * 0.08, spin: (r() - 0.5) * 0.04, turn });
      }
    }

    // Four spiral galaxies: a few thousand stars in a turning disc each.
    for (const [ox, oy, oz, size, seed, arms, tx, tz] of GALAXIES) {
      const r = seeded(seed), g = new Float32Array(GALAXY_STARS * 3);
      for (let i = 0; i < GALAXY_STARS; i++) {
        const rad = Math.pow(r(), 0.62), gauss = r() + r() + r() - 1.5, arm = (Math.floor(r() * arms) / arms) * Math.PI * 2;
        g[i * 3] = rad;
        g[i * 3 + 1] = arm + rad * 4.4 + gauss * (0.62 - rad * 0.34);
        g[i * 3 + 2] = (r() - 0.5) * 2;
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(GALAXY_STARS * 3), 3));
      geo.setAttribute('aG', new BufferAttribute(g, 3));
      const m = new ShaderMaterial({
        uniforms: { uTime: this.uTime, uA: { value: 0 }, uPx: this.uPx },
        vertexShader: /* glsl */ `uniform float uTime, uPx; attribute vec3 aG; varying float vA; varying vec3 vC;
          void main() {
            float r = aG.x, an = aG.y + uTime * 0.09 / (0.22 + r);
            vec3 p = vec3(cos(an) * r, aG.z * (0.09 * (1.0 - r) + 0.018), sin(an) * r);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(uPx * (0.1 + 0.12 * (1.0 - r)) / max(1.0, -mv.z), 1.0, 4.5);
            vA = 0.42 + 0.58 * (1.0 - r);
            vC = mix(vec3(1.0, 0.8, 0.46), mix(vec3(0.74, 0.7, 1.0), vec3(1.0, 0.72, 0.42), fract(aG.y * 3.7)), smoothstep(0.06, 0.5, r));
          }`,
        fragmentShader: /* glsl */ `uniform float uA; varying float vA; varying vec3 vC;
          void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * smoothstep(0.5, 0.08, d) * vA * uA * 1.3, 1.0); }`,
        ...ADD,
      });
      const p = new Points(geo, m);
      p.frustumCulled = false;
      p.rotation.set(tx, 0, tz);
      this.root.add(p);
      this.galaxies.push({ p, m, o: [ox, oy, oz], size });
    }

    // Three octagon rings running out from the landing.
    for (let k = 0; k < 3; k++) {
      const pos: number[] = [], shade: number[] = [];
      for (let i = 0; i < 8; i++) {
        for (const j of [i, i + 1]) {
          const a = ((j + 0.5) * Math.PI) / 4;
          pos.push(Math.cos(a), Math.sin(a), 0);
          shade.push(1);
        }
      }
      const g = new Group();
      this.root.add(g);
      this.rings.push({ g, m: lines(g, pos, shade, new Color(1, 0.8, 0.45)).material });
    }
  }

  /**
   * Stands the bang where the spark lands, `at`, as `camera` sees it from where the ride ends (both in the tunnel's world).
   * On a tall phone the galaxies move in from the sides and spread up and down, so they stay in view (mock `placeUniverse`).
   */
  place(at: Vector3, camera: PerspectiveCamera): void {
    this.at.copy(at);
    const q = camera.quaternion;
    const right = new Vector3(1, 0, 0).applyQuaternion(q), up = new Vector3(0, 1, 0).applyQuaternion(q), fwd = new Vector3(0, 0, -1).applyQuaternion(q);
    // How far ahead the landing is: its depth along the view, the same wherever on the page it lands.
    this.depth = Math.max(1, new Vector3().subVectors(at, camera.position).dot(fwd));
    this.depthScale = this.depth / 38;
    const sx = Math.min(1, camera.aspect / 1.4), sy = camera.aspect < 0.8 ? 1.9 : 1;
    for (const g of this.galaxies) {
      g.p.position.copy(at).addScaledVector(right, g.o[0] * sx * this.depth).addScaledVector(up, g.o[1] * sy * this.depth).addScaledVector(fwd, g.o[2] * this.depth);
    }
    this.nebula.mesh.position.copy(at).addScaledVector(fwd, 6);
    this.nebula.mesh.quaternion.copy(q);
    this.nebula.mesh.scale.setScalar(this.depth * 3.2);
    for (const ring of this.rings) {
      ring.g.position.copy(at);
      ring.g.quaternion.copy(q);
    }
  }

  /** The size of a star on the page: from the canvas's height in device pixels and the lens. */
  setPixels(heightPx: number, fov: number): void {
    this.uPx.value = heightPx / (2 * Math.tan((fov * Math.PI) / 360));
  }

  show(on: boolean): void {
    this.root.visible = on;
  }

  /** `t` the head's own time, `time` seconds (held still when the visitor asks for less motion). */
  update(t: number, time: number): void {
    this.uTime.value = time;
    const { grow: ub, rings } = softBangAt(t), out = 1 - Math.pow(1 - ub, 2.4), uk = SOFT_BANG;
    this.nebula.mesh.visible = ub > 0;
    this.nebula.m.uniforms.uGrow.value = 0.02 + 0.98 * (1 - Math.pow(1 - ub, 2.6));
    this.nebula.m.uniforms.uA.value = 0.32 * smooth(0.04, 0.5, ub) * uk;
    for (const [i, pf] of this.puffs.entries()) {
      pf.sp.visible = ub > 0 && i < this.puffsShown;
      if (!pf.sp.visible) continue;
      pf.sp.position.copy(this.at).addScaledVector(pf.dir, pf.dist * this.depth * out);
      pf.sp.scale.setScalar(pf.size * this.depth * (0.3 + 0.7 * out));
      pf.sp.material.opacity = pf.op * smooth(0.24, 0.92, ub) * uk;
      pf.sp.material.rotation = pf.turn + pf.spin * time;
    }
    this.galaxies.forEach((g, i) => {
      const grown = smooth(0.42 + i * 0.05, 0.88 + i * 0.03, ub);
      g.p.visible = grown > 0;
      g.p.scale.setScalar(g.size * 0.78 * this.depth * Math.max(0.001, grown));
      g.m.uniforms.uA.value = grown * 0.6 * uk;
    });
    this.rings.forEach(({ g, m }, k) => {
      const bk = rings[k];
      g.visible = bk > 0 && bk < 1;
      g.scale.setScalar((0.3 + Math.pow(bk, 0.55) * (6 + k * 4)) * this.depthScale);
      m.uniforms.uA.value = g.visible ? Math.pow(1 - bk, 1.4) * (k === 0 ? 0.4 : 0.22) : 0;
    });
  }

  /** The shown share of each galaxy's stars, at this step of the speed ladder. */
  setQuality(quality: JourneyQuality): void {
    for (const g of this.galaxies) g.p.geometry.setDrawRange(0, Math.max(1, Math.round(GALAXY_STARS * quality.galaxies)));
    this.puffsShown = Math.round(this.puffs.length * quality.clouds);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      const withGeometry = object as Partial<Mesh>;
      withGeometry.geometry?.dispose();
      (withGeometry.material as { dispose?: () => void } | undefined)?.dispose?.();
    });
    this.puffTex.dispose();
  }
}
