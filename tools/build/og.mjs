// The share image every page names in og:image and twitter:image: the journey's first view, as
// tools/share_image.mjs shot it, at the 1200 x 630 that social cards use.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const SOURCE = fileURLToPath(new URL('../../src/assets/journey/share.png', import.meta.url));

/**
 * Writes og.jpg into `dist`.
 * @param {string} dist
 * @returns {Promise<number>} its size in bytes
 */
export async function writeOg(dist) {
  const info = await sharp(SOURCE)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(join(dist, 'og.jpg'));
  if (info.width !== OG_WIDTH || info.height !== OG_HEIGHT) throw new Error(`og.jpg came out ${info.width}x${info.height}, not ${OG_WIDTH}x${OG_HEIGHT}`);
  return info.size;
}
