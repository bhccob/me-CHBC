import { AdditiveBlending, BoxGeometry, type Camera, Group, Matrix4, Mesh, MeshBasicMaterial, type MeshStandardMaterial, type Object3D, Quaternion, type Scene, type Vector2, Vector3 } from 'three';
import { backOut, clamp, ease, mix, ramp } from '../../math';
import { noQuestionText, PHONE_BIG, PHONE_LINE, PHONE_SMALL, PHONE_TYPE, PPU_BIG, PPU_SMALL, type QuestionText } from '../../qaType';
import { displayReferred } from '../displayOutput';
import { type TextPlate, textPlate } from '../flight/textures';
import { wrapLines } from '../flight/wrap';
import { endFov, FLOOR, QA_WORD_DISTANCE, QREAD, QUESTION_DISTANCES, voidAt, voidPose } from './path';

/** Which side of the way a question's gear stands. Its words stand on the other. */
export function questionSide(i: number): 1 | -1 {
  return i % 2 ? -1 : 1;
}

export interface QuestionWords {
  question: string;
  answer: string;
}

/** What each frame gives the questions. */
export interface QuestionsFrame {
  distance: number;
  now: number;
  mouse: Vector2;
  sway: number;
}

/** A question as it stands, for those checking it. */
export interface QuestionReport {
  words: string[];
  /** The box its words cover on the page: left, top, right, bottom. */
  rect: [number, number, number, number];
  gear: boolean;
  shown: boolean;
}

const INK = '#f6f1e6';
const UP = new Vector3(0, 1, 0);
/** The height the camera travels at. */
const EYE_HEIGHT = FLOOR + 2.2;

const corner = new Vector3();

/** A point of the world on the page, CSS px from the top left. */
function toPage(point: Vector3, camera: Camera, width: number, height: number): [number, number] {
  point.project(camera);
  return [(point.x * 0.5 + 0.5) * width, (-point.y * 0.5 + 0.5) * height];
}

interface Stop {
  i: number;
  d: number;
  group: Group;
  gear: Object3D;
  gearMaterials: MeshStandardMaterial[];
  leader: Mesh<BoxGeometry, MeshBasicMaterial>;
  pad: Mesh<BoxGeometry, MeshBasicMaterial>;
  stub: Mesh<BoxGeometry, MeshBasicMaterial>;
  title: TextPlate | null;
  answer: TextPlate | null;
  plates: TextPlate[];
  drawn: string[];
  left: number;
  top: number;
  total: number;
  /** The width its words wrap at, in units of the world. */
  wrap: number;
  home: Vector3;
  right: Vector3;
  face: Quaternion;
}

function gold(): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, fog: false });
  material.color.setRGB(1, 0.74, 0.34);
  return displayReferred(material, false);
}

const disposeWords = (group: Object3D, plate: TextPlate): void => {
  group.remove(plate.mesh);
  (plate.mesh.material.uniforms.map.value as { dispose(): void }).dispose();
  plate.mesh.material.dispose();
  plate.mesh.geometry.dispose();
};

/**
 * The questions hang beside the line, alternating sides, and you read them while moving: the question in large caps, the
 * answer under it, a thin leader line down to the floor, and on the other side a slowly turning open gold gear with its number
 * in hollow type.
 */
export class Questions {
  private readonly scene: Scene;
  private readonly end: number;
  private readonly stops: Stop[];
  private word: TextPlate | null = null;

  constructor(scene: Scene, model: Object3D, end: number) {
    this.scene = scene;
    this.end = end;
    const source = model.getObjectByName('qgear');
    if (!source) throw new Error('the gate has no part "qgear"');
    this.stops = QUESTION_DISTANCES.map((d, i) => {
      const group = new Group();
      scene.add(group);
      const gear = source.clone(true);
      const gearMaterials: MeshStandardMaterial[] = [];
      gear.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        // Each its own, since each gear fades alone. A copy does not keep how it writes to the picture.
        const material = displayReferred((mesh.material as MeshStandardMaterial).clone(), true);
        material.opacity = 1;
        mesh.material = material;
        mesh.renderOrder = 1;
        gearMaterials.push(material);
      });
      gear.position.set(0, 0, 0);
      group.add(gear);
      const leader = new Mesh(new BoxGeometry(0.012, 1, 0.012), gold());
      leader.frustumCulled = false;
      group.add(leader);
      const pad = new Mesh(new BoxGeometry(0.1, 0.02, 0.1), gold());
      pad.frustumCulled = false;
      group.add(pad);
      const stub = new Mesh(new BoxGeometry(1, 0.008, 0.02), gold());
      stub.frustumCulled = false;
      scene.add(stub);
      return { i, d, group, gear, gearMaterials, leader, pad, stub, title: null, answer: null, plates: [], drawn: [], left: 0, top: 0, total: 0, wrap: 0, home: new Vector3(), right: new Vector3(), face: new Quaternion() };
    });
  }

  /** The big word, standing in the void as you straighten up. */
  buildWord(text: string, phone: boolean, anisotropy: number): void {
    if (this.word) disposeWords(this.scene, this.word);
    const ruler = document.createElement('canvas').getContext('2d')!;
    ruler.font = '800 520px Barlow';
    ruler.letterSpacing = '-8px';
    const width = Math.ceil(ruler.measureText(text).width + 44);
    const word = textPlate((x) => {
      x.font = '800 520px Barlow';
      x.textBaseline = 'alphabetic';
      x.letterSpacing = '-8px';
      x.fillStyle = INK;
      x.fillText(text, 20, 520 * 0.86 + 10);
    }, 100, width, Math.round(520 * 1), anisotropy);
    word.mesh.renderOrder = 2;
    const at = voidAt(QA_WORD_DISTANCE, new Vector3(), this.end);
    const forward = voidAt(QA_WORD_DISTANCE + 1, new Vector3(), this.end).sub(at).setY(0).normalize();
    word.mesh.position.copy(at).setY(EYE_HEIGHT + 1.6);
    // A tall page sees little to the sides: there it stands where the camera is looking as it comes.
    if (phone) {
      const pose = voidPose(QA_WORD_DISTANCE - 15, this.end, { place: new Vector3(), look: new Vector3(), T: new Vector3(), R: new Vector3(), U: new Vector3(), roll: 0, arrive: 0, sway: 1, lens: 1 });
      const ahead = pose.look.clone().sub(pose.place).setY(0).normalize();
      const far = Math.hypot(at.x - pose.place.x, at.z - pose.place.z);
      word.mesh.position.set(pose.place.x + ahead.x * far, EYE_HEIGHT + 1.6, pose.place.z + ahead.z * far);
      forward.copy(ahead);
    }
    word.mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(forward.clone().cross(UP).normalize(), UP, forward.clone().negate()));
    word.mesh.scale.setScalar(phone ? 0.42 : 0.72);
    this.scene.add(word.mesh);
    this.word = word;
  }

  /** Draws one question's words: on a new language, or when the page turns into a phone's. */
  buildQuestion(i: number, words: QuestionWords, phone: boolean, anisotropy: number, aspect = 1): void {
    const stop = this.stops[i];
    for (const plate of stop.plates) disposeWords(stop.group, plate);
    stop.plates = [];
    const side = questionSide(i);
    const big = phone ? PHONE_BIG : 148;
    const small = phone ? PHONE_SMALL : 62;
    const line = phone ? PHONE_LINE : 84;
    // On a phone they take the page's width at the reading distance, and no more.
    const across = Math.min(3.3, 2 * QREAD * Math.tan((endFov(true) * Math.PI) / 360) * aspect - 0.32);
    const wrapQ = phone ? across : 3.6;
    const wrapA = phone ? across : 3.1;
    const ruler = document.createElement('canvas').getContext('2d')!;
    ruler.font = `800 ${big}px Barlow`;
    ruler.letterSpacing = '-3px';
    const qLines = wrapLines(words.question.toUpperCase(), wrapQ * PPU_BIG, (s) => ruler.measureText(s).width);
    ruler.font = `500 ${small}px Barlow`;
    ruler.letterSpacing = '0px';
    const aLines = wrapLines(words.answer, wrapA * PPU_SMALL, (s) => ruler.measureText(s).width);
    stop.drawn = [...qLines, ...aLines];

    const title = textPlate((x) => {
      x.font = `800 ${big}px Barlow`;
      x.textBaseline = 'alphabetic';
      x.letterSpacing = '-3px';
      x.fillStyle = INK;
      x.shadowColor = 'rgba(4,3,8,.8)';
      x.shadowBlur = 24;
      qLines.forEach((text, n) => x.fillText(text, 8, big * 0.86 + n * big * 0.92 + 8));
    }, PPU_BIG, Math.round(wrapQ * PPU_BIG + 40), Math.round(big * (0.14 + qLines.length * 0.92) + 16), anisotropy);
    const answer = textPlate((x) => {
      x.font = `500 ${small}px Barlow`;
      x.textBaseline = 'alphabetic';
      x.fillStyle = 'rgba(242,239,232,.94)';
      x.shadowColor = 'rgba(4,3,8,.95)';
      x.shadowBlur = 16;
      aLines.forEach((text, n) => x.fillText(text, 8, small + n * line));
    }, PPU_SMALL, Math.round(wrapA * PPU_SMALL + 40), Math.round(aLines.length * line + small * 0.6), anisotropy);
    const hollow = textPlate((x) => {
      x.font = `800 ${phone ? 200 : 300}px Barlow`;
      x.textBaseline = 'alphabetic';
      x.letterSpacing = '-6px';
      x.lineWidth = 3.5;
      x.strokeStyle = 'rgba(230,184,74,.95)';
      x.strokeText(String(i + 1).padStart(2, '0'), 14, 300);
    }, PPU_BIG, 640, 340, anisotropy);

    const place = (plate: TextPlate, left: number, top: number, z: number, window: readonly [number, number], order: number): void => {
      plate.mesh.position.set(left + plate.width / 2, top - plate.height / 2, z);
      plate.z = z;
      plate.window = window;
      plate.mesh.renderOrder = order;
      stop.group.add(plate.mesh);
      stop.plates.push(plate);
    };
    const total = title.height + 0.14 + answer.height;
    const left = phone ? -across / 2 : side > 0 ? -3.55 : 0.05;
    const top = phone ? total / 2 - 0.9 : total / 2 + 0.12;
    place(title, left, top, 0.2, [0.42, 0.74], 4);
    place(answer, left + 0.03, top - title.height - 0.14, 0.1, [0.62, 0.96], 4);
    const gx = phone ? across / 2 - 0.62 : side * 2.05;
    const gy = phone ? top + 0.95 : -0.12;
    stop.gear.position.set(gx, gy, -0.3);
    place(hollow, gx - (phone ? 0.75 : 1.2), gy + (phone ? 0.95 : 1.66), -0.7, [0.24, 0.6], 2);
    stop.title = title;
    stop.answer = answer;
    stop.left = left;
    stop.top = top;
    stop.total = total;
    stop.wrap = wrapQ;
    // On a phone the page sets these words in type (`pageWords`): the plates are kept for their place, never drawn.
    title.mesh.visible = !phone;
    answer.mesh.visible = !phone;
    this.layoutStop(stop);
  }

  /**
   * Where the page sets each question's words on a phone, this frame, into `out` (one entry for each question). The camera
   * must be placed for this frame. Nothing shows where the plates are not in view.
   */
  pageWords(camera: Camera, width: number, height: number, out: QuestionText[]): void {
    camera.updateMatrixWorld();
    this.stops.forEach((stop, i) => {
      const text = (out[i] ??= noQuestionText());
      const { title, answer } = stop;
      text.shown = stop.group.visible && title !== null && answer !== null;
      if (!text.shown || !title || !answer) return;
      stop.group.updateMatrixWorld();
      const [tx, ty] = toPage(corner.set(-title.width / 2, title.height / 2, 0).applyMatrix4(title.mesh.matrixWorld), camera, width, height);
      const [rx] = toPage(corner.set(title.width / 2, title.height / 2, 0).applyMatrix4(title.mesh.matrixWorld), camera, width, height);
      const [ax, ay] = toPage(corner.set(-answer.width / 2, answer.height / 2, 0).applyMatrix4(answer.mesh.matrixWorld), camera, width, height);
      const unit = (rx - tx) / title.width;
      const inset = PHONE_TYPE.inset * unit;
      text.unit = unit;
      text.width = stop.wrap * unit;
      text.titleX = tx + inset;
      text.titleY = ty;
      text.answerX = ax + inset;
      text.answerY = ay;
      text.titleA = title.mesh.material.uniforms.uA.value as number;
      text.titleReveal = title.mesh.material.uniforms.uReveal.value as number;
      text.answerA = answer.mesh.material.uniforms.uA.value as number;
      text.answerReveal = answer.mesh.material.uniforms.uReveal.value as number;
    });
  }

  private layoutStop(stop: Stop): void {
    const { end } = this;
    const eye = voidAt(stop.d - QREAD, new Vector3(), end);
    const forward = voidAt(stop.d - QREAD + 11, new Vector3(), end).sub(eye).setY(0).normalize();
    stop.right.crossVectors(forward, UP).normalize();
    stop.home.copy(eye).addScaledVector(forward, QREAD);
    stop.face.setFromRotationMatrix(new Matrix4().makeBasis(stop.right, UP, forward.clone().negate()));
    // A leader line from the block's corner down to the floor, and a stub back to the gold line.
    const lx = stop.left - 0.14;
    const floorY = FLOOR - stop.home.y;
    const h = stop.top - floorY;
    stop.leader.scale.y = h;
    stop.leader.position.set(lx, stop.top - h / 2, 0);
    stop.pad.position.set(lx, floorY + 0.01, 0);
    const foot = stop.home.clone().addScaledVector(stop.right, lx).setY(FLOOR + 0.012);
    const middle = voidAt(stop.d, new Vector3(), end).setY(FLOOR + 0.012);
    const v = foot.clone().sub(middle);
    stop.stub.position.copy(middle).addScaledVector(v, 0.5);
    stop.stub.scale.x = v.length();
    stop.stub.rotation.y = -Math.atan2(v.z, v.x);
    stop.group.position.copy(stop.home);
    stop.group.quaternion.copy(stop.face);
  }

  /** Everything it has that the GPU must take in. */
  textures(): { dispose(): void }[] {
    const plates = [...this.stops.flatMap((stop) => stop.plates), ...(this.word ? [this.word] : [])];
    return plates.map((plate) => plate.mesh.material.uniforms.map.value as { dispose(): void });
  }

  update({ distance, now, mouse, sway }: QuestionsFrame, phone: boolean): void {
    for (const stop of this.stops) {
      const r = stop.d - QREAD;
      const near = 1 - ramp(r - distance, 0, 15);
      const passed = ramp(distance, r + 1.4, stop.d - 0.7);
      const show = near > 0 && passed < 1;
      stop.group.visible = show;
      stop.stub.visible = distance > stop.d - 30 && distance < stop.d + 12;
      const fade = 0.9 * ease(near, 0.3, 0.7) * (1 - ease(passed, 0.3, 1));
      stop.stub.material.opacity = fade;
      if (!show) continue;
      stop.group.position.copy(stop.home).addScaledVector(stop.right, mouse.x * -0.05 * sway);
      stop.group.position.y += mouse.y * -0.03 * sway;
      stop.group.quaternion.copy(stop.face);
      stop.gear.rotation.z = distance * 0.32 + now / 4000;
      const grow = backOut(ease(near, 0.2, 0.7), 1.2);
      stop.gear.scale.setScalar((phone ? 0.62 : 1.02) * clamp(grow, 0, 1.2));
      stop.gear.visible = grow > 0.01;
      const gearOpacity = 1 - ease(passed, 0.3, 1);
      for (const material of stop.gearMaterials) material.opacity = gearOpacity;
      stop.leader.material.opacity = fade;
      stop.pad.material.opacity = fade;
      for (const plate of stop.plates) {
        const q = ease(near, plate.window[0], plate.window[1]);
        const { uniforms } = plate.mesh.material;
        uniforms.uReveal.value = q;
        uniforms.uA.value = (1 - ease(passed, 0.2, 1)) * ramp(q, 0, 0.2);
        plate.mesh.position.z = mix(plate.z - 0.9, plate.z, backOut(q, 1.1));
      }
    }
    if (this.word) {
      const a = ease(distance, QA_WORD_DISTANCE - 34, QA_WORD_DISTANCE - 22) * (1 - ease(distance, QA_WORD_DISTANCE - 9, QA_WORD_DISTANCE - 3));
      this.word.mesh.visible = a > 0.002;
      this.word.mesh.material.uniforms.uA.value = a;
      this.word.mesh.material.uniforms.uReveal.value = 1;
    }
  }

  /** All of them or none, for drawing them once before anything shows. */
  show(on: boolean): void {
    for (const stop of this.stops) stop.group.visible = stop.stub.visible = on;
    if (this.word) this.word.mesh.visible = on;
  }

  report(camera: Camera, width: number, height: number): QuestionReport[] {
    return this.stops.map((stop) => {
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      stop.group.updateMatrixWorld();
      for (const plate of [stop.title, stop.answer]) {
        if (!plate) continue;
        const { mesh } = plate;
        for (const x of [-plate.width / 2, plate.width / 2]) {
          for (const y of [-plate.height / 2, plate.height / 2]) {
            corner.set(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera);
            const px = (corner.x * 0.5 + 0.5) * width;
            const py = (-corner.y * 0.5 + 0.5) * height;
            left = Math.min(left, px);
            right = Math.max(right, px);
            top = Math.min(top, py);
            bottom = Math.max(bottom, py);
          }
        }
      }
      return { words: stop.drawn, rect: [left, top, right, bottom], gear: stop.gear.visible && stop.group.visible, shown: stop.group.visible };
    });
  }

  dispose(): void {
    for (const stop of this.stops) {
      for (const plate of stop.plates) disposeWords(stop.group, plate);
      for (const material of stop.gearMaterials) material.dispose();
      for (const mesh of [stop.leader, stop.pad, stop.stub]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.scene.remove(stop.group, stop.stub);
    }
    if (this.word) disposeWords(this.scene, this.word);
  }
}
