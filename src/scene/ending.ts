/* the last page: the pieces fly in one by one and are rammed home, Me last. on the final hit the lock shakes and small
   blocks burst out of it. the finished lock can be dragged to turn it (mouse only). a press takes it apart: the six
   pieces slide out and hang there. the next press rams them home again, one after the other, Me last.
   (the form is opened by the "Send a message" button under the lock, not by the lock) */
import * as THREE from "three";
import { clamp, ss, lerp } from "../util";
import { clack, finale } from "../audio";
import { form, formPose } from "./form";
import type { PieceRig } from "./pieces";
import type { Frame, Pose } from "./frame";

export const ending = {
  /** when the last camera shake started, and how strong */
  shakeT: -9, shakeAmp: 0,
  /** when the lock closed. below 0: not closed */
  finalT: -9,
  /** the visitor's own turn of the lock */
  userYaw: 0, userPitch: 0,
  /** the pointer is over the finished lock */
  hover: false,
  /** the lock is finished and can be dragged and pressed */
  live: false,
  /** the visitor has taken the lock apart, and when they last pressed it (seconds) */
  apart: false, playT: 0,
};
const hit = [0, 0, 0, 0, 0, 0];
/* how far out each piece is, 0 home .. 1 out, and where it was when the lock was last pressed */
const pull = [0, 0, 0, 0, 0, 0], from = [0, 0, 0, 0, 0, 0];

/** a press on the finished lock: apart, or back together */
function toggleLock() {
  ending.apart = !ending.apart; ending.playT = performance.now() / 1000;
  for (let k = 0; k < 6; k++) from[k] = pull[k];
  if (ending.apart) clack(0.35); // it lets go with one soft knock
}
/** how far out piece k is this frame. out: all six slide away together, Me a touch ahead. back: one at a time, each
    driven home with a knock, Me last and hardest */
function pulled(k: number, F: Frame) {
  if (form.open && ending.apart) { ending.apart = false; ending.playT = F.time; for (let j = 0; j < 6; j++) from[j] = pull[j]; } // the form takes the pieces: they go home quietly on the way
  const el = F.time - ending.playT;
  let v: number;
  if (F.reduce) v = ending.apart ? 1 : 0;
  else if (ending.apart) { const u = clamp((el - (5 - k) * 0.04) / 0.5, 0, 1); v = lerp(from[k], 1, 1 - Math.pow(1 - u, 3)); }
  else { const u = clamp((el - k * 0.085) / 0.15, 0, 1); v = from[k] * (1 - u * u * u); }
  if (!ending.apart && pull[k] > 0.001 && v <= 0.001 && !form.open && (!F.reduce || k === 5)) {
    clack(k === 5 ? 0.85 : 0.5); ending.shakeT = F.time; ending.shakeAmp = k === 5 ? 0.5 : 0.16;
  }
  pull[k] = v;
  return v;
}
const vA = new THREE.Vector3(), qA = new THREE.Quaternion();

/** each piece flies in out of the fog, lines up outside its slot, then is driven home hard.
    the Me piece comes last, waits a beat, and closes the lock */
export function placeInLock(k: number, pc: PieceRig, P: Pose, F: Frame) {
  const A = F.A, s0 = 0.06 + k * 0.1 + (k === 5 ? 0.02 : 0), T = s0 + 0.2 + (k === 5 ? 0.02 : 0);
  if (A <= s0) P.vis = false;
  else {
    const fly = ss(s0, s0 + 0.14, A), ram = clamp((A - (T - 0.06)) / 0.06, 0, 1), dirE = k * 1.9 + 0.4;
    /* taken apart, each piece slides out along its own length: three one way, three the other, so it opens evenly */
    const out = ending.finalT > 0 && A >= T ? pulled(k, F) * (F.wide ? 2.4 : 1.3) * (k < 3 ? 1 : -1) : 0;
    vA.copy(pc.axis).multiplyScalar(5.5 * (1 - ram * ram * ram) + out).add(pc.aPos).multiplyScalar(F.endScale).applyQuaternion(F.lockQ).add(F.endPos);
    qA.copy(F.lockQ).multiply(pc.aQuat);
    P.pos.set(Math.cos(dirE) * 30, Math.sin(dirE) * 14 + 3, -38).lerp(vA, 1 - Math.pow(1 - fly, 3));
    P.pos.y += Math.sin(Math.PI * fly) * 4; P.quat.slerp(qA, ss(0.2, 1, fly)); P.sc = lerp(F.lockScale, F.endScale, fly);
    P.glow = 0.6 + 0.15 * ram;
    if (F.ft > 0) formPose(k, pc, P, F);
  }
  /* the moment it seats: knock, shake, and for the last one the big close */
  if (A >= T && !hit[k]) {
    hit[k] = 1;
    if (!F.first && !form.open) {
      ending.shakeT = F.time; ending.shakeAmp = k === 5 ? 1.1 : 0.4;
      if (k === 5) { ending.finalT = F.time; finale(); } else clack(0.75);
    } else if (k === 5) ending.finalT = F.time - 20; // page opened already at the end: show it finished, without the show
  } else if (A < T - 0.02 && hit[k]) { hit[k] = 0; if (k === 5) ending.finalT = -9; }
  if (A < T || ending.finalT < 0) { pull[k] = from[k] = 0; if (k === 5) ending.apart = false; } // leaving the page puts it back together, without a sound
}

/** where fragment i is, `since` seconds after the lock closed: it bursts out, slows down as if there were no gravity,
    and stays floating and tumbling. every third block travels much further sideways, so some reach the screen edges */
export function burst(i: number, since: number, endPos: THREE.Vector3, out: { x: number; y: number; z: number; k: number; spin: number }) {
  const sa = i * 2.399, sel = Math.sin(i * 1.31) * 1.1, reach = 6 + (i % 6) * 2.1, far = 1.6 + reach * (1 - Math.exp(-since * 1.6)) + Math.min(since, 40) * 0.12;
  const wob = since * 0.25 + i;
  out.x = endPos.x + Math.cos(sa) * Math.cos(sel) * far * (1 + (i % 3) * 0.7) + Math.sin(wob) * 0.35;
  out.y = endPos.y + Math.sin(sel) * far + Math.cos(wob * 0.8) * 0.35;
  out.z = endPos.z + Math.sin(sa) * Math.cos(sel) * far * 0.5;
  out.k = Math.min(1, since * 9) * 0.8;
  out.spin = 3 * (1 - Math.exp(-since * 1.2)) + since * 0.12 * (1 + (i % 3));
}

/** dragging turns the finished lock (mouse only; a finger only taps, so it never fights with scrolling). a press takes it apart or closes it */
export function initDrag(hitTest: (e: MouseEvent) => number) {
  let dragging = false, touchDrag = false, moved = 0, lastX = 0, lastY = 0;
  window.addEventListener("pointerdown", (e) => {
    if (!ending.live || form.open || (e.target as Element).closest?.("a,button") || hitTest(e) < 0) return;
    dragging = true; touchDrag = e.pointerType === "touch"; moved = 0; lastX = e.clientX; lastY = e.clientY;
    if (e.pointerType === "mouse") e.preventDefault(); // dragging the lock should not select the text behind it
  });
  window.addEventListener("pointercancel", () => { dragging = false; });
  window.addEventListener("pointermove", (e) => {
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (!touchDrag) { ending.userYaw += dx * 0.008; ending.userPitch = clamp(ending.userPitch + dy * 0.008, -1.2, 1.2); }
    } else if (e.pointerType === "mouse") { ending.hover = ending.live && hitTest(e) >= 0; document.body.style.cursor = ending.hover ? "pointer" : ""; }
  });
  window.addEventListener("pointerup", () => { if (dragging && moved < (touchDrag ? 12 : 7) && ending.live && !form.open) toggleLock(); dragging = false; });
}
