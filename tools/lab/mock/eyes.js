// LAB ONLY (throwaway). Round 63, idea 1, "Behind the Eyes". Through the coin into Bob's head: the brain inside a
// skull lit from the eyes, one part per study, each wired to the eyes. Then out through his eye: his desk, in first
// person. The works on the screens they were made for; the end is the whole setup. Code art only.
import { THREE, ASPECT, phone, clamp, ease, mix, span, outside, C, pivot, sky, door, makeBrain, makeRT, RES, pose, lerpPose, frame, portal, renderTo, present, GL, shared, dust, place, camera } from './r62.js';
import { makeRoom } from './room62.js';
import { run, lightFrom } from './run63.js';

const room = await makeRoom();
const rtHead = makeRT(), rtRoom = makeRT(), rtMon = makeRT(1024, 429);
door.material.uniforms.uRT.value = rtHead.texture;

// ------------------------------------------------------------------ the head
const head = new THREE.Scene();
const brain = makeBrain(new THREE.Vector3(0, 0, 0), 2.0, head);
const E1 = new THREE.Vector3(9.0, 0.6, 1.7), E2 = new THREE.Vector3(9.0, 0.6, -1.7);
const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { uEye: { value: [E1, E2] } },
  vertexShader: 'varying vec3 vW, vO; void main(){ vO = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: GL + /* glsl */ `
    uniform vec3 uEye[2]; varying vec3 vW, vO;
    void main() {
      vec3 d = normalize(vO);
      float lat = asin(clamp(d.y, -1.0, 1.0)), lon = atan(d.z, d.x);
      float fm = lon / (2.0 * PI) * 40.0, fp = lat / PI * 22.0;
      float lines = (1.0 - smoothstep(0.0, max(fwidth(fm), 1e-4) * 1.3, 0.5 - abs(fract(fm) - 0.5))) * 0.5
                  + (1.0 - smoothstep(0.0, max(fwidth(fp), 1e-4) * 1.3, 0.5 - abs(fract(fp) - 0.5))) * 0.5;
      float e = 0.0;
      for (int i = 0; i < 2; i++) { float dd = length(vW - uEye[i]); e += exp(-dd * dd / 9.0); }
      vec3 col = vec3(0.006, 0.0025, 0.013) + vec3(0.03, 0.012, 0.05) * fbm(vO * 3.0);
      col += vec3(1.0, 0.58, 0.28) * e * 0.08;
      col += GOLD * lines * (0.04 + e * 0.45);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
}));
skull.scale.set(9.6, 6.6, 8.6);
skull.position.set(1.2, 0.3, 0);
head.add(skull);
// the eyes: two windows at the front of the head; through them, the room
const eyeMat = new THREE.ShaderMaterial({
  uniforms: { uRT: { value: rtRoom.texture }, uRes: { value: RES } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D uRT; uniform vec2 uRes; varying vec2 vP; void main(){ float r = length(vP) / 0.85; vec3 c = texture2D(uRT, gl_FragCoord.xy / uRes).rgb; c *= 1.0 - 0.5 * smoothstep(0.75, 1.0, r); gl_FragColor = vec4(c, 1.0); }',
});
const eyeQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // +z points back into the head
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 60, 128, 128, 128); g.addColorStop(0, 'rgba(255,170,90,0.7)'); g.addColorStop(1, 'rgba(255,120,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const halos = [];
for (const E of [E1, E2]) {
  const g = new THREE.Group(); g.position.copy(E); g.quaternion.copy(eyeQ); head.add(g);
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 96), eyeMat));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.035, 12, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color('#cf9a62').multiplyScalar(1.6), toneMapped: false })));
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.7, 96), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.position.z = -0.01; g.add(halo); halos.push(halo);
}
// nerves: one from each study's part of the brain to the near eye, and the two optic nerves
brain.group.updateMatrixWorld(true);
const nerveMat = (seed) => new THREE.ShaderMaterial({
  uniforms: { uTime: shared.uTime, uLit: { value: 0 }, uSeed: { value: seed } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform float uTime, uLit, uSeed; varying vec2 vUv;
    void main() {
      float run = pow(fract(vUv.x * 2.0 - uTime * (0.35 + uLit * 0.6) + uSeed), 10.0);
      vec3 c = vec3(1.0, 0.62, 0.3) * (0.1 + uLit * 1.1 + run * (0.5 + uLit * 2.0));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const nerves = brain.regions.map((r, i) => {
  const a = brain.mesh.localToWorld(r.clone());
  const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0.25, 0.05, 0.3)), new THREE.Vector3(2.4, 0.15 + i * 0.12, 1.1), new THREE.Vector3(5.6, -0.1, 1.7), E1.clone().add(new THREE.Vector3(-0.25, -0.95 + i * 0.05, 0.1))]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.009, 6, false), nerveMat(i * 0.27));
  head.add(m);
  return m;
});
for (const E of [E1, E2]) {
  const from = new THREE.Vector3(1.0, -0.4, Math.sign(E.z) * 0.35);
  const curve = new THREE.CatmullRomCurve3([from, new THREE.Vector3(3.6, -0.7, Math.sign(E.z) * 1.0), new THREE.Vector3(7.2, -0.6, E.z), E.clone().add(new THREE.Vector3(-0.2, -1.0, 0))]);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.05, 10, false), nerveMat(0.6)));
}
dust(head, 1600, [-7, -5, -7, 9, 6, 7], 26, new THREE.Color(0, 0, 0), 0.04);

// ------------------------------------------------------------------ the camera's way through
const F = pose(new THREE.Vector3(0, phone ? 1.4 : 0.92, phone ? 15 : 10.4), new THREE.Vector3(0, C.y + (phone ? 0.05 : 0.16), 0));
const ABOUT = phone ? new THREE.Vector3(0, -1.2, 8.0) : new THREE.Vector3(-2.25, 0.1, 7.3);
const YAW = [0.28, 0.05, 0.0, -0.38], PITCH = [0.0, 0.24, -0.05, -0.08];
const aboutPose = (s) => {
  const i = Math.min(3, Math.floor(s)), j = Math.min(3, i + 1), t = ease(s - i);
  const yaw = mix(YAW[i], YAW[j], t), pitch = mix(PITCH[i], PITCH[j], t);
  const off = ABOUT.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -pitch).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const target = new THREE.Vector3(ABOUT.x, phone ? -1.6 : 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return pose(off, target);
};
const A0 = aboutPose(0), A3 = aboutPose(3);
// the coin's hole opens onto a point just behind the first about view
const behind = A0.pos.clone().add(new THREE.Vector3(0, 0, 1.4).applyQuaternion(A0.q));
const toHead = portal(frame(C), frame(behind, A0.q));
// the near eye opens onto Bob's eyes at the desk, at a tenth of the size
const toRoom = portal(frame(E1, eyeQ), frame(room.poses.eye.pos, room.poses.eye.q, 0.04));
const FWD = new THREE.Vector3(0, 0, -1);
const enterPath = new THREE.CatmullRomCurve3([F.pos, new THREE.Vector3(0, C.y, 2.6), C.clone(), C.clone().add(new THREE.Vector3(0, 0, -1.4))]);
const eyeLook = pose(E1.clone().add(new THREE.Vector3(-1, 0, 0)), E1);
const throughEye = room.poses.eye.pos.clone().add(new THREE.Vector3(0, 0, -0.05).applyQuaternion(room.poses.eye.q));
const exitPath = new THREE.CatmullRomCurve3([A3.pos, new THREE.Vector3(2.4, 0.3, 4.6), new THREE.Vector3(6.4, 0.6, 2.2), E1.clone().add(new THREE.Vector3(-1.2, 0, 0)), E1.clone().add(new THREE.Vector3(0.25, 0, 0))]);
const steps = (x, n) => { x = clamp(x, 0, n); const i = Math.min(n, Math.floor(x)); return i + ease(x - i); };

run(({ p, time, dt, nx, ny, live, forced, tilt }) => {
  let where = 'outside', P, near = 0.01;
  if (p < 1) {
    const u = ease(p);
    const pos = enterPath.getPointAt(u);
    const q = F.q.clone().slerp(pose(F.pos, F.pos.clone().add(FWD)).q, clamp(u / 0.4));
    const P0 = { pos, q, fov: F.fov };
    if (toHead.side(pos) < 0) { where = 'head'; P = lerpPose(toHead.map(P0), A0, ease(clamp((u - 0.86) / 0.14))); }
    else P = P0;
  } else if (p < 4) { where = 'head'; P = aboutPose(steps(p - 1, 3)); }
  else if (p < 4.62) {
    const u = ease((p - 4) / 0.62);
    const pos = exitPath.getPointAt(u);
    const q = A3.q.clone().slerp(eyeLook.q, ease(clamp(u / 0.55)));
    const P0 = { pos, q, fov: A3.fov };
    if (toRoom.side(pos) < 0) { where = 'room'; P = toRoom.map(P0); } else { where = 'head'; P = P0; }
  } else if (p < 5) {
    where = 'room';
    const t = (p - 4.62) / 0.38;
    P = t < 0.4 ? room.poses.eye : lerpPose(room.poses.eye, room.workPose(0), ease((t - 0.4) / 0.6));
  } else if (p < 9) { where = 'room'; const w = p - 5, i = Math.min(3, Math.floor(w)); P = lerpPose(room.workPose(i), room.workPose(i + 1), ease(w - i)); }
  else { where = 'room'; P = lerpPose(room.workPose(4), room.poses.end, ease(p - 9)); }
  // a little life from the pointer, outside the crossings
  const sway = where === 'room' ? 0.006 : where === 'head' && p > 0.9 && p < 4.05 ? 0.12 : p < 0.3 ? 0.3 : 0;
  P = { ...P, pos: P.pos.clone().add(new THREE.Vector3(tilt[0] * sway, -tilt[1] * sway * 0.6, 0).applyQuaternion(P.q)) };

  // the coin, the brain, the room
  const tiltAmt = 1 - span(p, 0.1, 0.4);
  pivot.rotation.set(tilt[1] * 0.25 * tiltAmt, tilt[0] * 0.4 * tiltAmt, 0);
  const study = clamp(p - 1, 0, 3), si = Math.round(study), litAmt = span(p, 0.7, 1.0) * (1 - span(p, 4.1, 4.5));
  brain.uniforms.uActive.value = si;
  brain.uniforms.uLitAmt.value = litAmt;
  brain.group.updateMatrixWorld();
  brain.uniforms.uNM.value.setFromMatrix4(brain.mesh.matrixWorld);
  nerves.forEach((n, i) => { n.material.uniforms.uLit.value = (i === si ? 1 : 0.12) * litAmt + span(p, 4.0, 4.4) * 0.6; });
  halos.forEach((h) => { h.material.opacity = 0.8 * (1 - span(p, 4.25, 4.5)); });
  let hover = -1;
  if (where === 'room' && p > 4.9 && p < 9.5) {
    if (forced >= 0) hover = forced;
    else if (live) { place(camera, P); hover = room.pick(camera, nx, ny); }
  }
  room.update({ time, w: clamp(p - 5, 0, 4), end: span(p, 9, 10), idle: rtMon.texture, hover, tilt, dt, works: span(p, 4.85, 5.1) * (1 - span(p, 9.2, 9.6)) });

  // draw
  if (where === 'outside') {
    lightFrom(P, nx, ny, 6);
    sky.material.uniforms.uSun.value.copy(C).sub(P.pos).normalize();
    renderTo(rtHead, head, toHead.map(P));
    present(outside, P);
  } else {
    if (p > 3.5) { sky.material.uniforms.uSun.value.set(0, 0, -1); renderTo(rtMon, outside, F, { aspect: 0.8 / 0.335 }); }
    if (where === 'head') {
      lightFrom(P, nx, ny, 4);
      if (p > 3.5) renderTo(rtRoom, room.scene, toRoom.map(P), { near: 0.002 });
      present(head, P);
    } else present(room.scene, P, 0.005);
  }
  return { pose: P, hover, regionPoint: where === 'head' && p > 0.8 && p < 4.1 ? brain.mesh.localToWorld(brain.regions[si].clone()) : null };
});
