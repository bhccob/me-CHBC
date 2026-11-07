// Shrinks a GLB that Blender wrote: merges identical data, welds vertices and quantizes them. KHR_mesh_quantization needs
// no decoder, while Draco and Meshopt need wasm, which the site's CSP does not allow.
// A node named in <driven> gets its mesh moved to a child, because quantizing writes into the transform of the node that
// holds a mesh, and the page sets those nodes' transforms itself. <driven> is names split by commas; `#` stands for a number.
//   node tools/blender/pack.mjs <in.glb> <out.glb> [driven]      e.g. pulse-#,code-cover
import { statSync } from 'node:fs';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld } from '@gltf-transform/functions';

const [input, output, driven] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
if (driven) {
  const names = driven.split(',');
  const named = (name) => names.some((n) => (n.endsWith('#') ? name.startsWith(n.slice(0, -1)) && /^\d+$/.test(name.slice(n.length - 1)) : name === n));
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || !named(node.getName())) continue;
    node.addChild(doc.createNode(`${node.getName()}-mesh`).setMesh(mesh));
    node.setMesh(null);
  }
}
// Materials stay apart: the page lights some of them on their own, even where Blender wrote them the same.
// keepLeaves and keepAttributes: an empty node the pose drives must not go.
await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), weld(), prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }), quantize());
await io.write(output, doc);
console.log(`packed ${input} ${statSync(input).size} -> ${output} ${statSync(output).size}`);
