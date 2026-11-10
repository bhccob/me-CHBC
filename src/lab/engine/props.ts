import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three';
import { clamp } from '~/journey/math';
import { canvasTexture, GOLD_HOT, type Palette } from './look';

/**
 * LAB ONLY (throwaway). The bench's parts in greybox, all from the one palette: a drawer on a lead screw, a desktop
 * robot arm with its own reach (inverse kinematics), a monitor, a small PC, a dev board whose copper carries current,
 * and the cable that carries it on. Concepts A and C build their worlds from these; C draws their edges.
 */

/** Disposes what a builder made, once. */
export class Bag {
  private readonly things = new Set<{ dispose(): void }>();
  add<T extends { dispose(): void }>(thing: T): T {
    this.things.add(thing);
    return thing;
  }
  mesh(geometry: BufferGeometry, material: Material, shadows = true): Mesh {
    this.add(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    return mesh;
  }
  dispose(): void {
    for (const thing of this.things) thing.dispose();
    this.things.clear();
  }
}

const box = (bag: Bag, m: Material, w: number, h: number, d: number, x = 0, y = 0, z = 0): Mesh => {
  const mesh = bag.mesh(new BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
};

// ---------------------------------------------------------------- bench

/** The bench top (y = 0 is its surface) and the far wall that keeps the dark from being flat. */
export function bench(p: Palette, bag: Bag, width = 24, depth = 10, z = -0.8): Group {
  const group = new Group();
  const top = box(bag, p.bench, width, 0.5, depth, 0, -0.25, z);
  top.castShadow = false;
  const wall = bag.mesh(new PlaneGeometry(40, 16), p.wall);
  wall.position.set(0, 6, z - depth / 2 - 1.5);
  group.add(top, wall);
  return group;
}

// ---------------------------------------------------------------- drawer

export interface Drawer {
  group: Group;
  /** What slides out; the tray inside it. */
  slide: Group;
  tray: Object3D;
  led: MeshBasicMaterial;
  /** 0 shut, 1 out; the screw turns with it. */
  open(k: number): void;
  /** The limit switch: 0 off (red), 1 tripped (green). */
  trip(k: number): void;
}

export function drawerUnit(p: Palette, bag: Bag): Drawer {
  const group = new Group();
  const W = 1.8, H = 1.1, D = 1.6, T = 0.05;
  group.add(
    box(bag, p.metal, W, T, D, 0, H - T / 2, 0),
    box(bag, p.metal, W, T, D, 0, T / 2, 0),
    box(bag, p.metal, T, H, D, -W / 2 + T / 2, H / 2, 0),
    box(bag, p.metal, T, H, D, W / 2 - T / 2, H / 2, 0),
    box(bag, p.metal, W, H, T, 0, H / 2, -D / 2 + T / 2),
    // A shelf line and the rails.
    box(bag, p.black, W - 2 * T, 0.03, 0.06, 0, 0.62, D / 2 - 0.03),
    box(bag, p.alu, 0.03, 0.03, D - 0.1, -W / 2 + 0.1, 0.12, 0),
    box(bag, p.alu, 0.03, 0.03, D - 0.1, W / 2 - 0.1, 0.12, 0),
  );
  const slide = new Group();
  const front = box(bag, p.metal, W - 0.12, 0.48, 0.05, 0, 0.33, D / 2 - 0.02);
  const handle = box(bag, p.black, 0.56, 0.05, 0.03, 0, 0.42, D / 2 + 0.015);
  const tray = new Group();
  tray.position.set(0, 0.12, 0);
  const tw = W - 0.2, td = D - 0.14;
  tray.add(
    box(bag, p.metal, tw, 0.025, td, 0, 0, 0),
    box(bag, p.metal, 0.025, 0.22, td, -tw / 2, 0.11, 0),
    box(bag, p.metal, 0.025, 0.22, td, tw / 2, 0.11, 0),
    box(bag, p.metal, tw, 0.22, 0.025, 0, 0.11, -td / 2),
    // Foam for the part.
    box(bag, p.black, 0.62, 0.04, 0.5, 0, 0.03, 0.35),
  );
  slide.add(front, handle, tray);
  group.add(slide);

  // The lead screw that drives it, striped so its turn shows.
  const stripes = bag.add(
    canvasTexture(64, 256, (ctx, w, h) => {
      ctx.fillStyle = '#7d7886';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2a2630';
      for (let y = 0; y < h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + 10);
        ctx.lineTo(w, y + 16);
        ctx.lineTo(0, y + 6);
        ctx.fill();
      }
    }),
  );
  stripes.wrapS = stripes.wrapT = RepeatWrapping;
  stripes.repeat.set(1, 6);
  const screwMaterial = bag.add(new MeshStandardMaterial({ map: stripes, metalness: 1, roughness: 0.35 }));
  const screw = bag.mesh(new CylinderGeometry(0.035, 0.035, D - 0.1, 16), screwMaterial);
  screw.rotation.x = Math.PI / 2;
  screw.position.set(W / 2 - 0.2, 0.09, 0);
  const nut = box(bag, p.alu, 0.12, 0.1, 0.1, W / 2 - 0.2, 0.09, D / 2 - 0.2);
  slide.add(nut);
  group.add(screw);

  // The limit switch at full travel, and its LED.
  group.add(box(bag, p.black, 0.12, 0.1, 0.1, W / 2 - 0.12, 0.16, D / 2 + 0.06));
  const led = bag.add(new MeshBasicMaterial({ color: new Color(1.4, 0.12, 0.08) }));
  const ledMesh = bag.mesh(new CylinderGeometry(0.025, 0.025, 0.02, 16), led, false);
  ledMesh.position.set(W / 2 - 0.12, 0.22, D / 2 + 0.06);
  group.add(ledMesh);

  const red = new Color(1.4, 0.12, 0.08), green = new Color(0.25, 2.2, 0.6);
  return {
    group,
    slide,
    tray,
    led,
    open(k) {
      slide.position.z = clamp(k) * 1.02;
      screw.rotation.y = k * 26;
    },
    trip(k) {
      led.color.copy(red).lerp(green, clamp(k));
    },
  };
}

// ---------------------------------------------------------------- robot arm

export const ARM = { shoulderY: 0.66, l1: 1.45, l2: 1.3, l3: 0.44 } as const;

export interface ArmPose {
  yaw: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  /** 0 closed, 1 open. */
  grip: number;
}

export interface Arm {
  group: Group;
  /** The tool point, between the fingers. */
  tip: Object3D;
  ring: MeshBasicMaterial;
  set(pose: ArmPose): void;
  /** The pose that puts the tool point at `target` (world space), pointing straight down. */
  reach(target: Vector3, grip: number, out?: ArmPose): ArmPose;
}

export function robotArm(p: Palette, bag: Bag): Arm {
  const group = new Group();
  const base = bag.mesh(new CylinderGeometry(0.42, 0.5, 0.16, 48), p.metal);
  base.position.y = 0.08;
  const ring = bag.add(new MeshBasicMaterial({ color: GOLD_HOT.clone().multiplyScalar(0) }));
  const ringMesh = bag.mesh(new TorusGeometry(0.44, 0.012, 8, 72), ring, false);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 0.165;
  group.add(base, ringMesh);

  const yaw = new Group();
  yaw.position.y = 0.16;
  const turret = bag.mesh(new CylinderGeometry(0.3, 0.34, 0.34, 40), p.metal);
  turret.position.y = 0.17;
  yaw.add(turret);
  group.add(yaw);

  const joint = (r: number, len: number): Mesh => {
    const m = bag.mesh(new CylinderGeometry(r, r, len, 32), p.metal);
    m.rotation.z = Math.PI / 2;
    return m;
  };
  const shoulder = new Group();
  shoulder.position.y = ARM.shoulderY - 0.16;
  shoulder.add(joint(0.17, 0.46));
  const upper = box(bag, p.alu, 0.2, ARM.l1, 0.15, 0, ARM.l1 / 2, 0);
  shoulder.add(upper);
  yaw.add(shoulder);

  const elbow = new Group();
  elbow.position.y = ARM.l1;
  elbow.add(joint(0.13, 0.36));
  elbow.add(box(bag, p.alu, 0.15, ARM.l2, 0.12, 0, ARM.l2 / 2, 0));
  shoulder.add(elbow);

  const wrist = new Group();
  wrist.position.y = ARM.l2;
  wrist.add(joint(0.09, 0.26));
  wrist.add(box(bag, p.metal, 0.15, 0.2, 0.15, 0, 0.1, 0));
  const fingerL = box(bag, p.black, 0.03, 0.22, 0.09, -0.06, 0.3, 0);
  const fingerR = box(bag, p.black, 0.03, 0.22, 0.09, 0.06, 0.3, 0);
  wrist.add(fingerL, fingerR);
  const tip = new Object3D();
  tip.position.y = ARM.l3;
  wrist.add(tip);
  elbow.add(wrist);

  const local = new Vector3();
  return {
    group,
    tip,
    ring,
    set(pose) {
      yaw.rotation.y = pose.yaw;
      shoulder.rotation.x = pose.shoulder;
      elbow.rotation.x = pose.elbow;
      wrist.rotation.x = pose.wrist;
      const g = 0.035 + clamp(pose.grip) * 0.07;
      fingerL.position.x = -g;
      fingerR.position.x = g;
    },
    reach(target, grip, out = { yaw: 0, shoulder: 0, elbow: 0, wrist: 0, grip }) {
      group.updateMatrixWorld();
      group.worldToLocal(local.copy(target));
      const r = Math.hypot(local.x, local.z);
      out.yaw = Math.atan2(local.x, local.z);
      // In the arm's plane: forward r, up y. The wrist stands above the tool point.
      const dx = r, dy = local.y + ARM.l3 - ARM.shoulderY;
      const { l1, l2 } = ARM;
      const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.001);
      const beta = Math.atan2(dx, dy);
      const gamma = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
      const delta = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
      out.shoulder = beta - gamma;
      out.elbow = Math.PI - delta;
      out.wrist = Math.PI - out.shoulder - out.elbow;
      out.grip = grip;
      return out;
    },
  };
}

// ---------------------------------------------------------------- monitor and PC

export interface Monitor {
  group: Group;
  screen: Mesh;
  /** The screen's corners in world space: top left, top right, bottom right, bottom left. */
  corners(out: [Vector3, Vector3, Vector3, Vector3]): void;
}

export function monitor(p: Palette, bag: Bag, width = 3.2, height = 1.9): Monitor {
  const group = new Group();
  const bottom = 0.78;
  group.add(
    box(bag, p.metal, width, height, 0.08, 0, bottom + height / 2, 0),
    box(bag, p.metal, 0.2, 0.92, 0.1, 0, 0.46 + 0.02, -0.12),
    box(bag, p.metal, 1.05, 0.035, 0.58, 0, 0.0175, -0.1),
  );
  const screen = bag.mesh(new PlaneGeometry(width - 0.09, height - 0.09), p.black, false);
  screen.position.set(0, bottom + height / 2, 0.0415);
  group.add(screen);
  const w = (width - 0.09) / 2, h = (height - 0.09) / 2;
  return {
    group,
    screen,
    corners(out) {
      screen.updateMatrixWorld();
      screen.localToWorld(out[0].set(-w, h, 0));
      screen.localToWorld(out[1].set(w, h, 0));
      screen.localToWorld(out[2].set(w, -h, 0));
      screen.localToWorld(out[3].set(-w, -h, 0));
    },
  };
}

export interface MiniPc {
  group: Group;
  led: MeshBasicMaterial;
  /** Where its cable goes in, local. */
  port: Object3D;
}

export function miniPc(p: Palette, bag: Bag): MiniPc {
  const group = new Group();
  group.add(box(bag, p.metal, 1.0, 0.3, 1.0, 0, 0.15, 0));
  for (let i = 0; i < 6; i++) group.add(box(bag, p.black, 0.6, 0.012, 0.02, 0, 0.306, -0.3 + i * 0.12));
  const led = bag.add(new MeshBasicMaterial({ color: GOLD_HOT.clone().multiplyScalar(0) }));
  const ledMesh = bag.mesh(new BoxGeometry(0.3, 0.012, 0.01), led, false);
  ledMesh.position.set(-0.2, 0.08, 0.502);
  group.add(ledMesh);
  const port = new Object3D();
  port.position.set(-0.5, 0.12, 0.2);
  group.add(port);
  return { group, led, port };
}

// ---------------------------------------------------------------- dev board

const TRACE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
/** R: copper under the mask; G: how far along from the socket, 0 to 1. Lit up to `uFlow`, brightest at its head. */
const TRACE_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uFlow;
uniform float uPower;
uniform float uInward;
uniform vec3 uGold;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float cov = t.r;
  if (cov < 0.02) discard;
  float d = mix(t.g, 1.0 - t.g, uInward);
  float lit = smoothstep(uFlow, uFlow - 0.08, d);
  float head = exp(-pow((d - uFlow) / 0.025, 2.0)) * step(0.001, uFlow) * step(uFlow, 0.999);
  vec3 base = vec3(0.075, 0.04, 0.1);
  vec3 c = base + uGold * (lit * 0.55 * uPower + head * 2.2);
  gl_FragColor = vec4(c, cov);
}
`;

export interface Board {
  group: Group;
  /** Where the part seats, local to the board. */
  socket: Object3D;
  /** Where the cable leaves, local. */
  connector: Object3D;
  led: MeshBasicMaterial;
  /** How far the current has run from the socket (or, inward, toward it), 0 to 1, and how bright what it has reached stays. */
  flow(k: number, power: number, inward?: boolean): void;
}

export function devBoard(p: Palette, bag: Bag, width = 2.3, depth = 1.5): Board {
  const group = new Group();
  const plate = 0.05, lift = 0.07;
  group.add(box(bag, p.board, width, plate, depth, 0, lift + plate / 2, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const leg = bag.mesh(new CylinderGeometry(0.04, 0.04, lift, 12), p.tin);
    leg.position.set((x * (width - 0.16)) / 2, lift / 2, (z * (depth - 0.16)) / 2);
    group.add(leg);
  }
  const top = lift + plate;

  // Traces: routed from the socket's sides to the connector, the headers and a few vias, at 45 degrees.
  const W = 1024, H = Math.round((1024 * depth) / width);
  const sx = (x: number): number => ((x / width) + 0.5) * W;
  const sz = (z: number): number => ((z / depth) + 0.5) * H;
  const routes: [number, number][][] = [];
  const rnd = (() => {
    let s = 7;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  })();
  // East side to the connector at the right edge.
  for (let i = 0; i < 6; i++) {
    const z0 = -0.15 + i * 0.06;
    routes.push([[0.26, z0], [0.55, z0], [0.75, 0.2 + i * 0.02], [width / 2 - 0.12, 0.2 + i * 0.02]]);
  }
  // South side to the header row.
  for (let i = 0; i < 8; i++) {
    const x0 = -0.2 + i * 0.057;
    const hx = -0.85 + i * 0.24;
    routes.push([[x0, 0.26], [x0, 0.38], [hx, 0.38 + Math.abs(hx - x0) * 0.4], [hx, depth / 2 - 0.12]]);
  }
  // West and north to vias.
  for (let i = 0; i < 6; i++) {
    const z0 = -0.15 + i * 0.06;
    const len = 0.35 + rnd() * 0.45;
    routes.push([[-0.26, z0], [-0.26 - len * 0.5, z0], [-0.26 - len, z0 - 0.2 + rnd() * 0.4]]);
  }
  for (let i = 0; i < 6; i++) {
    const x0 = -0.15 + i * 0.06;
    const len = 0.2 + rnd() * 0.25;
    routes.push([[x0, -0.26], [x0, -0.26 - len], [x0 + (rnd() - 0.5) * 0.6, -0.26 - len - 0.15]]);
  }
  const lengths = routes.map((r) => r.reduce((sum, pt, i) => (i ? sum + Math.hypot(pt[0] - r[i - 1][0], pt[1] - r[i - 1][1]) : 0), 0));
  const longest = Math.max(...lengths);
  const traces = bag.add(
    canvasTexture(
      W,
      H,
      (ctx) => {
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(0, 0, W, H);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const route of routes) {
          let run = 0;
          for (let i = 1; i < route.length; i++) {
            const [ax, az] = route[i - 1], [bx, bz] = route[i];
            const seg = Math.hypot(bx - ax, bz - az);
            const steps = Math.max(1, Math.ceil(seg / 0.01));
            for (let s = 0; s < steps; s++) {
              const t0 = s / steps, t1 = (s + 1) / steps;
              const g = Math.round(255 * clamp((run + seg * t0) / longest));
              ctx.strokeStyle = `rgb(255,${g},0)`;
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.moveTo(sx(ax + (bx - ax) * t0), sz(az + (bz - az) * t0));
              ctx.lineTo(sx(ax + (bx - ax) * t1), sz(az + (bz - az) * t1));
              ctx.stroke();
            }
            run += seg;
          }
          const [ex, ez] = route[route.length - 1];
          ctx.fillStyle = `rgb(255,${Math.round(255 * clamp(run / longest))},0)`;
          ctx.beginPath();
          ctx.arc(sx(ex), sz(ez), 8, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      false,
    ),
  );
  const traceMaterial = bag.add(
    new ShaderMaterial({
      uniforms: { uMap: { value: traces }, uFlow: { value: 0 }, uPower: { value: 0 }, uInward: { value: 0 }, uGold: { value: new Color(2.4, 1.45, 0.48) } },
      vertexShader: TRACE_VERTEX,
      fragmentShader: TRACE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  const tracePlane = bag.mesh(new PlaneGeometry(width, depth), traceMaterial, false);
  tracePlane.rotation.x = -Math.PI / 2;
  tracePlane.position.y = top + 0.001;
  group.add(tracePlane);

  // Socket, headers, a few parts.
  const socket = new Object3D();
  socket.position.set(0, top, 0);
  const s = 0.27;
  group.add(
    box(bag, p.black, 2 * s + 0.06, 0.035, 0.03, 0, top + 0.0175, -s - 0.015),
    box(bag, p.black, 2 * s + 0.06, 0.035, 0.03, 0, top + 0.0175, s + 0.015),
    box(bag, p.black, 0.03, 0.035, 2 * s, -s - 0.015, top + 0.0175, 0),
    box(bag, p.black, 0.03, 0.035, 2 * s, s + 0.015, top + 0.0175, 0),
  );
  group.add(socket);
  for (let i = 0; i < 8; i++) group.add(box(bag, p.black, 0.11, 0.1, 0.11, -0.85 + i * 0.24, top + 0.05, depth / 2 - 0.1));
  for (let i = 0; i < 8; i++) group.add(box(bag, p.tin, 0.025, 0.2, 0.025, -0.85 + i * 0.24, top + 0.14, depth / 2 - 0.1));
  group.add(box(bag, p.chip, 0.22, 0.05, 0.22, -0.72, top + 0.025, -0.35), box(bag, p.chip, 0.16, 0.04, 0.3, 0.7, top + 0.02, -0.4));
  const cap = bag.mesh(new CylinderGeometry(0.08, 0.08, 0.2, 24), p.alu);
  cap.position.set(-0.75, top + 0.1, 0.25);
  group.add(cap);
  const led = bag.add(new MeshBasicMaterial({ color: GOLD_HOT.clone().multiplyScalar(0) }));
  const ledMesh = bag.mesh(new BoxGeometry(0.05, 0.025, 0.03), led, false);
  ledMesh.position.set(0.55, top + 0.0125, -0.55);
  group.add(ledMesh);
  const connector = new Object3D();
  connector.position.set(width / 2 - 0.04, top + 0.03, 0.27);
  group.add(box(bag, p.tin, 0.16, 0.07, 0.13, width / 2 - 0.08, top + 0.035, 0.27), connector);

  return {
    group,
    socket,
    connector,
    led,
    flow(k, power, inward = false) {
      traceMaterial.uniforms.uFlow.value = clamp(k);
      traceMaterial.uniforms.uPower.value = power;
      traceMaterial.uniforms.uInward.value = inward ? 1 : 0;
    },
  };
}

// ---------------------------------------------------------------- cable

const PULSE_FRAGMENT = /* glsl */ `
uniform float uAt;
uniform float uOn;
varying vec2 vUv;
void main() {
  float head = exp(-pow((vUv.x - uAt) / 0.03, 2.0));
  float trail = smoothstep(uAt - 0.25, uAt, vUv.x) * step(vUv.x, uAt) * 0.35;
  float a = (head + trail) * uOn;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vec3(2.4, 1.45, 0.48) * a, 1.0);
}
`;

export interface Cable {
  group: Group;
  /** A pulse at `at` (0 at the start, 1 at the end), `on` its strength. */
  pulse(at: number, on: number): void;
}

export function cable(p: Palette, bag: Bag, points: Vector3[], radius = 0.028): Cable {
  const group = new Group();
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  group.add(bag.mesh(new TubeGeometry(curve, 96, radius, 10, false), p.black));
  const pulseMaterial = bag.add(
    new ShaderMaterial({
      uniforms: { uAt: { value: 0 }, uOn: { value: 0 } },
      vertexShader: TRACE_VERTEX,
      fragmentShader: PULSE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    }),
  );
  group.add(bag.mesh(new TubeGeometry(curve, 160, radius * 1.35, 10, false), pulseMaterial, false));
  return {
    group,
    pulse(at, on) {
      pulseMaterial.uniforms.uAt.value = at;
      pulseMaterial.uniforms.uOn.value = on;
    },
  };
}
