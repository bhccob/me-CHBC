import { readFileSync } from 'node:fs';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { cameraPose, fitProjection, fovFor, pageFit, pageOffset, PHONE_ASPECT } from '~/journey/machine/camera';
import { machinePose } from '~/journey/machine/choreography';
import { PART_NAMES } from '~/journey/machine/parts';
import { ease, mix } from '~/journey/math';

interface Saved {
  parts: Record<string, { p: number[]; r: number[]; s: number[]; on: boolean }>;
  camera: { position: number[]; matrix: number[]; lens: number; fstop: number; focus: number; shift: number };
  emit: Record<string, number>;
  lights: Record<string, number>;
}
const fixture = JSON.parse(readFileSync('tests/fixtures/machine-pose.json', 'utf8')) as Record<string, Saved>;
const anchors = JSON.parse(readFileSync('tests/fixtures/machine-anchors.json', 'utf8')) as Record<string, Record<string, { point: [number, number, number]; uv: [number, number] }>>;

function expectClose(got: readonly number[], want: readonly number[], eps: number, label: string): void {
  expect(got.length, label).toBe(want.length);
  got.forEach((value, i) => expect(Math.abs(value - want[i]), `${label}[${i}]: ${value} against ${want[i]}`).toBeLessThanOrEqual(eps));
}

/**
 * Where round 21 leaves Blender on purpose, each with its own tests below: the first view is a city at night (its light,
 * and its camera, which also bends the dive's path until frame 48), and the machine opens like a box (its parts and camera).
 */
const OWN = { parts: new Set(['304']), light: new Set(['0']), camera: new Set(['0', '36', '304']) };

describe('the pose, against what Blender says at the review frames', () => {
  for (const [frame, want] of Object.entries(fixture)) {
    if (!OWN.parts.has(frame)) it(`matches every part at frame ${frame}`, () => {
      const pose = machinePose(+frame);
      for (const name of PART_NAMES) {
        const got = pose.parts[name], saved = want.parts[name];
        expect(got.on, `${name} on`).toBe(saved.on);
        if (!got.on) continue;
        expectClose(got.p, saved.p, 1e-3, `${name} p`);
        expectClose(got.r, saved.r, 1e-3, `${name} r`);
        expectClose(got.s, saved.s, 1e-3, `${name} s`);
      }
    });

    if (!OWN.light.has(frame)) it(`matches the glow and the lights at frame ${frame}`, () => {
      const pose = machinePose(+frame);
      for (const key of Object.keys(want.emit)) expect(pose.emit[key as keyof typeof pose.emit], key).toBeCloseTo(want.emit[key], 3);
      for (const key of Object.keys(want.lights)) expect(pose.lights[key as keyof typeof pose.lights], key).toBeCloseTo(want.lights[key], 3);
    });

    if (!OWN.camera.has(frame)) it(`matches the camera at frame ${frame}`, () => {
      const cam = cameraPose(+frame);
      expectClose(cam.position, want.camera.position, 1e-3, 'position');
      expect(cam.lens).toBeCloseTo(want.camera.lens, 3);
      expect(cam.fstop).toBeCloseTo(want.camera.fstop, 3);
      expect(cam.focus).toBeCloseTo(want.camera.focus, 3);
      expect(cam.shift).toBeCloseTo(want.camera.shift, 3);
      const view = viewOf(+frame);
      expectClose(view.elements as unknown as number[], columnMajor(want.camera.matrix), 2e-3, 'matrix');
    });
  }
});

/** The camera's world matrix from the pose. */
function viewOf(f: number): Matrix4 {
  const cam = cameraPose(f);
  const camera = new PerspectiveCamera();
  camera.position.set(...cam.position);
  camera.up.set(...cam.up);
  camera.lookAt(new Vector3(...cam.target));
  camera.rotateZ(cam.roll);
  camera.updateMatrixWorld();
  return camera.matrixWorld;
}

const columnMajor = (rows: readonly number[]): number[] => [0, 1, 2, 3].flatMap((col) => [0, 1, 2, 3].map((row) => rows[row * 4 + col]));

/** Where a 3D point lands in the frame, 0 to 1, seen from `view` through the same lens the page will use. */
function project(point: readonly [number, number, number], view: Matrix4, lens: number, shift: number): [number, number] {
  const camera = new PerspectiveCamera(fovFor(lens, 16 / 9), 16 / 9, 0.01, 400);
  fitProjection(camera.projectionMatrix.elements as unknown as number[], shift, 1, 16 / 9);
  const ndc = new Vector3(...point).applyMatrix4(view.clone().invert()).applyMatrix4(camera.projectionMatrix);
  return [(ndc.x + 1) / 2, (ndc.y + 1) / 2];
}

describe('the lens', () => {
  it('sees through the same lens as Blender, from where Blender stood', () => {
    // The open box holds the camera elsewhere now; the lens is checked from Blender's own camera at frame 304.
    const blender = fixture['304'].camera;
    const view = new Matrix4().fromArray(columnMajor(blender.matrix));
    for (const [name, a] of Object.entries(anchors['304'])) expectClose(project(a.point, view, blender.lens, blender.shift), a.uv, 0.002, name);
  });

  it('crops as the flipbook did: the sides on a narrower page, top and bottom on a wider one', () => {
    expect(fovFor(50, 16 / 9)).toBeCloseTo(22.9, 1);
    expect(fovFor(50, 2)).toBeCloseTo(20.4, 1);
    expect(fovFor(50, 4 / 3)).toBeCloseTo(22.9, 1);
  });

  it('shows a tall page 1.5 times its width, as the mock did', () => {
    expect(fovFor(50, 0.5)).toBeCloseTo(51.3, 1);
  });

  it('on a tall page, stands the machine small enough to leave its words clear, full size at the first view and the portal', () => {
    expect(pageFit(0, 0.5)).toBe(1);
    expect(pageFit(100, 0.5)).toBeCloseTo(0.8);
    expect(pageFit(304, 0.5)).toBeCloseTo(0.88);
    expect(pageFit(304, 0.75)).toBeCloseTo(0.7 * (0.58 / 0.75));
    expect(pageFit(350, 0.5)).toBe(1);
    expect(pageFit(700, 0.5)).toBe(1);
  });

  it('on a phone, stands the open stack larger, moved left and up to leave room for its labels', () => {
    // A phone with its browser's bars showing is still a phone; an upright tablet is not.
    expect(390 / 664).toBeLessThan(PHONE_ASPECT);
    expect(820 / 1180).toBeGreaterThan(PHONE_ASPECT);
    expect(pageFit(304, 390 / 844)).toBeCloseTo(0.88);
    expect(pageFit(304, 390 / 844)).toBeGreaterThan(pageFit(304, 0.75));
    expect(pageOffset(304, 390 / 844)).toEqual([-0.07, 0.1]);
    for (const f of [250, 270, 344, 400]) expect(pageOffset(f, 390 / 844), `frame ${f}`).toEqual([0, 0]);
    // A tablet held upright and a wide page keep the machine where it was.
    expect(pageOffset(304, 0.75)).toEqual([0, 0]);
    expect(pageOffset(304, 16 / 9)).toEqual([0, 0]);
  });

  it('moves the whole picture by the page offset, in NDC', () => {
    const plain = new PerspectiveCamera(30, 0.5, 0.01, 400), moved = new PerspectiveCamera(30, 0.5, 0.01, 400);
    fitProjection(plain.projectionMatrix.elements as unknown as number[], -0.04, 0.88, 0.5);
    fitProjection(moved.projectionMatrix.elements as unknown as number[], -0.04, 0.88, 0.5, [-0.07, 0.1]);
    for (const point of [new Vector3(0, 0, -5), new Vector3(0.4, -0.3, -3)]) {
      const a = point.clone().applyMatrix4(plain.projectionMatrix), b = point.clone().applyMatrix4(moved.projectionMatrix);
      expect(b.x - a.x).toBeCloseTo(-0.07, 5);
      expect(b.y - a.y).toBeCloseTo(0.1, 5);
    }
  });

  it('scales the machine about the right edge, 62% down, as the page did', () => {
    const camera = new PerspectiveCamera(30, 16 / 9, 0.01, 400);
    fitProjection(camera.projectionMatrix.elements as unknown as number[], 0, 0.8, 16 / 9);
    // A point straight ahead was at the middle of the page; it moves toward that anchor by a fifth.
    const ndc = new Vector3(0, 0, -5).applyMatrix4(camera.projectionMatrix);
    expect(ndc.x).toBeCloseTo(0.2, 5);
    expect(ndc.y).toBeCloseTo(-0.048, 5);
  });

  it('stands smaller on the last sheet, so that its long words read', () => {
    expect(pageFit(250, 16 / 9)).toBeCloseTo(0.76, 5);
  });

  it('follows the page fit keys', () => {
    for (const [f, v] of [[0, 0.9], [34, 1], [64, 0.84], [184, 0.76], [292, 0.94], [344, 1], [700, 0.76]]) expect(pageFit(f, 16 / 9), `frame ${f}`).toBeCloseTo(v, 5);
  });
});

const near = (got: readonly number[], want: readonly number[], label: string): void => expectClose(got, want, 1e-6, label);

describe('the machine opens like a box, so you can see what is inside (round 21)', () => {
  const open = machinePose(304);
  const FOLD = 0.96 * (Math.PI / 2);

  it('folds its four walls down nearly flat, each about its foot', () => {
    expect(open.parts.wall0.r[0]).toBeCloseTo(FOLD, 6);
    expect(open.parts.wall1.r[1]).toBeCloseTo(FOLD, 6);
    expect(open.parts.wall2.r[0]).toBeCloseTo(-FOLD, 6);
    expect(open.parts.wall3.r[1]).toBeCloseTo(-FOLD, 6);
    const out = 0.7 + 0.23 * Math.sin(FOLD);
    near(open.parts.wall0.p, [0, -out, 0.23 * Math.cos(FOLD)], 'wall0');
    near(open.parts.wall1.p, [out, 0, 0.23 * Math.cos(FOLD)], 'wall1');
  });

  it('lifts the board, the code and the game straight up', () => {
    near(open.parts.board.p, [0, 0, 0.1], 'board');
    near(open.parts.code.p, [0, 0, 0.17 + 0.55], 'code');
    near(open.parts.game.p, [0, 0, 0.34 + 1.05], 'game');
  });

  it('takes the lid off, up and back and tipped a little, with the gear ring and the drives on it', () => {
    near(open.parts.lid.p, [0, 0.85, 0.6 + 1.35], 'lid');
    expect(open.parts.lid.r[0]).toBeCloseTo(-0.4, 6);
    near(open.parts.turret.p, [0, 0.85, 0.65 + 1.35], 'turret');
    expect(open.parts['servo-0'].p[1] - open.parts.lid.p[1]).toBeCloseTo(machinePose(270).parts['servo-0'].p[1] - machinePose(270).parts.lid.p[1], 6);
  });

  it('puts the corner posts away while it is open, and back as it closes', () => {
    expect(open.parts['post-0'].on).toBe(false);
    expect(machinePose(270).parts['post-0'].on).toBe(true);
    expect(machinePose(330).parts['post-0'].on).toBe(true);
  });

  it('is shut again by frame 326, as it was before it opened', () => {
    const shut = machinePose(330);
    near(shut.parts.wall0.r, [0, 0, 0], 'wall0 r');
    near(shut.parts.lid.p, [0, 0, 0.6], 'lid');
    expect(shut.parts.lid.r[0]).toBeCloseTo(0, 9);
  });

  it('holds the camera where the open box reads, a little higher and further back', () => {
    for (const f of [296, 312]) {
      const cam = cameraPose(f);
      near(cam.position, [-3.4, -5.0, 4.4], `position at ${f}`);
      near(cam.target, [0, 0.3, 0.6], `target at ${f}`);
      expect(cam.lens).toBeCloseTo(38, 6);
    }
  });
});

/** Blender's camera keys for the dive, which the first view must still reach. */
const CAM_AT: Record<number, [number, number, number]> = { 34: [0.36, -0.48, 0.21], 48: [0.56, -0.8, 0.44], 72: [1.22, -1.95, 1.5] };

describe('the first view: the board as a city at night (round 21)', () => {
  it('stands the camera low on the board, among the parts, as at street level', () => {
    const cam = cameraPose(0);
    near(cam.position, [0.42, -0.62, 0.075], 'position');
    near(cam.target, [-0.08, 0.12, 0.05], 'target');
    expect(cam.lens).toBeCloseTo(26, 6);
  });

  it('turns the studio light down and lights the parts from behind, as at night', () => {
    const { lights } = machinePose(0);
    expect(lights.key).toBeCloseTo(150 * 0.55 * 0.32, 6);
    expect(lights.rim).toBeCloseTo(78 * 0.5 * 2.2, 6);
    expect(lights.strip).toBeCloseTo(42 * 0.6 * 0.4, 6);
    expect(lights.low).toBeCloseTo(18 * 0.3, 6);
    expect(lights.bench).toBeCloseTo(9 * 0.5 * 1.6, 6);
  });

  it('has light on the traces from the start, like the lights of a city', () => {
    expect(machinePose(0).emit.pulse).toBeCloseTo(5, 6);
  });

  it('lays a mist over the far end, gone once the camera dives in', () => {
    near([machinePose(0).mist.near, machinePose(0).mist.far], [0.9, 3], 'first view');
    near([machinePose(30).mist.near, machinePose(30).mist.far], [60, 120], 'dived in');
  });

  it('runs the light along the traces while you read, and only on the first view', () => {
    expect(machinePose(0, 10).parts['pulse-0'].p).not.toEqual(machinePose(0).parts['pulse-0'].p);
    expect(machinePose(40, 10).parts['pulse-0'].p).toEqual(machinePose(40).parts['pulse-0'].p);
  });

  it('still dives to the chip where Blender did, from frame 34 on', () => {
    for (const f of [34, 48, 72]) near(cameraPose(f).position, CAM_AT[f], `frame ${f}`);
  });

  it('gives the build back its own light once the camera dives in', () => {
    expect(machinePose(30).lights.key).toBeCloseTo(150 * mix(0.55, 1, ease(30, 8, 40)), 6);
    expect(machinePose(30).emit.pulse).toBeCloseTo(4, 6);
  });
});
