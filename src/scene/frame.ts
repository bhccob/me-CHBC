/* what one drawn frame knows, shared by the wall, the ending and the form */
import * as THREE from "three";

/** where one piece goes this frame. each stage of the site adjusts it in turn */
export interface Pose { pos: THREE.Vector3; quat: THREE.Quaternion; sc: number; glow: number; vis: boolean }

export interface Frame {
  /** seconds since the page opened */
  time: number;
  /** the same, but frozen at 0 for visitors who ask for reduced motion */
  tt: number;
  /** true on the very first frame: nothing makes a sound or plays its entrance */
  first: boolean;
  reduce: boolean;
  /** scroll stages, see timeline.ts */
  dc: number; dop: number; ep: number; A: number;
  /** 0..1: the lock has opened into the message form */
  ft: number;
  /** eased pointer position, -1..1 */
  smx: number; smy: number;
  wide: boolean; halfW: number; halfH: number;
  /** the piece the camera is with, or -1 */
  active: number;
  lockScale: number; fullScale: number; endScale: number;
  /** size of one wall tile, and how high the wall sits */
  sd: number; wallY: number;
  /** how the finished lock is turned */
  lockQ: THREE.Quaternion;
  endPos: THREE.Vector3;
}

export const makeFrame = (): Frame => ({
  time: 0, tt: 0, first: true, reduce: false, dc: 0, dop: 0, ep: 0, A: 0, ft: 0, smx: 0, smy: 0,
  wide: true, halfW: 10, halfH: 6, active: -1, lockScale: 1, fullScale: 1, endScale: 1, sd: 1, wallY: 0,
  lockQ: new THREE.Quaternion(), endPos: new THREE.Vector3(),
});
