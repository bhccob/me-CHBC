import { AdditiveBlending, Box3, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute, LineBasicMaterial, LineLoop, type Material, Mesh, type MeshStandardMaterial, type Object3D, Plane, type Scene, Vector3 } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { ease, mix, ramp } from '~/journey/math';

/**
 * LAB ONLY (throwaway). B's look, for any object: each study's parts appear first as a gold line drawing of themselves,
 * then a gold scan line rises through them (the brain's own motif) and leaves them solid behind it. Works on any meshes:
 * their materials are copied with a clipping plane, their edges drawn in gold.
 */

export interface PrintGroup {
  roots: readonly Object3D[];
  /** Frames: the drawing appears; the scan runs from print[0] to print[1]. */
  draw: number;
  print: readonly [number, number];
}

export const GOLD_LINE = new Color(2.2, 1.4, 0.48);

interface Print {
  group: PrintGroup;
  plane: Plane;
  meshes: Mesh[];
  lines: LineMaterial;
  ring: LineLoop;
  box: Box3;
  synced: [MeshStandardMaterial, MeshStandardMaterial][];
}

export class Printer {
  private readonly prints: Print[] = [];
  private readonly owned: { dispose(): void }[] = [];
  /** The world's up: the scan runs along it. */
  private readonly up: 'y' | 'z';

  /** `angle`: the least angle between two faces that is drawn as an edge (rounded boxes need it under their facets' 22°). */
  constructor(scene: Scene, groups: readonly PrintGroup[], up: 'y' | 'z' = 'y', skip: (mesh: Mesh) => boolean = () => false, angle = 28) {
    this.up = up;
    const ringMaterial = new LineBasicMaterial({ color: GOLD_LINE.clone().multiplyScalar(1.6), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });
    this.owned.push(ringMaterial);
    const normal = up === 'y' ? new Vector3(0, -1, 0) : new Vector3(0, 0, -1);
    for (const group of groups) {
      const plane = new Plane(normal.clone(), -100);
      const lines = new LineMaterial({ color: GOLD_LINE, linewidth: 1.2, transparent: true, opacity: 0, depthWrite: false });
      this.owned.push(lines);
      // Collected first: the edges added below are meshes too.
      const found: Mesh[] = [];
      for (const root of group.roots) {
        root.traverse((node) => {
          if (node instanceof Mesh && !(node instanceof LineSegments2) && !skip(node)) found.push(node);
        });
      }
      const synced: [MeshStandardMaterial, MeshStandardMaterial][] = [];
      for (const mesh of found) {
        const original = mesh.material as MeshStandardMaterial;
        const copy = original.clone();
        copy.clippingPlanes = [plane];
        copy.clipShadows = true;
        mesh.material = copy;
        this.owned.push(copy);
        if (original.emissive) synced.push([original, copy]);
        const edges = new EdgesGeometry(mesh.geometry, angle);
        const geometry = new LineSegmentsGeometry().setPositions(edges.attributes.position.array as Float32Array);
        edges.dispose();
        this.owned.push(geometry);
        const line = new LineSegments2(geometry, lines);
        line.frustumCulled = false;
        line.renderOrder = 5;
        mesh.add(line);
      }
      const ringGeometry = new BufferGeometry();
      ringGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
      this.owned.push(ringGeometry);
      const ring = new LineLoop(ringGeometry, ringMaterial);
      ring.frustumCulled = false;
      ring.visible = false;
      scene.add(ring);
      this.prints.push({ group, plane, meshes: found, lines, ring, box: new Box3(), synced });
    }
  }

  /** The drawings and the scan at frame `f`; `fade` is when every drawing goes, once the object is whole. */
  update(f: number, width: number, height: number, pixelRatio: number, fade: readonly [number, number] = [272, 290]): void {
    const y = this.up === 'y';
    for (const p of this.prints) {
      for (const [original, copy] of p.synced) copy.emissiveIntensity = original.emissiveIntensity;
      const { draw, print } = p.group;
      p.box.makeEmpty();
      for (const mesh of p.meshes) if (mesh.visible) p.box.expandByObject(mesh);
      const empty = p.box.isEmpty();
      const lo = empty ? 0 : y ? p.box.min.y : p.box.min.z;
      const hi = empty ? 1 : y ? p.box.max.y : p.box.max.z;
      const printing = f >= print[0] && f < print[1] && !empty;
      p.plane.constant = f < print[0] ? lo - 0.02 : f >= print[1] ? 1000 : mix(lo - 0.01, hi + 0.01, ease(ramp(f, print[0], print[1]), 0, 1));
      p.lines.opacity = ease(f, draw, draw + 10) * (1 - 0.82 * ease(f, print[1] - 4, print[1] + 10)) * (1 - ease(f, fade[0], fade[1]));
      p.lines.linewidth = 1.2 * pixelRatio;
      p.lines.resolution.set(width * pixelRatio, height * pixelRatio);
      p.ring.visible = printing;
      if (printing) {
        const h = p.plane.constant, b = p.box, pad = 0.04;
        const a = p.ring.geometry.attributes.position as Float32BufferAttribute;
        if (y) {
          a.setXYZ(0, b.min.x - pad, h, b.min.z - pad);
          a.setXYZ(1, b.max.x + pad, h, b.min.z - pad);
          a.setXYZ(2, b.max.x + pad, h, b.max.z + pad);
          a.setXYZ(3, b.min.x - pad, h, b.max.z + pad);
        } else {
          a.setXYZ(0, b.min.x - pad, b.min.y - pad, h);
          a.setXYZ(1, b.max.x + pad, b.min.y - pad, h);
          a.setXYZ(2, b.max.x + pad, b.max.y + pad, h);
          a.setXYZ(3, b.min.x - pad, b.max.y + pad, h);
        }
        a.needsUpdate = true;
      }
    }
  }

  /** Which study is printing now, and how far, for the corner. */
  status(f: number): string {
    const now = this.prints.find((p) => f >= p.group.print[0] && f < p.group.print[1]);
    if (now) return `Printing ${String(Math.round(ramp(f, now.group.print[0], now.group.print[1]) * 100)).padStart(3, '0')} %`;
    const done = this.prints.filter((p) => f >= p.group.print[1]).length;
    return `${String(done).padStart(2, '0')} / 04 built`;
  }

  dispose(): void {
    for (const thing of this.owned) thing.dispose();
  }
}

/** Disposes the materials and geometry of everything under `root`. */
export function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    const material = node.material as Material | Material[];
    for (const m of Array.isArray(material) ? material : [material]) m.dispose();
  });
}
