/* the space around the lock: floor grid, floating blocks that stream past, and dust.
   it is a place in space, so nothing shines into it: no light shafts or beams of any kind */
import * as THREE from "three";
import { rnd } from "../util";
import type { Rig } from "./rig";

export interface Frag { mesh: THREE.Mesh; x: number; y: number; z: number; s: number; rx: number; ry: number; sp: number }
export interface Env {
  group: THREE.Group;
  floor: THREE.GridHelper;
  frags: Frag[];
  dust: THREE.Points;
}

export function buildEnvironment(rig: Rig): Env {
  const group = new THREE.Group(); rig.scene.add(group);

  /* dust */
  const n = rig.lite ? 300 : 700, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = (rnd(i) - 0.5) * 60; arr[i * 3 + 1] = (rnd(i + 1000) - 0.5) * 36; arr[i * 3 + 2] = (rnd(i + 2000) - 0.5) * 40 - 6; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xefe8d6, size: 0.07, transparent: true, opacity: 0.55 }));
  rig.scene.add(dust);

  const floor = new THREE.GridHelper(250, 100, 0xe0b85a, 0x6a6590); floor.position.y = -7.5;
  floor.material.transparent = true; floor.material.depthWrite = false; group.add(floor);

  const frags: Frag[] = [];
  const fgeo = new THREE.BoxGeometry(1, 1, 1), fmat = new THREE.MeshStandardMaterial({ color: 0x1d1a29, metalness: 0.5, roughness: 0.5, emissive: 0x2c2244, emissiveIntensity: 0.7 });
  const count = rig.lite ? 28 : 48;
  for (let i = 0; i < count; i++) {
    const ang = rnd(i + 300) * 6.283, rad = 9 + rnd(i + 400) * 14, fm = new THREE.Mesh(fgeo, fmat);
    group.add(fm); frags.push({ mesh: fm, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.7, z: rnd(i + 500) * 90, s: 0.25 + rnd(i + 600) * 0.7, rx: rnd(i + 700) * 6, ry: rnd(i + 800) * 6, sp: 0.5 + rnd(i + 900) });
  }
  return { group, floor, frags, dust };
}
