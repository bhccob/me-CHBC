// Shrinks a GLB that Blender wrote: merges identical data, welds vertices and quantizes them. KHR_mesh_quantization needs
// no decoder, while Draco and Meshopt need wasm, which the site's CSP does not allow.
//   node tools/blender/pack.mjs <in.glb> <out.glb>
import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld } from '@gltf-transform/functions';

const [input, output] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
// keepLeaves and keepAttributes: an empty node the pose drives must not go.
await doc.transform(dedup(), weld(), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }), quantize());
await io.write(output, doc);
console.log(`packed ${input} ${statSync(input).size} -> ${output} ${statSync(output).size}`);
