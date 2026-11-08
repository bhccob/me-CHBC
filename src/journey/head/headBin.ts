/**
 * `public/models/head.bin`: Bob's head, baked once from the distance fields (tools/head/bake.mjs) so that no visitor builds
 * it. Little-endian. 'HEAD', u32 version 1, u32 part count; per part: u8 name length, the name, padding to 4, u32 vertex
 * count, u32 index count, u32 flags (1 normals, 2 extra), its box as 6 f32 (min xyz, max xyz), Int16 positions quantized
 * to the box, Int8 normals, Uint8 extra (0 to 1), then Uint32 indices; each block padded to 4. Pure: no three, no DOM.
 */

export type HeadPartName = 'skin' | 'brain' | 'brainDust';

export interface HeadPart {
  name: HeadPartName;
  positions: Float32Array;
  normals?: Float32Array;
  /** For the skin, the lid's piece (0 below the cut, 1 above); for the brain's dust, each point's seed. */
  extra?: Float32Array;
  index?: Uint32Array;
}

const MAGIC = 0x44414548; // 'HEAD', read little-endian
const VERSION = 1;
const Q = 32767;

const pad4 = (n: number): number => (n + 3) & ~3;

function partBytes(part: HeadPart): number {
  const n = part.positions.length / 3;
  let size = pad4(1 + part.name.length) + 12 + 24 + pad4(n * 6);
  if (part.normals) size += pad4(n * 3);
  if (part.extra) size += pad4(n);
  if (part.index) size += part.index.length * 4;
  return size;
}

export function encodeHead(parts: readonly HeadPart[]): ArrayBuffer {
  const buffer = new ArrayBuffer(12 + parts.reduce((sum, part) => sum + partBytes(part), 0));
  const view = new DataView(buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, parts.length, true);
  let at = 12;
  for (const part of parts) {
    const n = part.positions.length / 3;
    view.setUint8(at, part.name.length);
    for (let i = 0; i < part.name.length; i++) view.setUint8(at + 1 + i, part.name.charCodeAt(i));
    at += pad4(1 + part.name.length);
    view.setUint32(at, n, true);
    view.setUint32(at + 4, part.index?.length ?? 0, true);
    view.setUint32(at + 8, (part.normals ? 1 : 0) | (part.extra ? 2 : 0), true);
    at += 12;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < part.positions.length; i++) {
      min[i % 3] = Math.min(min[i % 3], part.positions[i]);
      max[i % 3] = Math.max(max[i % 3], part.positions[i]);
    }
    for (let k = 0; k < 3; k++) {
      if (n === 0) min[k] = max[k] = 0;
      view.setFloat32(at + k * 4, min[k], true);
      view.setFloat32(at + 12 + k * 4, max[k], true);
    }
    at += 24;
    const positions = new Int16Array(buffer, at, n * 3);
    for (let i = 0; i < n * 3; i++) {
      const k = i % 3, span = max[k] - min[k] || 1;
      positions[i] = Math.round(((part.positions[i] - min[k]) / span) * (2 * Q) - Q);
    }
    at += pad4(n * 6);
    if (part.normals) {
      const normals = new Int8Array(buffer, at, n * 3);
      for (let i = 0; i < n * 3; i++) normals[i] = Math.round(Math.max(-1, Math.min(1, part.normals[i])) * 127);
      at += pad4(n * 3);
    }
    if (part.extra) {
      const extra = new Uint8Array(buffer, at, n);
      for (let i = 0; i < n; i++) extra[i] = Math.round(Math.max(0, Math.min(1, part.extra[i])) * 255);
      at += pad4(n);
    }
    if (part.index) {
      new Uint32Array(buffer, at, part.index.length).set(part.index);
      at += part.index.length * 4;
    }
  }
  return buffer;
}

export function decodeHead(buffer: ArrayBuffer): HeadPart[] {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== VERSION) throw new Error('head.bin: not a head file of version 1');
  const count = view.getUint32(8, true);
  const parts: HeadPart[] = [];
  let at = 12;
  for (let p = 0; p < count; p++) {
    const length = view.getUint8(at);
    let name = '';
    for (let i = 0; i < length; i++) name += String.fromCharCode(view.getUint8(at + 1 + i));
    at += pad4(1 + length);
    const n = view.getUint32(at, true), indexCount = view.getUint32(at + 4, true), flags = view.getUint32(at + 8, true);
    at += 12;
    const min = [0, 1, 2].map((k) => view.getFloat32(at + k * 4, true));
    const max = [0, 1, 2].map((k) => view.getFloat32(at + 12 + k * 4, true));
    at += 24;
    const quantized = new Int16Array(buffer, at, n * 3);
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      const k = i % 3;
      positions[i] = min[k] + ((quantized[i] + Q) / (2 * Q)) * (max[k] - min[k]);
    }
    at += pad4(n * 6);
    const part: HeadPart = { name: name as HeadPartName, positions };
    if (flags & 1) {
      const packed = new Int8Array(buffer, at, n * 3);
      part.normals = Float32Array.from(packed, (v) => v / 127);
      at += pad4(n * 3);
    }
    if (flags & 2) {
      const packed = new Uint8Array(buffer, at, n);
      part.extra = Float32Array.from(packed, (v) => v / 255);
      at += pad4(n);
    }
    if (indexCount > 0) {
      part.index = new Uint32Array(buffer.slice(at, at + indexCount * 4));
      at += indexCount * 4;
    }
    parts.push(part);
  }
  return parts;
}
