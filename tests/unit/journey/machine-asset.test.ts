import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PART_NAMES } from '~/journey/machine/parts';
import { readGlbJson } from './glb';

const GLB = 'public/models/machine.glb';
const fixture = JSON.parse(readFileSync('tests/fixtures/machine-pose.json', 'utf8')) as Record<string, { parts: Record<string, unknown> }>;
const anchors = JSON.parse(readFileSync('tests/fixtures/machine-anchors.json', 'utf8')) as Record<string, Record<string, { point: number[]; uv: number[] }>>;

describe('the machine from Blender', () => {
  const gltf = readGlbJson(GLB);

  it('holds every part the pose drives', () => {
    const names = gltf.nodes.map((node) => node.name);
    for (const name of PART_NAMES) expect(names, name).toContain(name);
  });

  it('needs no wasm decoder, which the CSP would block', () => {
    expect(gltf.extensionsUsed ?? []).not.toContain('KHR_draco_mesh_compression');
    expect(gltf.extensionsUsed ?? []).not.toContain('EXT_meshopt_compression');
  });

  it('stays small', () => {
    expect(statSync(GLB).size).toBeLessThanOrEqual(5_000_000);
  });

  it('has a pose for each review frame, of every part', () => {
    expect(Object.keys(fixture)).toEqual(['0', '36', '112', '190', '262', '304', '345', '360']);
    for (const frame of Object.values(fixture)) for (const name of PART_NAMES) expect(frame.parts, name).toHaveProperty(name);
  });

  it("has where the stack's four labels point, with their 3D points", () => {
    expect(Object.keys(anchors)).toHaveLength(26);
    expect(Object.keys(anchors[304]).sort()).toEqual(['armour', 'body', 'brain', 'controls']);
    expect(anchors[304].armour.point).toHaveLength(3);
    expect(anchors[304].armour.uv).toHaveLength(2);
  });
});
