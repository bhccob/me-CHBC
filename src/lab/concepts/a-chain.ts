import { gsap } from 'gsap';
import { HalfFloatType, Matrix4, Object3D, PerspectiveCamera, PointLight, ShaderMaterial, Vector3, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { clamp, ease, mix } from '~/journey/math';
import { Chip, TOP } from '../engine/chip';
import { quadMatrix, toPage } from '../engine/dom';
import { palette, studioLights, studioScene } from '../engine/look';
import { Bag, bench, cable, devBoard, drawerUnit, miniPc, monitor, robotArm, type ArmPose } from '../engine/props';
import { fovFor, Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). A · Chain reaction. One engineer's bench in dark studio light, one unbroken shot. A lead screw
 * opens a drawer; the drawer trips a switch; the arm lifts the BC-2006 part out and seats it; current runs through the
 * copper and down the cable; the PC wakes and writes the name. The camera pushes through the screen, which is showing
 * the part live, and on into the part's port: the tunnel.
 */

const CHIP_SCALE = 0.42;
/** The camera passes through the screen's glass here, under a flash; after it, it is the screen's own camera. */
const SWAP = 331;

const SCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SCREEN_FRAGMENT = /* glsl */ `
uniform sampler2D uFeed;
uniform float uOn;
uniform float uFeedK;
uniform vec2 uCover;
varying vec2 vUv;
void main() {
  vec3 off = vec3(0.006, 0.005, 0.01) + vec3(0.02, 0.015, 0.035) * smoothstep(0.0, 1.0, 1.0 - vUv.y) * (0.6 + 0.4 * vUv.x);
  vec3 on = vec3(0.01, 0.006, 0.02) + vec3(0.03, 0.014, 0.06) * smoothstep(0.75, 0.0, distance(vUv, vec2(0.5)));
  vec2 f = (vUv - 0.5) * uCover + 0.5;
  vec3 feed = texture2D(uFeed, f).rgb;
  vec3 c = mix(off, on, uOn);
  c = mix(c, feed, uFeedK);
  c *= 0.965 + 0.035 * sin(vUv.y * 1400.0);
  gl_FragColor = vec4(c, 1.0);
}
`;

export async function build({ renderer, root }: BuildContext): Promise<World> {
  const bag = new Bag();
  const p = palette();
  const scene = studioScene(renderer, 0.05);
  const camera = new PerspectiveCamera(32, 16 / 9, 0.01, 120);
  const focusPoint = new Object3D();
  focusPoint.position.set(1.4, 0.4, -0.5);
  focusPoint.position.set(1.0, 0, -0.3);
  const lights = studioLights(scene, focusPoint, { x: -4.5, y: 8.5, z: 5.0, intensity: 1500 });

  scene.add(bench(p, bag));
  const drawer = drawerUnit(p, bag);
  drawer.group.position.set(-2.55, 0, -0.95);
  drawer.group.rotation.y = 0.22;
  const arm = robotArm(p, bag);
  arm.group.position.set(-0.3, 0, -0.35);
  const board = devBoard(p, bag);
  board.group.position.set(1.85, 0, 0.5);
  board.group.rotation.y = -0.1;
  const screen = monitor(p, bag, 3.2, 1.86);
  screen.group.position.set(4.1, 0, -2.05);
  screen.group.rotation.y = -0.42;
  const pc = miniPc(p, bag);
  pc.group.position.set(6.0, 0, -0.9);
  pc.group.rotation.y = -0.55;
  scene.add(drawer.group, arm.group, board.group, screen.group, pc.group);
  scene.updateMatrixWorld(true);

  // The cable from the board's connector, along the bench, to the PC.
  const from = board.connector.getWorldPosition(new Vector3());
  const to = pc.port.getWorldPosition(new Vector3());
  const wire = cable(p, bag, [from, new Vector3(from.x + 0.5, 0.04, from.z + 0.1), new Vector3((from.x + to.x) / 2, 0.03, (from.z + to.z) / 2 + 0.5), new Vector3(to.x - 0.5, 0.04, to.z + 0.25), to]);
  scene.add(wire.group);

  // The BC-2006 part: in the drawer's tray, then in the arm's grip, then in the socket.
  const chip = new Chip(p);
  chip.group.scale.setScalar(CHIP_SCALE);
  scene.add(chip.group);
  const inTray = new Matrix4().compose(new Vector3(0, 0.055, 0.35), new Object3D().quaternion, new Vector3(CHIP_SCALE, CHIP_SCALE, CHIP_SCALE));
  const gripHeight = (TOP + 0.03) * CHIP_SCALE;

  // The monitor's glass: off, on, then the part live from above (a camera of its own).
  const feed = new WebGLRenderTarget(1024, 576, { type: HalfFloatType, samples: 2 });
  bag.add(feed);
  const feedCamera = new PerspectiveCamera(30, 16 / 9, 0.01, 60);
  const screenMaterial = bag.add(
    new ShaderMaterial({
      uniforms: { uFeed: { value: feed.texture }, uOn: { value: 0 }, uFeedK: { value: 0 }, uCover: { value: [1, 1] } },
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
    }),
  );
  screen.screen.material = screenMaterial;
  const glow = new PointLight(0x8a6cff, 0, 6, 2);
  glow.position.set(0, 1.7, 0.9);
  screen.group.add(glow);

  const state = {
    drawer: 0,
    trip: 0,
    shut: 0,
    ring: 0,
    tx: 0,
    ty: 0,
    tz: 0,
    grip: 1,
    led: 0,
    flow: 0,
    power: 0,
    pulse: 0,
    pulseOn: 0,
    pcLed: 0,
    on: 0,
    feed: 0,
    lid: 0,
    glow: 0,
    window: 0,
  };

  // Where the arm goes: its rest, the part's grip point in the open tray, above the socket.
  const v = new Vector3();
  const trayGrip = (): Vector3 => {
    drawer.open(1);
    scene.updateMatrixWorld(true);
    const m = drawer.tray.matrixWorld.clone().multiply(inTray);
    const at = new Vector3().setFromMatrixPosition(m);
    at.y += gripHeight;
    drawer.open(0);
    return at;
  };
  const pick = trayGrip();
  const seat = board.socket.getWorldPosition(new Vector3());
  const place = seat.clone().setY(seat.y + gripHeight + 0.004);
  const rest = new Vector3(-0.9, 1.2, 0.45);
  state.tx = rest.x;
  state.ty = rest.y;
  state.tz = rest.z;

  // The screen's camera: straight down on the seated part, its top towards the monitor.
  const above = seat.clone().add(new Vector3(0, 1.25, 0.02));

  // The screen's middle and the way it faces, for the push through the glass.
  const glass = new Vector3(0, 1.71, 0.0415).applyMatrix4(screen.group.matrixWorld);
  const facing = new Vector3(0, 0, 1).applyQuaternion(screen.group.quaternion);
  const off = (d: number, side = 0, up = 0): [number, number, number] => [glass.x + facing.x * d + side * facing.z, glass.y + up, glass.z + facing.z * d - side * facing.x];
  // Each key keeps its subject right of the middle, where the step's words are not.
  const shots: Shot[] = [
    { f: 0, pos: [0.2, 3.2, 9.4], look: [1.5, 0.75, -0.8], fov: 31, focus: 9.6, blur: 2.2 },
    { f: 22, pos: [0.0, 2.8, 8.2], look: [1.1, 0.7, -0.8], fov: 31, focus: 8.5, blur: 2.4 },
    { f: 64, pos: [0.6, 1.5, 3.2], look: [-2.73, 0.4, 0.73], fov: 30, focus: 4.2, blur: 4.4 },
    { f: 98, pos: [1.0, 1.75, 3.6], look: [-2.55, 0.45, 0.85], fov: 30, focus: 4.4, blur: 4.0 },
    { f: 134, pos: [1.8, 2.6, 4.2], look: [-1.86, 0.75, 0.41], fov: 32, focus: 5.3, blur: 3.4 },
    { f: 176, pos: [3.4, 2.4, 4.4], look: [0.24, 0.65, 0.55], fov: 32, focus: 5.0, blur: 3.4 },
    { f: 214, pos: [3.6, 1.2, 2.6], look: [1.53, 0.12, 0.77], fov: 30, focus: 2.9, blur: 5 },
    { f: 246, pos: [5.0, 1.3, 3.0], look: [4.18, 0.2, -0.25], fov: 30, focus: 3.4, blur: 4.6 },
    { f: 278, pos: off(7.0, -2.6, 0.4), look: [glass.x - 1.6, glass.y - 0.2, glass.z + 1.0], fov: 31, focus: 7.2, blur: 3.0 },
    { f: 306, pos: off(5.6, -1.6, 0.2), look: [glass.x - 1.15, glass.y - 0.05, glass.z + 0.65], fov: 30, focus: 5.7, blur: 1.8 },
    { f: 320, pos: off(3.9, -0.3, 0.05), look: [glass.x - 0.15, glass.y, glass.z + 0.1], fov: 30, focus: 3.9, blur: 0.8 },
    { f: SWAP, pos: off(2.75), look: [glass.x, glass.y, glass.z], fov: 30, focus: 2.75, blur: 0.3 },
  ];
  const rig = new Rig(shots);
  const dive = new Rig([
    { f: SWAP, pos: [above.x, above.y, above.z], look: [seat.x, seat.y, seat.z], fov: 30, focus: 1.25, blur: 0 },
    { f: 350, pos: [seat.x, seat.y + 0.55, seat.z + 0.005], look: [seat.x, seat.y, seat.z], fov: 30, focus: 0.55, blur: 0 },
    { f: 366, pos: [seat.x, seat.y + 0.13, seat.z], look: [seat.x, seat.y, seat.z], fov: 32, focus: 0.13, blur: 0 },
    { f: 372, pos: [seat.x, seat.y + 0.045, seat.z], look: [seat.x, seat.y - 0.1, seat.z], fov: 34, focus: 0.05, blur: 0 },
  ]);
  const look = new Vector3();
  const pose: ArmPose = { yaw: 0, shoulder: 0, elbow: 0, wrist: 0, grip: 1 };
  const tip = new Vector3();
  const corners: [Vector3, Vector3, Vector3, Vector3] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  const nameEl = root.querySelector<HTMLElement>('.lab-screen-name');
  const page: [number, number, number] = [0, 0, 0];
  const quad: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]];
  let nameShown = false;

  return {
    scene,
    camera,
    chip,
    beats: {
      heroOut: [6, 30],
      steps: [
        [38, 56, 88, 98],
        [100, 118, 182, 194],
        [198, 216, 252, 262],
        [266, 284, 314, 324],
      ],
      bars: [40, 62, 300, 326],
    },

    timeline(tl) {
      // 01 Mechanics: the lead screw turns, the drawer comes out to its stop.
      tl.to(state, { drawer: 1, duration: 52, ease: 'power2.inOut' }, 40);
      tl.to(state, { trip: 1, duration: 4, ease: 'power1.out' }, 92);
      // 02 Mechatronics: the arm wakes, reaches into the tray, lifts the part, carries it, seats it.
      tl.to(state, { ring: 1, duration: 8, ease: 'power2.out' }, 96);
      tl.to(state, { tx: pick.x, tz: pick.z, duration: 22, ease: 'power2.inOut' }, 100);
      tl.to(state, { ty: pick.y + 0.55, duration: 22, ease: 'power2.inOut' }, 100);
      tl.to(state, { ty: pick.y, duration: 12, ease: 'power2.inOut' }, 122);
      tl.to(state, { grip: 0, duration: 6, ease: 'power2.inOut' }, 134);
      tl.to(state, { ty: pick.y + 0.7, duration: 12, ease: 'power2.inOut' }, 140);
      tl.to(state, { shut: 1, duration: 34, ease: 'power2.inOut' }, 156);
      tl.to(state, { tx: place.x, tz: place.z, duration: 36, ease: 'power2.inOut' }, 152);
      tl.to(state, { ty: place.y + 0.9, duration: 18, ease: 'power1.out' }, 152);
      tl.to(state, { ty: place.y + 0.5, duration: 18, ease: 'power1.in' }, 170);
      tl.to(state, { ty: place.y, duration: 12, ease: 'power2.inOut' }, 188);
      tl.to(state, { grip: 1, duration: 6, ease: 'power2.inOut' }, 200);
      tl.to(state, { ty: place.y + 0.7, duration: 16, ease: 'power2.inOut' }, 206);
      tl.to(state, { tx: rest.x, ty: rest.y, tz: rest.z, duration: 30, ease: 'power2.inOut' }, 222);
      // 03 Electronics: seated, the board powers; current runs out through the copper and down the cable.
      tl.to(state, { led: 1, duration: 4 }, 203);
      tl.to(state, { power: 1, duration: 6 }, 204);
      tl.to(state, { flow: 1, duration: 32, ease: 'power1.inOut' }, 206);
      tl.to(state, { pulseOn: 1, duration: 4 }, 232);
      tl.to(state, { pulse: 1, duration: 30, ease: 'power1.inOut' }, 232);
      tl.to(state, { pulseOn: 0, duration: 6 }, 260);
      // 04 Software: the PC wakes, the screen comes on and writes the name, then shows the part live.
      tl.to(state, { pcLed: 1, duration: 4 }, 260);
      tl.to(state, { on: 1, duration: 16, ease: 'power2.out' }, 266);
      tl.to(state, { feed: 1, duration: 22, ease: 'power1.inOut' }, 300);
      if (nameEl) {
        tl.set(nameEl, { autoAlpha: 1 }, 282);
        tl.fromTo(nameEl, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 16, ease: 'power2.inOut', immediateRender: false }, 282);
        tl.to(nameEl, { autoAlpha: 0, duration: 10 }, 320);
      }
      // Through the glass: the lid opens on the signal, then the window onto the tunnel.
      tl.to(state, { glow: 1, duration: 10, ease: 'power2.out' }, 324);
      tl.to(state, { lid: 1, duration: 14, ease: 'power2.inOut' }, 334);
      tl.to(state, { window: 1, duration: 12, ease: 'power1.inOut' }, 336);
    },

    frame(f, nowS, _dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      // The bench's parts.
      drawer.open(state.drawer * (1 - state.shut));
      drawer.trip(state.trip);
      arm.ring.color.setRGB(2.6 * state.ring, 1.55 * state.ring, 0.5 * state.ring);
      tip.set(state.tx, state.ty, state.tz);
      arm.set(arm.reach(tip, state.grip, pose));
      board.led.color.setRGB(0.25 * state.led, 2.2 * state.led, 0.6 * state.led);
      board.flow(state.flow, state.power);
      wire.pulse(state.pulse, state.pulseOn);
      pc.led.color.setRGB(2.6 * state.pcLed, 1.55 * state.pcLed, 0.5 * state.pcLed);
      screenMaterial.uniforms.uOn.value = state.on;
      screenMaterial.uniforms.uFeedK.value = state.feed;
      glow.intensity = 3.5 * state.on;

      // The part: tray, grip, socket.
      scene.updateMatrixWorld(true);
      if (f < 140) chip.group.matrix.copy(drawer.tray.matrixWorld).multiply(inTray);
      else if (f < 200) {
        arm.tip.getWorldPosition(v);
        chip.group.matrix.compose(v.setY(v.y - gripHeight), new Object3D().quaternion, chip.group.scale);
      } else chip.group.matrix.compose(seat.clone().setY(seat.y + 0.004), new Object3D().quaternion, chip.group.scale);
      chip.group.matrixAutoUpdate = false;
      chip.group.matrixWorldNeedsUpdate = true;
      chip.open(state.lid);
      chip.glow(state.glow);
      chip.window(state.window);

      // The camera: the bench's one shot, then the screen's own camera on down into the port.
      const shot = f < SWAP ? rig.at(f, camera.position, look) : dive.at(f, camera.position, look);
      camera.up.set(0, 1, 0);
      if (f >= SWAP) camera.up.set(0, 0, -1);
      camera.aspect = aspect;
      camera.fov = fovFor(shot.fov, aspect);
      camera.near = clamp(shot.focus * 0.05, 0.004, 0.1);
      camera.updateProjectionMatrix();
      camera.lookAt(look);
      camera.updateMatrixWorld();

      // The screen's camera is where the dive starts; the glass shows it at the page's shape.
      const feedShot = dive.at(SWAP, feedCamera.position, look);
      feedCamera.up.set(0, 0, -1);
      feedCamera.aspect = aspect;
      feedCamera.fov = fovFor(feedShot.fov, aspect);
      feedCamera.updateProjectionMatrix();
      feedCamera.lookAt(look);
      feedCamera.updateMatrixWorld();
      const screenAspect = 3.11 / 1.77;
      screenMaterial.uniforms.uCover.value = aspect > screenAspect ? [1, screenAspect / aspect] : [aspect / screenAspect, 1];

      // The name on the glass: real text, mapped onto the screen.
      if (nameEl && f >= 280 && f < SWAP) {
        screen.corners(corners);
        const w = nameEl.offsetWidth, h = nameEl.offsetHeight;
        const cx = corners.reduce((s, c) => s.add(c), new Vector3()).multiplyScalar(0.25);
        const right = corners[1].clone().sub(corners[0]).multiplyScalar(0.78);
        const up = corners[0].clone().sub(corners[3]).normalize().multiplyScalar(right.length() * (h / w));
        const pts = [
          cx.clone().sub(right.clone().multiplyScalar(0.5)).add(up.clone().multiplyScalar(0.5)),
          cx.clone().add(right.clone().multiplyScalar(0.5)).add(up.clone().multiplyScalar(0.5)),
          cx.clone().add(right.clone().multiplyScalar(0.5)).sub(up.clone().multiplyScalar(0.5)),
          cx.clone().sub(right.clone().multiplyScalar(0.5)).sub(up.clone().multiplyScalar(0.5)),
        ];
        let behind = false;
        pts.forEach((pt, i) => {
          toPage(pt, camera, width, height, page);
          if (page[2] > 1) behind = true;
          quad[i][0] = page[0];
          quad[i][1] = page[1];
        });
        if (!behind) nameEl.style.transform = quadMatrix(w, h, quad);
        nameShown = true;
      } else if (nameShown && nameEl) nameShown = false;

      lights.level(lamp);
      void nowS;
      const after = ease(f, SWAP, 356);
      const flash = 0.95 * (f < SWAP ? ease(f, 312, SWAP) : 1 - ease(f, SWAP, 348));
      return {
        focus: shot.focus,
        blur: shot.blur,
        grain: mix(0.034, 0, after),
        vignette: mix(0.58, 0, after),
        flash,
        light: lamp,
      } satisfies Look;
    },

    prerender(r: WebGLRenderer, f: number) {
      if (f < 298 || f >= SWAP) return;
      const [w, h] = [r.domElement.width, r.domElement.height];
      const fw = 1024, fh = Math.max(64, Math.round((1024 * h) / Math.max(1, w)));
      if (feed.width !== fw || feed.height !== fh) feed.setSize(fw, fh);
      r.setRenderTarget(feed);
      r.render(scene, feedCamera);
      r.setRenderTarget(null);
    },

    readout(f) {
      if (f < 40) return 'Bench · supply 5.00 V';
      if (f < 98) return `Drawer ${(state.drawer * 92).toFixed(1).padStart(4, '0')} mm · screw ${(state.drawer * 23).toFixed(1)} turns`;
      if (f < 200) {
        const deg = (r: number): string => `${Math.round((r * 180) / Math.PI)}°`.padStart(4, ' ');
        return `Limit switch 1 · arm J1 ${deg(pose.yaw)} J2 ${deg(pose.shoulder)} J3 ${deg(pose.elbow)}`;
      }
      if (f < 262) return `Socket U1 · ${(state.power * 3.3).toFixed(2)} V · ${Math.round(state.flow * 180)} mA`;
      if (f < SWAP) return state.feed > 0.5 ? 'PC · camera 2 · BC-2006 live' : `PC · boot ${Math.round(state.on * 100)} %`;
      return 'BC-2006 · port open';
    },

    pointer() {},

    dispose() {
      bag.dispose();
      p.dispose();
      chip.dispose();
      scene.environment?.dispose();
      gsap.killTweensOf(state);
    },
  };
}
