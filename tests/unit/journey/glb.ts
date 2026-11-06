import { readFileSync } from 'node:fs';

export interface GlbJson {
  nodes: { name?: string; children?: number[]; mesh?: number }[];
  extensionsUsed?: string[];
  materials?: { name?: string }[];
}

/** The JSON chunk of a GLB file. */
export function readGlbJson(path: string): GlbJson {
  const file = readFileSync(path);
  const length = file.readUInt32LE(12);
  return JSON.parse(file.toString('utf8', 20, 20 + length)) as GlbJson;
}
