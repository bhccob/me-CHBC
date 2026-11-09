import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, LineSegments, type Matrix4, Mesh, type Object3D, PerspectiveCamera, Points, Quaternion, ShaderMaterial, Sprite, SRGBColorSpace, Vector3 } from 'three';
import type { Locale } from '~/i18n/Translator';
import type { JourneyQuality } from '../../quality';
import { decodeHead } from '../../head/headBin';
import { objectSegments } from '../../head/objects';
import { pourWords } from '../../head/pour';
import { brainSdf, MOUTH_W, MOUTH_Y, MOUTH_Z } from '../../head/shape';
import { answerShown, DOWN, dwellT, dwellWeights, HOLD, NQ, THOUGHTS } from '../../head/thoughts';
import { HOLD_IN, SPIT_T } from '../../head/time';
import { clamp, ease, mix, seeded } from '../../math';
import type { Box } from '../../layers';
import { dotsMaterial, type GlowPoints, glowPoints, headSprite, lightSprite, lines } from './draw';
import { type Pose, S } from './track';
import { headUniforms, xrayMaterial } from './xray';

/**
 * Bob's head as the scanner sees it, from the shaft above it to the spit (spec 2026-11-08 "Into my head", sections 5.1 to
 * 5.11), ported from mock-up 20. Everything stands in the mock's own world, which `place` stands in the tunnel's: the head
 * at its middle, `S` world units to a head unit, the face toward +z. All of it is light added on light: nothing hides.
 */

export interface HeadInput {
  t: number;
  time: number;
  dt: number;
  camera: PerspectiveCamera;
  phone: boolean;
  reduce: boolean;
}

/** Where the head is, for the proof harness. */
export interface HeadReport {
  /** Its own time. */
  t: number;
  /** The answer being read, or -1. */
  active: number;
  /** The pressure behind the lips. */
  pressure: number;
  /** The language of the words that pour in. */
  locale: string;
  /** How far the lid has lifted, 0 to 1. */
  open: number;
  /** Where the spark is on the page, CSS px. */
  spark: [number, number];
}

/** Where the page's parts of the head journey stand this frame, in CSS px. */
export interface HeadAnchors {
  /** The six thoughts' regions, for the labels' leaders, and whether each is in front of the camera. */
  labels: [number, number][];
  /** The six answers' anchors, and whether each is in front of the camera. */
  cards: [number, number][];
  cardsInFront: boolean[];
  /** Where the spark is, for the scan line it opens into. */
  spark: [number, number];
  /** The head's box on the page, for laying the labels out round it. */
  headBox: Box;
  /** The camera on the side map, in head units (z, y), and the way it looks. */
  you: [number, number];
  youDir: [number, number];
  /** The scan's slice: where it crosses the head's middle on the page (CSS px), how bright it is, its height in head units. */
  scan: { y: number; on: number; head: number };
  /** How lit each region is (the seven thoughts, then the visual cortex), for the read-out's meter. */
  act: readonly number[];
}

const GOLD = new Color(0.93, 0.7, 0.28);
const INK = new Color(0.96, 0.93, 0.87);
const WARM = new Color(1.0, 0.78, 0.5);
const EYES = [new Vector3(0.27, 0.12, 0.68), new Vector3(-0.27, 0.12, 0.68)];
const GLYPHS = '01{}[]()<>=+-*/;:.#&|_$%ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789?!@^~';
const TINTS: [number, number, number][] = [[1, 0.78, 0.38], [1, 0.78, 0.38], [1, 0.84, 0.52], [1, 0.9, 0.7], [0.96, 0.93, 0.87], [1, 0.66, 0.32]];
const STREAM_Y0 = 240;
const OPENING_Y = 15;
const RING_R = 8;
const RING_Y = Array.from({ length: 26 }, (_, k) => 66 + k * 7);
const SPARK_RINGS = 8;
const SPARK_PER = 64;
/** Where the scan report stands, in the mock's world, and how far in front of it the ride ends (track.ts). */
const END_POS = new Vector3(0, -5, 62);
const END_LOOK = new Vector3(0, -5, 110);
const END_DEPTH = END_POS.distanceTo(END_LOOK);
const DEPTH_SCALE = END_DEPTH / 38;

const smooth = (a: number, b: number, x: number): number => ease(x, a, b);
const bump = (a: number, b: number, x: number): number => Math.sin(Math.PI * clamp((x - a) / (b - a)));
const inOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const W = (x: number, y: number, z: number): Vector3 => new Vector3(x * S, y * S, z * S);

interface StreamParticle { a0: number; sp: number; ang: number; r: number; k: number; jx: number; jy: number; jz: number }

const tmp = new Vector3(), tmp2 = new Vector3(), tmp3 = new Vector3(), camLocal = new Vector3(), camFwd = new Vector3(), camUp = new Vector3();
const toPage = new Vector3();

export class HeadScene {
  /** The mock's world, stood in the tunnel's. */
  readonly world = new Group();
  private readonly head = new Group();
  private readonly u = headUniforms();
  private readonly rnd = seeded(11);
  private readonly unplace: Matrix4;
  private readonly quatToMock = new Quaternion();
  private skinMat: ShaderMaterial | null = null;
  private brainMat: ShaderMaterial | null = null;
  private dustMat: ShaderMaterial | null = null;
  private neuralMat!: ShaderMaterial;
  private tunnelMat!: ShaderMaterial;
  private beamMat!: ShaderMaterial;
  private glyphAtlas!: CanvasTexture;
  private glyphs!: GlowPoints;
  private readonly glyphP: StreamParticle[] = [];
  private dust!: GlowPoints;
  private readonly dustP: StreamParticle[] = [];
  private sparks!: GlowPoints;
  private readonly sparkP: { y: number; home: Vector3; burst: Vector3; k: number }[] = [];
  private cards: { s: Sprite; p: StreamParticle }[] = [];
  private readonly regionW = THOUGHTS.map((thought) => W(...thought.c));
  private readonly neuronsW: Vector3[] = [];
  private readonly edges: [number, number][] = [];
  private nodes!: GlowPoints;
  private pulses!: GlowPoints;
  private readonly pulseP: { e: number; ph: number; sp: number; dir: boolean }[] = [];
  private readonly clusters: { cw: Vector3; m: ShaderMaterial; tips: Vector3[] }[] = [];
  private somas!: GlowPoints;
  private inward!: GlowPoints;
  private readonly inwardP: { k: number; tip: number; ph: number; sp: number }[] = [];
  private readonly objects: { g: Group; m: ShaderMaterial; spin: number }[] = [];
  private readonly optic: { curve: CatmullRomCurve3; m: ShaderMaterial }[] = [];
  private opticPulses!: GlowPoints;
  private readonly opticP: { c: number; ph: number; sp: number; o: Vector3 }[] = [];
  private readonly fibers: { curve: CatmullRomCurve3; offs: Vector3[]; m: ShaderMaterial }[] = [];
  private fiberPulses!: GlowPoints;
  private readonly fiberPulseP: { f: number; ph: number; sp: number; o: number }[] = [];
  private outsideLight!: Sprite;
  private lipRings!: { g: Group; m: ShaderMaterial };
  private voice!: GlowPoints;
  private readonly voiceP: { a0: number; sp: number; o: Vector3 }[] = [];
  private voiceCurve!: CatmullRomCurve3;
  private spray!: GlowPoints;
  private readonly sprayP: { life: number; o: Vector3 }[] = [];
  private letters!: GlowPoints;
  private readonly letterP: { o: Vector3 }[] = [];
  private bangSparks!: GlowPoints;
  private readonly bangP: { d: Vector3; sp: number; drift: Vector3 }[] = [];
  private core!: Sprite;
  private readonly mouth = W(0, MOUTH_Y, MOUTH_Z + 0.03);
  /** Where the spark is this frame, in the mock's world. */
  private readonly sparkAt = new Vector3();
  /** Where the spark lands: the top of the scan report, in the mock's world. */
  private readonly landing = END_LOOK.clone();
  private readonly endCam = new PerspectiveCamera(55, 16 / 9, 0.03, 900);
  private readonly cardAnchors = THOUGHTS.slice(0, NQ).map(() => new Vector3());
  private blinkAt = -10;
  private nextBlink = 1.5;
  private locale: Locale = 'nl';
  private lastT = 0;
  private lastPressure = 0;
  private loaded = false;

  constructor(parent: Object3D, place: Matrix4) {
    this.world.matrixAutoUpdate = false;
    this.world.matrix.copy(place);
    this.unplace = place.clone().invert();
    this.quatToMock.setFromRotationMatrix(this.unplace);
    this.head.scale.setScalar(S);
    this.world.add(this.head);
    parent.add(this.world);
    this.endCam.position.copy(END_POS);
    this.endCam.lookAt(END_LOOK);
    this.endCam.updateMatrixWorld();
    this.world.visible = false;
  }

  /**
   * Builds the scene a part at a time, with `next` between parts (a frame, in the tunnel), so that no frame of the flight
   * waits for all of it: on a weak machine the whole took 170 ms at once.
   */
  async build(next: () => Promise<void>): Promise<void> {
    for (const part of this.parts()) {
      part();
      await next();
    }
  }

  /** The scene's parts, in the order they are built (mock-up 20's sections). */
  private parts(): (() => void)[] {
    const u = this.u, rnd = this.rnd;
    return [
      () => {
        // The stars round it all.
        {
          const pos: number[] = [], sd: number[] = [];
          for (let i = 0; i < 2600; i++) {
            const v = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = mix(260, 520, rnd()), s = Math.sqrt(1 - v * v);
            pos.push(Math.cos(a) * s * r, v * r * 0.7 + 10, Math.sin(a) * s * r);
            sd.push(rnd());
          }
          const g = new BufferGeometry();
          g.setAttribute('position', new Float32BufferAttribute(pos, 3));
          g.setAttribute('aSeed', new Float32BufferAttribute(sd, 1));
          const m = dotsMaterial(u, INK, 0.9);
          m.uniforms.uA.value = 0.55;
          const p = new Points(g, m);
          p.frustumCulled = false;
          this.world.add(p);
        }

        // The portal's last stretch: a shaft straight down, above his head.
        this.tunnelMat = new ShaderMaterial({
          uniforms: { uCamY: { value: 250 }, uA: { value: 1 } },
          vertexShader: /* glsl */ `uniform float uCamY; varying float vA;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = length(mv.xyz);
              float gone = smoothstep(position.y + 30.0, position.y + 10.0, uCamY);
              vA = (1.0 - gone) * smoothstep(0.5, 4.0, d) * (1.0 - smoothstep(70.0, 150.0, d));
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ 'uniform float uA; varying float vA; void main() { gl_FragColor = vec4(0.95, 0.72, 0.3, uA * vA * 0.42); }',
          transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
        });
        {
          const pos: number[] = [];
          const corner = (k: number): [number, number] => [Math.cos(((k + 0.5) * Math.PI) / 4) * RING_R, Math.sin(((k + 0.5) * Math.PI) / 4) * RING_R];
          for (const y of RING_Y) {
            for (let k = 0; k < 8; k++) {
              const a = corner(k), b = corner(k + 1);
              pos.push(a[0], y, a[1], b[0], y, b[1]);
              if (y < RING_Y[RING_Y.length - 1]) pos.push(a[0], y, a[1], a[0], y + 7, a[1]);
            }
          }
          const g = new BufferGeometry();
          g.setAttribute('position', new Float32BufferAttribute(pos, 3));
          const l = new LineSegments(g, this.tunnelMat);
          l.frustumCulled = false;
          this.world.add(l);
        }
      },
      () => {
        // What goes in: everything from the site falls down the shaft and pours into the open skull, a wide torrent.
        const atlas = document.createElement('canvas');
        atlas.width = 1024;
        atlas.height = 512;
        this.glyphAtlas = new CanvasTexture(atlas);
        this.glyphAtlas.flipY = false;
        this.glyphAtlas.anisotropy = 4;
        this.glyphs = glowPoints(this.world, u, 6000, 32, this.glyphAtlas);
        for (let i = 0; i < this.glyphs.n; i++) {
          this.glyphP.push(this.streamParticle());
          this.glyphs.col.set(TINTS[Math.floor(rnd() * TINTS.length)], i * 3);
          this.glyphs.size[i] = mix(0.42, 0.95, rnd() ** 1.6);
          this.glyphs.glyph[i] = Math.floor(rnd() * 128);
        }
        this.dust = glowPoints(this.world, u, 5000, 22);
        for (let i = 0; i < this.dust.n; i++) {
          this.dustP.push({ ...this.streamParticle(), r: Math.sqrt(rnd()) * 1.1 });
          this.dust.col.set(TINTS[Math.floor(rnd() * 4)], i * 3);
          this.dust.size[i] = mix(0.12, 0.28, rnd());
        }
        this.sparks = glowPoints(this.world, u, SPARK_RINGS * SPARK_PER, 30);
        for (let k = 0; k < SPARK_RINGS; k++) {
          for (let j = 0; j < SPARK_PER; j++) {
            const e = Math.floor((j / SPARK_PER) * 8), f = (j / SPARK_PER) * 8 - e;
            const a0 = ((e + 0.5) * Math.PI) / 4, a1 = ((e + 1.5) * Math.PI) / 4, ry = RING_Y[k];
            const home = new Vector3(mix(Math.cos(a0), Math.cos(a1), f) * RING_R, ry, mix(Math.sin(a0), Math.sin(a1), f) * RING_R);
            this.sparkP.push({ y: ry, home, burst: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(5), k: Math.floor(rnd() * 6) });
            const i = k * SPARK_PER + j;
            this.sparks.col.set([1, 0.76, 0.36], i * 3);
            this.sparks.size[i] = mix(0.12, 0.28, rnd());
          }
        }
      },
      () => {
        // The body of the torrent: a soft column of light down the shaft into the skull, with streaks running down it.
        {
          const geo = new CylinderGeometry(1, 1, STREAM_Y0 - OPENING_Y, 28, 220, true);
          geo.translate(0, (STREAM_Y0 + OPENING_Y) / 2, -1);
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i), a = ((STREAM_Y0 - y) / (STREAM_Y0 - OPENING_Y)) * 0.86, r = this.streamR(a) * 0.8;
            pos.setX(i, pos.getX(i) * r);
            pos.setZ(i, (pos.getZ(i) + 1) * r - 1);
          }
          geo.computeVertexNormals();
          this.beamMat = new ShaderMaterial({
            uniforms: { uA: { value: 0 }, uTime: u.uTime },
            vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vDist;
              void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: /* glsl */ `uniform float uA, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vDist;
              void main() {
                float body = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
                float streak = 0.5 + 0.5 * sin(vUv.y * 150.0 + uTime * 7.0 + sin(vUv.x * 18.85) * 2.4);
                float ends = smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
                float a = uA * body * (0.45 + 0.55 * streak) * ends * smoothstep(1.0, 8.0, vDist);
                gl_FragColor = vec4(mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.92, 0.74), streak * body), a * 0.32);
              }`,
            side: DoubleSide, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
          });
          const mesh = new Mesh(geo, this.beamMat);
          mesh.frustumCulled = false;
          this.world.add(mesh);
        }
      },
      () => {
        // Inside: neurons and the network between them.
        const neurons: Vector3[] = [];
        while (neurons.length < 240) {
          const x = mix(-0.56, 0.56, rnd()), y = mix(0.1, 0.88, rnd()), z = mix(-0.74, 0.58, rnd());
          if (brainSdf(x, y, z) < -0.025) neurons.push(new Vector3(x, y, z));
        }
        {
          const seen = new Set<string>();
          neurons.forEach((p, i) => {
            const near = neurons.map((q, j): [number, number] => [p.distanceTo(q), j]).filter(([d, j]) => j !== i && d < 0.24).sort((a, b) => a[0] - b[0]).slice(0, 3);
            for (const [, j] of near) {
              const key = i < j ? `${i}-${j}` : `${j}-${i}`;
              if (!seen.has(key)) {
                seen.add(key);
                this.edges.push([i, j]);
              }
            }
          });
          const pos: number[] = [], shade: number[] = [];
          for (const [i, j] of this.edges) {
            pos.push(...neurons[i].toArray(), ...neurons[j].toArray());
            shade.push(1, 1);
          }
          this.neuralMat = lines(this.head, pos, shade, WARM).material;
        }
        for (const p of neurons) this.neuronsW.push(p.clone().multiplyScalar(S));
        this.nodes = glowPoints(this.world, u, neurons.length);
        this.neuronsW.forEach((p, i) => {
          this.nodes.at(i, p);
          this.nodes.col.set([1, 0.8, 0.5], i * 3);
          this.nodes.size[i] = 0.16;
        });
        this.nodes.touch(true);
        this.pulses = glowPoints(this.world, u, 460);
        for (let i = 0; i < this.pulses.n; i++) {
          this.pulseP.push({ e: Math.floor(rnd() * this.edges.length), ph: rnd(), sp: mix(0.5, 1.4, rnd()), dir: rnd() < 0.5 });
          this.pulses.col.set([1, 0.86, 0.6], i * 3);
          this.pulses.size[i] = mix(0.1, 0.2, rnd());
        }
        this.pulses.touch(true);
      },
      () => {
        // Each thought is one bright neuron: a body and its branches, with signals running in.
        for (const thought of THOUGHTS) {
          const c = new Vector3(...thought.c), pos: number[] = [], shade: number[] = [], tips: Vector3[] = [];
          const grow = (from: Vector3, dir: Vector3, len: number, depth: number): void => {
            const to = from.clone().addScaledVector(dir, len);
            pos.push(from.x, from.y, from.z, to.x, to.y, to.z);
            shade.push(1 - depth * 0.3, 1 - (depth + 1) * 0.3);
            if (depth < 2) for (let b = 0; b < 2; b++) grow(to, dir.clone().add(new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.2)).normalize(), len * 0.64, depth + 1);
            else tips.push(to.clone().multiplyScalar(S));
          };
          for (let b = 0; b < 7; b++) grow(c, new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), mix(0.055, 0.09, rnd()), 0);
          this.clusters.push({ cw: W(...thought.c), m: lines(this.head, pos, shade, new Color(1, 0.84, 0.56)).material, tips });
        }
        this.somas = glowPoints(this.world, u, this.clusters.length, 60);
        this.clusters.forEach((cl, k) => {
          this.somas.pos.set(cl.cw.toArray(), k * 3);
          this.somas.col.set([1, 0.88, 0.62], k * 3);
        });
        this.inward = glowPoints(this.world, u, this.clusters.length * 24);
        for (let i = 0; i < this.inward.n; i++) {
          const k = Math.floor(i / 24);
          this.inwardP.push({ k, tip: Math.floor(rnd() * this.clusters[k].tips.length), ph: rnd(), sp: mix(0.6, 1.3, rnd()) });
          this.inward.col.set([1, 0.9, 0.7], i * 3);
          this.inward.size[i] = mix(0.08, 0.16, rnd());
        }
        this.inward.touch(true);

        // One object of light for each answer, beside its thought.
        THOUGHTS.slice(0, NQ).forEach((thought, k) => {
          const { positions, shade } = objectSegments(thought.object!);
          const g = new Group();
          g.position.copy(this.clusters[k].cw);
          g.scale.setScalar(1.15);
          this.world.add(g);
          this.objects.push({ g, m: lines(g, positions, shade, new Color(1, 0.9, 0.68)).material, spin: rnd() * 6 });
        });
      },
      () => {
        // The eyes' nerves, back to the visual cortex.
        EYES.forEach((e, n) => {
          const k = n === 0 ? 1 : -1;
          const curve = new CatmullRomCurve3([W(e.x, e.y, e.z - 0.05), W(k * 0.17, 0.1, 0.44), W(0, 0.12, 0.28), W(-k * 0.12, 0.17, 0.04), W(-k * 0.2, 0.3, -0.36), W(-k * 0.08, 0.44, -0.62)], false, 'centripetal');
          const pos: number[] = [], shade: number[] = [];
          for (let st = 0; st < 4; st++) {
            const off = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.35);
            let prev: Vector3 | null = null;
            for (let j = 0; j <= 120; j++) {
              const a = j / 120, p = curve.getPoint(a).addScaledVector(off, Math.sin(Math.PI * a));
              if (prev) {
                pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
                shade.push(0.6, 0.6);
              }
              prev = p;
            }
          }
          this.optic.push({ curve, m: lines(this.world, pos, shade, WARM).material });
        });
        this.opticPulses = glowPoints(this.world, u, 2 * 34);
        for (let i = 0; i < this.opticPulses.n; i++) {
          this.opticP.push({ c: i % 2, ph: rnd(), sp: mix(0.35, 0.65, rnd()), o: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.4) });
          this.opticPulses.col.set([1, 0.9, 0.66], i * 3);
          this.opticPulses.size[i] = mix(0.12, 0.22, rnd());
        }
        this.opticPulses.touch(true);

        // The paths between the thoughts: bundles of fibres; the last runs the long way down to the mouth.
        this.fiberPulses = glowPoints(this.world, u, 7 * 22);
        for (let i = 0; i < 7; i++) {
          const A = W(...THOUGHTS[i].c);
          const pts = i < 6 ? [A, this.corridor(i).add(new Vector3(0, -0.5, 0)), W(...THOUGHTS[i + 1].c)] : [A, ...DOWN.map((p) => W(p[0] + 0.03, p[1] - 0.03, p[2])), this.mouth.clone()];
          const curve = new CatmullRomCurve3(pts, false, 'centripetal');
          const pos: number[] = [], shade: number[] = [], offs: Vector3[] = [];
          const steps = i < 6 ? 90 : 200;
          for (let s = 0; s < 6; s++) {
            const off = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.55), ph = rnd() * 6.28;
            offs.push(off);
            let prev: Vector3 | null = null;
            for (let j = 0; j <= steps; j++) {
              const a = j / steps, p = curve.getPoint(a).addScaledVector(off, Math.sin(Math.PI * a) * (0.8 + 0.4 * Math.sin(a * 9 + ph)));
              if (prev) {
                pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
                shade.push(0.5 + 0.5 * Math.sin(Math.PI * (a - 1 / steps)), 0.5 + 0.5 * Math.sin(Math.PI * a));
              }
              prev = p;
            }
          }
          this.fibers.push({ curve, offs, m: lines(this.world, pos, shade, WARM).material });
        }
        for (let i = 0; i < this.fiberPulses.n; i++) {
          this.fiberPulseP.push({ f: Math.floor(i / 22), ph: rnd(), sp: mix(0.35, 0.7, rnd()), o: Math.floor(rnd() * 6) });
          this.fiberPulses.col.set([1, 0.88, 0.62], i * 3);
          this.fiberPulses.size[i] = mix(0.12, 0.22, rnd());
        }
        this.fiberPulses.touch(true);
      },
      () => {
        // The mouth: a light outside the lips, the rings that frame them from inside.
        this.outsideLight = lightSprite(this.world, 9);
        this.outsideLight.position.copy(this.mouth).add(new Vector3(0, 0, 4));
        this.outsideLight.scale.set(9, 5, 1);
        {
          const g = new Group(), pos: number[] = [], shade: number[] = [];
          for (const [k, sh] of [[1, 1], [1.12, 0.55], [1.3, 0.25]] as const) {
            for (let i = 0; i < 72; i++) {
              for (const j of [i, i + 1]) {
                const a = (j / 72) * Math.PI * 2, x = Math.cos(a) * (MOUTH_W + 0.01) * k;
                pos.push(x, Math.sin(a) * k, MOUTH_Z - 1.3 * x * x);
                shade.push(sh);
              }
            }
          }
          this.lipRings = { g, m: lines(g, pos, shade, new Color(1, 0.86, 0.6)).material };
          this.head.add(g);
        }
        // The thought going down with you, from Broca's area the long way to the mouth.
        this.voice = glowPoints(this.world, u, 900, 30);
        for (let i = 0; i < this.voice.n; i++) {
          this.voiceP.push({ a0: rnd(), sp: mix(0.05, 0.1, rnd()), o: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.6) });
          this.voice.col.set(rnd() < 0.7 ? [1, 0.78, 0.4] : [0.96, 0.93, 0.87], i * 3);
          this.voice.size[i] = mix(0.08, 0.24, rnd() ** 2);
        }
        this.voice.touch(true);
        this.voiceCurve = new CatmullRomCurve3([W(...THOUGHTS[6].c), ...DOWN.map((p) => W(...p)), this.mouth.clone()], false, 'centripetal');
        // The spray: a little escaping at the seam of the lips, then the spark's trail.
        this.spray = glowPoints(this.world, u, 1600, 26);
        for (let i = 0; i < this.spray.n; i++) {
          this.sprayP.push({ life: mix(0.5, 1, rnd()), o: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.8) });
          this.spray.col.set(rnd() < 0.65 ? [1, 0.82, 0.5] : [0.95, 0.95, 1.0], i * 3);
          this.spray.size[i] = mix(0.06, 0.26, rnd() ** 2);
        }
        this.spray.touch(true);
        // The words: a swarm carried down with you, packed tight behind the lips, then in the spark.
        this.letters = glowPoints(this.world, u, 1000, 18);
        for (let i = 0; i < this.letters.n; i++) {
          this.letterP.push({ o: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(Math.cbrt(rnd()) * 1.1) });
          this.letters.col.set(rnd() < 0.85 ? [1, 0.8, 0.45] : [0.97, 0.94, 0.88], i * 3);
          this.letters.size[i] = mix(0.08, 0.16, rnd()) * DEPTH_SCALE;
        }
        this.letters.touch(true);
        // The bang's sparks and its seed of light (its gas, galaxies and rings are the soft bang's, softBang.ts).
        this.bangSparks = glowPoints(this.world, u, 1500, 22);
        for (let i = 0; i < this.bangSparks.n; i++) {
          const d = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
          this.bangP.push({ d, sp: mix(4, 22, rnd() ** 1.5) * (rnd() < 0.18 ? 3.2 : 1), drift: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.4) });
          this.bangSparks.col.set(rnd() < 0.6 ? [1, 0.8, 0.45] : [0.85, 0.9, 1.0], i * 3);
          this.bangSparks.size[i] = mix(0.06, 0.16, rnd()) * DEPTH_SCALE;
        }
        this.bangSparks.touch(true);
        this.core = lightSprite(this.world, 2);
      },
    ];
  }

  /** Loads the baked head and the words that pour in, and draws the cards; `next` between its heavier steps. */
  async load(url: string, locale: Locale, next: () => Promise<void> = async () => {}): Promise<void> {
    this.locale = locale;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`head.bin: ${response.status}`);
    const parts = decodeHead(await response.arrayBuffer());
    await next();
    const part = (name: string) => parts.find((p) => p.name === name)!;
    const meshOf = (name: string): BufferGeometry => {
      const p = part(name), g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(p.positions, 3));
      if (p.normals) g.setAttribute('normal', new BufferAttribute(p.normals, 3));
      g.setAttribute('aPiece', new BufferAttribute(p.extra ?? new Float32Array(p.positions.length / 3), 1));
      if (p.index) g.setIndex(new BufferAttribute(p.index, 1));
      return g;
    };
    this.skinMat = xrayMaterial(this.u, GOLD, { kind: 0, hole: true, jaw: true, split: true });
    const skin = new Mesh(meshOf('skin'), this.skinMat);
    this.brainMat = xrayMaterial(this.u, WARM, { kind: 2, strength: 0.8 });
    const brain = new Mesh(meshOf('brain'), this.brainMat);
    const dust = part('brainDust'), dg = new BufferGeometry();
    dg.setAttribute('position', new BufferAttribute(dust.positions, 3));
    dg.setAttribute('aSeed', new BufferAttribute(dust.extra!, 1));
    this.dustMat = dotsMaterial(this.u, INK, 0.05, true);
    const dustPoints = new Points(dg, this.dustMat);
    for (const object of [skin, brain, dustPoints]) {
      object.frustumCulled = false;
      this.head.add(object);
    }
    await next();
    await Promise.all([document.fonts.load('800 60px Barlow'), document.fonts.load("500 46px 'IBM Plex Mono'")]);
    this.drawAtlas();
    await next();
    this.buildCards(locale);
    this.loaded = true;
  }

  /** The words that pour in, in another language. */
  setLocale(locale: Locale): void {
    if (locale === this.locale || !this.loaded) return;
    this.locale = locale;
    this.buildCards(locale);
  }

  /** The shown share of the head's many points, at this step of the speed ladder. */
  setQuality(quality: JourneyQuality): void {
    const share = (points: GlowPoints, of: number): void => {
      points.points.geometry.setDrawRange(0, Math.max(1, Math.round(points.n * of)));
    };
    share(this.glyphs, quality.stars);
    share(this.dust, quality.stars);
    share(this.bangSparks, quality.stars);
  }

  /** The size of a point on the page: from the canvas's height in device pixels and the lens. */
  setPixels(heightPx: number, fov: number): void {
    this.u.uPx.value = heightPx / (2 * Math.tan((fov * Math.PI) / 360));
  }

  show(on: boolean): void {
    this.world.visible = on && this.loaded;
  }

  /**
   * Draws the scene for the first time in batches, `next` between them, so each part's buffers go to the GPU in a frame of
   * their own and none waits for all of them (on a weak machine the whole took 70 ms at once). `draw` draws the tunnel's
   * picture; its shaders are built already. Leaves the scene hidden.
   */
  async warm(draw: () => void, next: () => Promise<void>, batch = 10): Promise<void> {
    const parts = [...this.world.children];
    for (const part of parts) part.visible = false;
    this.world.visible = true;
    for (let i = 0; i < parts.length; i += batch) {
      const some = parts.slice(i, i + batch);
      for (const part of some) part.visible = true;
      draw();
      for (const part of some) part.visible = false;
      await next();
    }
    for (const part of parts) part.visible = true;
    this.world.visible = false;
  }

  /**
   * Where the spark lands: the top middle of the scan report on the page (CSS px), at the depth the ride ends at. The page
   * measures it on load and on every resize.
   */
  setLanding(x: number, y: number, width: number, height: number, fov: number): void {
    this.endCam.fov = fov;
    this.endCam.aspect = width / Math.max(1, height);
    this.endCam.updateProjectionMatrix();
    const tanV = Math.tan((fov * Math.PI) / 360), tanH = tanV * this.endCam.aspect;
    const nx = (x / width) * 2 - 1, ny = -((y / height) * 2 - 1);
    this.landing.set(nx * END_DEPTH * tanH, ny * END_DEPTH * tanV, -END_DEPTH).applyMatrix4(this.endCam.matrixWorld);
    this.core.position.copy(this.landing);
  }

  /** Where the landing stands in the tunnel's world, for the soft bang. */
  landingWorld(out: Vector3): Vector3 {
    return out.copy(this.landing).applyMatrix4(this.world.matrix);
  }

  /** The view from where the ride ends, in the tunnel's world, for standing the soft bang round the report. */
  endView(out: PerspectiveCamera): PerspectiveCamera {
    out.fov = this.endCam.fov;
    out.aspect = this.endCam.aspect;
    out.updateProjectionMatrix();
    out.matrixWorld.multiplyMatrices(this.world.matrix, this.endCam.matrixWorld).decompose(out.position, out.quaternion, out.scale);
    out.updateMatrixWorld(true);
    return out;
  }

  /** Each answer's anchor at its stop: a point at the page's left column, at the thought's depth (mock `placeAnchors`). */
  placeCards(track: (t: number, out: Pose) => Pose, width: number, height: number, phone: boolean, fov: number): void {
    const colPx = phone ? 18 : Math.max(48, width * 0.08);
    const cam = new PerspectiveCamera(fov, width / Math.max(1, height), 0.03, 900);
    const o: Pose = { pos: new Vector3(), look: new Vector3(), up: new Vector3() };
    this.cardAnchors.forEach((anchor, i) => {
      track(dwellT(i), o);
      cam.position.copy(o.pos);
      cam.up.copy(o.up);
      cam.lookAt(o.look);
      cam.updateMatrixWorld();
      const fwd = tmp2.copy(o.look).sub(o.pos).normalize();
      const cluster = tmp3.copy(this.clusters[i].cw).applyMatrix4(this.world.matrix);
      const D = cluster.distanceTo(o.pos) * 0.85;
      const ray = new Vector3((colPx / width) * 2 - 1, 0, 0.5).unproject(cam).sub(cam.position).normalize();
      anchor.copy(o.pos).addScaledVector(ray, D / ray.dot(fwd));
    });
  }

  /** Where the page's parts stand this frame. */
  anchors(camera: PerspectiveCamera, width: number, height: number, out: HeadAnchors): HeadAnchors {
    const project = (v: Vector3): [number, number, boolean] => {
      toPage.copy(v).applyMatrix4(camera.matrixWorldInverse);
      const inFront = toPage.z < 0;
      toPage.copy(v).project(camera);
      return [(toPage.x * 0.5 + 0.5) * width, (-toPage.y * 0.5 + 0.5) * height, inFront];
    };
    out.labels = this.clusters.slice(0, NQ).map((cl) => {
      const [x, y] = project(tmp.copy(cl.cw).applyMatrix4(this.world.matrix));
      return [x, y];
    });
    out.cards = [];
    out.cardsInFront = [];
    for (const anchor of this.cardAnchors) {
      const [x, y, inFront] = project(anchor);
      out.cards.push([x, y]);
      out.cardsInFront.push(inFront);
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of [[0, 1.25, -0.2], [0, 1.0, 0.6], [0, 0.6, -1.05], [0, -0.3, 0.95], [0, -1.0, 0.62], [0, -1.15, -0.25], [0.78, 0.4, 0], [-0.78, 0.4, 0]] as const) {
      const [x, y] = project(W(p[0], p[1], p[2]).applyMatrix4(this.world.matrix));
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    out.headBox = { left: x0, right: x1, top: y0, bottom: y1 };
    const [sx, sy] = project(tmp.copy(this.sparkAt).applyMatrix4(this.world.matrix));
    out.spark = [sx, sy];
    camLocal.copy(camera.position).applyMatrix4(this.unplace).divideScalar(S);
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion).applyQuaternion(this.quatToMock);
    out.you = [camLocal.z, camLocal.y];
    out.youDir = [camFwd.z, camFwd.y];
    const [, scanY] = project(W(0, this.u.uScanY.value, 0).applyMatrix4(this.world.matrix));
    out.scan = { y: scanY, on: this.u.uScanOn.value, head: this.u.uScanY.value };
    out.act = this.u.uAct.value;
    return out;
  }

  update({ t, time, dt, camera, reduce }: HeadInput): void {
    if (!this.loaded) return;
    const u = this.u, now = reduce ? 0 : time;
    u.uTime.value = now;
    camLocal.copy(camera.position).applyMatrix4(this.unplace);
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion).applyQuaternion(this.quatToMock);
    camUp.copy(camera.up).applyQuaternion(this.quatToMock);
    u.uAxis.value.copy(camFwd);

    const inside = smooth(0.302, 0.318, t) * (1 - smooth(0.902, 0.912, t));
    const endOn = smooth(0.93, 0.955, t);
    const focusBrain = smooth(0.198, 0.235, t) * (1 - inside);
    const qaPhase = smooth(0.33, 0.35, t);
    const pressure = smooth(HOLD_IN[0], HOLD_IN[1], t) * (1 - smooth(SPIT_T, SPIT_T + 0.004, t));
    this.lastT = t;
    this.lastPressure = pressure;
    // The head shakes with the pressure once you are outside it.
    this.head.position.set(Math.sin(time * 53) * 0.07, Math.sin(time * 41 + 2) * 0.05, 0).multiplyScalar(reduce ? 0 : pressure * pressure * smooth(0.9, 0.91, t));

    // The lid opens as the information arrives, and closes deep inside.
    u.uOpen.value = inOut(smooth(0.11, 0.18, t)) * (1 - inOut(smooth(0.6, 0.74, t)));
    u.uSeam.value = smooth(0.1, 0.13, t) * (1 - smooth(0.6, 0.76, t)) * (0.6 + 0.4 * Math.sin(now * 3)) * (1 - 0.75 * inside) + 0.25 * endOn;
    // The scan: a slice sweeps up from the neck to the crown and leaves the head drawn behind it; then a slow sweep now and again.
    const rev = clamp((t - 0.09) / 0.055);
    u.uRevealY.value = mix(-2.15, 1.4, rev);
    if (t > 0.09 && t < 0.147) {
      u.uScanY.value = u.uRevealY.value;
      u.uScanOn.value = 1;
    } else {
      const ph = (now / 6.5) % 1;
      u.uScanY.value = mix(-1.55, 1.35, ph);
      u.uScanOn.value = t >= 0.147 ? 0.4 * bump(0, 1, ph) * (1 - inside) * (1 - smooth(0.93, 0.95, t)) : 0;
    }
    // The eyes follow you.
    const gazeAt = tmp.copy(camLocal).divideScalar(S);
    [u.uGazeL.value, u.uGazeR.value].forEach((g, n) => {
      g.copy(gazeAt).sub(EYES[n]);
      if (g.z < 0.05) g.set(0, 0, 1);
      else {
        g.normalize();
        if (Math.acos(clamp(g.z, -1, 1)) > 0.5) {
          const s = Math.sin(0.5) / Math.max(1e-6, Math.hypot(g.x, g.y));
          g.set(g.x * s, g.y * s, Math.cos(0.5));
        }
      }
    });

    // Where he is thinking: each part fills as the information arrives, flares as the scanner names it, burns while you read it.
    const dw = dwellWeights(t);
    const listen = endOn * (0.25 + 0.15 * Math.sin(now * 1.4));
    for (let k = 0; k < NQ; k++) {
      const fill = smooth(0.13 + 0.011 * k, 0.19 + 0.011 * k, t) * (1 - 0.6 * qaPhase);
      const lt = 0.205 + 0.008 * k, lab = bump(lt, lt + 0.03, t);
      u.uAct.value[k] = (0.55 * fill + 0.5 * lab + dw[k]) * (0.85 + 0.15 * Math.sin(now * 2.3 + k * 1.7)) * (1 - smooth(0.935, 0.96, t)) + listen * 0.6;
    }
    u.uAct.value[6] = (dw[6] + 0.7 * smooth(0.8, 0.82, t) * (1 - smooth(0.84, 0.86, t))) * (1 - smooth(0.935, 0.96, t)) + listen * 0.4;

    // While you read, the brain falls back and the answer has the page.
    let reading = 0;
    for (let i = 0; i < NQ; i++) reading = Math.max(reading, answerShown(t, i));
    this.skinMat!.uniforms.uA.value = mix(1, 0.3, focusBrain) * mix(1, 0.5, inside) * (1 - 0.6 * reading) * mix(1, 0.75, endOn);
    const brainA = mix(0.5, 1, smooth(0.12, 0.2, t)) * (1 - 0.68 * reading) * (1 - 0.55 * smooth(0.85, 0.9, t)) + endOn * 0.35;
    this.brainMat!.uniforms.uA.value = brainA;
    this.dustMat!.uniforms.uA.value = 0.55 * brainA;
    const brainOn = mix(0.4, 1, smooth(0.12, 0.2, t));
    const visible = smooth(0.09, 0.15, t);
    this.neuralMat.uniforms.uA.value = 0.22 * brainOn * visible * (1 - 0.85 * reading) * (1 - 0.5 * endOn);

    // What goes in.
    const streamOn = smooth(0.0, 0.04, t) * (1 - smooth(0.23, 0.29, t));
    for (let i = 0; i < this.glyphs.n; i++) {
      const p = this.glyphP[i], a = (p.a0 + now * p.sp) % 1;
      this.streamPos(p, a, now, tmp);
      this.glyphs.at(i, tmp);
      this.glyphs.alpha[i] = streamOn * smooth(0, 0.04, a) * (1 - smooth(0.95, 1, a)) * (0.85 + 1.3 * bump(0.84, 0.98, a));
    }
    this.glyphs.touch();
    for (let i = 0; i < this.dust.n; i++) {
      const p = this.dustP[i], a = (p.a0 + now * p.sp * 1.1) % 1;
      this.streamPos(p, a, now, tmp);
      this.dust.at(i, tmp);
      this.dust.alpha[i] = streamOn * smooth(0, 0.04, a) * (1 - smooth(0.94, 1, a)) * 0.85;
    }
    this.dust.touch();
    this.beamMat.uniforms.uA.value = streamOn;
    for (const c of this.cards) {
      const a = (c.p.a0 + now * c.p.sp) % 1;
      this.streamPos(c.p, a, now, c.s.position);
      c.s.material.opacity = streamOn * smooth(0.04, 0.12, a) * (1 - smooth(0.78, 0.88, a)) * 0.9 * smooth(5, 12, c.s.position.distanceTo(camLocal));
    }
    for (let i = 0; i < this.sparks.n; i++) {
      const s = this.sparkP[i], gn = smooth(s.y + 30, s.y + 6, camLocal.y), f = gn * gn * (3 - 2 * gn);
      tmp.copy(s.home).addScaledVector(s.burst, Math.sin(Math.PI * gn) * 0.8).lerp(this.regionW[s.k], f * 0.85);
      this.sparks.at(i, tmp);
      this.sparks.alpha[i] = gn > 0.001 && gn < 0.999 ? Math.sin(Math.PI * gn) * (1 - smooth(0.2, 0.3, t)) : 0;
    }
    this.sparks.touch();

    // Neurons, the thoughts and the paths between them.
    for (let i = 0; i < this.pulses.n; i++) {
      const p = this.pulseP[i], f = (p.ph + now * p.sp) % 1, [a, b] = this.edges[p.e];
      tmp.copy(this.neuronsW[p.dir ? a : b]).lerp(this.neuronsW[p.dir ? b : a], f);
      this.pulses.at(i, tmp);
      this.pulses.alpha[i] = brainOn * 0.75 * visible * Math.sin(Math.PI * f) * (1 - 0.85 * reading) * (1 - 0.4 * endOn) * (1 + 0.8 * streamOn);
      if (f < 0.01) {
        p.e = Math.floor(this.rnd() * this.edges.length);
        p.dir = this.rnd() < 0.5;
      }
    }
    this.pulses.touch();
    for (let i = 0; i < this.nodes.n; i++) this.nodes.alpha[i] = brainOn * 0.28 * visible * (1 - 0.8 * reading) * (0.6 + 0.4 * Math.sin(now * 1.3 + i));
    this.nodes.touch();
    const seen = smooth(0.12, 0.2, t);
    this.clusters.forEach((cl, k) => {
      const act = clamp(u.uAct.value[k]);
      cl.m.uniforms.uA.value = seen * (0.12 + 0.75 * act) * (1 - 0.75 * dw[k]);
      this.somas.alpha[k] = seen * (0.25 + 0.75 * act) * (1 - 0.7 * dw[k]);
      this.somas.size[k] = 0.3 + 0.35 * act * (1 + 0.15 * Math.sin(now * 6 + k));
    });
    this.somas.touch(true);
    for (let i = 0; i < this.inward.n; i++) {
      const p = this.inwardP[i], f = (p.ph + now * p.sp) % 1, cl = this.clusters[p.k];
      tmp.copy(cl.tips[p.tip]).lerp(cl.cw, f);
      this.inward.at(i, tmp);
      this.inward.alpha[i] = seen * clamp(u.uAct.value[p.k]) * Math.sin(Math.PI * f) * (1 - 0.85 * dw[p.k]);
      if (f < 0.02) p.tip = Math.floor(this.rnd() * cl.tips.length);
    }
    this.inward.touch();
    const fiberW = this.fibers.map((_, i) => {
      if (i < 6) {
        const T0 = dwellT(i), T1 = dwellT(i + 1);
        return smooth(T0 - HOLD, T0, t) * (1 - smooth(T1, T1 + 0.012, t));
      }
      return smooth(0.79, 0.81, t) * (1 - smooth(0.885, 0.91, t));
    });
    this.fibers.forEach((f, i) => {
      f.m.uniforms.uA.value = (1 - smooth(0.93, 0.95, t)) * (0.07 * seen * (1 - 0.9 * reading) + 0.55 * fiberW[i] * (1 - 0.85 * reading));
    });
    for (let i = 0; i < this.fiberPulses.n; i++) {
      const p = this.fiberPulseP[i], f = (p.ph + now * p.sp) % 1, fb = this.fibers[p.f];
      fb.curve.getPoint(f, tmp).addScaledVector(fb.offs[p.o], Math.sin(Math.PI * f));
      this.fiberPulses.at(i, tmp);
      this.fiberPulses.alpha[i] = (1 - smooth(0.93, 0.95, t)) * (0.12 * seen + 0.85 * fiberW[p.f]) * (1 - 0.85 * reading) * Math.sin(Math.PI * f);
    }
    this.fiberPulses.touch();
    this.objects.forEach((o, k) => {
      o.g.rotation.y = o.spin + now * 0.5;
      o.g.rotation.x = 0.25 * Math.sin(now * 0.6 + k);
      const lt = 0.205 + 0.008 * k;
      o.m.uniforms.uA.value = clamp(dw[k] * 0.8 + 0.8 * bump(lt, lt + 0.03, t) + 0.35 * smooth(0.13 + 0.011 * k, 0.19 + 0.011 * k, t) * (1 - qaPhase)) * (1 - smooth(0.93, 0.95, t));
    });
    // The eyes: a blink now and then; a glow and light down the optic nerves while they take things in.
    if (!reduce && time > this.nextBlink) {
      this.blinkAt = time;
      this.nextBlink = time + 2.6 + Math.random() * 3.6;
    }
    u.uBlink.value = bump(this.blinkAt, this.blinkAt + 0.2, time);
    const seeing = clamp(streamOn * 0.9 + endOn * 0.18);
    u.uEyeGlow.value = seeing;
    u.uAct.value[7] = seeing * 0.8 * (1 - inside);
    for (const o of this.optic) o.m.uniforms.uA.value = seeing * 0.45 * (1 - 0.8 * inside);
    for (let i = 0; i < this.opticPulses.n; i++) {
      const p = this.opticP[i], f = (p.ph + now * p.sp) % 1;
      this.optic[p.c].curve.getPoint(f, tmp).addScaledVector(p.o, Math.sin(Math.PI * f));
      this.opticPulses.at(i, tmp);
      this.opticPulses.alpha[i] = seeing * (1 - 0.8 * inside) * Math.sin(Math.PI * f);
    }
    this.opticPulses.touch();

    // The mouth.
    const spitOpen = smooth(SPIT_T - 0.002, SPIT_T + 0.004, t) * (1 - smooth(0.952, 0.972, t));
    u.uJaw.value = spitOpen * 0.22;
    u.uMouth.value = 0.012 + spitOpen * 0.075;
    u.uPuff.value = pressure;
    u.uLip.value = smooth(0.86, 0.885, t) * (1 - smooth(0.952, 0.97, t)) * (0.5 + 0.5 * pressure);
    this.outsideLight.material.opacity = smooth(0.87, 0.89, t) * (1 - smooth(0.9, 0.91, t)) * (0.15 + 0.7 * pressure + 0.8 * spitOpen) * smooth(2.5, 9, camLocal.distanceTo(this.outsideLight.position));
    const drop = u.uJaw.value * 1.15;
    this.lipRings.g.position.y = MOUTH_Y - drop * 0.5;
    this.lipRings.g.scale.y = Math.max(u.uMouth.value + drop * 0.5, 0.006);
    this.lipRings.m.uniforms.uA.value = u.uLip.value * 0.95 * (1 - smooth(0.905, 0.915, t));
    this.tunnelMat.uniforms.uCamY.value = camLocal.y;
    this.tunnelMat.uniforms.uA.value = 1 - smooth(0.2, 0.3, t);

    // The thought, down with you; then the spray.
    const thoughtOn = smooth(0.79, 0.82, t) * (1 - smooth(0.9, 0.92, t));
    for (let i = 0; i < this.voice.n; i++) {
      const s = this.voiceP[i], a = (s.a0 + now * s.sp * 0.6) % 1;
      this.voiceCurve.getPoint(a, tmp).addScaledVector(s.o, 0.5 + 0.5 * Math.sin(Math.PI * a));
      this.voice.at(i, tmp);
      this.voice.alpha[i] = thoughtOn * smooth(0, 0.05, a) * (1 - smooth(0.92, 1, a)) * 0.85;
    }
    this.voice.touch();
    const tau = Math.max(0, (t - SPIT_T) / 0.035);
    for (let i = 0; i < this.spray.n; i++) {
      const s = this.sprayP[i];
      let al = 0;
      if (tau > 0) {
        // the spark's trail
        const f = clamp((t - SPIT_T) / 0.018 - s.life * 0.25);
        if (f > 0 && f < 1) {
          this.sparkPos(f, tmp).addScaledVector(s.o, 1.2 + 3 * (s.life - 0.5));
          al = (1 - f) * 0.7;
        }
      } else if (i < 160 && pressure > 0.3) {
        // a little escaping at the seam of the lips while he holds it in
        const f = (now * (0.8 + s.life) + i * 0.618) % 1;
        tmp.set(this.mouth.x + s.o.x * 3.6, this.mouth.y + s.o.y * 0.25, this.mouth.z + 0.2 + f * 2.2);
        al = (pressure - 0.3) * (1 - f);
      }
      this.spray.at(i, tmp);
      this.spray.alpha[i] = al * (1 - smooth(0.975, 0.99, t));
    }
    this.spray.touch();
    if (t >= SPIT_T) this.sparkPos(clamp((t - SPIT_T) / 0.018), this.sparkAt);
    else this.sparkAt.copy(this.mouth);

    // The spark: it stops at the top of the report and burns hotter, then opens into the scan line (the page draws that).
    const g2 = smooth(0.95, 0.958, t);
    if (t < 0.958) {
      this.core.material.opacity = g2 * (0.6 + 0.3 * Math.sin(now * 40));
      this.core.scale.setScalar((3.2 - 2.2 * g2) * DEPTH_SCALE);
    } else {
      this.core.material.opacity = 0.9 * (1 - smooth(0.958, 0.963, t));
      this.core.scale.setScalar(1.6 * DEPTH_SCALE);
    }
    const b = smooth(0.958, 0.99, t);
    for (let i = 0; i < this.bangSparks.n; i++) {
      const s = this.bangP[i], r = (1 - Math.pow(1 - b, 3)) * s.sp * DEPTH_SCALE;
      tmp.copy(this.landing).addScaledVector(s.d, r).addScaledVector(s.drift, Math.sin(now * 0.3 + i) * 2 * b * DEPTH_SCALE);
      this.bangSparks.at(i, tmp);
      this.bangSparks.alpha[i] = 0.25 * (b > 0 ? (bump(0, 0.25, b) * 0.6 + 0.3 * smooth(0.3, 1, b)) * (0.7 + 0.3 * Math.sin(now * 2 + i)) : 0);
    }
    this.bangSparks.touch();

    // The words: carried down inside you as a swarm, squeezed tight behind the lips, then packed into the spark.
    const swarmOn = smooth(0.8, 0.83, t);
    for (let i = 0; i < this.letters.n; i++) {
      const p = this.letterP[i];
      let alpha: number;
      if (t >= SPIT_T) {
        const g = smooth(0.95, 0.958, t);
        this.sparkPos(clamp((t - SPIT_T) / 0.018), tmp).addScaledVector(p.o, (0.35 + 0.2 * Math.sin(now * 5 + i)) * (1 - 0.75 * g) + 0.06 * g * Math.sin(now * 40 + i));
        alpha = 0.9 + 0.1 * g;
      } else {
        const squeeze = mix(1, 0.35, pressure);
        tmp.copy(camLocal).addScaledVector(camFwd, mix(3.2, 1.6, pressure)).addScaledVector(camUp, -0.7 * (1 - pressure)).addScaledVector(p.o, squeeze * (1 + 0.15 * Math.sin(now * 3 + i)));
        if (t > HOLD_IN[0] - 0.01) {
          tmp3.copy(this.mouth).add(tmp2.set(0, 0, -1.3)).add(tmp2.set(p.o.x * mix(1.6, 2.4, pressure), p.o.y * mix(0.9, 0.35, pressure), p.o.z * 0.4));
          tmp.lerp(tmp3, smooth(HOLD_IN[0] - 0.01, HOLD_IN[0] + 0.01, t));
        }
        alpha = swarmOn * mix(0.32, 0.6, pressure);
      }
      this.letters.at(i, tmp);
      this.letters.alpha[i] = alpha * (0.8 + 0.2 * Math.sin(now * 2 + i)) * (1 - smooth(0.955, 0.96, t));
    }
    this.letters.touch();
    void dt;
  }

  /** Where the head is, for the proof harness: its t, the answer being read (-1 for none), the pressure behind the lips, and the language of the words that pour in. */
  report(spark: [number, number]): HeadReport {
    let active = -1;
    for (let i = 0; i < NQ; i++) if (answerShown(this.lastT, i) > 0.5) active = i;
    return { t: this.lastT, active, pressure: this.lastPressure, locale: this.locale, open: this.u.uOpen.value, spark: [spark[0], spark[1]] };
  }

  dispose(): void {
    this.world.removeFromParent();
    this.world.traverse((object) => {
      const withGeometry = object as Partial<Mesh>;
      withGeometry.geometry?.dispose();
      const material = withGeometry.material as { dispose?: () => void } | undefined;
      material?.dispose?.();
    });
    this.glyphAtlas?.dispose();
    for (const c of this.cards) (c.s.material.map as CanvasTexture | null)?.dispose();
  }

  // ---------------------------------------------------------------- the stream

  private streamParticle(): StreamParticle {
    const rnd = this.rnd;
    return { a0: rnd(), sp: mix(0.05, 0.085, rnd()), ang: rnd() * Math.PI * 2, r: Math.sqrt(rnd()), k: Math.floor(rnd() * 6), jx: (rnd() - 0.5) * 1.6, jy: (rnd() - 0.5) * 1.6, jz: (rnd() - 0.5) * 1.6 };
  }

  private streamR(a: number): number {
    return mix(10, 5.4, smooth(0, 0.8, a)) * (1 - smooth(0.88, 1, a));
  }

  /** A piece of the stream at `a0` of its way down: quick down the shaft, crowding into view at the skull, then to its region. */
  private streamPos(p: StreamParticle, a0: number, time: number, out: Vector3): Vector3 {
    const a = 1 - Math.pow(1 - a0, 1.8);
    const tg = this.regionW[p.k], e = smooth(0.82, 1, a);
    const y = a < 0.86 ? mix(STREAM_Y0, OPENING_Y, a / 0.86) : mix(OPENING_Y, tg.y + p.jy, smooth(0.86, 1, a));
    const R = this.streamR(a) * p.r, th = p.ang + a * 7 + time * 0.3;
    return out.set(mix(0, tg.x + p.jx, e) + Math.cos(th) * R, y, mix(-1, tg.z + p.jz, e) + Math.sin(th) * R);
  }

  private drawAtlas(): void {
    const canvas = this.glyphAtlas.image as HTMLCanvasElement, x = canvas.getContext('2d') as CanvasRenderingContext2D;
    x.clearRect(0, 0, 1024, 512);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let i = 0; i < 128; i++) {
      x.font = i % 4 ? "500 44px 'IBM Plex Mono'" : '800 48px Barlow';
      x.fillText(GLYPHS[i % GLYPHS.length], (i % 16) * 64 + 32, Math.floor(i / 16) * 64 + 33);
    }
    this.glyphAtlas.needsUpdate = true;
  }

  /** The words that pour in, as flat cards that always face you, from the data in this language. */
  private buildCards(locale: Locale): void {
    for (const c of this.cards) {
      this.world.remove(c.s);
      (c.s.material.map as CanvasTexture | null)?.dispose();
      c.s.material.dispose();
    }
    const words = pourWords(locale);
    this.cards = words.map(({ text, mono }, i) => {
      const font = mono ? "500 46px 'IBM Plex Mono'" : '800 60px Barlow', color = mono ? '#ffd58a' : '#f6ead0', worldH = mono ? 1.8 : 2.2;
      const ruler = (document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D);
      ruler.font = font;
      const w = Math.ceil(ruler.measureText(text).width) + 40, h = 84;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d') as CanvasRenderingContext2D;
      x.font = font;
      x.fillStyle = color;
      x.textBaseline = 'middle';
      x.fillText(text, 20, 42);
      const texture = new CanvasTexture(c);
      texture.colorSpace = SRGBColorSpace;
      const s = new Sprite(headSprite(texture));
      s.scale.set((worldH * w) / h, worldH, 1);
      this.world.add(s);
      return { s, p: { ...this.streamParticle(), r: 1.15, a0: i / words.length, sp: 0.032, k: i % 6 } };
    });
  }

  // ---------------------------------------------------------------- the spit

  /** The spark's way from the mouth to where it lands, slowing as it comes. */
  private sparkPos(f: number, out: Vector3): Vector3 {
    return out.copy(this.mouth).lerp(this.landing, 1 - (1 - f) * (1 - f));
  }

  private corridor(i: number): Vector3 {
    const cams: [number, number, number][] = [[0.06, 0.53, 0.36], [-0.02, 0.6, 0.2], [0.04, 0.64, -0.02], [-0.02, 0.58, -0.26], [0.02, 0.32, -0.34], [0.18, 0.28, -0.36], [0.24, 0.32, 0.0]];
    return W(...cams[i]).lerp(W(...cams[i + 1]), 0.5).add(i === 5 ? new Vector3(0.8, 1.4, 0) : new Vector3());
  }
}

