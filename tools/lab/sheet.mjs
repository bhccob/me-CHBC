// LAB ONLY (throwaway): a contact sheet of stills, three across.  node tools/lab/sheet.mjs out.jpg a.jpg b.jpg ...
import sharp from 'sharp';

const [out, ...files] = process.argv.slice(2);
const w = Number(process.env.CELL_W ?? 480), h = Number(process.env.CELL_H ?? 270), across = Number(process.env.ACROSS ?? 3);
const cells = await Promise.all(files.map((file) => sharp(file).resize(w, h).toBuffer()));
const rows = Math.ceil(files.length / across);
await sharp({ create: { width: w * across, height: h * rows, channels: 3, background: '#000' } })
  .composite(cells.map((input, i) => ({ input, left: (i % across) * w, top: Math.floor(i / across) * h })))
  .jpeg({ quality: 86 })
  .toFile(out);
console.log(`${out}: ${files.length} stills`);
