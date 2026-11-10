import { gsap } from 'gsap';
import { AdditiveBlending, BoxGeometry, CatmullRomCurve3, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, ShaderMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { clamp, ease, mix } from '~/journey/math';
import { Chip } from '../engine/chip';
import { gear } from '../engine/gear';
import { palette, studioLights, studioScene } from '../engine/look';
import { nameSolid } from '../engine/name3d';
import { Bag } from '../engine/props';
import { fovFor, Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway, storyboard). E · Mechanism. The name is the machine: each letter turns on its own gear behind
 * it, the scroll is the crank on the B, and the turn passes letter to letter until the G's cam closes a contact and
 * current runs to BC-2006. Built for four stills, with a working seam.
 */

const PULSE_VERTEX = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PULSE_FRAGMENT = /* glsl */ `
uniform float uAt;
varying vec2 vUv;
void main() {
  float lit = smoothstep(uAt, uAt - 0.06, vUv.x);
  float head = exp(-pow((vUv.x - uAt) / 0.03, 2.0)) * step(0.001, uAt);
  float a = lit * 0.55 + head * 2.0;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(2.4, 1.45, 0.48) * a, 1.0);
}
`;

export async function build({ renderer }: BuildContext): Promise<World> {
  const bag = new Bag();
  const p = palette();
  const scene = studioScene(renderer, 0.04);
  const camera = new PerspectiveCamera(30, 16 / 9, 0.01, 100);
  const target = new Group();
  const lights = studioLights(scene, target, { x: -3, y: 4.5, z: 5.5, intensity: 1000 });

  const { geometry, letters } = nameSolid(0.16);
  bag.add(geometry);
  const name = new Mesh(geometry, p.metal);
  name.rotation.x = Math.PI;
  name.scale.setScalar(1 / 1000);
  name.castShadow = true;
  scene.add(name);

  // A gear behind each letter, the train running B, O, B, then down to C, H, U, N, G.
  const backZ = -0.2;
  const train = letters.map((letter, i) => {
    const r = Math.min(0.27, letter.size.x * 0.5);
    const g = gear(bag, i % 2 ? p.copper : p.alu, r, 0.05, 0.032);
    g.position.set(letter.center.x, letter.center.y, backZ);
    scene.add(g);
    const axle = bag.mesh(new CylinderGeometry(0.025, 0.025, 0.22, 16), p.tin);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(letter.center.x, letter.center.y, backZ + 0.1);
    scene.add(axle);
    return { g, r, dir: i % 2 ? -1 : 1 };
  });
  // The idler between the lines, and the crank on the first B.
  const idler = gear(bag, p.alu, 0.16, 0.05, 0.032);
  idler.position.set((letters[2].center.x + letters[3].center.x) / 2 + 0.25, 0, backZ);
  scene.add(idler);
  const crank = new Group();
  crank.add(bag.mesh(new BoxGeometry(0.62, 0.06, 0.05), p.metal));
  const knob = bag.mesh(new CylinderGeometry(0.05, 0.05, 0.18, 20), p.black);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(-0.3, 0, 0.1);
  crank.add(knob);
  crank.position.set(letters[0].center.x, letters[0].center.y, backZ - 0.08);
  scene.add(crank);

  // The G's cam and the contact it closes, then the wire to the part.
  const g = letters[letters.length - 1];
  const cam = bag.mesh(new BoxGeometry(0.1, 0.34, 0.06), p.copper);
  cam.position.set(g.center.x, g.center.y, backZ - 0.06);
  scene.add(cam);
  const contactA = bag.mesh(new BoxGeometry(0.04, 0.22, 0.12), p.copper);
  const contactB = bag.mesh(new BoxGeometry(0.04, 0.22, 0.12), p.copper);
  const cx = g.center.x + g.size.x * 0.5 + 0.18;
  contactA.position.set(cx, g.center.y, backZ);
  contactB.position.set(cx + 0.12, g.center.y, backZ);
  scene.add(contactA, contactB);
  const spark = new Mesh(bag.add(new SphereGeometry(0.03, 16, 12)), bag.add(new MeshBasicMaterial({ color: new Color(3, 2, 0.8), transparent: true, blending: AdditiveBlending, depthWrite: false })));
  spark.position.set(cx + 0.06, g.center.y, backZ);
  scene.add(spark);

  const chip = new Chip(p);
  chip.group.scale.setScalar(0.5);
  chip.group.rotation.x = Math.PI / 2;
  const chipAt = new Vector3(cx + 1.0, g.center.y + 0.05, backZ - 0.1);
  chip.group.position.copy(chipAt);
  scene.add(chip.group);
  const wire = new CatmullRomCurve3([new Vector3(cx + 0.14, g.center.y, backZ), new Vector3(cx + 0.4, g.center.y - 0.25, backZ - 0.05), new Vector3(chipAt.x - 0.45, chipAt.y - 0.2, backZ - 0.1), new Vector3(chipAt.x - 0.3, chipAt.y, backZ - 0.1)]);
  scene.add(bag.mesh(new TubeGeometry(wire, 64, 0.014, 8), p.black));
  const pulseMaterial = bag.add(new ShaderMaterial({ uniforms: { uAt: { value: 0 } }, vertexShader: PULSE_VERTEX, fragmentShader: PULSE_FRAGMENT, transparent: true, blending: AdditiveBlending, depthWrite: false }));
  scene.add(bag.mesh(new TubeGeometry(wire, 96, 0.02, 8), pulseMaterial, false));

  const state = { turn: 0, contact: 0, pulse: 0, glow: 0, lid: 0, window: 0 };
  const port = new Vector3();
  chip.portCenter(port);
  const shots: Shot[] = [
    { f: 0, pos: [0.4, 0.2, 6.2], look: [-0.4, -0.4, 0], fov: 30, focus: 6.2, blur: 0 },
    { f: 40, pos: [-2.2, 0.9, 4.4], look: [-0.9, -0.2, 0], fov: 30, focus: 4.6, blur: 1.6 },
    { f: 120, pos: [1.2, 2.6, -3.6], look: [0, -0.1, 0], fov: 32, focus: 4.4, blur: 2.2 },
    { f: 200, pos: [cx + 0.9, g.center.y + 0.5, 1.0], look: [cx - 0.1, g.center.y, backZ], fov: 30, focus: 1.3, blur: 4 },
    { f: 300, pos: [chipAt.x - 0.6, chipAt.y + 0.5, 1.6], look: [chipAt.x - 0.25, chipAt.y - 0.05, chipAt.z], fov: 30, focus: 1.8, blur: 3 },
    { f: 340, pos: [port.x, port.y, port.z + 0.5], look: [port.x, port.y, port.z], fov: 30, focus: 0.5, blur: 0 },
    { f: 372, pos: [port.x, port.y, port.z + 0.03], look: [port.x, port.y, port.z - 0.1], fov: 34, focus: 0.03, blur: 0 },
  ];
  const rig = new Rig(shots);
  const look = new Vector3();

  return {
    scene,
    camera,
    chip,
    beats: {
      heroOut: [6, 28],
      steps: [
        [24, 36, 70, 80],
        [96, 110, 150, 160],
        [176, 190, 232, 242],
        [270, 284, 326, 336],
      ],
      bars: [30, 50, 320, 336],
    },

    timeline(tl) {
      tl.to(state, { turn: 1, duration: 170, ease: 'none' }, 20);
      tl.to(state, { contact: 1, duration: 10, ease: 'power2.in' }, 186);
      tl.to(state, { pulse: 1, duration: 60, ease: 'power1.inOut' }, 200);
      tl.to(state, { glow: 1, duration: 20 }, 258);
      tl.to(state, { lid: 1, duration: 14, ease: 'power2.inOut' }, 326);
      tl.to(state, { window: 1, duration: 12 }, 336);
    },

    frame(f, _nowS, _dt, width, height, lamp) {
      const angle = state.turn * Math.PI * 6;
      train.forEach(({ g: wheel, r, dir }) => (wheel.rotation.z = (dir * angle * 0.25) / r));
      idler.rotation.z = (-angle * 0.25) / 0.16;
      crank.rotation.z = angle;
      cam.rotation.z = (-angle * 0.25) / train[train.length - 1].r;
      contactB.position.x = cx + 0.12 - 0.08 * state.contact;
      (spark.material as MeshBasicMaterial).opacity = state.contact * (1 - ease(f, 200, 230)) + 0.0;
      spark.scale.setScalar(0.5 + state.contact * 2.5 * (1 - ease(f, 200, 230)));
      pulseMaterial.uniforms.uAt.value = state.pulse;
      chip.open(state.lid);
      chip.glow(state.glow);
      chip.window(state.window);
      const shot = rig.at(f, camera.position, look);
      camera.aspect = width / Math.max(1, height);
      camera.fov = fovFor(shot.fov, camera.aspect);
      camera.near = clamp(shot.focus * 0.04, 0.004, 0.2);
      camera.updateProjectionMatrix();
      camera.lookAt(look);
      lights.level(lamp * ease(f, 0, 24) + 0.0001);
      const after = ease(f, 340, 364);
      return { focus: shot.focus, blur: shot.blur, grain: mix(0.03, 0, after), vignette: mix(0.55, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    readout(f) {
      if (f < 20) return 'Crank · 0.0 turns';
      if (f < 190) return `Crank · ${(state.turn * 3).toFixed(1)} turns · ${letters.length} letters, ${letters.length + 1} gears`;
      if (f < 258) return `Contact closed · ${Math.round(state.pulse * 100)} % to BC-2006`;
      return 'BC-2006 · powered';
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
