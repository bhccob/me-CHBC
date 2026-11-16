// LAB ONLY (throwaway). Round 65 textures, into proof-out/lab/mock/ideas65/tex:
//   projections for the Hall (the name, code, a network map, a gear drawing), the three works as PNG for Blender,
//   and line drawings of the works for the Cutaway hover (edges only, frost on obsidian).
//   node tools/lab/mock/tex65.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const OUT = 'proof-out/lab/mock/ideas65/tex/';
mkdirSync(OUT, { recursive: true });
const FROST = '#e4e7e9', TI = '#aeb6bf', ICE = '#91b9cc', DIM = '#4a525b';

const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#000"/>${body}</svg>`);

// the name, as the far wall's projection
await sharp(svg(4096, 1400, `
  <text x="2048" y="860" text-anchor="middle" font-family="Segoe UI Black, Segoe UI" font-weight="900" font-size="640" letter-spacing="-24" fill="${FROST}">BOB CHUNG</text>
  <text x="2048" y="1110" text-anchor="middle" font-family="Consolas" font-size="72" letter-spacing="22" fill="${TI}">SOFTWARE ENGINEERING · SECURITY · PHYSICAL SYSTEMS</text>
`)).png().toFile(OUT + 'name.png');

// DIGITAL: a few lines of code (OBSERVE, UNDERSTAND, ENGINEER, the site's own spine)
const code = [
  ['function', ' observe(system) {'],
  ['  const', ' parts = system.split();'],
  ['  for', ' (const part of parts) {'],
  ['', '    understand(part);'],
  ['', '  }'],
  ['  return', ' engineer(parts);'],
  ['', '}'],
  ['', ''],
  ['', 'observe(world).then(explore);'],
];
await sharp(svg(1600, 1000, code.map(([k, rest], i) => `
  <text x="70" y="${150 + i * 86}" font-family="Consolas" font-size="54" fill="${DIM}">${String(i + 1).padStart(2, '0')}</text>
  <text x="200" y="${150 + i * 86}" font-family="Consolas" font-size="54" xml:space="preserve"><tspan fill="${ICE}">${k}</tspan><tspan fill="${FROST}">${rest.replace(/</g, '&lt;')}</tspan></text>`).join('') + `
  <rect x="200" y="${150 + 8 * 86 + 14}" width="30" height="6" fill="${FROST}"/>`)).png().toFile(OUT + 'digital.png');

// SECURITY: a small network map; one path is traced in ice
const nodes = [[200, 500, 'GATEWAY'], [520, 260, 'HOST-01'], [520, 740, 'HOST-02'], [860, 380, 'SWITCH'], [860, 820, 'HOST-03'], [1180, 220, 'SERVER'], [1220, 600, 'HOST-04'], [1430, 420, 'LOG']];
const edges = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [3, 6], [5, 7], [6, 7], [4, 6]];
const traced = new Set(['0-2', '2-3', '3-5', '5-7']);
await sharp(svg(1600, 1000, edges.map(([a, b]) => {
  const t = traced.has(`${a}-${b}`);
  return `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="${t ? ICE : DIM}" stroke-width="${t ? 7 : 4}" ${t ? '' : 'stroke-dasharray="14 12"'}/>`;
}).join('') + nodes.map(([x, y, l], i) => `
  <circle cx="${x}" cy="${y}" r="${i === 7 ? 30 : 22}" fill="#000" stroke="${[0, 2, 3, 5, 7].includes(i) ? ICE : TI}" stroke-width="6"/>
  <text x="${x}" y="${y + 74}" text-anchor="middle" font-family="Consolas" font-size="34" letter-spacing="4" fill="${TI}">${l}</text>`).join(''))).png().toFile(OUT + 'security.png');

// PHYSICAL: a gear in a technical drawing, centre lines and dimensions
const teeth = 18, R = 300, r = 262, cx = 640, cy = 500;
let d = '';
for (let i = 0; i < teeth; i++) {
  const a0 = (i / teeth) * Math.PI * 2, da = (Math.PI * 2) / teeth;
  for (const [f, rr] of [[0, r], [0.2, r], [0.32, R], [0.6, R], [0.72, r]]) {
    const a = a0 + f * da;
    d += `${d ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `;
  }
}
await sharp(svg(1600, 1000, `
  <path d="${d}Z" fill="none" stroke="${FROST}" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="120" fill="none" stroke="${FROST}" stroke-width="6"/>
  <circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="${FROST}" stroke-width="6"/>
  <line x1="${cx - 380}" y1="${cy}" x2="${cx + 380}" y2="${cy}" stroke="${TI}" stroke-width="3" stroke-dasharray="40 10 8 10"/>
  <line x1="${cx}" y1="${cy - 380}" x2="${cx}" y2="${cy + 380}" stroke="${TI}" stroke-width="3" stroke-dasharray="40 10 8 10"/>
  <line x1="${cx - R}" y1="${cy + 400}" x2="${cx + R}" y2="${cy + 400}" stroke="${ICE}" stroke-width="4"/>
  <path d="M${cx - R},${cy + 400} l22,-12 v24 Z M${cx + R},${cy + 400} l-22,-12 v24 Z" fill="${ICE}"/>
  <text x="${cx}" y="${cy + 380}" text-anchor="middle" font-family="Consolas" font-size="44" fill="${ICE}">Ø 60.0</text>
  <rect x="1100" y="180" width="420" height="640" fill="none" stroke="${DIM}" stroke-width="4"/>
  <text x="1130" y="260" font-family="Consolas" font-size="38" letter-spacing="6" fill="${TI}">PART  G-18</text>
  <text x="1130" y="330" font-family="Consolas" font-size="38" letter-spacing="6" fill="${TI}">TEETH 18</text>
  <text x="1130" y="400" font-family="Consolas" font-size="38" letter-spacing="6" fill="${TI}">MODULE 3</text>
  <text x="1130" y="470" font-family="Consolas" font-size="38" letter-spacing="6" fill="${TI}">SCALE 1:1</text>
`)).png().toFile(OUT + 'physical.png');

// the works: PNG for Blender, and a line drawing of each for the Cutaway hover
const works = { lumo: 'tools/lab/mock/img/lumo.webp', jontai: 'src/assets/projects/jontai-type.webp', cookies: 'src/assets/projects/cookies-playing.webp' };
for (const [name, file] of Object.entries(works)) {
  await sharp(file).png().toFile(OUT + `${name}.png`);
  const { width, height } = await sharp(file).metadata();
  const edges = await sharp(file).greyscale().blur(0.6)
    .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
    .linear(3.2, 0).threshold(46).toBuffer();
  // frost lines over obsidian with a faint drawing grid
  const grid = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1d232a" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="#080a0d"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const mask = await sharp(edges).extractChannel(0).toBuffer();
  const frost = await sharp({ create: { width, height, channels: 3, background: '#dfe6ea' } }).joinChannel(mask).png().toBuffer();
  await sharp(grid).composite([{ input: frost }]).webp({ quality: 88 }).toFile(OUT + `${name}-lines.webp`);
  await sharp(file).webp({ quality: 90 }).toFile(OUT + `${name}.webp`);
}
console.log('textures in', OUT);
