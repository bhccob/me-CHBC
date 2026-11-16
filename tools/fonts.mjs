// Self-hosts the three fonts in public/fonts. Run with `npm run fonts` after adding a new Chinese character.
// - Bricolage Grotesque (display) and IBM Plex Mono (labels): the Latin files, copied as they are.
// - Noto Serif SC (Chinese): cut down to only the characters the site uses, so it is a few KB instead of several MB.
import { readFile, writeFile, mkdir, copyFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import subsetFont from "subset-font";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "fonts");
const mod = (p) => path.join(root, "node_modules", p);
await mkdir(out, { recursive: true });

await copyFile(mod("@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2"), path.join(out, "bricolage-grotesque.woff2"));
await copyFile(mod("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2"), path.join(out, "ibm-plex-mono-400.woff2"));
await copyFile(mod("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2"), path.join(out, "ibm-plex-mono-500.woff2"));

// every Chinese character that appears in the page or the code
async function walk(dir) {
  const found = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) found.push(...(await walk(p)));
    else if (/\.(ts|html|css)$/.test(e.name)) found.push(p);
  }
  return found;
}
const files = [...(await walk(path.join(root, "src"))), path.join(root, "index.html")];
const chars = new Set();
for (const f of files) for (const ch of await readFile(f, "utf8")) if (/[㐀-鿿]/.test(ch)) chars.add(ch);
const text = [...chars].sort().join("");

const full = await readFile(mod("@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-900-normal.woff2"));
const cut = await subsetFont(full, text, { targetFormat: "woff2" });
await writeFile(path.join(out, "noto-serif-sc-900.woff2"), cut);
// the file keeps its name, so its address in the stylesheet carries a short code of the characters inside it.
// when the characters change, the code changes and browsers fetch the new file instead of a stale copy
const code = createHash("sha1").update(text).digest("hex").slice(0, 8);
const cssPath = path.join(root, "src", "styles.css");
const css = await readFile(cssPath, "utf8");
await writeFile(cssPath, css.replace(/noto-serif-sc-900\.woff2(\?v=[0-9a-f]+)?/, `noto-serif-sc-900.woff2?v=${code}`));
console.log(`Chinese subset: ${chars.size} characters (${text}), ${cut.length} bytes`);
