import { AdditiveBlending, BackSide, BoxGeometry, Color, DoubleSide, FogExp2, FrontSide, type Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, type Object3D, PointLight, Raycaster, Scene, SphereGeometry, Sprite, SpriteMaterial, type Texture, Vector2, Vector3, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Locale } from '~/i18n/Translator';
import { journeyQuality, type JourneyQuality } from '../../quality';
import { distanceAt, type DistanceTable, distanceTable, type FlightLayout } from '../../flight/layout';
import { clamp, ease, ez, mix, ramp } from '../../math';
import { pressureAt } from '../../head/cues';
import type { Timeline } from '../../timeline';
import { GROUND } from '~/ui/journey/paper';
import { displayReferred, displayValue } from '../displayOutput';
import { type HeadAnchors, HeadScene } from '../head/HeadScene';
import { SoftBang } from '../head/softBang';
import { buildHeadTrack, headPlace, type Pose } from '../head/track';
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
}

/** What a stop holds, for those checking it. */
export interface StopReport {
  id: string;
  screens: number;
  pieces: number;
  words: string[];
  /** The box its words cover on the page: left, top, right, bottom. */
  rect: [number, number, number, number];
  /** How far down the page the left end of its last words comes. */
  foot: number;
}

const GATE_URL = '/models/gate.glb';
const HEAD_URL = '/models/head.bin';
/** The head's lens, as the mock's: wider on a tall phone. */
const HEAD_FOV = 55;
const HEAD_FOV_PHONE = 68;
/** The head's ground, the page's dark purple, in the screen's values the tunnel's picture holds. */
const GROUND_SCREEN = [1, 3, 5].map((at) => parseInt(GROUND.slice(at, at + 2), 16) / 255) as unknown as Rgb;
/** Where the tunnel's own parts are left behind on the way down: the head's t. */
const TUNNEL_GONE = 0.1;
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
const across = new Vector3();
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
  /** The tunnel's wires and rings, left behind on the way down. */
  private readonly tunnelParts: Mesh[];
  /** Bob's head, where the flight leaves off, and the soft bang behind the report. */
  private readonly headPlace: Matrix4;
  private readonly join: Pose;
  private headTrack: (t: number, out: Pose) => Pose;
  private readonly headPose: Pose = { pos: new Vector3(), look: new Vector3(), up: new Vector3() };
  private head: HeadScene | null = null;
  private headReady: Promise<HeadScene> | null = null;
  private softBang: SoftBang | null = null;
  private bangPlaced = false;
  private readonly endView = new PerspectiveCamera();
  private readonly headState: HeadAnchors = { labels: [], cards: [], cardsInFront: [], spark: [0, 0], headBox: { left: 0, top: 0, right: 0, bottom: 0 }, you: [0, 0], youDir: [0, 0], scan: { y: 0, on: 0, head: 0 }, act: [] };
  private headShown = false;
  /** Where the page says the scan report's top middle stands, CSS px. */
  private landingPx: [number, number] | null = null;
  private pixelRatio = 1;
  private quality = journeyQuality(0, true);
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
  /** Kept, with their materials, so that the shader they readied stays ready. */
  private readonly specks: Mesh<BoxGeometry, MeshStandardMaterial>[] = [];
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
    this.tunnelParts = [wires.mesh, rings.mesh, wires.mirror, rings.mirror, streaks.mesh];
    this.scene.add(wires.mesh, rings.mesh, wires.mirror, rings.mirror);
    this.camera.add(streaks.mesh);
    // Where the flight leaves off, the head's way begins: the flight's last view, looking ahead along the tunnel.
    this.join = { pos: center(end, end, new Vector3()), look: center(end + LOOK_AHEAD, end, new Vector3()), up: frameAt(end, end).U.clone() };
    this.headPlace = headPlace(this.join);
    this.headTrack = buildHeadTrack(this.join, this.headPlace, false);

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
    draw();
    for (const speck of this.specks) speck.visible = false;
  }

  /** The gates' model, which every later stage stands on, and the gates themselves. It comes once. */
  private gatesReady: Promise<Object3D> | null = null;

  private standGates(renderer: WebGLRenderer, draw: () => void): Promise<Object3D> {
    this.gatesReady ??= (async () => {
      this.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const [gltf] = await Promise.all([new GLTFLoader().loadAsync(GATE_URL), ...WORD_FONTS.map((font) => document.fonts.load(font))]);
      if (this.gone) return gltf.scene;
      // The first view is already moving: one thing a frame, so that none of this catches it.
      this.prepare(renderer, draw);
      const gates = new Gates(gltf.scene);
      gates.place(this.input.layout);
      this.scene.add(gates.group);
      this.gates = gates;
      await nextFrame();
      gates.show(true);
      await renderer.compileAsync(this.scene, this.camera);
      draw();
      gates.show(false);
      return gltf.scene;
    })();
    return this.gatesReady;
  }

  /** The flight's stage: the gates, and each project with its pictures, its words and its screens on the walls. */
  async loadFlight(renderer: WebGLRenderer, draw: () => void): Promise<void> {
    const { layout, projects } = this.input;
    const [pictures] = await Promise.all([
      Promise.all(projects.map(async (project) => {
        const anisotropy = renderer.capabilities.getMaxAnisotropy();
        return {
          images: await Promise.all(project.images.map((file) => loadPicture(`/flight/${file}`, anisotropy))),
          piece: project.pieceImage ? await loadPicture(`/flight/${project.pieceImage}`, anisotropy) : null,
        };
      })),
      this.standGates(renderer, draw),
    ]);
    if (this.gone) return;
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
    this.walls.setShare(this.quality.wallScreens);
    if (this.gone) return;
    await renderer.compileAsync(this.scene, this.camera);
    for (const texture of [...pictures.flatMap(({ images, piece }) => (piece ? [...images, piece] : images)), ...this.stops.flatMap((stop) => stop.textures())]) {
      if (this.gone) return;
      renderer.initTexture(texture);
      await nextFrame();
    }
    // Each part drawn once while nothing shows, so that the first time it is seen costs nothing.
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
  }

  /** The head's stage: Bob's head, baked once (tools/head/bake.mjs), and everything that pours into it. */
  loadHead(draw: () => void, compile: () => Promise<unknown>): Promise<HeadScene> {
    this.headReady ??= (async () => {
      const head = new HeadScene(this.scene, this.headPlace);
      try {
        await head.load(HEAD_URL, this.locale);
      } catch (error) {
        head.dispose();
        throw error;
      }
      if (this.gone) {
        head.dispose();
        return head;
      }
      head.setQuality(this.quality);
      this.fitHead(head);
      await nextFrame();
      if (this.gone) return head;
      // Its shaders readied and its points drawn once while nothing shows, so that the first time it is seen costs nothing.
      head.show(true);
      await compile();
      draw();
      head.show(false);
      this.head = head;
      this.bangPlaced = false;
      return head;
    })();
    return this.headReady;
  }

  /** The end's stage: the soft big bang behind the scan report. It stands where the head's ride ends. */
  async loadEnd(draw: () => void, compile: () => Promise<unknown>): Promise<void> {
    await this.loadHead(draw, compile);
    if (this.gone) return;
    const bang = new SoftBang(this.scene);
    bang.setQuality(this.quality);
    this.softBang = bang;
    this.placeBang();
    await nextFrame();
    if (this.gone) return;
    bang.update(0.99, 0);
    bang.show(true);
    await compile();
    draw();
    bang.show(false);
  }

  private headFov(): number {
    return this.phone ? HEAD_FOV_PHONE : HEAD_FOV;
  }

  /** The head's sizes for this page: its points, where the spark lands, and where each answer stands. */
  private fitHead(head: HeadScene): void {
    const fov = this.headFov();
    head.setPixels(this.height * this.pixelRatio, fov);
    // Till the page has measured its report, the spark lands at the top middle.
    const [x, y] = this.landingPx ?? [this.width / 2, this.height * 0.2];
    head.setLanding(x, y, this.width, this.height, fov);
    head.placeCards(this.headTrack, this.width, this.height, this.phone, fov);
    this.bangPlaced = false;
  }

  /** Stands the soft bang where the spark lands, once the head knows where that is. */
  private placeBang(): void {
    if (!this.head || !this.softBang || this.bangPlaced) return;
    this.softBang.place(this.head.landingWorld(place), this.head.endView(this.endView));
    this.softBang.setPixels(this.height * this.pixelRatio, this.headFov());
    this.bangPlaced = true;
  }

  /** What every part draws at this step of the ladder. It all changes in place. */
  setQuality(quality: JourneyQuality): void {
    this.quality = quality;
    this.walls.setShare(quality.wallScreens);
    this.head?.setQuality(quality);
    this.softBang?.setQuality(quality);
  }

  /** Where the page's scan report stands: the spark lands at its top middle. */
  setLanding(x: number, y: number): void {
    this.landingPx = [x, y];
    if (this.head) this.fitHead(this.head);
  }

  /** Where the head's parts stand on the page this frame, while it shows. */
  headAnchors(): HeadAnchors | null {
    return this.headShown ? this.headState : null;
  }

  /** Where the head is, for the proof harness. */
  headReport(): { t: number; active: number; pressure: number; locale: string } | null {
    return this.headShown && this.head ? this.head.report() : null;
  }

  /** The words in another language: the world stays, only they change. */
  setLocale(locale: Locale): void {
    if (locale === this.locale) return;
    this.locale = locale;
    this.rebuildWords();
  }

  private rebuildWords(): void {
    this.stops.forEach((stop, i) => stop.buildWords(this.input.projects[i].words[this.locale], this.phone, this.anisotropy));
    this.head?.setLocale(this.locale);
  }

  /** Where a project's screen stands on the page: left, top, width, height. */
  screenRect(id: string): [number, number, number, number] | null {
    const stop = this.stops.find((candidate) => candidate.project.id === id);
    if (!stop) return null;
    this.camera.updateMatrixWorld();
    return stop.pageRect(this.camera, this.width, this.height);
  }

  report(): StopReport[] {
    this.camera.updateMatrixWorld();
    return this.stops.map((stop) => ({ id: stop.project.id, screens: stop.project.screens === 'phones' ? 3 : 1, pieces: stop.project.piece ? 1 : 0, words: stop.drawn, rect: stop.wordsRect(this.camera, this.width, this.height), foot: stop.wordsFoot(this.camera, this.height) }));
  }

  get wallCount(): number {
    return this.walls.count;
  }

  /** Where the pointer aims, -1 to 1 each way. */
  pointer(x: number, y: number): void {
    this.aim.set(x, y);
    this.pointerAt.set(x, y);
  }

  /** `t` is the head's own time (head/time.ts), past the flight; the page works it out, with the ending's own clock. */
  update(f: number, dt: number, now: number, t: number): void {
    const { layout, projects, timeline, reduce } = this.input;
    const end = layout.end;
    const s = distanceAt(ramp(f, timeline.flight[0], timeline.flight[1]), this.table);
    const inHead = f >= timeline.head[0];
    const moved = this.last === null || dt <= 0 ? 0 : Math.abs(s - this.last) / dt;
    this.last = s;
    const state = this.state;
    state.s = s;
    state.speed = reduce ? 0 : state.speed + (clamp(moved / FULL_SPEED, 0, 1.6) - state.speed) * (1 - Math.exp(-dt / 0.14));
    this.uniforms.uTime.value = reduce ? 0 : now / 1000;

    // The camera, leaning into bends, with a little of the pointer.
    this.mouse.lerp(this.aim, 1 - Math.exp(-dt / 0.28));
    const m = reduce ? 0 : 1;
    const camera = this.camera;
    const frame = frameAt(s, end);
    let wantFov: number;
    if (inHead) {
      // Past the flight, its last view bends down the shaft into his head (spec 5.1). Over the first steps the flight's
      // lean and its way with the pointer hand over to the head's, so the join has no seam.
      const pose = this.headTrack(t, this.headPose);
      const k = ease(t, 0, 0.03);
      const sway = ease(t, 0.27, 0.3);
      camera.up.copy(pose.up);
      camera.position.copy(pose.pos);
      camera.lookAt(pose.look);
      across.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const x = this.mouse.x * m, y = this.mouse.y * m;
      place.copy(pose.pos).addScaledVector(across, x * mix(0.24, 0.9 * (1 - sway), k)).addScaledVector(pose.up, y * mix(0.14, 0.54 * (1 - sway), k));
      look.copy(pose.look).addScaledVector(across, x * 0.62 * (1 - k)).addScaledVector(pose.up, y * 0.36 * (1 - k));
      // Behind the lips the pressure shakes you; outside, it shakes him (the head scene does that).
      const pressure = pressureAt(t);
      const shake = reduce ? 0 : pressure * pressure * 0.09 * (1 - ease(t, 0.9, 0.91));
      const time = now / 1000;
      place.addScaledVector(across, Math.sin(time * 47) * shake).addScaledVector(pose.up, Math.sin(time * 39 + 1) * shake);
      camera.position.copy(place);
      camera.lookAt(look);
      camera.rotateZ(bankAt(frame.T) * (1 - k));
      wantFov = this.headFov();
    } else {
      center(s, end, place);
      center(s + LOOK_AHEAD, end, look);
      place.addScaledVector(frame.R, this.mouse.x * 0.24 * m).addScaledVector(frame.U, this.mouse.y * 0.14 * m);
      look.addScaledVector(frame.R, this.mouse.x * 0.62 * m).addScaledVector(frame.U, this.mouse.y * 0.36 * m);
      camera.up.copy(frame.U);
      camera.position.copy(place);
      camera.lookAt(look);
      camera.rotateZ(bankAt(frame.T));
      wantFov = fovAt(state.speed, this.phone);
    }
    state.fov += (wantFov - state.fov) * (dt > 0 ? 1 - Math.exp(-dt / 0.16) : 1);
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    this.streaks.uTravel.value = s + (reduce ? 0 : now / 6000);
    this.streaks.uSpeed.value = state.speed;

    // The colour follows the nearest project; past the flight the ground turns the page's dark purple.
    const { near } = nearestStop(s, layout);
    const tint = tintAt(s, layout, projects.map((project) => project.tint));
    this.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
    this.headlamp.color.setRGB(tint[0], tint[1], tint[2]);
    const wash = washAt(tint, near);
    const ground = inHead ? ease(t, 0, 0.04) : 0;
    this.background.setRGB(mix(displayValue(wash[0]), GROUND_SCREEN[0], ground), mix(displayValue(wash[1]), GROUND_SCREEN[1], ground), mix(displayValue(wash[2]), GROUND_SCREEN[2], ground));
    const calm = ez(near);
    this.uniforms.uCalm.value = calm;
    state.calm = calm;
    this.fog.density = mix(0.017, 0.085, calm);

    // The light at the tunnel's end goes as you leave it; below, the tunnel is left behind.
    center(Math.min(s + ORB_AHEAD, end + ORB_AHEAD), end, this.orb.position);
    this.orb.material.color.setRGB(tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6);
    const left = inHead ? ease(t, 0, 0.04) : 0;
    this.orb.material.opacity = 1 - left;
    this.orb.visible = left < 0.99;
    const tunnelOn = !inHead || t < TUNNEL_GONE;
    for (const part of this.tunnelParts) part.visible = tunnelOn;
    if (tunnelOn) {
      this.gates?.update(s, 0, 0);
      this.walls.update(s, calm, 0);
    }

    // Each project swings out of the wall as you near it.
    let at: ProjectStop | null = null;
    if (tunnelOn) {
      for (const stop of this.stops) {
        if (stop.update({ s, now: reduce ? 0 : now, mouse: this.mouse, sway: m, dissolve: 0 })) at = stop;
      }
    }
    state.project = at ? at.project.id : null;
    state.link = null;
    state.screen = null;
    state.hover = null;
    if (at) {
      at.linkPoint(point).project(camera);
      state.link = [(point.x * 0.5 + 0.5) * this.width, (-point.y * 0.5 + 0.5) * this.height];
      at.main.getWorldPosition(point).project(camera);
      state.screen = [(point.x * 0.5 + 0.5) * this.width, (-point.y * 0.5 + 0.5) * this.height];
      this.ray.setFromCamera(this.pointerAt, camera);
      if (at.hit(this.ray)) state.hover = at.project.id;
    }

    // His head: from a little before the flight leaves off, so the shaft is there as you come out of the tunnel.
    const head = this.head;
    this.headShown = head !== null && f >= timeline.head[0] - 30;
    head?.show(this.headShown);
    if (head && this.headShown) {
      head.setPixels(this.height * this.pixelRatio, camera.fov);
      head.update({ t, time: now / 1000, dt, camera, phone: this.phone, reduce });
      head.anchors(camera, this.width, this.height, this.headState);
    }
    this.placeBang();
    const bangOn = this.softBang !== null && inHead && t >= 0.95;
    this.softBang?.show(bangOn);
    if (bangOn) this.softBang?.update(t, reduce ? 0 : now / 1000);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    const narrowed = width !== this.width;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    const phone = this.camera.aspect < 0.8;
    const turned = phone !== this.phone;
    this.phone = phone;
    // On a tall phone the camera stands further back while it looks at the whole head.
    if (turned) this.headTrack = buildHeadTrack(this.join, this.headPlace, phone);
    if (this.head) this.fitHead(this.head);
    // A phone's address bar changes only the height: that draws no words again.
    if (!turned && !(phone && narrowed)) return;
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
    this.head?.dispose();
    this.softBang?.dispose();
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
