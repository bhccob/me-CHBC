import { AdditiveBlending, BackSide, BoxGeometry, type BufferGeometry, Color, DoubleSide, FogExp2, FrontSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, type Points, Raycaster, Scene, type ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, type Texture, Vector2, Vector3, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Locale } from '~/i18n/Translator';
import { distanceAt, type DistanceTable, distanceTable, type FlightLayout } from '../../flight/layout';
import { clamp, ease, ez, mix, ramp } from '../../math';
import type { Timeline } from '../../timeline';
import { displayReferred, displayValue } from '../displayOutput';
import { orbitAngles } from '../../end';
import { Bang } from '../end/Bang';
import { bangShare, collapseShare, fallPoint, voidLeftAfter } from '../end/Collapse';
import { galaxy, Universe, type UniverseReport } from '../end/Universe';
import { movingShare, starShare } from '../void/Dissolve';
import { endFov, endFrame, voidDistanceAt, voidOpening, type VoidPose, voidPose, wallReach } from '../void/path';
import { type QuestionReport, Questions, type QuestionWords } from '../void/Questions';
import { VoidScene } from '../void/VoidScene';
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
  /** His questions and answers, and the big word over them, in each language. */
  questions: Record<Locale, readonly QuestionWords[]>;
  qaWord: Record<Locale, string>;
  locale: Locale;
  timeline: Timeline;
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
  /** How far along the way through the void. */
  voidDistance: number;
  /** The tunnel breaking: the share of its points on their way, and the share already stars. */
  sparks: number;
  stars: number;
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

const WORLD_UP = new Vector3(0, 1, 0);
const orbit = new Vector3();
const place = new Vector3();
const point = new Vector3();
const nextFrame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()));
const look = new Vector3();

/** The flight: one curving tunnel you never stop in, only slow down to read. */
export class TunnelScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(54, 16 / 9, 0.05, 900);
  readonly state: FlightState = { s: 0, speed: 0, fov: 54, calm: 0, project: null, link: null, screen: null, hover: null, voidDistance: 0, sparks: 0, stars: 0 };
  private readonly input: TunnelInput;
  private readonly table: DistanceTable;
  private readonly uniforms: TunnelUniforms = tunnelUniforms();
  private readonly streaks: StreakUniforms;
  private readonly meshes: Mesh[];
  private readonly orb: Sprite;
  private readonly glow = glowTexture();
  private readonly walls: WallScreens;
  private readonly voidScene: VoidScene;
  private readonly bang: Bang;
  private readonly fallsTo: Vector3;
  /** The end page's light. It stands from the start, since a lit material's shader depends on how many lights there are. */
  private readonly endLight = new PointLight(0xffd6a0, 0, 320, 1);
  private universe: Universe | null = null;
  private readonly pose: VoidPose = { place: new Vector3(), look: new Vector3(), T: new Vector3(), R: new Vector3(), U: new Vector3(), roll: 0, arrive: 0, sway: 1, lens: 1 };
  private readonly ray = new Raycaster();
  private readonly pointerAt = new Vector2(9, 9);
  private stops: ProjectStop[] = [];
  private questions: Questions | null = null;
  private locale: Locale;
  private anisotropy = 1;
  private width = 1;
  private height = 1;
  private gone = false;
  private readonly headlamp = new PointLight(0xffffff, 22, 30, 1.4);
  private gates: Gates | null = null;
  /** Kept, with their materials, so that the shader they readied stays ready. */
  private readonly specks: (Mesh<BoxGeometry, MeshStandardMaterial> | Points<BufferGeometry, ShaderMaterial>)[] = [];
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
    this.meshes = [wires.mesh, rings.mesh, wires.mirror, rings.mirror, streaks.mesh];
    this.scene.add(wires.mesh, rings.mesh, wires.mirror, rings.mirror);
    this.camera.add(streaks.mesh);
    this.voidScene = new VoidScene(this.scene, this.uniforms, end, input.timeline, [wires.mirror, rings.mirror]);
    this.fallsTo = fallPoint(end, new Vector3());
    this.voidScene.sparkControls.uPoint.value.copy(this.fallsTo);
    this.bang = new Bang(this.scene, this.uniforms, this.fallsTo, this.glow);
    this.scene.add(this.endLight);

    this.orb = new Sprite(displayReferred(new SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, fog: false }), false));
    this.orb.scale.setScalar(22);
    this.orb.renderOrder = -5;
    this.scene.add(this.orb);
  }

  /**
   * What cannot be spread over frames, done behind the loader. The room the metal reflects takes a third of a second to make,
   * and the driver readies each shader only at its first draw: a third of a second more, for all of them. So their first
   * draws are here, of what needs no download and of a speck for what does, and not in the middle of the journey. `draw`
   * draws the tunnel once.
   */
  prepare(renderer: WebGLRenderer, draw: () => void): void {
    if (this.scene.environment) return;
    this.scene.environment = reflections(renderer);
    for (const side of [FrontSide, DoubleSide]) {
      for (const fog of [true, false]) {
        const speck = new Mesh(new BoxGeometry(0.001, 0.001, 0.001), displayReferred(new MeshStandardMaterial({ transparent: true, side, fog }), true));
        speck.frustumCulled = false;
        this.scene.add(speck);
        this.specks.push(speck);
      }
    }
    const stars = galaxy(1, 1, 2, this.uniforms.uTime, this.voidScene.sparkPixels);
    this.scene.add(stars);
    this.specks.push(stars);
    this.voidScene.show(true);
    this.bang.show(true);
    draw();
    this.voidScene.show(false);
    this.bang.show(false);
    for (const speck of this.specks) speck.visible = false;
  }

  /** Loads what stands in the tunnel, and readies it to draw. `draw` draws the tunnel once, out of sight. */
  async load(renderer: WebGLRenderer, draw: () => void): Promise<void> {
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
    // The first view is already moving: one thing a frame, so that none of this catches it.
    this.prepare(renderer, draw);
    const gates = new Gates(gltf.scene);
    gates.place(layout);
    this.scene.add(gates.group);
    this.gates = gates;
    await nextFrame();
    for (const [i, project] of projects.entries()) {
      if (this.gone) return;
      const stop = new ProjectStop(this.scene, project, layout.stops[i], layout.end, pictures[i].images, pictures[i].piece, this.glow);
      stop.layout(this.phone);
      this.stops.push(stop);
      await nextFrame();
      if (this.gone) return;
      stop.buildWords(project.words[this.locale], this.phone, this.anisotropy);
      await nextFrame();
      if (this.gone) return;
      this.walls.add(stop.wallPictures(), project.screens === 'phones', layout.stops[i], new Color(project.tint[0], project.tint[1], project.tint[2]), layout.end);
      await nextFrame();
    }
    if (this.gone) return;
    const questions = new Questions(this.scene, gltf.scene, layout.end);
    questions.buildWord(this.input.qaWord[this.locale], this.phone, this.anisotropy);
    this.questions = questions;
    await nextFrame();
    if (this.gone) return;
    const universe = new Universe(this.scene, gltf.scene, layout.end, this.uniforms.uTime, this.voidScene.sparkPixels, this.voidScene.sparkControls, this.fallsTo, this.glow, this.endLight);
    this.universe = universe;
    await nextFrame();
    for (const [i, words] of this.input.questions[this.locale].entries()) {
      if (this.gone) return;
      questions.buildQuestion(i, words, this.phone, this.anisotropy);
      await nextFrame();
    }
    if (this.gone) return;
    await renderer.compileAsync(this.scene, this.camera);
    for (const texture of [...pictures.flatMap(({ images, piece }) => (piece ? [...images, piece] : images)), ...this.stops.flatMap((stop) => stop.textures()), ...(questions.textures() as Texture[])]) {
      if (this.gone) return;
      renderer.initTexture(texture);
      await nextFrame();
    }
    // Each part drawn once while nothing shows, so that the first time it is seen costs nothing.
    if (this.gone) return;
    gates.show(true);
    draw();
    gates.show(false);
    for (const stop of this.stops) {
      await nextFrame();
      if (this.gone) return;
      stop.show(true);
      draw();
      stop.show(false);
    }
    await nextFrame();
    if (this.gone) return;
    this.walls.show(true);
    draw();
    this.walls.show(false);
    await nextFrame();
    if (this.gone) return;
    questions.show(true);
    draw();
    questions.show(false);
    await nextFrame();
    if (this.gone) return;
    universe.show(true);
    draw();
    universe.show(false);
  }

  /** A press on the end page: a light grows at the cursor. */
  press(): void {
    if (!this.input.reduce) this.universe?.press();
  }

  /** Let go, or the press given up. */
  release(cancelled: boolean): void {
    this.universe?.release(this.pointerAt, this.camera, cancelled, this.input.reduce);
  }

  endReport(): UniverseReport | null {
    this.camera.updateMatrixWorld();
    return this.universe?.report(this.camera, this.width, this.height) ?? null;
  }

  get fired(): number {
    return this.universe?.fired ?? 0;
  }

  /** The words in another language: the world stays, only they change. */
  setLocale(locale: Locale): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.rebuildWords();
  }

  private rebuildWords(): void {
    this.stops.forEach((stop, i) => stop.buildWords(this.input.projects[i].words[this.locale], this.phone, this.anisotropy));
    const { questions } = this;
    if (!questions) return;
    questions.buildWord(this.input.qaWord[this.locale], this.phone, this.anisotropy);
    this.input.questions[this.locale].forEach((words, i) => questions.buildQuestion(i, words, this.phone, this.anisotropy));
  }

  questionReport(): QuestionReport[] {
    this.camera.updateMatrixWorld();
    return this.questions?.report(this.camera, this.width, this.height) ?? [];
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
    const { layout, projects, timeline, reduce } = this.input;
    const end = layout.end;
    const s = distanceAt(ramp(f, timeline.flight[0], timeline.flight[1]), this.table);
    const beyond = voidDistanceAt(f, timeline);
    const total = s + beyond;
    const moved = this.last === null || dt <= 0 ? 0 : Math.abs(total - this.last) / dt;
    this.last = total;
    const state = this.state;
    state.s = s;
    state.voidDistance = beyond;
    const dissolve = ramp(f, timeline.dissolve[0], timeline.dissolve[1]);
    const opening = voidOpening(f, timeline);
    state.sparks = movingShare(dissolve);
    state.stars = starShare(dissolve);
    const fall = collapseShare(f, timeline);
    const bang = bangShare(f, timeline);
    const voidLeft = voidLeftAfter(opening, fall);
    this.uniforms.uDis.value = dissolve;
    this.uniforms.uVoid.value = voidLeft;
    this.uniforms.uFar.value = wallReach(opening);
    state.speed = reduce ? 0 : state.speed + (clamp(moved / FULL_SPEED, 0, 1.6) - state.speed) * (1 - Math.exp(-dt / 0.14));
    this.uniforms.uTime.value = reduce ? 0 : now / 1000;

    // The camera, leaning into bends, with a little of the pointer.
    this.mouse.lerp(this.aim, 1 - Math.exp(-dt / 0.28));
    let m = reduce ? 0 : 1;
    let roll: number;
    let wantFov: number;
    let right: Vector3;
    let up: Vector3;
    const camera = this.camera;
    if (beyond > 0) {
      const pose = voidPose(beyond, end, this.pose);
      m *= pose.sway;
      place.copy(pose.place);
      look.copy(pose.look);
      // Settled in the dark, the cursor swings you round the point it all came from.
      const round = reduce ? 0 : ease(bang, 0.42, 0.94);
      if (round > 0) {
        const { yaw, pitch } = orbitAngles(this.mouse.x, this.mouse.y);
        orbit.subVectors(place, this.fallsTo).applyAxisAngle(WORLD_UP, -yaw * round).applyAxisAngle(endFrame(end).right, pitch * round);
        place.copy(this.fallsTo).add(orbit);
        look.lerp(this.fallsTo, round);
      }
      right = pose.R;
      up = pose.U;
      roll = pose.roll;
      camera.up.set(0, 1, 0);
      wantFov = fovAt(state.speed * pose.lens, this.phone) + (endFov(this.phone) - fovAt(0, this.phone)) * pose.arrive;
    } else {
      const frame = frameAt(s, end);
      center(s, end, place);
      center(s + LOOK_AHEAD, end, look);
      right = frame.R;
      up = frame.U;
      roll = bankAt(frame.T);
      camera.up.copy(frame.U);
      wantFov = fovAt(state.speed, this.phone);
    }
    place.addScaledVector(right, this.mouse.x * 0.24 * m).addScaledVector(up, this.mouse.y * 0.14 * m);
    look.addScaledVector(right, this.mouse.x * 0.62 * m).addScaledVector(up, this.mouse.y * 0.36 * m);
    camera.position.copy(place);
    camera.lookAt(look);
    camera.rotateZ(roll);
    // The bang opens the lens wide for a moment, and throws the streaks past you.
    if (!reduce) wantFov += 13 * Math.sin(Math.PI * clamp((bang - 0.01) / 0.4));
    const burst = Math.sin(Math.PI * clamp((bang - 0.01) / 0.42));
    state.fov += (wantFov - state.fov) * (dt > 0 ? 1 - Math.exp(-dt / 0.16) : 1);
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
    this.streaks.uTravel.value = s + (reduce ? 0 : now / 6000) + bang * 300;
    this.streaks.uSpeed.value = reduce ? 0 : Math.max(state.speed, burst * 1.15);

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
    this.fog.density = mix(mix(0.017, 0.085, calm), 0.0028, opening);

    center(Math.min(s + ORB_AHEAD, end + ORB_AHEAD), end, this.orb.position);
    this.orb.material.color.setRGB(tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6);
    this.orb.material.opacity = 1 - opening;
    this.orb.visible = opening < 0.99;
    this.gates?.update(s, dissolve, opening);
    this.walls.update(s, calm, dissolve);
    this.voidScene.update({ f, distance: beyond, dissolve, opening, voidLeft, fall, bang, dt, camera: camera.position });
    this.bang.update(fall, bang, now, camera.quaternion);
    this.universe?.update({ bang, now, dt, pointer: this.pointerAt, mouse: this.mouse, camera, phone: this.phone, reduce });
    this.questions?.update({ distance: beyond, now: reduce ? 0 : now, mouse: this.mouse, sway: m }, this.phone);

    // Each project swings out of the wall as you near it.
    let at: ProjectStop | null = null;
    for (const stop of this.stops) {
      if (stop.update({ s, now: reduce ? 0 : now, mouse: this.mouse, sway: m, dissolve })) at = stop;
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

  resize(width: number, height: number, pixelRatio: number): void {
    this.voidScene.setPixels(pixelRatio, height);
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
    for (const speck of this.specks) {
      speck.geometry.dispose();
      speck.material.dispose();
    }
    this.gates?.dispose();
    this.walls.dispose();
    this.voidScene.dispose();
    this.bang.dispose();
    this.universe?.dispose();
    this.questions?.dispose();
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
