// The brush face for the two characters of Hakka, 客家, cut out of Ma Shan Zheng (SIL Open Font License), so that the site
// carries its two glyphs and not the thousands of the whole face.
//   node tools/fonts/hakka.mjs
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';

const DIR = 'node_modules/@fontsource/ma-shan-zheng/files';
const CHARS = ['客', '家'];
const toArrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const found = new Map();
let metrics = null;
for (const file of readdirSync(DIR).filter((name) => name.endsWith('-400-normal.woff'))) {
  const font = opentype.parse(toArrayBuffer(readFileSync(join(DIR, file))));
  for (const char of CHARS) {
    if (found.has(char)) continue;
    const glyph = font.charToGlyph(char);
    if (glyph.index === 0) continue;
    found.set(char, glyph);
    metrics = font;
  }
  if (found.size === CHARS.length) break;
}
if (found.size !== CHARS.length) throw new Error(`only found ${[...found.keys()].join('')}`);

const glyphs = [
  new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: metrics.unitsPerEm, path: new opentype.Path() }),
  ...CHARS.map((char) => new opentype.Glyph({ name: `uni${char.codePointAt(0).toString(16).toUpperCase()}`, unicode: char.codePointAt(0), advanceWidth: found.get(char).advanceWidth, path: found.get(char).path })),
];
const subset = new opentype.Font({ familyName: 'Ma Shan Zheng', styleName: 'Regular', unitsPerEm: metrics.unitsPerEm, ascender: metrics.ascender, descender: metrics.descender, glyphs });
mkdirSync('public/fonts', { recursive: true });
writeFileSync('public/fonts/hakka.otf', Buffer.from(subset.toArrayBuffer()));
console.log('hakka.otf written');
