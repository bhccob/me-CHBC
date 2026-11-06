import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, type IUniform, Matrix4, Mesh, MeshBasicMaterial, type MeshStandardMaterial, NoColorSpace, type Object3D, type PerspectiveCamera, type PointLight, Points, Raycaster, RingGeometry, type Scene, ShaderMaterial, Sprite, type SpriteMaterial, type Texture, Vector2, Vector3 } from 'three';
import { addGalaxy, MAX_GALAXIES } from '../../end';
import type { JourneyQuality } from '../../quality';
import { backOut, ease, seeded, TAU } from '../../math';
import { displayReferred } from '../displayOutput';
import type { SparkControls } from '../void/Dissolve';
import { endFrame } from '../void/path';
import { glowing } from './Bang';

/** How far off the words the universe stands. */
const DISTANCE = 220;
/** The inner edge of the gate's frame, in the model's units, to its corners. */
const GATE_INNER = 3.25;
const SHOCKS = 3;
const SHOCK_MS = 1500;
/** How far off a new galaxy forms along the pointer's ray. */
const BIRTH_DISTANCE = 150;

const up = new Vector3(0, 1, 0);
const tmp = new Vector3();
const toCamera = new Vector3();

function puffTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const x = canvas.getContext('2d')!;
  const r = seeded(6060);
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 1.5) * 86;
    const px = 128 + Math.cos(a) * d;
    const py = 128 + Math.sin(a) * d;
    const rad = 18 + r() * 40;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.1})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  return texture;
}

/** A spiral galaxy: a few thousand stars in a turning disc. */
export function galaxy(seed: number, count: number, arms: number, time: IUniform<number>, pixels: IUniform<number>): Points<BufferGeometry, ShaderMaterial> {
  const r = seeded(seed);
  const stars = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const rad = Math.pow(r(), 0.62);
    const gauss = r() + r() + r() - 1.5;
    const arm = (Math.floor(r() * arms) / arms) * TAU;
    stars[i * 3] = rad;
    stars[i * 3 + 1] = arm + rad * 4.4 + gauss * (0.62 - rad * 0.34);
    stars[i * 3 + 2] = (r() - 0.5) * 2;
  }
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3)).setAttribute('aG', new BufferAttribute(stars, 3));
  const points = new Points(
    geometry,
    new ShaderMaterial({
      uniforms: { uTime: time, uA: { value: 0 }, uPx: pixels, uBorn: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `uniform float uTime,uPx,uBorn; attribute vec3 aG; varying float vA; varying vec3 vC;
        void main(){
          float r=aG.x, an=aG.y+(uTime-uBorn)*.09/(.22+r);
          vec3 p=vec3(cos(an)*r,aG.z*(.09*(1.-r)+.018),sin(an)*r);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(uPx*(1.2+1.5*(1.-r))*96./max(1.,length(mv.xyz)),1.1,5.);
          vA=.42+.58*(1.-r);
          vC=mix(vec3(1.,.8,.46),mix(vec3(.74,.7,1.),vec3(1.,.72,.42),fract(aG.y*3.7)),smoothstep(.06,.5,r));
        }`,
      fragmentShader: /* glsl */ `uniform float uA; varying float vA; varying vec3 vC;
        void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vC*smoothstep(.5,.08,d)*vA*uA*1.3,1.); }`,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = -1.5;
  return points;
}

interface Puff {
  sprite: Sprite;
  dir: Vector3;
  dist: number;
  size: number;
  opacity: number;
  spin: number;
}

interface Shock {
  group: Group;
  core: Mesh<RingGeometry, MeshBasicMaterial>;
  glow: Sprite;
  born: number;
  size: number;
  at: Vector2;
}

interface Yours {
  points: Points<BufferGeometry, ShaderMaterial>;
  born: number;
  size: number;
}

/** What each frame gives the universe. */
export interface UniverseFrame {
  bang: number;
  now: number;
  dt: number;
  /** The pointer exactly, and smoothed. */
  pointer: Vector2;
  mouse: Vector2;
  camera: PerspectiveCamera;
  phone: boolean;
  reduce: boolean;
}

/** What it holds, for those checking it. */
export interface UniverseReport {
  stars: number;
  gas: number;
  yours: number;
  fired: number;
  charge: number;
  /** Where the gate stands on the page and how far its inner edge reaches from there, in CSS pixels. */
  gate: { x: number; y: number; inner: number };
}

const FIXED = [
  { off: [-138, 70, 30], size: 58, tilt: [1.16, 0, 0.32], seed: 11, arms: 2 },
  { off: [150, -74, 10], size: 70, tilt: [1.3, 0, -0.5], seed: 23, arms: 3 },
  { off: [128, 92, 60], size: 40, tilt: [1.1, 0, 0.8], seed: 37, arms: 2 },
  { off: [-170, -96, -70], size: 82, tilt: [1.42, 0, 0.14], seed: 51, arms: 2 },
] as const;

/**
 * The dark space it settles into. Four spiral galaxies at different depths, thin gas, and the portal's own gate, huge and dark,
 * with the words inside its inner edge. All faint, so that the words stay the one bright thing. The cursor bends the stars;
 * hold and let go, and an octagon shock goes through them and leaves a galaxy of your own.
 */
export class Universe {
  private readonly scene: Scene;
  private readonly group = new Group();
  private readonly time: IUniform<number>;
  private readonly pixels: IUniform<number>;
  private readonly controls: SparkControls;
  private readonly point: Vector3;
  private readonly light: PointLight;
  private readonly ray = new Raycaster();
  private readonly puffMap = puffTexture();
  private readonly puffs: Puff[] = [];
  private readonly fixed: { points: Points<BufferGeometry, ShaderMaterial>; size: number }[] = [];
  private readonly rig = new Group();
  private readonly spin = new Group();
  private readonly gears: Object3D[] = [];
  private readonly gateMaterials: MeshStandardMaterial[] = [];
  private readonly seedHold: Sprite;
  private readonly shocks: Shock[] = [];
  private yours: Yours[] = [];
  private nextShock = 0;
  private charge = 0;
  private held = false;
  fired = 0;
  private lastNow = 0;
  private starShare = 1;

  constructor(scene: Scene, model: Object3D, end: number, time: IUniform<number>, pixels: IUniform<number>, controls: SparkControls, point: Vector3, glow: Texture, light: PointLight) {
    this.scene = scene;
    this.time = time;
    this.pixels = pixels;
    this.controls = controls;
    this.point = point;
    this.light = light;
    this.group.visible = false;
    scene.add(this.group);

    const r = seeded(7070);
    const tones = [[1, 0.58, 0.2], [0.82, 0.36, 0.3], [0.42, 0.3, 0.8], [0.3, 0.24, 0.62], [1, 0.72, 0.36]];
    for (let i = 0; i < 24; i++) {
      const c = tones[Math.floor(r() * tones.length)];
      const sprite = new Sprite(glowing(c[0], c[1], c[2], this.puffMap));
      const th = r() * TAU;
      const ph = Math.acos(2 * r() - 1);
      const dist = 70 + Math.pow(r(), 0.7) * 240;
      const dir = new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.62, Math.sin(ph) * Math.sin(th));
      const size = 90 + r() * 190;
      const opacity = 0.012 + r() * 0.05;
      const spin = (r() - 0.5) * 0.04;
      sprite.material.rotation = r() * TAU;
      sprite.renderOrder = -3;
      sprite.frustumCulled = false;
      this.group.add(sprite);
      this.puffs.push({ sprite, dir, dist, size, opacity, spin });
    }

    for (const { off, size, tilt, seed, arms } of FIXED) {
      const points = galaxy(seed, 5200, arms, time, pixels);
      points.position.copy(point).add(tmp.set(off[0], off[1], off[2]));
      points.rotation.set(tilt[0], tilt[1], tilt[2]);
      this.group.add(points);
      this.fixed.push({ points, size });
    }

    // The portal's own ring, where the bang came from, slowly turning.
    const source = model.getObjectByName('frame');
    if (!source) throw new Error('the gate has no part "frame"');
    const gate = source.clone(true);
    gate.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        const material = displayReferred((mesh.material as MeshStandardMaterial).clone(), true);
        material.opacity = 1;
        material.fog = false;
        if (material.name === 'graphite') material.color.setRGB(0.035, 0.035, 0.042);
        if (material.name === 'steel') {
          material.color.setRGB(0.09, 0.09, 0.1);
          material.roughness = 0.5;
        }
        if (material.name === 'gold') material.color.setRGB(0.42, 0.27, 0.08);
        if (material.name === 'led') {
          material.emissive.setRGB(0.9, 0.56, 0.18);
          material.emissiveIntensity = 0.62;
        }
        mesh.material = material;
        mesh.renderOrder = -2;
        mesh.frustumCulled = false;
        this.gateMaterials.push(material);
      }
      if (/^gear-\d$/.test(object.name)) this.gears.push(object);
    });
    this.rig.position.copy(point);
    this.spin.add(gate);
    this.rig.add(this.spin);
    this.group.add(this.rig);

    const { heading } = endFrame(end);
    light.position.copy(point).addScaledVector(heading, -70).add(tmp.set(0, 30, 0));

    this.seedHold = new Sprite(glowing(1, 0.86, 0.6, glow));
    (this.seedHold.material as SpriteMaterial).opacity = 0;
    this.seedHold.renderOrder = 7;
    this.seedHold.visible = false;
    scene.add(this.seedHold);

    for (let i = 0; i < SHOCKS; i++) {
      const group = new Group();
      group.visible = false;
      const coreMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, fog: false, side: DoubleSide });
      coreMaterial.color.setRGB(1, 0.76, 0.36);
      const core = new Mesh(new RingGeometry(0.992, 1, 8, 1, Math.PI / 8), displayReferred(coreMaterial, false));
      const light2 = new Sprite(glowing(1, 0.8, 0.5, glow));
      core.renderOrder = light2.renderOrder = 6;
      core.frustumCulled = light2.frustumCulled = false;
      group.add(core, light2);
      scene.add(group);
      this.shocks.push({ group, core, glow: light2, born: -1e9, size: 40, at: new Vector2() });
    }
    this.heading = heading;
    this.right = endFrame(end).right;
  }

  private readonly heading: Vector3;
  private readonly right: Vector3;

  /** What the ladder asks of it: how many of the galaxies' stars, and how much of the gas. */
  setQuality(quality: JourneyQuality): void {
    this.starShare = quality.galaxies;
    for (const { points } of [...this.fixed, ...this.yours]) points.geometry.setDrawRange(0, Math.round(points.geometry.attributes.position.count * quality.galaxies));
    const keep = Math.round(this.puffs.length * quality.clouds);
    this.puffs.forEach(({ sprite }, i) => {
      sprite.visible = i < keep;
    });
  }

  /** A press: the stars pull in harder, and a light grows at the cursor. */
  press(): void {
    this.held = true;
    this.charge = 0;
  }

  /** Let go: `pointer` is where. `cancelled` lets it go with nothing to show for it. */
  release(pointer: Vector2, camera: PerspectiveCamera, cancelled: boolean, reduce: boolean): void {
    if (!this.held) return;
    this.held = false;
    const power = this.charge;
    this.charge = 0;
    if (!cancelled) this.fire(pointer, camera, power, reduce);
  }

  private rayPoint(pointer: Vector2, camera: PerspectiveCamera, out: Vector3): Vector3 {
    this.ray.setFromCamera(pointer, camera);
    return out.copy(this.ray.ray.origin).addScaledVector(this.ray.ray.direction, BIRTH_DISTANCE);
  }

  /** The shock wave, and the galaxy it leaves. */
  private fire(pointer: Vector2, camera: PerspectiveCamera, power: number, reduce: boolean): void {
    const now = this.lastNow;
    const at = this.rayPoint(pointer, camera, new Vector3());
    const shock = this.shocks[this.nextShock++ % SHOCKS];
    shock.born = now;
    shock.size = 26 + power * 40;
    shock.at.copy(pointer);
    shock.group.position.copy(at);
    shock.group.visible = true;
    this.fired += 1;
    const points = galaxy(101 + this.fired * 7, 1700 + Math.round(power * 2600), 2 + (this.fired % 2), this.time, this.pixels);
    points.position.copy(at);
    const r = seeded(4001 + this.fired * 13);
    points.rotation.set(0.5 + r() * 0.9, 0, (r() - 0.5) * 1.1);
    points.material.uniforms.uBorn.value = reduce ? 0 : now / 1000;
    points.geometry.setDrawRange(0, Math.round(points.geometry.attributes.position.count * this.starShare));
    this.group.add(points);
    const made: Yours = { points, born: now, size: 26 + power * 44 };
    const before = this.yours;
    this.yours = addGalaxy(before, made);
    if (before.length === MAX_GALAXIES) {
      const old = before[0];
      this.group.remove(old.points);
      old.points.geometry.dispose();
      old.points.material.dispose();
    }
  }

  update({ bang, now, dt, pointer, mouse, camera, phone, reduce }: UniverseFrame): void {
    this.lastNow = now;
    const q = ease(bang, 0.24, 0.92);
    const on = bang > 0.02;
    this.group.visible = on;
    this.light.intensity = on ? 220 * q : 0;
    const { controls } = this;
    controls.uLensK.value = reduce ? 0 : ease(bang, 0.72, 0.96);
    controls.uLens.value.copy(pointer);
    controls.uAsp.value = camera.aspect;
    if (this.held) this.charge = Math.min(1, this.charge + dt / 1.2);
    controls.uCharge.value += (this.charge - controls.uCharge.value) * (1 - Math.exp(-dt / 0.12));

    this.seedHold.visible = this.held;
    if (this.held) {
      this.rayPoint(pointer, camera, this.seedHold.position);
      this.seedHold.material.opacity = 0.35 + 0.65 * this.charge;
      this.seedHold.scale.setScalar(3 + this.charge * 30 + Math.sin(now / 50) * this.charge * 1.5);
    }

    this.shocks.forEach((shock, i) => {
      const a = (now - shock.born) / SHOCK_MS;
      if (a < 0 || a >= 1) {
        shock.group.visible = false;
        controls.uPulseA.value[i] = -1;
        return;
      }
      controls.uPulseA.value[i] = a;
      controls.uPulseP.value[i].copy(shock.at);
      shock.core.scale.setScalar((1 - Math.pow(1 - a, 3)) * shock.size * 2.2 + 0.5);
      shock.core.material.opacity = 0.9 * (1 - a) * (1 - a);
      shock.group.quaternion.copy(camera.quaternion);
      const flash = Math.exp(-a * 9);
      shock.glow.material.opacity = flash * 0.9;
      shock.glow.scale.setScalar(10 + shock.size * 1.6 * (1 - flash));
    });
    if (!on) return;

    const out = 1 - Math.pow(1 - bang, 2.4);
    for (const puff of this.puffs) {
      puff.sprite.position.copy(this.point).addScaledVector(puff.dir, puff.dist * out);
      puff.sprite.scale.setScalar(puff.size * (0.3 + 0.7 * out));
      puff.sprite.material.opacity = puff.opacity * q;
      puff.sprite.material.rotation += puff.spin * dt;
    }
    this.fixed.forEach(({ points, size }, i) => {
      const grown = ease(bang, 0.42 + i * 0.05, 0.88 + i * 0.03);
      points.scale.setScalar(size * Math.max(0.001, grown));
      points.material.uniforms.uA.value = grown;
    });
    for (const { points, born, size } of this.yours) {
      const grown = ease((now - born) / 1000, 0.05, 1.8);
      points.scale.setScalar(size * Math.max(0.01, grown));
      points.material.uniforms.uA.value = grown;
    }

    // The ring grows out of the point, then keeps turning and leans toward the cursor.
    const grow = backOut(ease(bang, 0.34, 0.84), 1.1);
    const tanV = Math.tan(((phone ? 68 : 52) * Math.PI) / 360);
    const fit = ((phone ? 0.74 : 1.14) * tanV * DISTANCE) / GATE_INNER;
    this.spin.rotation.z = reduce ? 0 : now / 26000;
    this.rig.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(this.right, up, this.heading.clone().negate()));
    // It turns against the camera's swing, so that it keeps facing you; the words must never cross its metal.
    if (!reduce) {
      this.rig.rotateY(-mouse.x * 0.22);
      this.rig.rotateX(mouse.y * 0.14);
    }
    // And it grows just enough that its far side, which turning draws in, stays clear of them, with a little for their lean.
    const facing = Math.abs(tmp.set(0, 0, 1).applyQuaternion(this.rig.quaternion).dot(toCamera.subVectors(camera.position, this.point).normalize()));
    const turned = Math.acos(Math.min(1, facing));
    const reach = (fit * GATE_INNER * Math.cos(Math.PI / 8)) / DISTANCE;
    const clear = 1 / Math.max(0.5, Math.cos(turned) - reach * Math.sin(turned));
    const lean = 1 + 0.04 * Math.min(1, Math.hypot(mouse.x, mouse.y));
    this.rig.scale.setScalar(Math.max(0.001, fit * grow) * clear * lean);
    this.gears.forEach((gear, i) => {
      gear.rotation.z = reduce ? 0 : (now / 1500) * (i % 2 ? 1 : -1);
    });
  }

  /** All of it or none, for drawing it once before anything shows. */
  show(on: boolean): void {
    this.group.visible = on;
    this.seedHold.visible = on;
    for (const shock of this.shocks) shock.group.visible = on;
  }

  report(camera: PerspectiveCamera, width: number, height: number): UniverseReport {
    const px = (v: Vector3): [number, number] => {
      v.project(camera);
      return [(v.x * 0.5 + 0.5) * width, (-v.y * 0.5 + 0.5) * height];
    };
    const [x, y] = px(tmp.copy(this.point));
    // To its flats, not its corners, and at its nearest as it turns: the inner edge reaches at least this far all the way round.
    this.rig.updateMatrixWorld(true);
    const reach = GATE_INNER * Math.cos(Math.PI / 8);
    let inner = Infinity;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * TAU;
      const [ex, ey] = px(tmp.set(Math.cos(a) * reach, Math.sin(a) * reach, 0).applyMatrix4(this.rig.matrixWorld));
      inner = Math.min(inner, Math.hypot(ex - x, ey - y));
    }
    return { stars: this.fixed.length, gas: this.puffs.length, yours: this.yours.length, fired: this.fired, charge: this.charge, gate: { x, y, inner } };
  }

  dispose(): void {
    this.puffMap.dispose();
    for (const { sprite } of this.puffs) sprite.material.dispose();
    for (const { points } of [...this.fixed, ...this.yours]) {
      points.geometry.dispose();
      points.material.dispose();
    }
    for (const material of this.gateMaterials) material.dispose();
    this.seedHold.material.dispose();
    for (const shock of this.shocks) {
      shock.core.geometry.dispose();
      shock.core.material.dispose();
      shock.glow.material.dispose();
      this.scene.remove(shock.group);
    }
    this.scene.remove(this.group, this.seedHold);
  }
}
