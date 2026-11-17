import { gsap } from 'gsap';
import { AdditiveBlending, Box3, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute, LineLoop, LineBasicMaterial, Mesh, type MeshStandardMaterial, Plane, Vector3 } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { ease, mix, ramp } from '~/journey/math';
import { idleFrames, nightShare } from '~/journey/machine/choreography';
import { LabMachine } from '../engine/machine';
import { Rig, type Shot } from '../engine/rig';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). B · Drawn, then built. Bob's machine, built part by part as on the live site. Each new part
 * arrives as a gold line drawing of itself; then a gold scan line, the brain's own motif, passes up through it and leaves
 * it solid behind. One fixed three-quarter view, one dark ground: the page reads like one drawing sheet becoming real.
 */

interface Group {
  names: readonly string[];
  /** Frames: the drawing appears, the scan starts, the scan ends. */
  draw: number;
  print: readonly [number, number];
}

const GROUPS: readonly Group[] = [
  { names: ['code', 'code-cover'], draw: 50, print: [70, 94] },
  { names: ['game'], draw: 102, print: [122, 146] },
  { names: ['wall0', 'wall1', 'wall2', 'wall3', 'post-0', 'post-1', 'post-2', 'post-3', 'lid', 'keycap', ...Array.from({ length: 9 }, (_, k) => `blade-pivot-${k}`)], draw: 154, print: [178, 204] },
  { names: ['turret', 'servo-0', 'servo-1', 'pinion-0', 'pinion-1', 'leg0', 'leg1', 'leg2', 'leg3'], draw: 206, print: [236, 270] },
];

const GOLD = new Color(2.2, 1.4, 0.48);

export async function build({ renderer }: BuildContext): Promise<World> {
  renderer.localClippingEnabled = true;
  const m = new LabMachine();
  const shots: Shot[] = [
    { f: 0, pos: [2.0, -2.9, 1.7], look: [-0.25, 0.35, 0.02], fov: 24, blur: 1.6 },
    { f: 60, pos: [2.5, -3.2, 2.3], look: [-0.3, 0.3, 0.1], fov: 24, blur: 1.2 },
    { f: 150, pos: [2.7, -3.1, 2.55], look: [-0.32, 0.3, 0.2], fov: 24, blur: 1.2 },
    { f: 210, pos: [2.9, -3.0, 2.4], look: [-0.32, 0.3, 0.14], fov: 25, blur: 1.2 },
    { f: 264, pos: [3.3, -3.7, 1.4], look: [-0.35, 0.3, -0.12], fov: 27, blur: 1.2 },
    { f: 300, pos: [2.2, -4.3, 2.7], look: [-0.2, 0.2, 0.3], fov: 28, blur: 1.0 },
    { f: 318, pos: [0.4, -4.4, 2.6], look: [0, 0, 0.2], fov: 30, blur: 0.8 },
  ];
  const rig = new Rig(shots);
  const pos = new Vector3(), look = new Vector3();

  // Built once the model is in: for each study, its meshes printed through one clipping plane, its edges in gold.
  const prints: { group: Group; plane: Plane; meshes: Mesh[]; lines: LineMaterial; ring: LineLoop; box: Box3; synced: [MeshStandardMaterial, MeshStandardMaterial][] }[] = [];
  const owned: { dispose(): void }[] = [];
  const ringMaterial = new LineBasicMaterial({ color: GOLD.clone().multiplyScalar(1.6), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
  owned.push(ringMaterial);

  const prepare = (): void => {
    for (const group of GROUPS) {
      const plane = new Plane(new Vector3(0, 0, -1), -10);
      const lines = new LineMaterial({ color: GOLD, linewidth: 1.2, transparent: true, opacity: 0, depthWrite: false });
      owned.push(lines);
      const meshes: Mesh[] = [];
      const synced: [MeshStandardMaterial, MeshStandardMaterial][] = [];
      // Collected first: the edges added below are meshes too, and must not be walked into.
      const found: Mesh[] = [];
      for (const name of group.names) {
        m.part(name)?.traverse((node) => {
          if (node instanceof Mesh && !(node instanceof LineSegments2)) found.push(node);
        });
      }
      for (const node of found) {
        {
          const original = node.material as MeshStandardMaterial;
          const copy = original.clone();
          copy.clippingPlanes = [plane];
          copy.clipShadows = true;
          node.material = copy;
          if (original.emissive) synced.push([original, copy]);
          meshes.push(node);
          const edges = new EdgesGeometry(node.geometry, 28);
          const geometry = new LineSegmentsGeometry().setPositions(edges.attributes.position.array as Float32Array);
          edges.dispose();
          owned.push(geometry);
          const line = new LineSegments2(geometry, lines);
          line.frustumCulled = false;
          line.renderOrder = 5;
          node.add(line);
        }
      }
      // The scan line: a gold outline that runs round the part at the height being printed.
      const ringGeometry = new BufferGeometry();
      ringGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
      owned.push(ringGeometry);
      const ring = new LineLoop(ringGeometry, ringMaterial);
      ring.frustumCulled = false;
      ring.visible = false;
      m.scene.add(ring);
      prints.push({ group, plane, meshes, lines, ring, box: new Box3(), synced });
    }
  };

  return {
    scene: m.scene,
    camera: m.camera,
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
    async load(progress) {
      await m.load(renderer, progress);
      prepare();
      // The clipped copies are new shaders: readied now, not mid-scroll.
      renderer.compile(m.scene, m.camera);
    },

    timeline() {},

    frame(f, nowS, _dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      m.update(f, idleFrames(nowS) * nightShare(f), aspect);
      m.light({ key: 0.85 * lamp + 0.05, rim: 1.2 * lamp + 0.2, top: lamp, bench: 0.6 });
      const pr = renderer.getPixelRatio();
      for (const p of prints) {
        for (const [original, copy] of p.synced) copy.emissiveIntensity = original.emissiveIntensity;
        const { draw, print } = p.group;
        // Where the part is now, in the world: its height range is what the scan runs through.
        p.box.makeEmpty();
        for (const mesh of p.meshes) if (mesh.visible) p.box.expandByObject(mesh);
        const k = ramp(f, print[0], print[1]);
        const printing = f >= print[0] && f < print[1] && !p.box.isEmpty();
        const zMin = p.box.isEmpty() ? 0 : p.box.min.z, zMax = p.box.isEmpty() ? 1 : p.box.max.z;
        p.plane.constant = f < print[0] ? zMin - 0.02 : f >= print[1] ? 100 : mix(zMin - 0.01, zMax + 0.01, ease(k, 0, 1));
        // The drawing: in as it arrives, strong while it is only lines, faint once solid, gone as the machine is whole.
        const drawn = ease(f, draw, draw + 10) * (1 - 0.82 * ease(f, print[1] - 4, print[1] + 10)) * (1 - ease(f, 272, 290));
        p.lines.opacity = drawn;
        p.lines.linewidth = 1.2 * pr;
        p.lines.resolution.set(width * pr, height * pr);
        p.ring.visible = printing;
        if (printing) {
          const z = p.plane.constant, b = p.box, pad = 0.04;
          const a = p.ring.geometry.attributes.position as Float32BufferAttribute;
          a.setXYZ(0, b.min.x - pad, b.min.y - pad, z);
          a.setXYZ(1, b.max.x + pad, b.min.y - pad, z);
          a.setXYZ(2, b.max.x + pad, b.max.y + pad, z);
          a.setXYZ(3, b.min.x - pad, b.max.y + pad, z);
          a.needsUpdate = true;
        }
      }
      const shot = rig.at(f, pos, look);
      m.aim(f, { pos, look, fov: shot.fov }, aspect);
      const after = ease(f, 330, 356);
      return { focus: pos.distanceTo(look), blur: shot.blur * (1 - after), grain: mix(0.02, 0, after), vignette: mix(0.3, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    window: (f) => m.window(f),

    readout(f) {
      const done = GROUPS.filter((g) => f >= g.print[1]).length;
      const now = GROUPS.find((g) => f >= g.print[0] && f < g.print[1]);
      return now ? `Printing ${String(Math.round(ramp(f, now.print[0], now.print[1]) * 100)).padStart(3, '0')} %` : `${String(done).padStart(2, '0')} / 04 built`;
    },

    dispose() {
      renderer.localClippingEnabled = false;
      for (const thing of owned) thing.dispose();
      m.dispose();
      gsap.killTweensOf(prints);
    },
  };
}
