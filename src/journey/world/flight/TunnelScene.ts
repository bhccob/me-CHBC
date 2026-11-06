import { AdditiveBlending, BackSide, Color, DoubleSide, FogExp2, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Raycaster, Scene, SphereGeometry, Sprite, SpriteMaterial, type Texture, Vector2, Vector3, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Locale } from '~/i18n/Translator';
import { distanceAt, type DistanceTable, distanceTable, type FlightLayout } from '../../flight/layout';
import { clamp, ez, mix, ramp } from '../../math';
import { displayReferred, displayValue } from '../displayOutput';
import { Gates } from './Gates';
import { bankAt, center, fovAt, frameAt, nearestStop, type Rgb, tintAt, washAt } from './path';
import { ProjectStop, type StopProject, type StopWords } from './ProjectStop';
import { glowTexture, loadPicture } from './textures';
import { makeRings, makeStreaks, makeWires, type StreakUniforms, tunnelUniforms, type TunnelUniforms } from './tunnelParts';
import { WallScreens } from './WallScreens';

/** A project as the flight shows it. */
export interface FlightProject extends StopProject {
  /** Where its pictures are. */
  images: readonly string[];
  pieceImage?: string;
  words: Record<Locale, StopWords>;
}

export interface TunnelInput {
  layout: FlightLayout;
  projects: readonly FlightProject[];
  locale: Locale;
  /** The frames the flight runs over. */
  frames: readonly [number, number];
  reduce: boolean;
}

/** How the flight is moving, for those who ask. */
export interface FlightState {
  s: number;
  speed: number;
  fov: number;
  /** How far the tunnel has quietened for a project, 0 to 1. */
  calm: number;
  /** The project you are at, if any. */
  project: string | null;
  /** Where its link stands, and the middle of its screen, in CSS pixels. */
  link: [number, number] | null;
  screen: [number, number] | null;
  /** The project whose screen is under the pointer, if any. */
  hover: string | null;
}

/** What a stop holds, for those checking it. */
export interface StopReport {
  id: string;
  screens: number;
  pieces: number;
  words: string[];
}

const GATE_URL = '/models/gate.glb';
const ORB_AHEAD = 58;
const LOOK_AHEAD = 9;
const FULL_SPEED = 15;

/** The dark room the gates' metal reflects: a dim sphere, with long strips of warm light and one of cold. */
function reflections(renderer: WebGLRenderer): Texture {
  const room = new Scene();
  const parts: Mesh[] = [new Mesh(new SphereGeometry(20, 16, 12), new MeshBasicMaterial({ color: new Color(0.012, 0.012, 0.02), side: BackSide }))];
  const strip = (x: number, y: number, z: number, w: number, h: number, c: Rgb): void => {
    const mesh = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(c[0], c[1], c[2]), side: DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    parts.push(mesh);
  };
  strip(0, 14, 2, 22, 2, [1.1, 0.8, 0.5]);
  strip(0, -14, 4, 22, 1.2, [0.5, 0.36, 0.2]);
  strip(14, 0, 6, 1.4, 16, [0.9, 0.62, 0.3]);
  strip(-14, 0, 6, 1.4, 16, [0.5, 0.45, 0.7]);
  strip(0, 0, 18, 8, 8, [0.22, 0.2, 0.26]);
  room.add(...parts);
  const generator = new PMREMGenerator(renderer);
  const { texture } = generator.fromScene(room, 0.03);
  generator.dispose();
  for (const part of parts) {
    part.geometry.dispose();
    (part.material as MeshBasicMaterial).dispose();
  }
  return texture;
}

const WORD_FONTS = ['800 168px Barlow', '500 56px Barlow', '500 46px "IBM Plex Mono"'];

const place = new Vector3();
const point = new Vector3();
const nextFrame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()));
const look = new Vector3();

/** The flight: one curving tunnel you never stop in, only slow down to read. */
export class TunnelScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(54, 16 / 9, 0.05, 900);
  readonly state: FlightState = { s: 0, speed: 0, fov: 54, calm: 0, project: null, link: null, screen: null, hover: null };
  private readonly input: TunnelInput;
  private readonly table: DistanceTable;
  private readonly uniforms: TunnelUniforms = tunnelUniforms();
  private readonly streaks: StreakUniforms;
  private readonly meshes: Mesh[];
  private readonly orb: Sprite;
  private readonly glow = glowTexture();
  private readonly walls: WallScreens;
  private readonly ray = new Raycaster();
  private readonly pointerAt = new Vector2(9, 9);
  private stops: ProjectStop[] = [];
  private locale: Locale;
  private anisotropy = 1;
  private width = 1;
  private height = 1;
  private gone = false;
  private readonly headlamp = new PointLight(0xffffff, 22, 30, 1.4);
  private gates: Gates | null = null;
  private readonly fog = new FogExp2(0x000000, 0.017);
  private readonly background = new Color();
  private readonly mouse = new Vector2();
  private readonly aim = new Vector2();
  private last: number | null = null;
  private phone = false;

  constructor(input: TunnelInput) {
    this.input = input;
    this.locale = input.locale;
    this.walls = new WallScreens(this.scene);
    this.table = distanceTable(input.layout);
    // Held in the screen's values, as the picture is: a render target takes them from these colours as they stand.
    this.scene.background = this.background;
    this.fog.color = this.background;
    this.scene.fog = this.fog;
    this.scene.add(this.camera);
    this.scene.environmentIntensity = 1.5;
    this.headlamp.position.set(0, 0.5, -1.5);
    this.camera.add(this.headlamp);

    const end = input.layout.end;
    const wires = makeWires(end, this.uniforms);
    const rings = makeRings(end, this.uniforms);
    const streaks = makeStreaks(this.uniforms);
    this.streaks = streaks.speed;
    this.meshes = [wires, rings, streaks.mesh];
    this.scene.add(wires, rings);
    this.camera.add(streaks.mesh);

    this.orb = new Sprite(displayReferred(new SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, fog: false }), false));
    this.orb.scale.setScalar(22);
    this.orb.renderOrder = -5;
    this.scene.add(this.orb);
  }

  /** Loads what stands in the tunnel, and readies it to draw. */
  async load(renderer: WebGLRenderer): Promise<void> {
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const { layout, projects } = this.input;
    const [gltf, pictures] = await Promise.all([
      new GLTFLoader().loadAsync(GATE_URL),
      Promise.all(projects.map(async (project) => ({
        images: await Promise.all(project.images.map((file) => loadPicture(`/flight/${file}`, this.anisotropy))),
        piece: project.pieceImage ? await loadPicture(`/flight/${project.pieceImage}`, this.anisotropy) : null,
      }))),
      ...WORD_FONTS.map((font) => document.fonts.load(font)),
    ]);
    if (this.gone) return;
    this.scene.environment = reflections(renderer);
    const gates = new Gates(gltf.scene);
    gates.place(layout);
    this.scene.add(gates.group);
    this.gates = gates;
    gates.showAll();

    this.stops = projects.map((project, i) => {
      const stop = new ProjectStop(this.scene, project, layout.stops[i], layout.end, pictures[i].images, pictures[i].piece, this.glow);
      stop.layout(this.phone);
      stop.buildWords(project.words[this.locale], this.phone, this.anisotropy);
      stop.showAll();
      this.walls.add(stop.wallPictures(), project.screens === 'phones', layout.stops[i], new Color(project.tint[0], project.tint[1], project.tint[2]), layout.end);
      return stop;
    });
    this.walls.showAll();
    await renderer.compileAsync(this.scene, this.camera);

    // One picture a frame, so that taking them all in does not catch the page.
    for (const texture of [...pictures.flatMap(({ images, piece }) => (piece ? [...images, piece] : images)), ...this.stops.flatMap((stop) => stop.textures())]) {
      if (this.gone) return;
      renderer.initTexture(texture);
      await nextFrame();
    }
  }

  /** The words in another language: the world stays, only they change. */
  setLocale(locale: Locale): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.rebuildWords();
  }

  private rebuildWords(): void {
    this.stops.forEach((stop, i) => stop.buildWords(this.input.projects[i].words[this.locale], this.phone, this.anisotropy));
  }

  /** Where a project's screen stands on the page: left, top, width, height. */
  screenRect(id: string): [number, number, number, number] | null {
    const stop = this.stops.find((candidate) => candidate.project.id === id);
    if (!stop) return null;
    this.camera.updateMatrixWorld();
    return stop.pageRect(this.camera, this.width, this.height);
  }

  report(): StopReport[] {
    return this.stops.map((stop) => ({ id: stop.project.id, screens: stop.project.screens === 'phones' ? 3 : 1, pieces: stop.project.piece ? 1 : 0, words: stop.drawn }));
  }

  get wallCount(): number {
    return this.walls.count;
  }

  /** Where the pointer aims, -1 to 1 each way. */
  pointer(x: number, y: number): void {
    this.aim.set(x, y);
    this.pointerAt.set(x, y);
  }

  update(f: number, dt: number, now: number): void {
    const { layout, projects, frames, reduce } = this.input;
    const end = layout.end;
    const s = distanceAt(ramp(f, frames[0], frames[1]), this.table);
    const moved = this.last === null || dt <= 0 ? 0 : Math.abs(s - this.last) / dt;
    this.last = s;
    const state = this.state;
    state.s = s;
    state.speed = reduce ? 0 : state.speed + (clamp(moved / FULL_SPEED, 0, 1.6) - state.speed) * (1 - Math.exp(-dt / 0.14));
    this.uniforms.uTime.value = reduce ? 0 : now / 1000;

    // The camera, leaning into bends, with a little of the pointer.
    this.mouse.lerp(this.aim, 1 - Math.exp(-dt / 0.28));
    const m = reduce ? 0 : 1;
    const frame = frameAt(s, end);
    center(s, end, place)
      .addScaledVector(frame.R, this.mouse.x * 0.24 * m)
      .addScaledVector(frame.U, this.mouse.y * 0.14 * m);
    center(s + LOOK_AHEAD, end, look)
      .addScaledVector(frame.R, this.mouse.x * 0.62 * m)
      .addScaledVector(frame.U, this.mouse.y * 0.36 * m);
    const camera = this.camera;
    camera.position.copy(place);
    camera.up.copy(frame.U);
    camera.lookAt(look);
    camera.rotateZ(bankAt(frame.T));
    state.fov += (fovAt(state.speed, this.phone) - state.fov) * (dt > 0 ? 1 - Math.exp(-dt / 0.16) : 1);
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
    this.streaks.uTravel.value = s + (reduce ? 0 : now / 6000);
    this.streaks.uSpeed.value = state.speed;

    // The colour follows the nearest project.
    const { near } = nearestStop(s, layout);
    const tint = tintAt(s, layout, projects.map((project) => project.tint));
    this.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
    this.headlamp.color.setRGB(tint[0], tint[1], tint[2]);
    const wash = washAt(tint, near);
    this.background.setRGB(displayValue(wash[0]), displayValue(wash[1]), displayValue(wash[2]));
    const calm = ez(near);
    this.uniforms.uCalm.value = calm;
    state.calm = calm;
    this.fog.density = mix(0.017, 0.085, calm);

    center(Math.min(s + ORB_AHEAD, end + ORB_AHEAD), end, this.orb.position);
    this.orb.material.color.setRGB(tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6);
    this.gates?.update(s, 0);
    this.walls.update(s, calm, 0);

    // Each project swings out of the wall as you near it.
    let at: ProjectStop | null = null;
    for (const stop of this.stops) {
      if (stop.update({ s, now: reduce ? 0 : now, mouse: this.mouse, sway: m, dissolve: 0 })) at = stop;
    }
    state.project = at ? at.project.id : null;
    state.link = null;
    state.screen = null;
    state.hover = null;
    if (at) {
      camera.updateMatrixWorld();
      at.linkPoint(point).project(camera);
      state.link = [(point.x * 0.5 + 0.5) * this.width, (-point.y * 0.5 + 0.5) * this.height];
      at.main.getWorldPosition(point).project(camera);
      state.screen = [(point.x * 0.5 + 0.5) * this.width, (-point.y * 0.5 + 0.5) * this.height];
      this.ray.setFromCamera(this.pointerAt, camera);
      if (at.hit(this.ray)) state.hover = at.project.id;
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    const phone = this.camera.aspect < 0.8;
    if (phone === this.phone) return;
    this.phone = phone;
    for (const stop of this.stops) stop.layout(phone);
    this.rebuildWords();
  }

  dispose(): void {
    this.gone = true;
    this.gates?.dispose();
    this.walls.dispose();
    for (const stop of this.stops) stop.dispose();
    this.scene.environment?.dispose();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
    }
    this.glow.dispose();
    this.orb.material.dispose();
  }
}
