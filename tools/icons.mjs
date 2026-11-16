// Makes the icons from Bob's logo, and the share image from tools/share.html.
// The logo is two files he drew: public/favicon.svg (bold lines, for small sizes) and public/icon.svg (fine lines, for large sizes).
// Run `npm run icons` while `npm run dev` is running (the share image is a picture of a page on the dev server).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (f) => path.join(root, "public", f);

/* phone home screen: the large logo on a full square of its own background (the phone rounds the corners itself) */
await sharp(pub("icon.svg"), { density: 300 }).resize(180, 180).flatten({ background: "#0c0519" }).png().toFile(pub("apple-touch-icon.png"));
console.log("apple-touch-icon.png written");

/* favicon.ico, for browsers and search engines that still ask for it: the bold logo at 48 px, as a PNG inside an ICO file */
const png = await sharp(pub("favicon.svg"), { density: 400 }).resize(48, 48).png().toBuffer();
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // an icon file holding one picture
head.writeUInt8(48, 6); head.writeUInt8(48, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9); // 48 x 48
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
writeFileSync(pub("favicon.ico"), Buffer.concat([head, png]));
console.log("favicon.ico written");

const browsers = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter((p) => p && existsSync(p));
if (!browsers.length) { console.log("No Edge or Chrome found: share.png not remade. Set BROWSER_PATH to a browser."); process.exit(0); }
const raw = path.join(root, "node_modules", ".cache", "share-raw.png"), profile = path.join(root, "node_modules", ".cache", "share-browser");
mkdirSync(path.dirname(raw), { recursive: true });
rmSync(raw, { force: true });
execFileSync(browsers[0], ["--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1", "--window-size=1200,630", "--timeout=9000", `--user-data-dir=${profile}`, `--screenshot=${raw}`, "http://127.0.0.1:5173/tools/share.html"], { stdio: "ignore" });
for (let n = 0; n < 40 && !existsSync(raw); n++) await new Promise((r) => setTimeout(r, 500)); // the browser writes the file a moment after it returns
if (!existsSync(raw)) { console.log("The browser made no picture. Is `npm run dev` running?"); process.exit(1); }
await new Promise((r) => setTimeout(r, 500));
await sharp(raw).resize(1200, 630, { fit: "cover", position: "top" }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(pub("share.png"));
console.log("share.png written");
