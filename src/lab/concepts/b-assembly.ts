import { gsap } from 'gsap';
import { AdditiveBlending, BoxGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { clamp, ease, mix, ramp } from '~/journey/math';
import { Chip } from '../engine/chip';
import { canvasTexture, GOLD_HOT, palette, studioLights, studioScene } from '../engine/look';
import { Bag } from '../engine/props';
import { fovFor, Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). B · Assembly. A macro view of one big board, in centimetres. A feeder slides out (the drawer), a
 * two-head gantry places real parts onto the pads of BOB CHUNG, a heat band solders them, power runs through the copper
 * and lights the name, and the camera drops to the board and follows the live trace into the BC-2006 processor: the
 * tunnel.
 */

const FONT: Record<string, string[]> = {
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
};
const PITCH = 0.8;
const NAME_X = -4;
const NAME_Z = -1.2;
const BOARD = { w: 60, d: 34 };
const FEEDER_Z = 19.5;
const CPU = new Vector3(23, 0, -1.2);
const CPU_SCALE = 4;
const PLACE: readonly [number, number] = [96, 186];

interface Part {
  x: number;
  z: number;
  /** Lies across x (true) or z. */
  across: boolean;
  kind: 0 | 1;
  /** Which head places it, which cycle, and when (frames). */
  head: 0 | 1;
  pick: number;
  place: number;
  column: number;
}

function nameParts(): Part[] {
  const cells: { x: number; z: number; column: number }[] = [];
  let column = 0;
  const text = 'BOB CHUNG';
  const width = [...text].reduce((w, ch) => w + (ch === ' ' ? 3 : 6), -1);
  const x0 = NAME_X - ((width - 1) * PITCH) / 2;
  for (const ch of text) {
    if (ch === ' ') {
      column += 3;
      continue;
    }
    const rows = FONT[ch];
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 7; r++) if (rows[r][c] === '1') cells.push({ x: x0 + (column + c) * PITCH, z: NAME_Z + (r - 3) * PITCH, column: column + c });
    }
    column += 6;
  }
  cells.sort((a, b) => a.x - b.x || a.z - b.z);
  const cycles = Math.ceil(cells.length / 12);
  const D = (PLACE[1] - PLACE[0]) / cycles;
  return cells.map((cell, i) => {
    const cycle = Math.floor(i / 12);
    const within = i % 12;
    const head = within < 6 ? 0 : 1;
    const k = within % 6;
    const c0 = PLACE[0] + cycle * D;
    return { ...cell, across: (cell.column + Math.round(cell.z)) % 2 === 0, kind: (i % 3 === 0 ? 1 : 0) as 0 | 1, head: head as 0 | 1, pick: c0, place: c0 + D * (0.34 + k * 0.1), column: cell.column };
  });
}

const BOARD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
/** R: copper; G: along the live route (0 at the name, 1 at the processor); B: 1 on the live route. */
const BOARD_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uSolder;
uniform float uFlow;
uniform float uHeat;
uniform vec3 uGold;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float cov = t.r;
  float x = vUv.x;
  float heat = exp(-pow((x - uHeat) / 0.035, 2.0)) * step(0.0, uHeat) * step(uHeat, 1.0);
  vec3 c = vec3(0.0);
  float a = 0.0;
  if (cov > 0.02) {
    float live = t.b;
    float soldered = smoothstep(uSolder, uSolder - 0.03, x);
    vec3 masked = mix(vec3(0.022, 0.011, 0.034), vec3(0.05, 0.026, 0.07), live);
    vec3 tinned = vec3(0.32, 0.22, 0.2);
    c = mix(masked, tinned, soldered * live);
    float lit = smoothstep(uFlow, uFlow - 0.05, t.g) * live;
    float head = exp(-pow((t.g - uFlow) / 0.012, 2.0)) * live * step(0.001, uFlow) * step(uFlow, 0.999);
    c += uGold * (lit * 0.45 + head * 2.6);
    a = cov;
  }
  c += vec3(1.6, 0.55, 0.12) * heat * 0.35;
  a = max(a, heat * 0.5);
  if (a < 0.01) discard;
  gl_FragColor = vec4(c, a);
}
`;

export async function build({ renderer }: BuildContext): Promise<World> {
  const bag = new Bag();
  const p = palette();
  const scene = studioScene(renderer, 0.006);
  const camera = new PerspectiveCamera(30, 16 / 9, 0.05, 400);
  const target = new Object3D();
  const lights = studioLights(scene, target, { x: -28, y: 58, z: 34, intensity: 82000 });
  lights.rim.position.set(40, 30, -40);
  lights.rim.intensity = 26000;
  lights.key.angle = 0.62;

  // The board and the dark around it.
  const ground = bag.mesh(new PlaneGeometry(400, 400), p.wall);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.7;
  scene.add(ground);
  const boardMesh = bag.mesh(new BoxGeometry(BOARD.w, 0.16, BOARD.d), p.board);
  boardMesh.position.y = -0.08;
  scene.add(boardMesh);

  const parts = nameParts();
  const last = parts.at(-1)!;

  // The copper: a live route from every letter's foot to the bus and into the processor, and quiet routing everywhere else.
  const W = 2048, H = Math.round((2048 * BOARD.d) / BOARD.w);
  const px = (x: number): number => (x / BOARD.w + 0.5) * W;
  const pz = (z: number): number => (z / BOARD.d + 0.5) * H;
  const busZ = NAME_Z + 4 * PITCH + 1.4;
  const routeEnd = CPU.x - 2.6;
  const span = routeEnd - (parts[0].x - 0.5);
  const map = bag.add(
    canvasTexture(
      W,
      H,
      (ctx) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.lineCap = 'round';
        let s = 11;
        const rnd = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
        // Quiet routing.
        for (let i = 0; i < 140; i++) {
          let x = (rnd() - 0.5) * BOARD.w * 0.94, z = (rnd() - 0.5) * BOARD.d * 0.9;
          if (Math.abs(z - NAME_Z) < 4.6 && x > -26 && x < 18) continue;
          ctx.strokeStyle = 'rgb(160,0,0)';
          ctx.lineWidth = 3 + rnd() * 3;
          ctx.beginPath();
          ctx.moveTo(px(x), pz(z));
          for (let k = 0; k < 3; k++) {
            const len = 2 + rnd() * 7;
            const dir = Math.floor(rnd() * 4);
            if (dir === 0) x += len;
            else if (dir === 1) z += len * 0.6;
            else if (dir === 2) { x += len * 0.7; z += len * 0.7; }
            else { x -= len * 0.5; z += len * 0.5; }
            ctx.lineTo(px(x), pz(z));
          }
          ctx.stroke();
          ctx.fillStyle = 'rgb(160,0,0)';
          ctx.beginPath();
          ctx.arc(px(x), pz(z), 6, 0, Math.PI * 2);
          ctx.fill();
        }
        // The live route: a stub from each column's foot down to the bus, the bus along to the processor.
        const g = (x: number): number => Math.round(255 * clamp((x - (parts[0].x - 0.5)) / span));
        const columns = [...new Set(parts.map((q) => q.x))];
        for (const x of columns) {
          const foot = Math.max(...parts.filter((q) => q.x === x).map((q) => q.z));
          ctx.strokeStyle = `rgb(255,${g(x)},255)`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(px(x), pz(foot + 0.4));
          ctx.lineTo(px(x), pz(busZ - 0.5));
          ctx.lineTo(px(x + 0.5), pz(busZ));
          ctx.stroke();
        }
        for (let x = parts[0].x; x < routeEnd; x += 0.1) {
          ctx.strokeStyle = `rgb(255,${g(x)},255)`;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.moveTo(px(x), pz(busZ));
          ctx.lineTo(px(x + 0.12), pz(busZ));
          ctx.stroke();
        }
        // Into the processor's west side, as four traces fanning in.
        for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = `rgb(255,255,255)`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(px(routeEnd), pz(busZ));
          ctx.lineTo(px(routeEnd + 0.4), pz(CPU.z + 0.6 + k * 0.45));
          ctx.lineTo(px(CPU.x - 2.1), pz(CPU.z + 0.6 + k * 0.45));
          ctx.stroke();
        }
        // Pad outlines of the name (silkscreen-like, as copper rings).
        ctx.strokeStyle = 'rgb(110,0,0)';
        ctx.lineWidth = 2;
        for (const q of parts) ctx.strokeRect(px(q.x - 0.36), pz(q.z - 0.3), px(0.72) - px(0), pz(0.6) - pz(0));
      },
      false,
    ),
  );
  const copper = bag.add(
    new ShaderMaterial({
      uniforms: { uMap: { value: map }, uSolder: { value: -0.1 }, uFlow: { value: 0 }, uHeat: { value: -1 }, uGold: { value: new Color(2.4, 1.45, 0.48) } },
      vertexShader: BOARD_VERTEX,
      fragmentShader: BOARD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  const copperPlane = bag.mesh(new PlaneGeometry(BOARD.w, BOARD.d), copper, false);
  copperPlane.rotation.x = -Math.PI / 2;
  copperPlane.position.y = 0.004;
  scene.add(copperPlane);

  // Pads, two per part.
  const pad = new BoxGeometry(0.2, 0.02, 0.32);
  const pads = new InstancedMesh(bag.add(pad), p.tin, parts.length * 2);
  const m = new Matrix4(), q = new Quaternion(), one = new Vector3(1, 1, 1), at = new Vector3();
  const yaw = (across: boolean): Quaternion => q.setFromAxisAngle(new Vector3(0, 1, 0), across ? 0 : Math.PI / 2);
  parts.forEach((part, i) => {
    for (const side of [-1, 1]) {
      const dx = part.across ? side * 0.27 : 0, dz = part.across ? 0 : side * 0.27;
      pads.setMatrixAt(i * 2 + (side + 1) / 2, m.compose(at.set(part.x + dx, 0.01, part.z + dz), yaw(part.across), one));
    }
  });
  pads.receiveShadow = true;
  scene.add(pads);

  // The parts: a body and two tinned ends each; and a glow on top for when the name is powered.
  const bodyGeometry = bag.add(new BoxGeometry(0.42, 0.2, 0.3));
  const endGeometry = bag.add(new BoxGeometry(0.1, 0.21, 0.31));
  const bodyMaterial = bag.add(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.05 }));
  const bodies = new InstancedMesh(bodyGeometry, bodyMaterial, parts.length);
  const ends = new InstancedMesh(endGeometry, bag.add(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 1 })), parts.length * 2);
  const glowMaterial = bag.add(new MeshBasicMaterial({ color: '#ffffff', blending: AdditiveBlending, transparent: true, depthWrite: false }));
  const glows = new InstancedMesh(bag.add(new BoxGeometry(0.3, 0.01, 0.18)), glowMaterial, parts.length);
  const black = new Color('#151118'), tan = new Color('#9a7552');
  parts.forEach((part, i) => {
    bodies.setColorAt(i, part.kind ? tan : black);
    glows.setColorAt(i, new Color(0, 0, 0));
    ends.setColorAt(i * 2, new Color(0.3, 0.29, 0.32));
    ends.setColorAt(i * 2 + 1, new Color(0.3, 0.29, 0.32));
  });
  bodies.castShadow = true;
  ends.castShadow = true;
  scene.add(bodies, ends, glows);

  // The feeder: the parts drawer at the front edge, with tape of parts in it.
  const feeder = new Group();
  feeder.add(bag.mesh(new BoxGeometry(46, 0.8, 4.4), p.metal));
  for (let k = 0; k < 3; k++) {
    const tape = bag.mesh(new BoxGeometry(44, 0.06, 0.8), p.black);
    tape.position.set(0, 0.43, -1.3 + k * 1.3);
    feeder.add(tape);
    const pocketParts = new InstancedMesh(bodyGeometry, bodyMaterial, 60);
    for (let n = 0; n < 60; n++) {
      pocketParts.setMatrixAt(n, m.compose(at.set(-21.5 + n * 0.73, 0.55, -1.3 + k * 1.3), q.identity(), one));
      pocketParts.setColorAt(n, k === 1 ? tan : black);
    }
    feeder.add(pocketParts);
  }
  feeder.position.set(-4, -0.2, FEEDER_Z + 6);
  scene.add(feeder);

  // The gantry: two rails, a beam, two heads with a nozzle each.
  const gantry = new Group();
  for (const side of [-1, 1]) {
    const rail = bag.mesh(new BoxGeometry(1.4, 1.2, 52), p.alu);
    rail.position.set(side * 33, 0.2, 2);
    gantry.add(rail);
  }
  const beam = new Group();
  beam.add(bag.mesh(new BoxGeometry(70, 1.3, 1.8), p.alu));
  for (const side of [-1, 1]) {
    const leg = bag.mesh(new BoxGeometry(1.8, 4.6, 2.2), p.metal);
    leg.position.set(side * 33, -2.2, 0);
    beam.add(leg);
  }
  beam.position.y = 5.2;
  gantry.add(beam);
  const heads = [0, 1].map(() => {
    const head = new Group();
    head.add(bag.mesh(new BoxGeometry(2.6, 2.2, 2.6), p.metal));
    const led = bag.add(new MeshBasicMaterial({ color: GOLD_HOT.clone().multiplyScalar(0.4) }));
    const ledMesh = bag.mesh(new BoxGeometry(0.9, 0.08, 0.06), led, false);
    ledMesh.position.set(0, 0.5, 1.31);
    head.add(ledMesh);
    const nozzle = bag.mesh(new CylinderGeometry(0.12, 0.2, 3.2, 16), p.tin);
    head.add(nozzle);
    scene.add(head);
    return { head, nozzle, led };
  });
  scene.add(gantry);

  // The processor.
  const chip = new Chip(p);
  chip.group.scale.setScalar(CPU_SCALE);
  chip.group.position.copy(CPU);
  scene.add(chip.group);
  for (let k = 0; k < 6; k++) {
    const cap = bag.mesh(new BoxGeometry(0.42, 0.22, 0.3), k % 2 ? p.chip : p.copper);
    cap.position.set(CPU.x - 1.4 + k * 0.56, 0.11, CPU.z - 3.1);
    scene.add(cap);
  }

  const state = { feeder: 0, home: 0, solder: -0.1, heat: -1, flow: 0, light: 0, park: 0, lid: 0, glow: 0, window: 0 };

  // Each head's path, cycle by cycle: the feeder, then six pads.
  const cycles = Math.ceil(parts.length / 12);
  const D = (PLACE[1] - PLACE[0]) / cycles;
  type Key = { f: number; x: number; z: number; dip: number };
  const paths: Key[][] = [[], []];
  for (let c = 0; c < cycles; c++) {
    const c0 = PLACE[0] + c * D;
    for (const h of [0, 1] as const) {
      const mine = parts.filter((part) => part.head === h && Math.abs(part.pick - c0) < 0.01);
      if (!mine.length) continue;
      const fx = mine.reduce((sum, part) => sum + part.x, 0) / mine.length;
      paths[h].push({ f: c0, x: fx, z: FEEDER_Z - 1.3 + h * 1.3, dip: 1 });
      for (const part of mine) paths[h].push({ f: part.place, x: part.x, z: part.z, dip: 1 });
    }
  }
  const restOf = (h: number): Key => ({ f: 0, x: -20 + h * 6, z: -16, dip: 0 });
  const headAt = (h: number, f: number, out: Vector3): number => {
    const path = paths[h];
    if (!path.length || f <= path[0].f) {
      // From the parked place at the back to the first pick, as the gantry homes.
      const r = restOf(h);
      const k = ease(f, 60, PLACE[0]);
      const first = path[0] ?? r;
      out.set(mix(r.x, first.x, k), 0, mix(r.z, first.z, k));
      return 0;
    }
    if (f >= path.at(-1)!.f) {
      // Done: off to the back again.
      const end = path.at(-1)!;
      const k = ease(f, end.f + 2, end.f + 26);
      const r = restOf(h);
      out.set(mix(end.x, r.x + 30, k), 0, mix(end.z, r.z, k));
      return 0;
    }
    let i = 0;
    while (path[i + 1].f <= f) i++;
    const a = path[i], b = path[i + 1];
    const t = ramp(f, a.f, b.f);
    const move = ease(t, 0.15, 0.85);
    out.set(mix(a.x, b.x, move), 0, mix(a.z, b.z, move));
    // The nozzle dips at each end of the move.
    return Math.max(Math.exp(-Math.pow(t / 0.12, 2)), Math.exp(-Math.pow((1 - t) / 0.12, 2)));
  };

  const shots: Shot[] = [
    { f: 0, pos: [-3, 58, 15], look: [-3, 0, -2.5], fov: 30, focus: 60, blur: 1.4 },
    { f: 24, pos: [-3, 50, 13], look: [-3, 0, -2], fov: 30, focus: 51, blur: 1.6 },
    { f: 62, pos: [28, 14, 34], look: [4, 1, 15], fov: 32, focus: 34, blur: 3.4 },
    { f: 96, pos: [-24, 18, 19], look: [-16, 0, 0.5], fov: 32, focus: 23, blur: 3.4 },
    { f: 130, pos: [-15, 18, 13], look: [-12, 0, -1.6], fov: 30, focus: 21, blur: 3.8 },
    { f: 162, pos: [-2, 18, 13], look: [1, 0, -1.6], fov: 30, focus: 21, blur: 3.8 },
    { f: 190, pos: [8, 19, 13], look: [8, 0, -1.6], fov: 30, focus: 22, blur: 3.4 },
    { f: 222, pos: [-4, 40, 11], look: [-4, 0, -1.6], fov: 30, focus: 40, blur: 1.8 },
    { f: 262, pos: [-8, 24, 13], look: [-4, 0, -1.4], fov: 31, focus: 27, blur: 2.4 },
    { f: 292, pos: [6, 3.0, 9], look: [14, 0.2, busZ], fov: 34, focus: 9, blur: 5 },
    { f: 312, pos: [15.5, 2.2, busZ + 1.6], look: [CPU.x - 1.5, 0.1, busZ - 1.0], fov: 34, focus: 8, blur: 5 },
    { f: 328, pos: [CPU.x - 4.5, 8, CPU.z + 0.4], look: [CPU.x, 0, CPU.z], fov: 32, focus: 9, blur: 2 },
    { f: 346, pos: [CPU.x - 0.6, 4.4, CPU.z], look: [CPU.x, 0, CPU.z], fov: 30, focus: 4.4, blur: 0 },
    { f: 362, pos: [CPU.x - 0.05, 1.3, CPU.z], look: [CPU.x, 0, CPU.z], fov: 32, focus: 1.3, blur: 0 },
    { f: 372, pos: [CPU.x, 0.55, CPU.z], look: [CPU.x, -0.5, CPU.z], fov: 34, focus: 0.4, blur: 0 },
  ];
  const rig = new Rig(shots);
  const look = new Vector3();
  const up = new Vector3();
  const tip = [new Vector3(), new Vector3()];
  const size = new Vector3();
  const tint = new Color();
  const paste = new Color(0.3, 0.29, 0.32), tinned = new Color(1, 0.98, 1.02);
  let placed = 0;

  return {
    scene,
    camera,
    chip,
    beats: {
      heroOut: [6, 30],
      steps: [
        [34, 52, 86, 96],
        [98, 116, 184, 194],
        [196, 214, 244, 254],
        [256, 274, 312, 322],
      ],
      bars: [36, 58, 300, 324],
    },

    timeline(tl) {
      // 01 Mechanics: the feeder slides out from under the front edge; the gantry homes.
      tl.to(state, { feeder: 1, duration: 40, ease: 'power2.inOut' }, 34);
      tl.to(state, { home: 1, duration: 36, ease: 'power2.inOut' }, 60);
      // 03 Electronics: the heat band crosses the board; the joints and the live copper are soldered behind it.
      tl.to(state, { heat: 1.1, duration: 46, ease: 'none' }, 198);
      tl.to(state, { solder: 1.05, duration: 46, ease: 'none' }, 200);
      // 04 Software: power. The name lights in a wave, then the current runs along the bus into the processor.
      tl.to(state, { light: 1, duration: 26, ease: 'power1.inOut' }, 256);
      tl.to(state, { flow: 1, duration: 46, ease: 'power1.inOut' }, 276);
      tl.to(state, { glow: 1, duration: 10 }, 318);
      tl.to(state, { lid: 1, duration: 16, ease: 'power2.inOut' }, 328);
      tl.to(state, { window: 1, duration: 12, ease: 'power1.inOut' }, 336);
    },

    frame(f, _nowS, _dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      feeder.position.z = FEEDER_Z + 6 - 6 * state.feeder;

      // Heads, beam, nozzles.
      const dips = [headAt(0, f, tip[0]), headAt(1, f, tip[1])];
      const beamZ = (tip[0].z + tip[1].z) / 2;
      beam.position.z = beamZ;
      heads.forEach(({ head, nozzle, led }, h) => {
        head.position.set(tip[h].x, 6.4, tip[h].z);
        nozzle.position.y = -2.4 - dips[h] * 0.9;
        led.color.copy(GOLD_HOT).multiplyScalar(0.25 + 0.75 * dips[h]);
      });

      // Each part: hidden, on its nozzle, or on its pads.
      placed = 0;
      const lit = state.light;
      parts.forEach((part, i) => {
        let y = 0.11, x = part.x, z = part.z, show = 1;
        if (f < part.pick) show = 0;
        else if (f < part.place) {
          const h = part.head;
          x = tip[h].x;
          z = tip[h].z;
          y = 6.4 - 2.4 - 1.6 - dips[h] * 0.9 - 0.15;
        } else placed++;
        const s = show ? 1 : 0.0001;
        size.set(s, s, s);
        m.compose(at.set(x, y, z), yaw(part.across), size);
        bodies.setMatrixAt(i, m);
        const solder = clamp((state.solder - (part.x / BOARD.w + 0.5)) * 30);
        tint.copy(paste).lerp(tinned, solder);
        for (const side of [-1, 1]) {
          const dx = part.across ? side * 0.26 : 0, dz = part.across ? 0 : side * 0.26;
          ends.setMatrixAt(i * 2 + (side + 1) / 2, m.compose(at.set(x + dx, y, z + dz), yaw(part.across), size));
          ends.setColorAt(i * 2 + (side + 1) / 2, tint);
        }
        const wave = clamp((lit * 1.25 - (part.x - parts[0].x) / (last.x - parts[0].x)) * 4);
        glows.setMatrixAt(i, m.compose(at.set(x, y + 0.105, z), yaw(part.across), size));
        glows.setColorAt(i, tint.setRGB(2.4 * wave, 1.4 * wave, 0.45 * wave));
      });
      bodies.instanceMatrix.needsUpdate = true;
      ends.instanceMatrix.needsUpdate = true;
      if (ends.instanceColor) ends.instanceColor.needsUpdate = true;
      glows.instanceMatrix.needsUpdate = true;
      if (glows.instanceColor) glows.instanceColor.needsUpdate = true;

      copper.uniforms.uSolder.value = state.solder;
      copper.uniforms.uHeat.value = state.heat;
      copper.uniforms.uFlow.value = state.flow;
      chip.open(state.lid);
      chip.glow(state.glow);
      chip.window(state.window);

      // The camera: up turns from the world's to the direction of travel as it tips down over the processor.
      const shot = rig.at(f, camera.position, look);
      const down = ease(f, 318, 340);
      up.set(0, 1, 0).lerp(new Vector3(1, 0, 0), down).normalize();
      camera.up.copy(up);
      camera.aspect = aspect;
      camera.fov = fovFor(shot.fov, aspect);
      camera.near = clamp(shot.focus * 0.04, 0.01, 1);
      camera.updateProjectionMatrix();
      camera.lookAt(look);
      lights.level(lamp);
      const after = ease(f, 334, 360);
      return { focus: shot.focus, blur: shot.blur, grain: mix(0.032, 0, after), vignette: mix(0.55, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    readout(f) {
      if (f < 34) return `Board 600 × 340 mm · ${parts.length} pads empty`;
      if (f < 96) return `Feeder ${(state.feeder * 60).toFixed(0)} mm out · gantry homing`;
      if (f < 196) return `Placed ${String(placed).padStart(3, '0')}/${parts.length} · head A x ${tip[0].x.toFixed(1)} · head B x ${tip[1].x.toFixed(1)}`;
      if (f < 256) return `Reflow ${Math.round(183 + 62 * clamp(state.heat))} °C · ${Math.round(clamp(state.solder) * parts.length * 2)} joints`;
      if (f < 336) return `Power 3.3 V · signal ${Math.round(state.flow * 100)} % to BC-2006`;
      return 'BC-2006 · port open';
    },

    dispose() {
      bag.dispose();
      p.dispose();
      chip.dispose();
      scene.environment?.dispose();
      gsap.killTweensOf(state);
    },
  };
}
