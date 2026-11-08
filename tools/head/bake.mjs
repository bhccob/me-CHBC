/**
 * Bakes Bob's head into public/models/head.bin, once, so that no visitor's browser builds it (spec 2026-11-08 "Into my
 * head", section 9). It runs the mock's distance fields through three's MarchingCubes as mock-up 20's `surfaceMesh` did,
 * splits the skin at the lid's cut as its `piecesGeometry` did (style 2, the lid), and samples the brain's dust as its
 * `surfacePoints` did. Run with `npm run build:head`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { MeshBasicMaterial } from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

const here = dirname(fileURLToPath(import.meta.url));
const { headSdf, brainSdf, pieceOf } = await tsImport('../../src/journey/head/shape.ts', import.meta.url);
const { encodeHead } = await tsImport('../../src/journey/head/headBin.ts', import.meta.url);
const OUT = resolve(here, '../../public/models/head.bin');

/** The surface of `sdf` in a cube of `half` round `center`, as triangles (mock `surfaceMesh`). */
function surfaceMesh(sdf, res, center, half, maxPoly) {
  const mc = new MarchingCubes(res, new MeshBasicMaterial(), false, false, maxPoly);
  const size2 = res * res;
  for (let z = 0; z < res; z++) {
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        mc.field[x + y * res + z * size2] = -sdf(center[0] + ((x - res / 2) / (res / 2)) * half, center[1] + ((y - res / 2) / (res / 2)) * half, center[2] + ((z - res / 2) / (res / 2)) * half);
      }
    }
  }
  mc.isolation = 0;
  mc.update();
  const n = mc.count;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i += 3) {
    pos[i] = center[0] + mc.positionArray[i] * half;
    pos[i + 1] = center[1] + mc.positionArray[i + 1] * half;
    pos[i + 2] = center[2] + mc.positionArray[i + 2] * half;
  }
  const nor = mc.normalArray.slice(0, n * 3);
  mc.geometry.dispose();
  return { pos, nor };
}

/** Each triangle to the piece it belongs to; one that straddles the cut goes to both, and the shader clips each clean. */
function lidPieces({ pos, nor }) {
  const P = [], N = [], K = [];
  for (let t = 0; t < pos.length; t += 9) {
    const ids = new Set([pieceOf(pos[t], pos[t + 1], pos[t + 2]), pieceOf(pos[t + 3], pos[t + 4], pos[t + 5]), pieceOf(pos[t + 6], pos[t + 7], pos[t + 8])]);
    for (const id of ids) {
      for (let k = 0; k < 9; k++) {
        P.push(pos[t + k]);
        N.push(nor[t + k]);
      }
      K.push(id, id, id);
    }
  }
  return { pos: Float32Array.from(P), nor: Float32Array.from(N), piece: Float32Array.from(K) };
}

/** One vertex for each place, normal and piece that are the same, and an index into them. */
function indexed(pos, nor, extra) {
  const keys = new Map(), P = [], N = [], E = [], index = new Uint32Array(pos.length / 3);
  for (let v = 0; v < pos.length / 3; v++) {
    const key = `${Math.round(pos[v * 3] * 2e4)},${Math.round(pos[v * 3 + 1] * 2e4)},${Math.round(pos[v * 3 + 2] * 2e4)},${Math.round(nor[v * 3] * 60)},${Math.round(nor[v * 3 + 1] * 60)},${Math.round(nor[v * 3 + 2] * 60)},${extra ? extra[v] : 0}`;
    let at = keys.get(key);
    if (at === undefined) {
      at = P.length / 3;
      keys.set(key, at);
      P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      N.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
      if (extra) E.push(extra[v]);
    }
    index[v] = at;
  }
  return { positions: Float32Array.from(P), normals: Float32Array.from(N), extra: extra ? Float32Array.from(E) : undefined, index };
}

/** Points on the surface of `sdf`, each pulled onto it by a few Newton steps, with a seed each (mock `surfacePoints`). */
function surfacePoints(sdf, n, box) {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mix = (a, b, t) => a + (b - a) * t;
  const pos = [], seeds = [], e = 0.0015;
  while (seeds.length < n) {
    let x = mix(box[0], box[1], rnd()), y = mix(box[2], box[3], rnd()), z = mix(box[4], box[5], rnd());
    if (Math.abs(sdf(x, y, z)) > 0.07) continue;
    for (let it = 0; it < 3; it++) {
      const d = sdf(x, y, z);
      const gx = (sdf(x + e, y, z) - sdf(x - e, y, z)) / (2 * e), gy = (sdf(x, y + e, z) - sdf(x, y - e, z)) / (2 * e), gz = (sdf(x, y, z + e) - sdf(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-8) break;
      x -= (d * gx) / g2;
      y -= (d * gy) / g2;
      z -= (d * gz) / g2;
    }
    if (Math.abs(sdf(x, y, z)) > 0.004) continue;
    pos.push(x, y, z);
    seeds.push(rnd());
  }
  return { positions: Float32Array.from(pos), extra: Float32Array.from(seeds) };
}

const started = Date.now();
const skinRaw = surfaceMesh(headSdf, 108, [0, -0.42, 0], 1.72, 170000);
const lid = lidPieces(skinRaw);
const skin = indexed(lid.pos, lid.nor, lid.piece);
const brainRaw = surfaceMesh(brainSdf, 80, [0, 0.47, -0.08], 0.7, 120000);
const brain = indexed(brainRaw.pos, brainRaw.nor, null);
const dust = surfacePoints(brainSdf, 9000, [-0.6, 0.6, 0.0, 0.92, -0.8, 0.66]);
const file = encodeHead([
  { name: 'skin', ...skin },
  { name: 'brain', positions: brain.positions, normals: brain.normals, index: brain.index },
  { name: 'brainDust', ...dust },
]);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.from(file));
const mb = (file.byteLength / 1024 / 1024).toFixed(2);
console.log(`head.bin: ${mb} MB, skin ${skin.positions.length / 3} vertices / ${skin.index.length / 3} triangles, brain ${brain.positions.length / 3} / ${brain.index.length / 3}, dust ${dust.extra.length}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
