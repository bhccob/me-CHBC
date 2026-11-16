/* the wall: after the sixth chapter the pieces fly in from the fog on curved, tumbling paths and tile into a flat 2×3 wall */
import * as THREE from "three";
import { clamp, ss, lerp } from "../util";
import { CH } from "../timeline";
import { tock } from "../audio";
import { CAM_Z } from "./rig";
import type { Frame, Pose } from "./frame";

const wallHit = [0, 0, 0, 0, 0, 0];
const vK = new THREE.Vector3(), flatQ = new THREE.Quaternion(); // flat: square to the camera

/** two columns of three pieces, big enough to cover the screen. its bottom edge sits exactly on the top edge of the
    work page and scrolls up with it */
export function wallMetrics(F: Frame, workTop: number, y: number, vh: number) {
  F.sd = Math.max(F.halfW / 6, F.halfH / 3) * 1.06;
  F.wallY = Math.max(-F.halfH, -(((workTop - y) / vh) * 2 - 1) * F.halfH) * (CAM_Z - F.sd) / CAM_Z + 3 * F.sd;
}

/** each piece flies in from its own direction out of the fog, still tumbling, on a curved path. it slows as it arrives
    and only turns flat in the last stretch */
export function placeInWall(i: number, P: Pose, F: Frame) {
  const slot = CH[i] - 1, side = slot < 3 ? -1 : 1, row = slot % 3, d0 = clamp((F.dc - slot * 0.07) / 0.62, 0, 1), d = 1 - Math.pow(1 - d0, 3);
  const dir = slot * 2.4 + 0.7, arc = Math.sin(Math.PI * d);
  if (i !== F.active) { P.pos.set(Math.cos(dir) * 26, Math.sin(dir) * 12 + 4, -34 - slot * 3); P.sc = F.lockScale; }
  vK.set(side * 3 * F.sd, (1 - row) * 2 * F.sd + F.wallY, 0);
  P.pos.lerp(vK, d);
  P.pos.x += arc * Math.cos(dir + 1.6) * 5; P.pos.y += arc * 3; P.pos.z += arc * 4;
  P.quat.slerp(flatQ, ss(0.35, 1, d0)); P.sc = lerp(P.sc, F.sd * 1.004, d); P.glow = lerp(P.glow, 0.9, d);
  /* each slab knocks into place as it lands */
  if (d0 >= 1 && !wallHit[slot]) { wallHit[slot] = 1; if (!F.first) tock(); } else if (d0 < 0.9) wallHit[slot] = 0;
}
