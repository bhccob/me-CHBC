import { type Camera, Color, Group, Matrix4, Mesh, type MeshBasicMaterial, PlaneGeometry, Quaternion, Raycaster, type Scene, type ShaderMaterial, type Texture, Vector2, Vector3 } from 'three';
import type { FlightStop } from '../../flight/layout';
import { READ } from '../../flight/layout';
import { backOut, clamp, ease, mix, ramp } from '../../math';
import { bankAt, center, frameAt, type PathFrame, type Rgb } from './path';
import { curvedPlane, glowMaterial, hushMaterial, pieceMaterial, screenMaterial, type TextPlate, textPlate } from './textures';
import { wrapLines } from './wrap';

/** How near a stop is, 0 to 1, with this distance still to go to where you read it. */
export function nearAt(distance: number): number {
  return 1 - ramp(distance, 0, 15);
}

/** How much of the page's width a screen takes at a distance. */
export function screenShare(width: number, distance: number, fovDeg: number, aspect: number): number {
  return width / (2 * distance * Math.tan((fovDeg * Math.PI) / 360) * aspect);
}

/** What a stop needs of its project. */
export interface StopProject {
  id: string;
  year: number;
  tint: Rgb;
  titleLines: readonly string[];
  screens: 'wide' | 'phones';
  piece?: 'cookie' | 'sun' | 'ring';
}

export interface StopWords {
  kind: string;
  line: string;
}

/** What each frame gives a stop. */
export interface StopFrame {
  s: number;
  now: number;
  /** The pointer, smoothed, and how much of it counts. */
  mouse: Vector2;
  sway: number;
  dissolve: number;
}

const WIDE_WIDTH = 2.45;
const WIDE_ASPECT = 1440 / 900;
const PHONE_ASPECT = 1170 / 2532;
const INK = '#f6f1e6';
const PPU_BIG = 400;
const PPU_SMALL = 560;
const SUM_LINE = 74;

const corner = new Vector3();

/** The one place a project stands in the flight, in its own words and pictures. */
export class ProjectStop {
  readonly project: StopProject;
  readonly stop: FlightStop;
  /** The screen you can click. */
  main!: Mesh;
  /** What was last drawn, for those checking the words. */
  drawn: string[] = [];
  /** How much of each plate its words really cover, from its top left, for those checking they stay on the page. */
  private inks: { plate: TextPlate; width: number; height: number }[] = [];
  /** Where its link stands, in the words' own space. */
  private linkAt = new Vector3();
  private readonly end: number;
  private readonly tint: Color;
  private readonly screenSide = new Group();
  private readonly wordSide = new Group();
  private readonly back: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly hush: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly screens: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  private readonly pieces: { mesh: Mesh; base: Vector3 }[] = [];
  private plates: TextPlate[] = [];
  private readFrame!: PathFrame;
  private view!: PathFrame;
  private home = new Vector3();
  private wall = new Vector3();
  private face = new Quaternion();
  private turned = new Quaternion();
  private scale = 1;
  private textHome = new Vector3();
  private textFace = new Quaternion();
  private hushAt = new Vector3();
  private readonly read: number;

  constructor(scene: Scene, project: StopProject, stop: FlightStop, end: number, images: readonly Texture[], piece: Texture | null, glow: Texture) {
    this.project = project;
    this.stop = stop;
    this.end = end;
    this.read = stop.s - READ;
    this.tint = new Color(project.tint[0], project.tint[1], project.tint[2]);
    scene.add(this.screenSide, this.wordSide);

    this.back = new Mesh(new PlaneGeometry(1, 1), glowMaterial(glow, project.tint, 0.3));
    this.back.position.z = -0.5;
    this.back.renderOrder = 1.2;
    this.screenSide.add(this.back);

    this.hush = new Mesh(new PlaneGeometry(1, 1), hushMaterial());
    this.hush.frustumCulled = false;
    this.hush.renderOrder = 1;
    scene.add(this.hush);

    if (project.screens === 'phones') this.standPhones(images);
    else this.standScreen(images[0]);
    if (project.piece === 'cookie' || project.piece === 'ring') this.standPiece(project.piece, piece as Texture);
    if (project.piece === 'sun') this.standSun(glow);
  }

  private standPhones(images: readonly Texture[]): void {
    const places = [[-0.8, -0.04, -0.34, 0.2, 1.78], [0.8, -0.04, -0.34, -0.2, 1.78], [0, 0.02, 0, 0, 2.14]];
    places.forEach(([x, y, z, turn, h], i) => {
      const mesh = new Mesh(curvedPlane(h * PHONE_ASPECT, h, 0), screenMaterial(images[i], 0, 0.05, PHONE_ASPECT, this.tint));
      mesh.position.set(x, y, z);
      mesh.rotation.y = turn;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2 + i;
      this.screenSide.add(mesh);
      this.screens.push(mesh);
      if (i === 2) this.main = mesh;
    });
  }

  private standScreen(image: Texture): void {
    const mesh = new Mesh(curvedPlane(WIDE_WIDTH, WIDE_WIDTH / WIDE_ASPECT, 0.05), screenMaterial(image, this.stop.side, 0.012, WIDE_ASPECT, this.tint));
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    this.screenSide.add(mesh);
    this.screens.push(mesh);
    this.main = mesh;
  }

  private standPiece(kind: 'cookie' | 'ring', image: Texture): void {
    const size = kind === 'cookie' ? 0.8 : 0.68;
    const [ux, uy] = kind === 'cookie' ? [0.17, 0.63] : [0.333, 0.65];
    const mesh = new Mesh(new PlaneGeometry(size, size), pieceMaterial(image));
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    this.screenSide.add(mesh);
    this.pieces.push({ mesh, base: new Vector3((ux - 0.5) * WIDE_WIDTH, (uy - 0.5) * (WIDE_WIDTH / WIDE_ASPECT), 0.56) });
  }

  private standSun(glow: Texture): void {
    const mesh = new Mesh(new PlaneGeometry(2.3, 2.3), glowMaterial(glow, [1, 0.72, 0.32], 0.85));
    mesh.frustumCulled = false;
    mesh.renderOrder = 1.3;
    this.screenSide.add(mesh);
    this.pieces.push({ mesh, base: new Vector3(0.95 * this.stop.side, 0.72, -0.42) });
  }

  /** Draws its words again: on a new language, or when the page turns into a phone's. */
  buildWords(words: StopWords, phone: boolean, anisotropy: number): void {
    this.clearWords();
    const { project } = this;
    const yearText = String(project.year);
    const tintHex = `#${project.tint.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('')}`;
    const titleLines = project.titleLines.map((line) => line.toUpperCase());

    // The sizes first: a long title shrinks to fit, and a long line takes the height it needs.
    const ruler = document.createElement('canvas').getContext('2d')!;
    let titleSize = phone ? 132 : 168;
    ruler.font = `800 ${titleSize}px Barlow`;
    const widest = Math.max(...titleLines.map((line) => ruler.measureText(line).width));
    if (widest > 1340) titleSize = Math.floor((titleSize * 1340) / widest);
    ruler.font = '500 56px Barlow';
    const lines = wrapLines(words.line, (phone ? 2.5 : 2.05) * PPU_SMALL, (s) => ruler.measureText(s).width);

    const year = textPlate((x) => {
      x.font = `800 ${phone ? 190 : 230}px Barlow`;
      x.textBaseline = 'alphabetic';
      x.letterSpacing = '-4px';
      x.lineWidth = 2.5;
      x.strokeStyle = tintHex;
      x.globalAlpha = 0.62;
      x.strokeText(yearText, 14, 300);
    }, PPU_BIG, 900, 330, anisotropy);
    const title = textPlate((x) => {
      x.font = `800 ${titleSize}px Barlow`;
      x.textBaseline = 'alphabetic';
      x.letterSpacing = '-4px';
      x.shadowColor = 'rgba(4,3,8,.75)';
      x.shadowBlur = 34;
      x.fillStyle = INK;
      titleLines.forEach((line, i) => x.fillText(line, 12, titleSize * 0.86 + i * titleSize * 0.88 + 16));
    }, PPU_BIG, 1400, Math.round(titleSize * (0.1 + titleLines.length * 0.88) + 40), anisotropy);
    const meta = textPlate((x) => {
      x.font = '500 46px "IBM Plex Mono"';
      x.textBaseline = 'alphabetic';
      x.shadowColor = 'rgba(4,3,8,.9)';
      x.shadowBlur = 16;
      x.fillStyle = tintHex;
      x.fillText(yearText, 8, 48);
      const width = x.measureText(yearText).width;
      x.fillStyle = '#f2efe8';
      x.fillText(words.kind, 8 + width + 26, 48);
    }, PPU_SMALL, 1500, 74, anisotropy);
    const sum = textPlate((x) => {
      x.font = '500 56px Barlow';
      x.textBaseline = 'alphabetic';
      x.shadowColor = 'rgba(4,3,8,.9)';
      x.shadowBlur = 18;
      x.fillStyle = 'rgba(242,239,232,.94)';
      lines.forEach((line, i) => x.fillText(line, 8, 58 + i * SUM_LINE));
    }, PPU_SMALL, 1500, Math.max(340, 58 + lines.length * SUM_LINE + 28), anisotropy);

    const place = (plate: TextPlate, left: number, top: number, z: number, window: readonly [number, number], order: number): void => {
      plate.mesh.position.set(left + plate.width / 2, top - plate.height / 2, z);
      plate.z = z;
      plate.window = window;
      plate.mesh.renderOrder = order;
      this.wordSide.add(plate.mesh);
      this.plates.push(plate);
    };
    const stackTop = phone ? 0 : 0.42 + (titleLines.length === 1 ? -0.14 : 0.2);
    place(year, -0.04, stackTop + (phone ? 0.42 : 0.56), -0.75, [0.34, 0.66], 1.5);
    place(title, 0, stackTop, 0.3, [0.48, 0.8], 4);
    const below = stackTop - title.height - 0.02;
    place(meta, 0.03, below, 0.16, [0.68, 0.88], 4);
    place(sum, 0.03, below - 0.17, 0.16, [0.76, 0.98], 4);
    this.linkAt.set(0.04, below - 0.17 - (lines.length * SUM_LINE + 28) / PPU_SMALL - 0.05, 0.16);
    ruler.font = `800 ${titleSize}px Barlow`;
    const titleInk = Math.max(...titleLines.map((line) => ruler.measureText(line).width)) / PPU_BIG;
    ruler.font = '500 56px Barlow';
    const sumInk = Math.max(...lines.map((line) => ruler.measureText(line).width)) / PPU_SMALL;
    ruler.font = '500 46px "IBM Plex Mono"';
    const metaInk = (ruler.measureText(yearText).width + 26 + ruler.measureText(words.kind).width) / PPU_SMALL;
    this.inks = [
      { plate: title, width: titleInk, height: title.height },
      { plate: meta, width: metaInk, height: meta.height },
      { plate: sum, width: sumInk, height: (lines.length * SUM_LINE + 28) / PPU_SMALL },
    ];
    this.drawn = [yearText, ...titleLines, words.kind, ...lines];
  }

  /** Where it stands: worked out from where the camera will be when you read it. */
  layout(phone: boolean): void {
    const { end, read, stop } = this;
    const side = stop.side;
    this.readFrame = frameAt(read, end);
    const rf = this.readFrame;
    const forward = center(read + 9, end, new Vector3()).sub(rf.p).normalize();
    const R0 = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const U0 = new Vector3().crossVectors(R0, forward).normalize();
    const roll = bankAt(rf.T);
    const VR = R0.clone().multiplyScalar(Math.cos(roll)).addScaledVector(U0, Math.sin(roll));
    const VU = R0.clone().multiplyScalar(-Math.sin(roll)).addScaledVector(U0, Math.cos(roll));
    const view: PathFrame = { p: rf.p.clone().addScaledVector(forward, READ), T: forward, R: VR, U: VU };
    this.view = view;
    const sx = phone ? 0 : side * 1.08;
    const sy = phone ? 0.92 : this.project.screens === 'phones' ? 0.02 : 0.08;
    this.scale = phone ? 0.82 : 1;
    this.home.copy(view.p).addScaledVector(view.R, sx).addScaledVector(view.U, sy);
    this.wall.copy(view.p).addScaledVector(view.R, side * (phone ? 2.4 : 3.1)).addScaledVector(view.U, sy).addScaledVector(view.T, -1.5);
    this.face.setFromRotationMatrix(new Matrix4().lookAt(rf.p, this.home, view.U));
    this.turned.copy(this.face).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -side * 1.2));
    const backSize = this.project.screens === 'phones' ? 5.2 : 5.6;
    this.back.scale.set(backSize, backSize * 0.72, 1);
    for (const { mesh, base } of this.pieces) mesh.position.copy(base);
    const tx = phone ? -1.28 : side > 0 ? -2.12 : 0.12;
    const ty = phone ? -0.32 : 0;
    this.textHome.copy(view.p).addScaledVector(view.R, tx).addScaledVector(view.U, ty);
    this.textFace.setFromRotationMatrix(new Matrix4().lookAt(rf.p, view.p.clone().addScaledVector(view.R, tx + 1.2).addScaledVector(view.U, ty), view.U));
    this.hushAt.copy(view.p).addScaledVector(forward, 0.9);
  }

  /** Moves it for this frame, and says whether you are at it. */
  update({ s, now, mouse, sway, dissolve }: StopFrame): boolean {
    const distance = this.read - s;
    const near = nearAt(distance);
    const passed = ramp(s, this.read + 1.2, this.stop.s + 0.1);
    const show = near > 0 && s < this.stop.s + 4 && dissolve < 0.5;
    this.screenSide.visible = show;
    this.wordSide.visible = show && passed < 1;
    this.hush.visible = show;
    if (!show) return false;

    // It swings out of the wall and overshoots.
    const swing = backOut(ease(near, 0.05, 0.72), 0.9);
    const leave = ease(s, this.read + 0.7, this.read + 3.6);
    this.screenSide.position.lerpVectors(this.wall, this.home, swing * (1 - leave));
    this.screenSide.quaternion.slerpQuaternions(this.turned, this.face, clamp(swing, 0, 1.05) * (1 - leave * 0.8));
    this.screenSide.scale.setScalar(mix(0.55, 1, clamp(swing, 0, 1.1)) * this.scale * mix(1, 0.7, leave));
    // A little of the cursor moves the screen, so it feels held in space.
    this.screenSide.position.addScaledVector(this.view.R, mouse.x * 0.05 * sway).addScaledVector(this.view.U, mouse.y * 0.04 * sway);
    const lit = mix(0.3, 1, ease(near, 0.3, 0.85));
    const alpha = ease(near, 0, 0.3) * (1 - ease(leave, 0.45, 1));
    for (const screen of this.screens) {
      const { uniforms } = screen.material;
      uniforms.uA.value = alpha;
      uniforms.uOn.value = lit;
    }
    this.back.material.opacity = 0.26 * ease(near, 0.3, 0.9);
    this.hush.material.uniforms.uA.value = 0.86 * ease(near, 0.35, 0.95) * (1 - ease(passed, 0.2, 1));
    this.hush.position.copy(this.hushAt);
    this.hush.quaternion.copy(this.face);
    this.hush.scale.set(13, 8.2, 1);
    this.pieces.forEach(({ mesh, base }, i) => {
      const lift = backOut(ease(near, 0.55, 0.95), 1.6);
      const drift = sway === 0 ? 0 : 1;
      mesh.position.set(base.x + Math.sin(now / 1500 + i) * 0.02 * drift, base.y + Math.cos(now / 1300 + i) * 0.02 * drift, mix(0, base.z, lift));
      const material = mesh.material as ShaderMaterial | MeshBasicMaterial;
      if ('uniforms' in material) material.uniforms.uA.value = ease(near, 0.55, 0.8);
      else material.opacity = 0.85 * ease(near, 0.3, 0.8);
    });

    // The words arrive one by one.
    this.wordSide.position.copy(this.textHome).addScaledVector(this.view.R, mouse.x * -0.04 * sway).addScaledVector(this.view.U, mouse.y * -0.03 * sway);
    this.wordSide.quaternion.copy(this.textFace);
    for (const plate of this.plates) {
      const q = ease(near, plate.window[0], plate.window[1]);
      const { uniforms } = plate.mesh.material;
      uniforms.uReveal.value = q;
      uniforms.uA.value = (1 - ease(passed, 0.25, 1)) * ramp(q, 0, 0.2);
      plate.mesh.position.z = mix(plate.z - 0.9, plate.z, backOut(q, 1.1));
    }
    return near > 0.82 && passed < 0.7;
  }

  /** Where its link stands on the page, in CSS pixels. */
  linkPoint(out: Vector3): Vector3 {
    this.wordSide.updateMatrixWorld();
    return out.copy(this.linkAt).applyMatrix4(this.wordSide.matrixWorld);
  }

  /** The box its words cover on a page of this size: left, top, right, bottom. */
  wordsRect(camera: Camera, width: number, height: number): [number, number, number, number] {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const { plate, width: inkWidth, height: inkHeight } of this.inks) {
      plate.mesh.updateWorldMatrix(true, false);
      for (const x of [-plate.width / 2, -plate.width / 2 + inkWidth]) {
        for (const y of [plate.height / 2, plate.height / 2 - inkHeight]) {
          corner.set(x, y, 0).applyMatrix4(plate.mesh.matrixWorld).project(camera);
          const px = (corner.x * 0.5 + 0.5) * width;
          const py = (-corner.y * 0.5 + 0.5) * height;
          left = Math.min(left, px);
          right = Math.max(right, px);
          top = Math.min(top, py);
          bottom = Math.max(bottom, py);
        }
      }
    }
    return [left, top, right, bottom];
  }

  /** How far down a page of this height the left end of its last words comes: the link stands under that. */
  wordsFoot(camera: Camera, height: number): number {
    const last = this.inks[this.inks.length - 1];
    if (!last) return 0;
    last.plate.mesh.updateWorldMatrix(true, false);
    corner.set(-last.plate.width / 2, last.plate.height / 2 - last.height, 0).applyMatrix4(last.plate.mesh.matrixWorld).project(camera);
    return (-corner.y * 0.5 + 0.5) * height;
  }

  /** The box its screen covers on a page of this size: left, top, width, height. */
  pageRect(camera: Camera, width: number, height: number): [number, number, number, number] {
    const geometry = this.main.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    this.main.updateWorldMatrix(true, false);
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        corner.set(x, y, 0).applyMatrix4(this.main.matrixWorld).project(camera);
        const px = (corner.x * 0.5 + 0.5) * width;
        const py = (-corner.y * 0.5 + 0.5) * height;
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      }
    }
    return [left, top, right - left, bottom - top];
  }

  /** Whether a ray from the pointer meets its screen. */
  hit(ray: Raycaster): boolean {
    this.main.updateWorldMatrix(true, false);
    return ray.intersectObject(this.main, false).length > 0;
  }

  /** The maps its walls show, in order: the same work, seen from the wall. */
  wallPictures(): Texture[] {
    const pictures = this.screens.map((screen) => screen.material.uniforms.map.value as Texture);
    return this.project.screens === 'phones' ? [pictures[2], pictures[0], pictures[1], pictures[2]] : [pictures[0], pictures[0], pictures[0], pictures[0]];
  }

  /** Everything it has that the GPU must take in. */
  textures(): Texture[] {
    return this.plates.map((plate) => plate.mesh.material.uniforms.map.value as Texture);
  }

  /** All of it or none, for drawing it once before anything shows. */
  show(on: boolean): void {
    this.screenSide.visible = this.wordSide.visible = this.hush.visible = on;
  }

  private clearWords(): void {
    for (const plate of this.plates) {
      this.wordSide.remove(plate.mesh);
      (plate.mesh.material.uniforms.map.value as Texture).dispose();
      plate.mesh.material.dispose();
      plate.mesh.geometry.dispose();
    }
    this.plates = [];
  }

  dispose(): void {
    this.clearWords();
    for (const screen of this.screens) {
      screen.geometry.dispose();
      screen.material.dispose();
    }
    for (const { mesh } of this.pieces) {
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    }
    this.back.geometry.dispose();
    this.back.material.dispose();
    this.hush.geometry.dispose();
    this.hush.material.dispose();
  }
}
