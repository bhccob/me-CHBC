import {
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ExtrudeGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Shape,
  type Texture,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { clamp, ease, mix } from '~/journey/math';
import { irisWindowOn, windowReach } from '~/journey/world/portalWindow';
import { arrive, box, cyl, kitMaterials, part, Portal, shadowFloor, studio } from '../engine/kit';
import { canvasTexture } from '../engine/look';
import { disposeTree, Printer } from '../engine/print';
import { fovFor, Rig, type Shot, type V3 } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). D · Desk PC, in B's way: each part is drawn in gold first, then the scan line prints it solid.
 * The first view is the drawing of an empty case. Software: the motherboard boots. Game & App: the graphics card. Cyber-
 * security: the case closes round it and locks. Mechatronics: the fans and the pump spin up. Then the camera goes to the
 * front: the middle fan's rotor sinks back and the circle behind it opens onto the gold tunnel. Y is up, the front is +z,
 * the glass side is +x.
 */

const W = 0.46;
const H = 1.0;
const D = 0.92;
const X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
const FLOOR = 0.035;
const TOP = FLOOR + H;
const FAN_Y = [0.22, 0.5, 0.78] as const;
const FAN_Z = 0.4;
/** Over the front panel's hole (0.114), under the fan frame's (0.117): nothing of the inside shows round it. */
const DOOR_R = 0.116;

const GROUPS = {
  frame: { draw: -10, print: [14, 40] },
  board: { draw: 50, print: [70, 94] },
  card: { draw: 102, print: [122, 146] },
  shell: { draw: 154, print: [178, 204] },
  cooling: { draw: 206, print: [226, 250] },
} as const;

/** Gold words on a dark ground, lit from inside. */
function words(width: number, height: number, text: string, size: number, ring = false): Texture {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = '#0b0711';
    ctx.fillRect(0, 0, w, h);
    if (ring) {
      ctx.strokeStyle = '#c99a45';
      ctx.lineWidth = w * 0.025;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - w * 0.06, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#e6b84a';
    ctx.font = `500 ${size}px "IBM Plex Mono"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  });
}

const lit = (map: Texture): MeshStandardMaterial => new MeshStandardMaterial({ map, emissive: new Color(1, 1, 1), emissiveMap: map, emissiveIntensity: 0, roughness: 0.35, metalness: 0 });

/**
 * A camera key with its subject `shift` world units right of the picture's centre (the words sit at the left). On a tall
 * screen the words sit below instead: the subject stays near the middle and rides up into the top half.
 */
function framed(f: number, pos: V3, subject: V3, shift: number, fov: number, blur: number, tall: boolean): Shot {
  const ahead = new Vector3(subject[0] - pos[0], subject[1] - pos[1], subject[2] - pos[2]);
  const distance = ahead.length();
  const right = ahead.normalize().cross(new Vector3(0, 1, 0)).normalize();
  const s = tall ? shift * 0.12 : shift;
  const drop = tall ? distance * 0.17 : 0;
  return { f, pos, look: [subject[0] - right.x * s, subject[1] - drop, subject[2] - right.z * s], fov, blur, focus: distance };
}

export async function build({ renderer }: BuildContext): Promise<World> {
  renderer.localClippingEnabled = true;
  const k = kitMaterials();
  const { scene, lights } = studio(renderer, { x: 0.6, y: 3.0, z: 2.8, intensity: 90 }, new Vector3(0, 0.55, 0));
  lights.rim.position.set(-1.6, 1.8, -3.2);
  // The rig's own rim (420) floods every top face violet at this size; set again after each level().
  const RIM = 24;
  const camera = new PerspectiveCamera(30, 16 / 9, 0.05, 100);
  const pc = new Group();
  scene.add(pc, shadowFloor(0, 8, 0.5));

  // Materials of its own: the glass, the lights that come on with each part.
  const glass = new MeshPhysicalMaterial({ color: '#2a2238', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.2, depthWrite: false });
  // The case's outside: powder-coated, so the warm key reads on it (the kit's anodised metal stays for the parts inside).
  const coat = new MeshPhysicalMaterial({ color: '#221c2b', metalness: 0.35, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const lockLight = k.led.clone();
  const fanLight = k.led.clone();
  const cardText = words(512, 64, 'BC-2006', 40);
  const pumpText = words(256, 256, 'BC-2006', 40, true);
  const cardWords = lit(cardText);
  const pumpWords = lit(pumpText);
  const own = [glass, coat, lockLight, fanLight, cardText, pumpText, cardWords, pumpWords];

  // ---------------------------------------------------------------- the frame (the first view's drawing)
  const frame = new Group();
  for (const x of [-0.18, 0.18]) for (const z of [-0.4, 0.4]) frame.add(part(cyl(0.022, 0.026, FLOOR, 24), k.dark, x, FLOOR / 2, z));
  frame.add(part(box(W, 0.012, D, 0.004), coat, 0, FLOOR + 0.006, 0));
  frame.add(part(box(0.012, H - 0.03, D - 0.03, 0.003), coat, -0.2, FLOOR + H / 2, 0));
  for (const x of [X0 + 0.008, X1 - 0.008]) {
    for (const z of [Z0 + 0.008, Z1 - 0.008]) frame.add(part(box(0.016, H, 0.016, 0.003), k.steel, x, FLOOR + H / 2, z));
    frame.add(part(box(0.016, 0.016, D, 0.003), k.steel, x, TOP - 0.008, 0));
  }
  for (const z of [Z0 + 0.008, Z1 - 0.008]) frame.add(part(box(W, 0.016, 0.016, 0.003), k.steel, 0, TOP - 0.008, z));
  frame.add(part(box(0.405, 0.2, 0.74, 0.01), coat, 0.012, FLOOR + 0.112, -0.08), part(box(0.405, 0.006, 0.006, 0), k.gold, 0.012, FLOOR + 0.212, 0.29));
  pc.add(frame);

  // ---------------------------------------------------------------- 01 Software: the motherboard
  const board = new Group();
  board.add(part(box(0.01, 0.68, 0.54, 0.004), k.pcb, -0.183, 0.66, -0.17));
  board.add(part(box(0.008, 0.13, 0.13, 0.003), k.steel, -0.174, 0.8, -0.2), part(box(0.012, 0.1, 0.1, 0.004), k.chip, -0.168, 0.8, -0.2));
  board.add(part(box(0.04, 0.05, 0.2, 0.006), k.metal, -0.158, 0.92, -0.24), part(box(0.04, 0.2, 0.05, 0.006), k.metal, -0.158, 0.78, -0.35));
  board.add(part(box(0.06, 0.2, 0.07, 0.008), k.metal, -0.148, 0.86, -0.4), part(box(0.003, 0.16, 0.003, 0), k.gold, -0.117, 0.86, -0.365));
  for (let i = 0; i < 4; i++) {
    const z = -0.085 + i * 0.022;
    board.add(part(box(0.07, 0.3, 0.012, 0.002), k.metal, -0.143, 0.8, z), part(box(0.006, 0.28, 0.013, 0.001), k.led, -0.106, 0.8, z));
  }
  board.add(part(box(0.01, 0.045, 0.2, 0.004), k.metal, -0.172, 0.58, -0.22), part(box(0.03, 0.11, 0.022, 0.003), k.dark, -0.163, 0.66, 0.085));
  pc.add(board);

  // ---------------------------------------------------------------- 02 Game & App: the graphics card
  const card = new Group();
  const [GX, GY, GZ] = [-0.044, 0.425, -0.105];
  card.add(part(box(0.27, 0.1, 0.67, 0.012), coat, GX, GY, GZ), part(box(0.268, 0.008, 0.66, 0.003), k.dark, GX, GY + 0.054, GZ));
  card.add(part(box(0.004, 0.026, 0.6, 0.001), k.gold, GX + 0.136, GY + 0.02, GZ), part(box(0.04, 0.016, 0.06, 0.003), k.dark, GX + 0.06, GY + 0.066, GZ + 0.15));
  const cardLabel = new Mesh(new PlaneGeometry(0.2, 0.025), cardWords);
  cardLabel.position.set(GX + 0.1365, GY - 0.02, GZ + 0.12);
  cardLabel.rotation.y = Math.PI / 2;
  card.add(cardLabel);
  const power = new CatmullRomCurve3([new Vector3(0.016, 0.49, 0.045), new Vector3(0.03, 0.55, 0.15), new Vector3(0.06, 0.45, 0.26), new Vector3(0.07, 0.26, 0.27)]);
  card.add(part(new TubeGeometry(power, 40, 0.008, 8), k.dark));
  pc.add(card);

  // ---------------------------------------------------------------- 03 Cybersecurity: the case closes and locks
  const shell = new Group();
  const lid = part(box(W, 0.018, D, 0.006), coat, 0, TOP + 0.009, 0);
  lid.add(part(cyl(0.014, 0.014, 0.006, 24), k.gold, -0.15, 0.012, 0.36));
  const back = part(box(W - 0.02, H, 0.012, 0.003), coat, 0, FLOOR + H / 2, Z0 - 0.006);
  const wall = part(box(0.012, H, D, 0.004), coat, X0 - 0.006, FLOOR + H / 2, 0);
  const face = new Shape();
  face.moveTo(-W / 2, 0);
  face.lineTo(W / 2, 0);
  face.lineTo(W / 2, H);
  face.lineTo(-W / 2, H);
  face.closePath();
  for (const y of FAN_Y) {
    const hole = new Path();
    hole.absarc(0, y - FLOOR, 0.114, 0, Math.PI * 2, true);
    face.holes.push(hole);
  }
  const front = part(new ExtrudeGeometry(face, { depth: 0.024, bevelEnabled: false, curveSegments: 48 }), coat, 0, FLOOR, Z1 - 0.012);
  front.add(part(box(0.006, H - 0.12, 0.006, 0), lockLight, X0 + 0.03, H / 2, 0.026));
  const door = new Group();
  door.add(part(box(0.006, H - 0.02, D - 0.02, 0.002), glass, X1 + 0.003, FLOOR + H / 2, 0));
  const screws: Mesh[] = [];
  for (const y of [FLOOR + 0.04, TOP - 0.04]) {
    for (const z of [Z0 + 0.04, Z1 - 0.04]) {
      const screw = part(cyl(0.011, 0.011, 0.01, 20), k.gold, X1 + 0.011, y, z);
      screw.rotation.z = Math.PI / 2;
      screw.add(part(box(0.016, 0.003, 0.003, 0), k.dark, 0, 0.0055, 0));
      screws.push(screw);
      door.add(screw);
    }
  }
  shell.add(lid, back, wall, front, door);
  // The panels let the key light through (they would shut the inside in the dark); the shadow on the floor is the frame's.
  shell.traverse((node) => {
    if (node instanceof Mesh) node.castShadow = false;
  });
  pc.add(shell);
  const panels: [Object3D, Vector3, number][] = [
    [lid, new Vector3(0, 0.45, 0), 154],
    [wall, new Vector3(-0.45, 0, 0), 156],
    [back, new Vector3(0, 0, -0.45), 158],
    [front, new Vector3(0, 0, 0.5), 160],
    [door, new Vector3(0.6, 0, 0), 166],
  ];
  const panelHomes = panels.map(([o]) => o.position.clone());

  // ---------------------------------------------------------------- 04 Mechatronics: fans, radiator, pump and tubes
  const cooling = new Group();
  const blade = (r0: number, r1: number): ExtrudeGeometry => {
    const s = new Shape();
    s.moveTo(r0, -0.012);
    s.lineTo(r1 - 0.012, -0.03);
    s.quadraticCurveTo(r1 + 0.004, 0, r1 - 0.012, 0.028);
    s.lineTo(r0, 0.014);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, -0.0015);
    return g;
  };
  const rotors: Group[] = [];
  const fanAt = (x: number, y: number, z: number): Group => {
    const fan = new Group();
    fan.position.set(x, y, z);
    const half = 0.125;
    const square = new Shape();
    square.moveTo(-half, -half);
    square.lineTo(half, -half);
    square.lineTo(half, half);
    square.lineTo(-half, half);
    square.closePath();
    const hole = new Path();
    hole.absarc(0, 0, half - 0.008, 0, Math.PI * 2, true);
    square.holes.push(hole);
    fan.add(part(new ExtrudeGeometry(square, { depth: 0.05, bevelEnabled: false, curveSegments: 40 }), k.dark, 0, 0, -0.025));
    fan.add(part(new TorusGeometry(half - 0.008, 0.0035, 6, 64), fanLight, 0, 0, 0.026));
    for (let i = 0; i < 3; i++) {
      const arm = new Group();
      arm.rotation.z = Math.PI / 6 + (i * Math.PI * 2) / 3;
      arm.add(part(box(0.08, 0.01, 0.006, 0), k.dark, 0.08, 0, -0.022));
      fan.add(arm);
    }
    const rotor = new Group();
    const hub = part(cyl(0.042, 0.042, 0.034, 32), k.metal);
    hub.rotation.x = Math.PI / 2;
    const cap = part(cyl(0.03, 0.03, 0.002, 32), k.gold, 0, 0, 0.0175);
    cap.rotation.x = Math.PI / 2;
    rotor.add(hub, cap);
    const shape = blade(0.04, half - 0.012);
    for (let i = 0; i < 7; i++) {
      const pivot = new Group();
      pivot.rotation.z = (i * Math.PI * 2) / 7;
      const b = part(shape, k.metal);
      b.rotation.x = 0.55;
      pivot.add(b);
      rotor.add(pivot);
    }
    fan.add(rotor);
    rotors.push(rotor);
    cooling.add(fan);
    return fan;
  };
  for (const y of FAN_Y) fanAt(0, y, FAN_Z);
  fanAt(0.02, 0.8, Z0 + 0.06);
  cooling.add(part(box(0.27, 0.28, 0.026, 0.004), k.dark, 0.02, 0.8, Z0 + 0.022));
  const pump = new Group();
  pump.position.set(-0.135, 0.8, -0.2);
  const body = part(cyl(0.055, 0.058, 0.045, 48), k.metal);
  body.rotation.z = Math.PI / 2;
  const rim = part(new TorusGeometry(0.05, 0.004, 8, 64), k.gold, 0.0235, 0, 0);
  rim.rotation.y = Math.PI / 2;
  const screen = new Mesh(new CircleGeometry(0.046, 48), pumpWords);
  screen.position.x = 0.0236;
  screen.rotation.y = Math.PI / 2;
  pump.add(body, rim, screen);
  cooling.add(pump);
  const hose = (points: V3[]): Mesh => part(new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), 48, 0.011, 8), k.dark);
  cooling.add(hose([[-0.112, 0.83, -0.21], [-0.07, 0.9, -0.23], [-0.03, 0.985, -0.32], [-0.01, 0.99, -0.42], [0.0, 0.945, -0.438]]));
  cooling.add(hose([[-0.112, 0.77, -0.19], [-0.05, 0.8, -0.24], [0.04, 0.98, -0.33], [0.08, 0.99, -0.42], [0.08, 0.945, -0.438]]));
  pc.add(cooling);

  // The way in: a disc behind the middle front fan's rotor. It glows once the fans run, then opens onto the tunnel.
  const way = new Portal(new CircleGeometry(DOOR_R, 64), FrontSide);
  way.mesh.position.set(0, FAN_Y[1], FAN_Z - 0.02);
  pc.add(way.mesh);
  const inside = new PointLight(0xffc68a, 0, 1.4, 2);
  inside.position.set(0.05, 0.95, 0.1);
  pc.add(inside);

  // ---------------------------------------------------------------- the build
  const printer = new Printer(scene, [
    { roots: [frame], ...GROUPS.frame },
    { roots: [board], ...GROUPS.board },
    { roots: [card], ...GROUPS.card },
    { roots: [shell], ...GROUPS.shell },
    { roots: [cooling], ...GROUPS.cooling },
  ], 'y', () => false, 20);
  renderer.compile(scene, camera);

  const homes = { board: board.position.clone(), card: card.position.clone(), cooling: cooling.position.clone() };
  const shots = (tall: boolean): Shot[] => [
    framed(0, [2.9, 1.25, 2.7], [0, 0.55, 0], 0.62, 28, 1.4, tall),
    framed(40, [2.7, 1.2, 2.5], [0, 0.55, 0], 0.56, 28, 1.4, tall),
    framed(84, [2.0, 1.2, 1.55], [-0.12, 0.66, -0.12], 0.34, 28, 1.8, tall),
    framed(130, [1.95, 0.9, 1.75], [-0.06, 0.5, -0.08], 0.34, 28, 1.8, tall),
    framed(186, [2.6, 1.3, 2.3], [0, 0.55, 0], 0.46, 28, 1.4, tall),
    framed(240, [2.1, 1.05, 2.0], [0, 0.62, 0.02], 0.38, 28, 1.6, tall),
    framed(286, [1.7, 0.55, 2.6], [0, 0.55, 0.1], 0.4, 28, 1.4, tall),
    framed(312, [0.6, 0.55, 1.9], [0, 0.5, FAN_Z], 0.3, 30, 1.0, tall),
    { f: 330, pos: [0.06, 0.5, 1.15], look: [0, 0.5, 0.38], fov: 34, blur: 0.4 },
    { f: 344, pos: [0, 0.5, 0.82], look: [0, 0.5, 0.3], fov: 34, blur: 0 },
    { f: 356, pos: [0, 0.5, 0.63], look: [0, 0.5, 0.25], fov: 34, blur: 0 },
    { f: 364, pos: [0, 0.5, 0.53], look: [0, 0.5, 0.2], fov: 34, blur: 0 },
    { f: 372, pos: [0, 0.5, 0.47], look: [0, 0.5, 0.15], fov: 34, blur: 0 },
  ];
  const wide = new Rig(shots(false)), tall = new Rig(shots(true));
  const pos = new Vector3(), look = new Vector3();
  const aim = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
  const wayAt = new Vector3();
  let spin = 0, rpm = 0;

  return {
    scene,
    camera,
    transparent: true,
    post: { bloom: 0.3, threshold: 1.0, contrast: 1.24, saturation: 1.2 },
    beats: {
      heroOut: [6, 28],
      steps: [
        [44, 56, 94, 102],
        [100, 112, 146, 154],
        [152, 164, 202, 208],
        [206, 218, 266, 276],
      ],
    },

    timeline() {},

    frame(f, _nowS, dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      arrive(board, homes.board, new Vector3(0.5, 0, 0), f, GROUPS.board.draw);
      arrive(card, homes.card, new Vector3(0.5, 0, 0), f, GROUPS.card.draw);
      panels.forEach(([o, from, at], i) => arrive(o, panelHomes[i], from, f, at, 22));
      arrive(cooling, homes.cooling, new Vector3(0, 0, 0), f, GROUPS.cooling.draw);
      for (const screw of screws) screw.rotation.x = ease(f, 188, 200) * Math.PI * 1.5;

      // Power: the board's traces and memory light with the software, the card's name with the card, the case's strip
      // once it locks, the fans' rings as they spin up, and the pump's face.
      k.pcb.emissiveIntensity = 1.5 * ease(f, 88, 100);
      k.led.emissiveIntensity = 3 * ease(f, 92, 98);
      cardWords.emissiveIntensity = 2.2 * ease(f, 140, 150);
      lockLight.emissiveIntensity = 3 * ease(f, 194, 202);
      fanLight.emissiveIntensity = 2.4 * ease(f, 252, 272);
      pumpWords.emissiveIntensity = 2.4 * ease(f, 240, 250);
      inside.intensity = 0.35 * lamp * ease(f, 90, 102);

      // The fans run on time once they are built (a fan does not stop when the page does).
      const speed = ease(f, 248, 276);
      spin += (dt || 0) * speed * Math.PI * 2 * 1.4;
      rpm = Math.round(1450 * speed);
      rotors.forEach((rotor, i) => (rotor.rotation.z = spin + i * 0.7));
      rotors[1].position.z = -0.075 * ease(f, 336, 350);
      way.mesh.visible = f >= GROUPS.cooling.print[1];
      way.set(0.8 * ease(f, 270, 300), ease(f, 336, 346), [2.6, 1.3, 0.32]);

      // The camera, with a little lean toward the cursor until it heads for the fan.
      const shot = (aspect < 1 ? tall : wide).at(f, pos, look);
      const free = 1 - ease(f, 286, 306);
      const k1 = 1 - Math.exp(-(dt || 0.016) / 0.4);
      lean.x += (aim.x - lean.x) * k1;
      lean.y += (aim.y - lean.y) * k1;
      pos.x += lean.x * 0.08 * free;
      pos.z -= lean.x * 0.05 * free;
      pos.y += lean.y * 0.05 * free;
      camera.position.copy(pos);
      camera.lookAt(look);
      camera.aspect = aspect;
      camera.fov = fovFor(shot.fov, aspect);
      camera.near = f > 320 ? 0.01 : 0.05;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      lights.level(lamp);
      lights.rim.intensity = RIM * (0.25 + 0.75 * lamp);
      printer.update(f, width, height, renderer.getPixelRatio(), [272, 292]);
      const after = ease(f, 330, 356);
      return { focus: shot.focus, blur: shot.blur * (1 - after), grain: mix(0.02, 0, after), vignette: mix(0.3, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    window(f) {
      if (!irisWindowOn(f)) return null;
      way.mesh.getWorldPosition(wayAt);
      return { center: [wayAt.x, wayAt.y, wayAt.z], edge: [wayAt.x + DOOR_R, wayAt.y, wayAt.z], reach: windowReach(f) };
    },

    pointer(x, y) {
      aim.x = clamp(x, -1, 1);
      aim.y = clamp(y, -1, 1);
    },

    readout(f) {
      if (f < 14) return 'Drawing · the case';
      if (f < 44) return 'Printing · the frame';
      if (f < 102) return f < 88 ? 'Board · placed' : 'Boot · BIOS OK';
      if (f < 154) return f < 140 ? 'GPU · PCIe x16' : 'GPU · BC-2006';
      if (f < 206) return f < 194 ? 'Case · closing' : 'Case · locked';
      if (f < 280) return `Fans · ${String(rpm).padStart(4, '0')} rpm`;
      return f < 330 ? 'Running · BC-2006' : 'Intake';
    },

    dispose() {
      renderer.localClippingEnabled = false;
      printer.dispose();
      way.dispose();
      disposeTree(pc);
      for (const thing of own) thing.dispose();
      scene.environment?.dispose();
      k.dispose();
    },
  };
}
