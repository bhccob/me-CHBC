// LAB ONLY (throwaway). Round 63, idea 2, "Boot Up". The coin's square hole is the CPU: you come out of the chip,
// inside Bob's PC, and turn round to see where you are. One part lights per study: the processor (its lid engraved
// like a brain), the graphics card, the security chip, the fans. Then out through the glass side into his room, his
// eyes at the desk, the works on the screens, the whole setup at the end. Code art only.
import { THREE, phone, clamp, ease, span, outside, C, pivot, sky, door, makeRT, pose, lerpPose, frame, portal, renderTo, present, place, camera, HOLE } from './r62.js';
import { makeRoom } from './room62.js';
import { run, lightFrom } from './run63.js';

const room = await makeRoom();
const rtPC = makeRT(), rtMon = makeRT(1024, 429);
door.material.uniforms.uRT.value = rtPC.texture;
const { MB, MBW, PCW } = room;

// the coin's hole opens onto the CPU's lid, scaled down to it; whatever is behind the lid is cut away
const mbQ = MB.getWorldQuaternion(new THREE.Quaternion());
const lidQ = mbQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
const toPC = portal(frame(C), frame(MBW(new THREE.Vector3(0, 0.37, 0.0105)), lidQ, 0.02 / HOLE), { clip: true });

// poses inside the case, in the motherboard's own terms (+z toward the glass, +x toward the front of the case)
const WIDE = 58; // a wider lens inside the case, so you see where you are
const mbPose = (cam, look, fov = WIDE) => pose(MBW(new THREE.Vector3(...cam)), MBW(new THREE.Vector3(...look)), fov);
const S = [
  mbPose([-0.065, 0.385, 0.165], [-0.065, 0.36, 0]),
  mbPose([-0.2, 0.165, 0.185], [-0.12, 0.215, 0.07]),
  mbPose([-0.17, 0.205, 0.16], [-0.17, 0.17, 0]),
  mbPose([-0.08, 0.335, 0.15], [0.205, 0.255, 0.1]),
];
const F = pose(new THREE.Vector3(0, phone ? 1.4 : 0.92, phone ? 15 : 10.4), new THREE.Vector3(0, C.y + (phone ? 0.05 : 0.16), 0));
const FWD = new THREE.Vector3(0, 0, -1);
const enterPath = new THREE.CatmullRomCurve3([F.pos, new THREE.Vector3(0, C.y, 2.6), C.clone(), C.clone().add(new THREE.Vector3(0, 0, -0.45))]);
const sideways = mbPose([-0.02, 0.38, 0.07], [0.2, 0.36, 0.07]); // halfway round: looking along the board
const outPath = new THREE.CatmullRomCurve3([S[3].pos, MBW(new THREE.Vector3(0.02, 0.3, 0.17)), MBW(new THREE.Vector3(0.0, 0.33, 0.3)), MBW(new THREE.Vector3(-0.1, 0.45, 0.62)), room.poses.eye.pos]);
const lookOut = mbPose([0.0, 0.3, 0.17], [0.0, 0.33, 0.6], 44);
const steps = (x, n) => { x = clamp(x, 0, n); const i = Math.min(n, Math.floor(x)); return i + ease(x - i); };
const studyPose = (s) => { const i = Math.min(3, Math.floor(s)), t = ease(s - i); return lerpPose(S[i], S[Math.min(3, i + 1)], t); };

run(({ p, time, dt, nx, ny, live, forced, tilt }) => {
  let where = 'outside', P, near = 0.01;
  if (p < 0.6) {
    const u = ease(p / 0.6);
    const pos = enterPath.getPointAt(u);
    const q = F.q.clone().slerp(pose(F.pos, F.pos.clone().add(FWD)).q, clamp(u / 0.4));
    const P0 = { pos, q, fov: F.fov };
    if (toPC.side(pos) < 0) { where = 'pc'; P = toPC.map(P0); } else P = P0;
  } else if (p < 1) {
    where = 'pc';
    const E0 = toPC.map({ pos: C.clone().add(new THREE.Vector3(0, 0, -0.45)), q: pose(F.pos, F.pos.clone().add(FWD)).q, fov: F.fov });
    const t = (p - 0.6) / 0.4;
    P = t < 0.5 ? lerpPose(E0, sideways, ease(t / 0.5)) : lerpPose(sideways, S[0], ease((t - 0.5) / 0.5));
  } else if (p < 4) { where = 'pc'; P = studyPose(steps(p - 1, 3)); }
  else if (p < 4.7) {
    where = 'pc';
    const u = ease((p - 4) / 0.7);
    const q = u < 0.35 ? S[3].q.clone().slerp(lookOut.q, ease(u / 0.35)) : lookOut.q.clone().slerp(room.poses.eye.q, ease((u - 0.35) / 0.65));
    P = { pos: outPath.getPointAt(u), q, fov: u < 0.35 ? S[3].fov + (lookOut.fov - S[3].fov) * ease(u / 0.35) : lookOut.fov + (room.poses.eye.fov - lookOut.fov) * ease((u - 0.35) / 0.65) };
  } else if (p < 5) { where = 'room'; P = lerpPose(room.poses.eye, room.workPose(0), ease((p - 4.7) / 0.3)); }
  else if (p < 9) { where = 'room'; const w = p - 5, i = Math.min(3, Math.floor(w)); P = lerpPose(room.workPose(i), room.workPose(i + 1), ease(w - i)); }
  else { where = 'room'; P = lerpPose(room.workPose(4), room.poses.end, ease(p - 9)); }
  const sway = where === 'room' ? 0.006 : where === 'pc' && p > 0.95 && p < 4.05 ? 0.004 : p < 0.3 ? 0.3 : 0;
  P = { ...P, pos: P.pos.clone().add(new THREE.Vector3(tilt[0] * sway, -tilt[1] * sway * 0.6, 0).applyQuaternion(P.q)) };

  const tiltAmt = 1 - span(p, 0.1, 0.4);
  pivot.rotation.set(tilt[1] * 0.25 * tiltAmt, tilt[0] * 0.4 * tiltAmt, 0);
  const study = clamp(p - 1, 0, 3), si = Math.round(study), studyAmt = span(p, 0.8, 1.0) * (1 - span(p, 4.05, 4.4));
  let hover = -1;
  if (where === 'room' && p > 4.9 && p < 9.5) {
    if (forced >= 0) hover = forced;
    else if (live) { place(camera, P); hover = room.pick(camera, nx, ny); }
  }
  room.update({ time, w: clamp(p - 5, 0, 4), end: span(p, 9, 10), idle: rtMon.texture, hover, tilt, dt, study: si, studyAmt, works: span(p, 4.85, 5.1) * (1 - span(p, 9.2, 9.6)) });

  sky.material.uniforms.uSun.value.set(0, 0, -1);
  renderTo(rtMon, outside, F, { aspect: 0.8 / 0.335 });
  if (where === 'outside') {
    lightFrom(P, nx, ny, 6);
    sky.material.uniforms.uSun.value.copy(C).sub(P.pos).normalize();
    renderTo(rtPC, room.scene, toPC.map(P), { near: 0.0015, clip: toPC.plane });
    present(outside, P);
  } else present(room.scene, P, where === 'pc' ? 0.0015 : 0.005);
  const parts = [room.parts.cpu, room.parts.gpuStrip, room.parts.chip, room.parts.caseFans[1].ring];
  return { pose: P, hover, regionPoint: where === 'pc' && p > 0.85 && p < 4.1 ? parts[si].getWorldPosition(new THREE.Vector3()) : null };
});
