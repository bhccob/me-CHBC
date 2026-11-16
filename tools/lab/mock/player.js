// LAB ONLY (throwaway). Round 63, idea 3, "Player One". The front is a game's title screen. Its studies are a skill
// tree that grows out of the coin into the sky, one branch unlocking per study. "Press start", and the camera pulls
// back out of the screen: it was Bob's monitor, at his desk, and you are looking through his eyes. The works on the
// other screens; at the end the game is still running on the main one. Code art only.
import { THREE, phone, clamp, ease, mix, span, outside, C, pivot, sky, makeRT, pose, lerpPose, renderTo, present, place, camera, tex } from './r62.js';
import { makeRoom } from './room62.js';
import { run, lightFrom } from './run63.js';

const room = await makeRoom();
const rtMon = makeRT(1440, 603);
const MON_ASPECT = 0.8 / 0.335;

// ------------------------------------------------------------------ the skill tree, in the game's sky
const ROOT = new THREE.Vector3(0, 2.5, -7);
const tree = new THREE.Group();
outside.add(tree);
const CHARS = ['码', '戏', '安', '机'];
const ANG = [-0.95, -0.34, 0.34, 0.95];
const lineMat = () => new THREE.ShaderMaterial({
  uniforms: { uFill: { value: 0 }, uHot: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform float uFill, uHot; varying vec2 vUv;
    void main() {
      float on = step(vUv.x, uFill);
      vec3 c = mix(vec3(0.32, 0.16, 0.5) * 0.45, vec3(1.0, 0.64, 0.3) * (1.2 + uHot * 0.9), on);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const ringGeo = new THREE.TorusGeometry(0.2, 0.024, 6, 6), discGeo = new THREE.CircleGeometry(0.17, 6);
const branches = ANG.map((a, i) => {
  const dir = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
  const pts = [ROOT.clone()];
  for (let k = 1; k <= 3; k++) pts.push(ROOT.clone().addScaledVector(dir, k * 1.15).add(new THREE.Vector3(Math.sin(a) * k * k * 0.06, -k * k * 0.02, 0)));
  const lines = [], nodes = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(pts[k], pts[k + 1]), 8, 0.02, 6, false), lineMat());
    tree.add(m); lines.push(m);
  }
  const glyph = tex(256, 256, (x) => { x.fillStyle = '#120a1c'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#e7b877'; x.font = '400 170px "Ma Shan Zheng"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(CHARS[i], 128, 140); }, true);
  for (let k = 1; k <= 3; k++) {
    const g = new THREE.Group(); g.position.copy(pts[k]); tree.add(g);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.15, 0.5), toneMapped: false }));
    ring.rotation.z = Math.PI / 6;
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#120a1c', map: k === 1 ? glyph : null, toneMapped: false }));
    disc.rotation.z = Math.PI / 6; disc.position.z = -0.005;
    if (k === 1) { ring.scale.setScalar(1.45); disc.scale.setScalar(1.45); }
    g.add(ring, disc); nodes.push(ring);
  }
  return { lines, nodes, tip: pts[3], dir };
});
// the root, and a beam down to the coin
const rootRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#cf9a62').multiplyScalar(1.4), toneMapped: false }));
rootRing.position.copy(ROOT); rootRing.rotation.z = Math.PI / 6; tree.add(rootRing);
const beam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(C.clone().add(new THREE.Vector3(0, 1.0, -0.2)), ROOT.clone().add(new THREE.Vector3(0, -0.34, 0))), 8, 0.012, 6, false), lineMat());
tree.add(beam);

// ------------------------------------------------------------------ the camera
const F = pose(new THREE.Vector3(0, phone ? 1.4 : 0.92, phone ? 15 : 10.4), new THREE.Vector3(0, C.y + (phone ? 0.05 : 0.16), 0));
const ABOUT = phone ? { pos: new THREE.Vector3(0, 2.0, 9.5), at: new THREE.Vector3(0, 6.2, -7) } : { pos: new THREE.Vector3(-2.7, 3.4, 6.6), at: new THREE.Vector3(-2.7, 4.3, -7) };
const studyPose = (s) => {
  const i = Math.min(3, Math.floor(s)), j = Math.min(3, i + 1), t = ease(s - i);
  const d = branches[i].dir.clone().lerp(branches[j].dir, t);
  const shift = new THREE.Vector3(d.x * 0.5, d.y * 0.25 - 0.2, -0.4);
  return pose(ABOUT.pos.clone().add(shift), ABOUT.at.clone().add(shift));
};
const TITLE = pose(new THREE.Vector3(0, phone ? 2.2 : 1.7, phone ? 22 : 15.5), new THREE.Vector3(0, phone ? 3.4 : 2.9, 0));
const P_SWITCH = 4.45;
const steps = (x, n) => { x = clamp(x, 0, n); const i = Math.min(n, Math.floor(x)); return i + ease(x - i); };

run(({ p, time, dt, nx, ny, live, forced, tilt }) => {
  let where = 'outside', P;
  if (p < 1) P = lerpPose(F, studyPose(0), ease(p));
  else if (p < 4) P = studyPose(steps(p - 1, 3));
  else if (p < P_SWITCH) P = lerpPose(studyPose(3), TITLE, ease((p - 4) / (P_SWITCH - 4)));
  else if (p < 5) {
    where = 'room';
    const t = (p - P_SWITCH) / (5 - P_SWITCH);
    P = t < 0.62 ? lerpPose(room.poses.mainFill, room.poses.eye, ease(t / 0.62)) : lerpPose(room.poses.eye, room.workPose(0), ease((t - 0.62) / 0.38));
  } else if (p < 9) { where = 'room'; const w = p - 5, i = Math.min(3, Math.floor(w)); P = lerpPose(room.workPose(i), room.workPose(i + 1), ease(w - i)); }
  else { where = 'room'; P = lerpPose(room.workPose(4), room.poses.end, ease(p - 9)); }
  const sway = where === 'room' ? (p > 4.9 ? 0.006 : 0) : p < 4 ? 0.3 : 0;
  P = { ...P, pos: P.pos.clone().add(new THREE.Vector3(tilt[0] * sway, -tilt[1] * sway * 0.6, 0).applyQuaternion(P.q)) };

  // the tree unlocks a branch per study, and keeps it
  const study = clamp(p - 1, 0, 3), si = Math.round(study);
  beam.material.uniforms.uFill.value = span(p, 0.2, 0.8);
  branches.forEach((b, i) => {
    const u = span(p, 0.75 + i, 1.2 + i), hot = i === si && p > 0.8 && p < 4.2 ? 1 : 0;
    b.lines.forEach((l, k) => { l.material.uniforms.uFill.value = clamp(u * 3 - k); l.material.uniforms.uHot.value = hot; });
    b.nodes.forEach((n, k) => { const on = clamp(u * 3 - k - 0.6); n.material.color.setRGB(0.3, 0.15, 0.5).lerp(new THREE.Color(1.0, 0.64, 0.3).multiplyScalar(1.4 + hot * (0.6 + 0.4 * Math.sin(time * 4))), on); });
  });
  const tiltAmt = 1 - span(p, 0.1, 0.5);
  pivot.rotation.set(tilt[1] * 0.25 * tiltAmt, tilt[0] * 0.4 * tiltAmt, 0);
  let hover = -1;
  if (where === 'room' && p > 4.9 && p < 9.5) {
    if (forced >= 0) hover = forced;
    else if (live) { place(camera, P); hover = room.pick(camera, nx, ny); }
  }
  room.update({ time, w: clamp(p - 5, 0, 4), end: span(p, 9, 10), idle: rtMon.texture, hover, tilt, dt, works: span(p, 4.85, 5.1) * (1 - span(p, 9.2, 9.6)) });

  if (where === 'outside') {
    lightFrom(P, nx, ny, 6);
    sky.material.uniforms.uSun.value.copy(C).sub(P.pos).normalize();
    present(outside, P);
  } else {
    // the game keeps running on the main monitor, seen from where the title screen stood
    lightFrom(TITLE, 0.2, 0.3, 8);
    sky.material.uniforms.uSun.value.copy(C).sub(TITLE.pos).normalize();
    renderTo(rtMon, outside, TITLE, { aspect: MON_ASPECT });
    present(room.scene, P, 0.005);
  }
  return { pose: P, hover, regionPoint: where === 'outside' && p > 0.8 && p < 4.1 ? branches[si].tip : null };
});
