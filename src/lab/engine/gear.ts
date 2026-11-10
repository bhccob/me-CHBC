import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, type Material, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import type { Bag } from './props';

/** LAB ONLY (throwaway). A spur gear lying in the xy plane (its axle along z): a disc, a hub and square teeth. */
export function gear(bag: Bag, material: Material, radius: number, thickness = 0.05, toothSize = 0.045): Group {
  const group = new Group();
  const disc = bag.mesh(new CylinderGeometry(radius, radius, thickness, 48), material);
  disc.rotation.x = Math.PI / 2;
  const hub = bag.mesh(new CylinderGeometry(radius * 0.22, radius * 0.22, thickness * 2.4, 24), material);
  hub.rotation.x = Math.PI / 2;
  const teeth = Math.max(8, Math.round((2 * Math.PI * radius) / (toothSize * 2.1)));
  const tooth = bag.add(new BoxGeometry(toothSize, toothSize * 1.3, thickness));
  const ring = new InstancedMesh(tooth, material, teeth);
  const m = new Matrix4(), q = new Quaternion(), z = new Vector3(0, 0, 1), one = new Vector3(1, 1, 1), at = new Vector3();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    ring.setMatrixAt(i, m.compose(at.set(Math.cos(a) * (radius + toothSize * 0.5), Math.sin(a) * (radius + toothSize * 0.5), 0), q.setFromAxisAngle(z, a - Math.PI / 2), one));
  }
  ring.castShadow = true;
  // Spokes, so a turn shows.
  for (let k = 0; k < 3; k++) {
    const spoke = bag.mesh(new BoxGeometry(radius * 1.5, radius * 0.12, thickness * 1.3), material) as Mesh;
    spoke.rotation.z = (k * Math.PI) / 3;
    group.add(spoke);
  }
  group.add(disc, hub, ring);
  return group;
}
