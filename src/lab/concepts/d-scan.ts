import { gsap } from 'gsap';
import { AdditiveBlending, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Plane, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { clamp, ease, mix } from '~/journey/math';
import { Chip } from '../engine/chip';
import { gear } from '../engine/gear';
import { canvasTexture, palette, studioLights, studioScene } from '../engine/look';
import { nameSolid } from '../engine/name3d';
import { Bag } from '../engine/props';
import { fovFor, Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway, storyboard). D · Scan. The brain's own instrument arrives first: a gold scan band crosses the name
 * in solid metal and shows, behind it, what the letters are made of: a mechanism, then a circuit, then at the core one
 * part, BC-2006. Built for four stills, with a working seam.
 */

const XRAY_VERTEX = /* glsl */ `
#include <clipping_planes_pars_vertex>
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 local = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 mvPosition = modelViewMatrix * local;
  vN = normalize(normalMatrix * n);
  vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`;
const XRAY_FRAGMENT = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <clipping_planes_fragment>
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  gl_FragColor = vec4(uColor * (0.008 + rim * 0.9), 1.0);
}
`;

export async function build({ renderer }: BuildContext): Promise<World> {
  renderer.localClippingEnabled = true;
  const bag = new Bag();
  const p = palette();
  const scene = studioScene(renderer, 0.04);
  const camera = new PerspectiveCamera(30, 16 / 9, 0.01, 100);
  const target = new Group();
  const lights = studioLights(scene, target, { x: -3, y: 4, z: 6, intensity: 900 });

  const band = { x: -2.2 };
  const keep = new Plane(new Vector3(1, 0, 0), 2.2);
  const shown = new Plane(new Vector3(-1, 0, 0), -2.2);

  // The name, solid ahead of the band and X-ray behind it.
  const { geometry } = nameSolid(0.22);
  bag.add(geometry);
  const solidMaterial = bag.add(new MeshStandardMaterial({ color: '#3a3442', metalness: 0.85, roughness: 0.32, clippingPlanes: [keep], clipShadows: true }));
  const xrayMaterial = bag.add(new ShaderMaterial({ uniforms: { uColor: { value: new Color(1.0, 0.68, 0.26) } }, vertexShader: XRAY_VERTEX, fragmentShader: XRAY_FRAGMENT, clipping: true, clippingPlanes: [shown], transparent: true, blending: AdditiveBlending, depthWrite: false }));
  const upm = 1000;
  const name = new Group();
  for (const material of [solidMaterial, xrayMaterial]) {
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = Math.PI;
    mesh.scale.setScalar(1 / upm);
    mesh.castShadow = material === solidMaterial;
    name.add(mesh);
  }
  scene.add(name);

  // Behind it: the mechanism, then the circuit, then the core.
  // The mechanism in the same X-ray as the letters: only its edges light.
  const goldLit = bag.add(new ShaderMaterial({ uniforms: { uColor: { value: new Color(0.95, 0.58, 0.2) } }, vertexShader: XRAY_VERTEX, fragmentShader: XRAY_FRAGMENT, clipping: true, clippingPlanes: [shown], transparent: true, blending: AdditiveBlending, depthWrite: false }));
  const mechanism = new Group();
  const gears: [number, number, number, number][] = [[-1.05, 0.38, 0.32, 1], [-0.42, 0.52, 0.2, -1], [0.22, 0.36, 0.28, 1], [0.95, 0.42, 0.24, -1], [-0.9, -0.42, 0.26, -1], [-0.2, -0.38, 0.22, 1], [0.5, -0.46, 0.3, -1], [1.18, -0.36, 0.18, 1]];
  const turning = gears.map(([x, y, r, dir]) => {
    const g = gear(bag, goldLit, r, 0.04, 0.035);
    g.position.set(x, y, -0.45);
    mechanism.add(g);
    return { g, dir, r };
  });
  scene.add(mechanism);
  const traces = bag.add(
    canvasTexture(1024, 640, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(240,180,80,0.9)';
      ctx.lineWidth = 3;
      let s = 5;
      const rnd = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) {
        let x = w / 2, y = h / 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const a = rnd() * Math.PI * 2;
        x += Math.cos(a) * 60;
        y += Math.sin(a) * 60;
        ctx.lineTo(x, y);
        for (let k = 0; k < 3; k++) {
          const dir = Math.floor(rnd() * 8) * (Math.PI / 4);
          const len = 40 + rnd() * 160;
          x += Math.cos(dir) * len;
          y += Math.sin(dir) * len;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }),
  );
  const circuit = new Mesh(bag.add(new PlaneGeometry(3.6, 2.25)), bag.add(new MeshBasicMaterial({ map: traces, transparent: true, blending: AdditiveBlending, depthWrite: false, clippingPlanes: [shown], color: new Color(1.4, 1.1, 0.8) })));
  circuit.position.z = -0.95;
  scene.add(circuit);
  const chip = new Chip(p);
  chip.group.scale.setScalar(0.62);
  chip.group.rotation.x = Math.PI / 2;
  chip.group.position.set(0, 0, -0.78);
  scene.add(chip.group);

  // The band itself.
  const bandMaterial = bag.add(new MeshBasicMaterial({ color: new Color(2.6, 1.6, 0.55), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  const bandMesh = new Mesh(bag.add(new PlaneGeometry(0.012, 2.4)), bandMaterial);
  const bandGlow = new Mesh(bag.add(new PlaneGeometry(0.18, 2.4)), bag.add(new MeshBasicMaterial({ color: new Color(0.5, 0.3, 0.1), transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })));
  const bandGroup = new Group();
  bandGroup.add(bandMesh, bandGlow);
  bandGroup.rotation.y = Math.PI / 2;
  const bandSheet = new Group();
  bandSheet.add(bandGroup);
  // A sheet of light across the name: thin in x, deep in z.
  bandMesh.scale.set(1, 1, 1);
  const sheet = new Mesh(bag.add(new PlaneGeometry(1.6, 2.4)), bag.add(new MeshBasicMaterial({ color: new Color(0.16, 0.1, 0.04), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })));
  sheet.rotation.y = Math.PI / 2;
  sheet.position.z = -0.5;
  bandSheet.add(sheet);
  scene.add(bandSheet);

  const state = { glow: 0, lid: 0, window: 0 };
  const port = new Vector3();
  chip.portCenter(port);
  const shots: Shot[] = [
    { f: 0, pos: [0, 0, 6.4], look: [-0.5, -0.4, 0], fov: 30, focus: 6.4, blur: 0 },
    { f: 40, pos: [0.5, 0.35, 5.2], look: [-0.55, -0.42, 0], fov: 30, focus: 5.2, blur: 1.2 },
    { f: 120, pos: [1.9, 0.7, 4.4], look: [-0.45, -0.38, -0.35], fov: 30, focus: 4.6, blur: 2.4 },
    { f: 200, pos: [4.0, 1.5, 2.9], look: [-0.25, -0.3, -0.55], fov: 30, focus: 4.6, blur: 2.6 },
    { f: 300, pos: [0.55, 0.3, 0.55], look: [-0.05, -0.08, -0.78], fov: 30, focus: 1.45, blur: 3.4 },
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
      tl.to(band, { x: -0.1, duration: 100, ease: 'power1.inOut' }, 24);
      tl.to(band, { x: 2.1, duration: 80, ease: 'power1.inOut' }, 130);
      tl.to(state, { glow: 1, duration: 30 }, 250);
      tl.to(state, { lid: 1, duration: 14, ease: 'power2.inOut' }, 326);
      tl.to(state, { window: 1, duration: 12 }, 336);
    },

    frame(f, nowS, _dt, width, height, lamp) {
      keep.constant = -band.x;
      shown.constant = band.x;
      bandSheet.position.x = band.x;
      bandSheet.visible = band.x > -1.9 && band.x < 2.0;
      const turn = f * 0.03;
      for (const { g, dir, r } of turning) g.rotation.z = (dir * turn * 0.3) / r;
      chip.group.visible = band.x > 0;
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
      void nowS;
      const after = ease(f, 340, 364);
      return { focus: shot.focus, blur: shot.blur, grain: mix(0.03, 0, after), vignette: mix(0.55, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    readout(f) {
      const slice = Math.round(clamp((band.x + 1.6) / 3.2) * 256);
      if (f < 24) return 'Scanner · standing by';
      if (f < 250) return `Scan · slice ${String(slice).padStart(3, '0')} / 256`;
      return 'Core found · BC-2006';
    },

    dispose() {
      renderer.localClippingEnabled = false;
      bag.dispose();
      p.dispose();
      chip.dispose();
      scene.environment?.dispose();
      gsap.killTweensOf([band, state]);
    },
  };
}
