import { gsap } from 'gsap';
import { Box3, Color, EdgesGeometry, Group, InstancedMesh, Matrix4, Mesh, type Material, Object3D, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { clamp, ease, mix } from '~/journey/math';
import { Chip } from '../engine/chip';
import { toPage } from '../engine/dom';
import { palette, studioLights, studioScene } from '../engine/look';
import { Bag, devBoard, drawerUnit, miniPc, monitor, robotArm } from '../engine/props';
import { fovFor, Rig, type Shot } from '../engine/rig';
import { NAME_OUTLINE } from './name-outline';
import type { BuildContext, Look, World } from './types';

/**
 * LAB ONLY (throwaway). C · Blueprint. Black, and one thin gold line. It traces the outline of the name (the name itself
 * is DOM text, filling in behind it), then draws a drawer, an arm, a PC and a board in one line style with mono
 * dimensions, each drawing turning into the next. Then the last drawing gains depth and material, and the line becomes
 * the signal that runs into the BC-2006 part: the tunnel.
 */

const CHIP_SCALE = 0.42;
/** The axonometric view the drawings are made in: far and narrow, nearly flat. */
const FLAT = { pos: [16, 11, 26] as const, look: [0, 1.0, 0] as const };

interface Drawing {
  line: LineSegments2;
  material: LineMaterial;
  dims: LineSegments2;
  dimMaterial: LineMaterial;
  ends: Float32Array;
  points: Float32Array;
  total: number;
  dimTotal: number;
  labels: { el: HTMLElement; at: Vector3 }[];
  draw: number;
  erase: number;
}

/** Every edge of what `root` holds, in world space, ordered so a pen sweeps across it left to right. */
function edgesOf(root: Object3D, bag: Bag): number[] {
  root.updateMatrixWorld(true);
  const right = new Vector3(FLAT.look[0] - FLAT.pos[0], 0, FLAT.look[2] - FLAT.pos[2]).normalize();
  right.set(-right.z, 0, right.x);
  const segs: { a: Vector3; b: Vector3; key: number }[] = [];
  const add = (geometry: Mesh['geometry'], matrix: Matrix4): void => {
    const edges = bag.add(new EdgesGeometry(geometry, 24));
    const pos = edges.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      const a = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(matrix);
      const b = new Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(matrix);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      segs.push({ a, b, key: mid.dot(right) * 1.0 - mid.y * 0.18 });
    }
  };
  const m = new Matrix4();
  root.traverse((node) => {
    if (!(node instanceof Mesh) || !node.visible) return;
    const material = node.material as Material;
    if (material instanceof ShaderMaterial || material.transparent) return;
    if (node instanceof InstancedMesh) {
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, m);
        add(node.geometry, m.premultiply(node.matrixWorld));
      }
    } else add(node.geometry, node.matrixWorld);
  });
  segs.sort((s, t) => s.key - t.key);
  return segs.flatMap(({ a, b }) => [a.x, a.y, a.z, b.x, b.y, b.z]);
}

/** Dimension lines under and beside a box: a span with end ticks, and its label's anchor. */
function dimensionsOf(box: Box3): { flat: number[]; anchors: Vector3[] } {
  const flat: number[] = [];
  const seg = (a: Vector3, b: Vector3): void => void flat.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const y = box.min.y - 0.22, z = box.max.z + 0.05;
  const l = new Vector3(box.min.x, y, z), r = new Vector3(box.max.x, y, z);
  seg(l, r);
  seg(l.clone().setY(y - 0.08), l.clone().setY(y + 0.08));
  seg(r.clone().setY(y - 0.08), r.clone().setY(y + 0.08));
  const x = box.max.x + 0.28;
  const b = new Vector3(x, box.min.y, box.min.z), t = new Vector3(x, box.max.y, box.min.z);
  seg(b, t);
  seg(b.clone().setX(x - 0.08), b.clone().setX(x + 0.08));
  seg(t.clone().setX(x - 0.08), t.clone().setX(x + 0.08));
  return { flat, anchors: [new Vector3((box.min.x + box.max.x) / 2, y - 0.12, z), new Vector3(x + 0.12, (box.min.y + box.max.y) / 2, box.min.z)] };
}

function cumulative(flat: number[]): { ends: Float32Array; total: number } {
  const ends = new Float32Array(flat.length / 6);
  let run = 0;
  for (let i = 0; i < ends.length; i++) {
    const k = i * 6;
    run += Math.hypot(flat[k + 3] - flat[k], flat[k + 4] - flat[k + 1], flat[k + 5] - flat[k + 2]);
    ends[i] = run;
  }
  return { ends, total: run };
}

export async function build({ renderer, root }: BuildContext): Promise<World> {
  const bag = new Bag();
  const p = palette();
  const scene = studioScene(renderer, 0.02);
  const camera = new PerspectiveCamera(11, 16 / 9, 0.01, 200);
  const target = new Object3D();
  target.position.set(0, 0.2, 0);
  const lights = studioLights(scene, target, { x: -4.5, y: 8, z: 5, intensity: 1300 });
  const pins = root.querySelector<HTMLElement>('.lab-pins');
  const pen = root.querySelector<HTMLElement>('.lab-pen');

  // The things the line draws, each centred where the last one stood.
  const fit = (group: Group, size: number): Group => {
    group.updateMatrixWorld(true);
    const box = new Box3().setFromObject(group);
    const s = size / Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
    group.scale.multiplyScalar(s);
    group.updateMatrixWorld(true);
    box.setFromObject(group);
    group.position.sub(new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2));
    group.updateMatrixWorld(true);
    return group;
  };
  const drawer = drawerUnit(p, bag);
  drawer.open(0.55);
  const arm = robotArm(p, bag);
  arm.set(arm.reach(new Vector3(0, 0.3, 1.6), 0.6));
  const pc = new Group();
  const screen = monitor(p, bag, 3.2, 1.86);
  const box = miniPc(p, bag);
  box.group.position.set(2.5, 0, 0.5);
  pc.add(screen.group, box.group);
  const board = devBoard(p, bag);
  const chip = new Chip(p);
  chip.group.scale.setScalar(CHIP_SCALE);
  board.socket.add(chip.group);
  chip.group.scale.setScalar(CHIP_SCALE);
  chip.group.position.y = 0.004;
  const things = [fit(drawer.group, 2.6), fit(arm.group, 2.8), fit(pc, 3.6), board.group];
  const words: [string, string][] = [
    ['W 180 mm', 'H 110 mm'],
    ['Reach 275 mm', '4 axes'],
    ['1920 × 1080', '60 Hz'],
    ['230 × 150 mm', 'BC-2006 · 3.3 V'],
  ];

  const gold = new Color(2.1, 1.35, 0.5), lilac = new Color(0.55, 0.5, 0.7);
  const drawings: Drawing[] = things.map((group, n) => {
    const flat = edgesOf(group, bag);
    const { ends, total } = cumulative(flat);
    const geometry = bag.add(new LineSegmentsGeometry().setPositions(flat));
    const material = bag.add(new LineMaterial({ color: gold, linewidth: 1.4, dashed: true, dashSize: 0, gapSize: 1e6, dashOffset: 0 }));
    const line = new LineSegments2(geometry, material);
    line.computeLineDistances();
    line.frustumCulled = false;
    const dim = dimensionsOf(new Box3().setFromObject(group));
    const dimGeometry = bag.add(new LineSegmentsGeometry().setPositions(dim.flat));
    const dimMaterial = bag.add(new LineMaterial({ color: lilac, linewidth: 1, dashed: true, dashSize: 0, gapSize: 1e6, dashOffset: 0 }));
    const dims = new LineSegments2(dimGeometry, dimMaterial);
    dims.computeLineDistances();
    dims.frustumCulled = false;
    scene.add(line, dims);
    const labels = dim.anchors.map((at, k) => {
      const el = document.createElement('span');
      el.className = 'lab-pin';
      el.innerHTML = `<b>${String(n + 1).padStart(2, '0')}.${k + 1}</b> ${words[n][k]}`;
      pins?.append(el);
      return { el, at };
    });
    return { line, material, dims, dimMaterial, ends, points: new Float32Array(flat), total, dimTotal: cumulative(dim.flat).total, labels, draw: 0, erase: 0 };
  });

  // The last drawing also stands as the real thing, faded up from nothing.
  const solids = [p.metal, p.alu, p.black, p.copper, p.tin, p.board, p.chip];
  for (const material of solids) {
    material.transparent = true;
    material.opacity = 0;
  }
  scene.add(board.group);
  const copperMeshes: Mesh[] = [];
  board.group.traverse((node) => {
    if (node instanceof Mesh && node.material instanceof ShaderMaterial) copperMeshes.push(node);
  });

  // The name's outline over the real text.
  const name = root.querySelector<HTMLElement>('.lab-name');
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'lab-name-outline');
  svg.setAttribute('viewBox', `0 0 ${NAME_OUTLINE.width * NAME_OUTLINE.upm} ${NAME_OUTLINE.height * NAME_OUTLINE.upm}`);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', NAME_OUTLINE.d);
  path.setAttribute('pathLength', '1');
  svg.append(path);
  name?.append(svg);
  const outline = { k: 0, e: 0 };
  const length = path.getTotalLength();
  const showOutline = (): void => {
    const px = name ? parseFloat(getComputedStyle(name).fontSize) : 200;
    path.setAttribute('stroke-width', String((1.3 * NAME_OUTLINE.upm) / px));
    const on = Math.max(0, outline.k - outline.e);
    path.style.strokeDasharray = `${on} 2`;
    path.style.strokeDashoffset = String(-outline.e);
    svg.style.visibility = on > 0.0005 ? 'visible' : 'hidden';
  };
  const penAtOutline = (): void => {
    if (!pen) return;
    const drawing = outline.k > 0.001 && outline.k < 0.999 && outline.e < 0.001;
    pen.style.opacity = drawing ? '1' : '0';
    if (!drawing) return;
    const pt = path.getPointAtLength(outline.k * length);
    const ctm = path.getScreenCTM();
    if (!ctm) return;
    pen.style.transform = `translate(${(ctm.a * pt.x + ctm.c * pt.y + ctm.e).toFixed(1)}px, ${(ctm.b * pt.x + ctm.d * pt.y + ctm.f).toFixed(1)}px)`;
  };
  showOutline();

  const seat = board.socket.getWorldPosition(new Vector3());
  const state = { solid: 0, flow: 0, glow: 0, lid: 0, window: 0 };
  const shots: Shot[] = [
    { f: 0, pos: [FLAT.pos[0], FLAT.pos[1], FLAT.pos[2]], look: [-0.8, 1.15, 0.55], fov: 9, focus: 32, blur: 0 },
    { f: 90, pos: [FLAT.pos[0] - 0.6, FLAT.pos[1] + 0.2, FLAT.pos[2]], look: [-0.8, 1.15, 0.55], fov: 9, focus: 32, blur: 0 },
    { f: 150, pos: [FLAT.pos[0], FLAT.pos[1], FLAT.pos[2] + 0.4], look: [-0.85, 1.25, 0.55], fov: 9.5, focus: 32, blur: 0 },
    { f: 212, pos: [FLAT.pos[0] + 0.4, FLAT.pos[1], FLAT.pos[2]], look: [-1.0, 1.15, 0.55], fov: 10, focus: 32, blur: 0 },
    { f: 258, pos: [FLAT.pos[0] - 1, FLAT.pos[1] - 1, FLAT.pos[2] - 2], look: [-0.6, 0.35, 0.45], fov: 7.5, focus: 30, blur: 0.4 },
    { f: 290, pos: [4.6, 3.2, 5.6], look: [-0.25, 0.2, 0.4], fov: 32, focus: 7.4, blur: 3.6 },
    { f: 316, pos: [seat.x + 0.2, seat.y + 1.9, seat.z + 1.3], look: [seat.x, seat.y, seat.z], fov: 32, focus: 2.3, blur: 2.4 },
    { f: 336, pos: [seat.x, seat.y + 0.95, seat.z + 0.05], look: [seat.x, seat.y, seat.z], fov: 30, focus: 0.95, blur: 0 },
    { f: 360, pos: [seat.x, seat.y + 0.14, seat.z], look: [seat.x, seat.y, seat.z], fov: 32, focus: 0.14, blur: 0 },
    { f: 372, pos: [seat.x, seat.y + 0.045, seat.z], look: [seat.x, seat.y - 0.1, seat.z], fov: 34, focus: 0.05, blur: 0 },
  ];
  const rig = new Rig(shots);
  const look = new Vector3();
  const head = new Vector3();
  const page: [number, number, number] = [0, 0, 0];
  const windows: [number, number, number, number][] = [
    [30, 88, 96, 148],
    [96, 150, 156, 208],
    [156, 210, 216, 260],
    [216, 262, 1e9, 1e9],
  ];

  return {
    scene,
    camera,
    chip,
    introStyle: 'fill',
    beats: {
      heroOut: [8, 34],
      steps: [
        [40, 56, 90, 98],
        [102, 118, 150, 158],
        [162, 178, 210, 218],
        [222, 238, 296, 308],
      ],
      bars: [252, 272, 306, 326],
    },

    intro(tl) {
      tl.fromTo(outline, { k: 0 }, { k: 1, duration: 1.7, ease: 'power1.inOut', onUpdate: () => (showOutline(), penAtOutline()), onComplete: penAtOutline }, 0.05);
    },

    timeline(tl) {
      tl.to(outline, { e: 1, duration: 26, ease: 'power1.in' }, 6);
      drawings.forEach((d, n) => {
        const [a, b, c, e] = windows[n];
        tl.to(d, { draw: 1, duration: b - a, ease: 'power1.inOut' }, a);
        if (c < 1e8) tl.to(d, { erase: 1, duration: e - c, ease: 'power1.inOut' }, c);
      });
      tl.to(state, { solid: 1, duration: 40, ease: 'power2.inOut' }, 254);
      tl.to(state, { flow: 1, duration: 30, ease: 'power1.inOut' }, 288);
      tl.to(state, { glow: 1, duration: 10 }, 314);
      tl.to(state, { lid: 1, duration: 14, ease: 'power2.inOut' }, 326);
      tl.to(state, { window: 1, duration: 12, ease: 'power1.inOut' }, 336);
    },

    frame(f, _nowS, _dt, width, height, lamp) {
      const aspect = width / Math.max(1, height);
      const shot = rig.at(f, camera.position, look);
      const down = ease(f, 300, 330);
      camera.up.set(0, 1, 0).lerp(new Vector3(0, 0, -1), down).normalize();
      camera.aspect = aspect;
      camera.fov = fovFor(shot.fov, aspect);
      camera.near = clamp(shot.focus * 0.03, 0.004, 0.5);
      camera.updateProjectionMatrix();
      camera.lookAt(look);
      camera.updateMatrixWorld();

      showOutline();
      const pr = renderer.getPixelRatio();
      let penShown = false;
      drawings.forEach((d, n) => {
        // The line shows only what lies between the eraser and the pen.
        // The last drawing's line gives way to the real thing (its lines were drawn with the lid shut).
        const fade = n === 3 ? 1 - state.solid : 1;
        const L = d.draw * d.total, E = d.erase * d.total;
        d.material.dashSize = Math.max(0, L - E);
        d.material.dashOffset = -E;
        d.material.linewidth = 1.4 * pr;
        d.material.resolution.set(width * pr, height * pr);
        d.material.opacity = fade;
        d.material.transparent = fade < 1;
        d.line.visible = L - E > 1e-4 && fade > 0.01;
        const dimK = clamp((d.draw - 0.6) / 0.4) * (1 - d.erase);
        d.dimMaterial.dashSize = dimK * d.dimTotal;
        d.dimMaterial.linewidth = 1 * pr;
        d.dimMaterial.resolution.set(width * pr, height * pr);
        d.dims.visible = dimK > 0.001 && state.solid < 0.95;
        for (const label of d.labels) {
          toPage(label.at, camera, width, height, page);
          label.el.style.transform = `translate(${page[0].toFixed(1)}px, ${page[1].toFixed(1)}px) translate(-50%, -50%)`;
          label.el.style.opacity = (dimK * (1 - state.solid)).toFixed(3);
        }
        // The pen: where the drawing's line has got to.
        if (pen && d.draw > 0.001 && d.draw < 0.999) {
          let i = 0;
          while (i < d.ends.length - 1 && d.ends[i] < L) i++;
          const start = i ? d.ends[i - 1] : 0;
          const t = clamp((L - start) / Math.max(1e-6, d.ends[i] - start));
          const k = i * 6;
          head.set(mix(d.points[k], d.points[k + 3], t), mix(d.points[k + 1], d.points[k + 4], t), mix(d.points[k + 2], d.points[k + 5], t));
          toPage(head, camera, width, height, page);
          pen.style.transform = `translate(${page[0].toFixed(1)}px, ${page[1].toFixed(1)}px)`;
          penShown = true;
        }
      });
      if (pen && f > 1) pen.style.opacity = penShown ? '1' : '0';

      for (const material of solids) material.opacity = state.solid;
      chip.group.visible = state.solid > 0.02;
      for (const mesh of copperMeshes) mesh.visible = state.solid > 0.02;
      board.flow(state.flow, state.flow > 0 ? 1 : 0, true);
      board.led.color.setRGB(0.25 * state.glow, 2.2 * state.glow, 0.6 * state.glow);
      chip.open(state.lid);
      chip.glow(state.glow);
      chip.window(state.window);
      lights.level(lamp * state.solid);
      const after = ease(f, 334, 358);
      return { focus: shot.focus, blur: shot.blur, grain: mix(0.03, 0, after), vignette: mix(0.5, 0, after), flash: 0, light: lamp } satisfies Look;
    },

    readout(f) {
      const now = drawings.findIndex((d) => d.draw > 0 && d.erase < 1 && d.draw < 1);
      if (f < 30) return 'Line 0.25 mm · Barlow 800 · 2 lines';
      if (f < 262 && now >= 0) return `Drawing ${now + 1} of 4 · ${(drawings[now].draw * drawings[now].total * 100).toFixed(0)} mm drawn`;
      if (f < 296) return `Material ${Math.round(state.solid * 100)} %`;
      if (f < 336) return `Signal ${Math.round(state.flow * 100)} % · to BC-2006`;
      return 'BC-2006 · port open';
    },

    dispose() {
      svg.remove();
      for (const d of drawings) for (const label of d.labels) label.el.remove();
      if (pen) pen.style.opacity = '0';
      bag.dispose();
      p.dispose();
      chip.dispose();
      scene.environment?.dispose();
      gsap.killTweensOf([state, outline, ...drawings]);
    },
  };
}
