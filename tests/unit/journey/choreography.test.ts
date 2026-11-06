import { readFileSync } from 'node:fs';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { cameraPose, fitProjection, fovFor, pageFit } from '~/journey/machine/camera';
import { machinePose } from '~/journey/machine/choreography';
import { PART_NAMES } from '~/journey/machine/parts';

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

describe('the pose, against what Blender says at the review frames', () => {
  for (const [frame, want] of Object.entries(fixture)) {
    it(`matches every part at frame ${frame}`, () => {
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

    it(`matches the glow and the lights at frame ${frame}`, () => {
      const pose = machinePose(+frame);
      for (const key of Object.keys(want.emit)) expect(pose.emit[key as keyof typeof pose.emit], key).toBeCloseTo(want.emit[key], 3);
      for (const key of Object.keys(want.lights)) expect(pose.lights[key as keyof typeof pose.lights], key).toBeCloseTo(want.lights[key], 3);
    });

    it(`matches the camera at frame ${frame}`, () => {
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

/** Where a 3D point lands in the frame, 0 to 1, through the same lens the page will use. */
function project(point: readonly [number, number, number], f: number): [number, number] {
  const cam = cameraPose(f);
  const camera = new PerspectiveCamera(fovFor(cam.lens, 16 / 9), 16 / 9, 0.01, 400);
  fitProjection(camera.projectionMatrix.elements as unknown as number[], cam.shift, 1, 16 / 9);
  const ndc = new Vector3(...point).applyMatrix4(viewOf(f).clone().invert()).applyMatrix4(camera.projectionMatrix);
  return [(ndc.x + 1) / 2, (ndc.y + 1) / 2];
}

describe('the lens', () => {
  it('sees through the same lens as Blender', () => {
    for (const [f, labels] of Object.entries(anchors)) for (const [name, a] of Object.entries(labels)) expectClose(project(a.point, +f), a.uv, 0.002, `${name} at ${f}`);
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
    expect(pageFit(304, 0.5)).toBeCloseTo(0.7);
    expect(pageFit(350, 0.5)).toBe(1);
    expect(pageFit(700, 0.5)).toBe(1);
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
