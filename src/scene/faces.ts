/* the 2D drawings on the pieces: one live drawing per face, the name bands on the long sides, the end caps */
import * as THREE from "three";
import { PIECES, DIRECTIONS } from "../content";
import { clamp, ss, lerp, rnd, rr } from "../util";

export const FW = 1200, FH = 400;
export const CN = PIECES.map((p) => p.cn), BIGNAME = PIECES.map((p) => p.big);
export const CNFONT = "'Noto Serif SC','Songti SC','SimSun',serif", DFONT = "'Bricolage Grotesque',Arial,sans-serif";
const INK = "#0c0b15", BONE = "#efe8d6", DIM = "#8d88a3", ME_GOLD = "#f2cf7a";

type Ctx = CanvasRenderingContext2D;
/** c: the face's canvas, t: time in seconds, col: the piece's colour, u: 0..1 progress of the name animation (Me only) */
export type FaceDraw = (c: Ctx, t: number, col: string, u: number) => void;

function faceBase(c: Ctx, col: string) {
  c.fillStyle = INK; c.fillRect(0, 0, FW, FH);
  c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 3; c.strokeRect(14, 14, FW - 28, FH - 28); c.globalAlpha = 1;
}

/** a player running a level, jumping for coins towards a flag. drawn on a 1200 × 400 area */
function gameScene(c: Ctx, t: number, col: string) {
  const gy = 330, pl = [[170, 250, 200], [480, 190, 200], [790, 250, 200]];
  let i: number;
  c.fillStyle = BONE; c.fillRect(30, gy, FW - 60, 6);
  for (i = 0; i < pl.length; i++) {
    c.fillStyle = col; c.fillRect(pl[i][0], pl[i][1], pl[i][2], 20);
    c.globalAlpha = 0.22; c.fillRect(pl[i][0], pl[i][1] + 20, pl[i][2], gy - pl[i][1] - 20); c.globalAlpha = 1;
    const bob = Math.sin(t * 4 + i) * 6, taken = ((t * 0.22) % 1) * 1000 + 60 > pl[i][0] + pl[i][2] / 2;
    if (!taken) { c.fillStyle = ME_GOLD; c.beginPath(); c.arc(pl[i][0] + pl[i][2] / 2, pl[i][1] - 46 + bob, 17, 0, 6.283); c.fill(); c.fillStyle = INK; c.fillRect(pl[i][0] + pl[i][2] / 2 - 3, pl[i][1] - 56 + bob, 6, 20); }
  }
  c.fillStyle = BONE; c.fillRect(1090, 150, 8, 180); c.fillStyle = col; c.beginPath(); c.moveTo(1098, 150); c.lineTo(1160, 178); c.lineTo(1098, 206); c.closePath(); c.fill();
  const u = (t * 0.22) % 1, px = 60 + u * 1000, py = gy - 64 - Math.abs(Math.sin(u * Math.PI * 4)) * 190;
  c.fillStyle = BONE; c.fillRect(px, py, 64, 64); c.fillStyle = INK; c.fillRect(px + 38, py + 14, 10, 14); c.fillRect(px + 50, py + 14, 10, 14);
  c.fillStyle = col; c.font = "800 34px monospace"; c.textBaseline = "middle"; c.textAlign = "left"; c.fillText("SCORE " + String(Math.floor(u * 3.99) * 100).padStart(4, "0"), 44, 60);
  for (i = 0; i < 3; i++) { c.fillStyle = "#ff6a55"; c.fillRect(330 + i * 38, 46, 26, 26); }
}

/** one phone screen with a list, a tab bar and a finger tapping down the list. tab: which of its three tabs is lit */
function phone(c: Ctx, col: string, x: number, y: number, tab: number, tap: number) {
  const w = 190, h = 284;
  let k: number;
  c.globalAlpha = 1;
  c.lineWidth = 6; c.strokeStyle = col; rr(c, x, y, w, h, 24); c.stroke();
  c.fillStyle = col; rr(c, x + 14, y + 16, w - 28, 40, 10); c.fill();
  for (k = 0; k < 3; k++) {
    const ry = y + 72 + k * 56, hot = k === Math.floor(tap * 3);
    if (hot) { c.globalAlpha = 0.3; c.fillStyle = col; rr(c, x + 10, ry - 6, w - 20, 50, 10); c.fill(); c.globalAlpha = 1; }
    c.fillStyle = col; c.beginPath(); c.arc(x + 36, ry + 19, 15, 0, 6.283); c.fill();
    c.fillStyle = BONE; c.fillRect(x + 62, ry + 6, 96, 9); c.globalAlpha = 0.55; c.fillRect(x + 62, ry + 24, 64, 8); c.globalAlpha = 1;
    if (hot) { c.strokeStyle = BONE; c.lineWidth = 4; c.beginPath(); c.arc(x + w - 34, ry + 19, 10 + ((tap * 3) % 1) * 14, 0, 6.283); c.stroke(); }
  }
  for (k = 0; k < 3; k++) { c.fillStyle = k === tab ? col : DIM; c.beginPath(); c.arc(x + w / 2 + (k - 1) * 40, y + h - 26, 9, 0, 6.283); c.fill(); }
}

/* one drawing per piece, in the order of PIECES in content.ts */
const RAW: FaceDraw[] = [
  function software(c, t, col) { /* real code, typed out one character at a time */
    faceBase(c, col);
    const CODE = ["function build(idea) {", "  const plan = design(idea);", "  const app  = code(plan);", "  test(app);", "  return ship(app);", "}"];
    let total = 0, i: number;
    for (i = 0; i < CODE.length; i++) total += CODE[i].length;
    let n = Math.floor((t * 13) % (total + 34)), cur = false;
    c.font = "500 36px monospace"; c.textBaseline = "middle"; c.textAlign = "left";
    const cw = c.measureText("M").width;
    for (i = 0; i < CODE.length; i++) {
      const y = 112 + i * 48, line = CODE[i], shown = clamp(n, 0, line.length), re = /[A-Za-z_]+|[^A-Za-z_]+/g;
      let m: RegExpExecArray | null, at = 0;
      c.fillStyle = DIM; c.fillText(String(i + 1), 40, y);
      while ((m = re.exec(line))) {
        const tok = m[0], vis = Math.min(tok.length, shown - at);
        if (vis <= 0) break;
        c.fillStyle = /^(function|const|return)$/.test(tok) ? col : line.charAt(at + tok.length) === "(" ? "#6cc4ff" : BONE;
        c.fillText(tok.slice(0, vis), 100 + at * cw, y); at += tok.length;
      }
      if (!cur && n < line.length) { cur = true; if (Math.sin(t * 9) > 0) { c.fillStyle = col; c.fillRect(100 + shown * cw, y - 20, 14, 40); } }
      n -= line.length;
    }
    if (!cur && Math.sin(t * 9) > 0) { c.fillStyle = col; c.fillRect(100 + cw, 112 + 5 * 48 - 20, 14, 40); }
  },
  function development(c, t, col) { /* games and apps: the level being played on the left, a phone being tapped on the right */
    faceBase(c, col);
    c.save(); c.translate(26, 118); c.scale(0.66, 0.66); gameScene(c, t, col); c.restore();
    phone(c, col, 930, 96, Math.floor(t * 0.6) % 3, (t * 0.6) % 1);
    c.globalAlpha = 1;
  },
  function mechatronics(c, t, col) { /* gears turning and a robot arm carrying a block back and forth */
    faceBase(c, col);
    function gear(cx: number, cy: number, r: number, teeth: number, a: number) {
      c.save(); c.translate(cx, cy); c.rotate(a); c.strokeStyle = col; c.lineWidth = 8; c.beginPath();
      for (let i = 0; i < teeth * 2; i++) { const rad = i % 2 ? r : r - 24, a0 = i / (teeth * 2) * 6.283, a1 = (i + 1) / (teeth * 2) * 6.283; c.lineTo(Math.cos(a0) * rad, Math.sin(a0) * rad); c.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad); }
      c.closePath(); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.22, 0, 6.283); c.fill(); c.restore();
    }
    gear(175, 225, 130, 12, t * 0.8); gear(372, 225, 82, 8, -t * 0.8 * 12 / 8 + 0.39);
    /* arm: shoulder fixed, the tip sweeps between two stands */
    const bx = 700, by = 340, L1 = 190, L2 = 170, s = (Math.sin(t * 1.1) + 1) / 2, tx = lerp(560, 1020, s), ty = 300 - Math.sin(s * Math.PI) * 120;
    const dx = tx - bx, dy = ty - by, d = Math.min(Math.hypot(dx, dy), L1 + L2 - 2), a = Math.atan2(dy, dx), q = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)), a1 = a - q;
    const jx = bx + Math.cos(a1) * L1, jy = by + Math.sin(a1) * L1, ex = bx + Math.cos(a) * d, ey = by + Math.sin(a) * d;
    c.fillStyle = DIM; c.fillRect(520, 330, 90, 12); c.fillRect(980, 330, 90, 12); c.fillRect(640, 340, 120, 22);
    c.strokeStyle = BONE; c.lineWidth = 28; c.lineCap = "round"; c.beginPath(); c.moveTo(bx, by); c.lineTo(jx, jy); c.lineTo(ex, ey); c.stroke(); c.lineCap = "butt";
    c.fillStyle = col; [[bx, by], [jx, jy]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], 20, 0, 6.283); c.fill(); });
    c.fillStyle = ME_GOLD; c.fillRect(ex - 24, ey - 4, 48, 40); c.strokeStyle = col; c.lineWidth = 8; c.strokeRect(ex - 32, ey - 12, 64, 16);
    c.fillStyle = col; c.font = "800 30px monospace"; c.textBaseline = "middle"; c.textAlign = "left"; c.fillText("θ1 " + (a1 * 57.3).toFixed(0) + "°", 440, 360);
  },
  function internship(c, t, col) { /* cybersecurity: a password being cracked, and a padlock that opens when it is */
    faceBase(c, col);
    const cyc = (t * 0.32) % 1.5, k = Math.min(8, Math.floor(cyc * 8)), open = k >= 8, PASS = "R7#kQ2!x";
    const lx = 205, ly = 240, lift = open ? -38 : 0;
    c.strokeStyle = BONE; c.lineWidth = 24; c.lineCap = "round"; c.beginPath();
    c.moveTo(lx - 58, ly - 60 + lift); c.lineTo(lx - 58, ly - 110 + lift); c.arc(lx, ly - 110 + lift, 58, Math.PI, 0); c.lineTo(lx + 58, open ? ly - 110 + lift : ly - 60); c.stroke(); c.lineCap = "butt";
    c.fillStyle = open ? "#5fd6ab" : col; rr(c, lx - 100, ly - 64, 200, 150, 18); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(lx, ly, 20, 0, 6.283); c.fill(); c.fillRect(lx - 8, ly, 16, 44);
    c.textBaseline = "middle"; c.textAlign = "center";
    for (let i = 0; i < 8; i++) {
      const x = 410 + i * 90, got = i < k;
      c.lineWidth = 4; c.strokeStyle = got ? BONE : col; c.strokeRect(x, 150, 74, 90);
      c.font = "800 52px monospace"; c.fillStyle = got ? BONE : col; c.globalAlpha = got ? 1 : 0.75;
      c.fillText(got ? PASS.charAt(i) : String.fromCharCode(33 + Math.floor(rnd(i * 7 + Math.floor(t * 14)) * 90)), x + 37, 197); c.globalAlpha = 1;
    }
    c.fillStyle = DIM; c.fillRect(410, 266, 704, 10); c.fillStyle = open ? "#5fd6ab" : col; c.fillRect(410, 266, 704 * k / 8, 10);
    c.textAlign = "left"; c.font = "800 40px monospace"; c.fillStyle = open ? "#5fd6ab" : col; c.fillText(open ? "ACCESS GRANTED" : "ACCESS DENIED", 410, 322);
  },
  function directions(c, t, col) { /* one starting point, several paths. each lights in turn; the last, in gold, is the long-term goal */
    faceBase(c, col);
    const n = DIRECTIONS.length, x0 = 150, y0 = 228, x1 = 620, top = 116, gap = (366 - top) / Math.max(1, n - 1);
    const act = Math.floor(t * 0.7) % n, run = (t * 0.7) % 1;
    c.textBaseline = "middle"; c.textAlign = "left"; c.lineCap = "round";
    for (let k = 0; k < n; k++) {
      const y = top + k * gap, on = k === act, ink = k === n - 1 ? ME_GOLD : col;
      c.globalAlpha = on ? 1 : 0.4; c.strokeStyle = ink; c.lineWidth = on ? 6 : 3;
      c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + 230, y0, x1 - 230, y, x1, y); c.stroke();
      c.fillStyle = ink; c.beginPath(); c.arc(x1, y, on ? 11 : 7, 0, 6.283); c.fill();
      c.globalAlpha = on ? 1 : 0.7; c.fillStyle = on ? BONE : ink; c.font = (on ? "800" : "500") + " 27px monospace"; c.fillText(DIRECTIONS[k], x1 + 30, y + 1);
      if (on) { /* a spark travelling out along the path that is lit */
        const m = 1 - run, bx = m * m * m * x0 + 3 * m * m * run * (x0 + 230) + 3 * m * run * run * (x1 - 230) + run * run * run * x1;
        const by = m * m * m * y0 + 3 * m * m * run * y0 + 3 * m * run * run * y + run * run * run * y;
        c.globalAlpha = 1; c.fillStyle = BONE; c.beginPath(); c.arc(bx, by, 12, 0, 6.283); c.fill();
      }
    }
    c.lineCap = "butt"; c.globalAlpha = 1;
    c.fillStyle = BONE; c.beginPath(); c.arc(x0, y0, 34, 0, 6.283); c.fill();
    c.fillStyle = INK; c.textAlign = "center"; c.font = "900 36px " + CNFONT; c.fillText(CN[5], x0, y0 + 3); c.textAlign = "left";
  },
  function me(c, t, col, u) { /* BOB opens; CHUNG CHUN HO shrinks to C C H; they cross over and land backwards as H C C */
    faceBase(c, col);
    const GOLD = "#e0b85a", BIG = "800 170px " + DFONT, L = ["B", "H", "C", "C", "O", "B"], WORDS = ["CHUNG", "CHUN", "HO"];
    const w: number[] = [], fx: number[] = [], gap = 10, cx = 470, base = 212;
    let i: number, k: number, tot = 0;
    c.textBaseline = "alphabetic"; c.textAlign = "left"; c.font = BIG;
    for (i = 0; i < 6; i++) { w[i] = c.measureText(L[i]).width; tot += w[i]; }
    tot += gap * 5; let x = cx - tot / 2;
    for (i = 0; i < 6; i++) { fx[i] = x; x += w[i] + gap; }
    /* BOB splits to make room */
    const wb = w[0] + w[4] + w[5] + gap * 2, bx = cx - wb / 2, split = ss(0.08, 0.3, u);
    const x0 = lerp(bx, fx[0], split), x4 = lerp(bx + w[0] + gap, fx[4], split), x5 = lerp(bx + w[0] + w[4] + gap * 2, fx[5], split);
    c.fillStyle = col; c.fillText("B", x0, base); c.fillText("O", x4, base); c.fillText("B", x5, base);
    /* the Chinese name in its own order, family name first */
    const SM = 46, wx: number[] = [], ww: number[] = [], wgap = 34, rowY = 70;
    let wt = 0;
    c.font = "800 " + SM + "px " + DFONT;
    for (k = 0; k < 3; k++) { ww[k] = c.measureText(WORDS[k]).width; wt += ww[k]; }
    wt += wgap * 2; x = cx - wt / 2; for (k = 0; k < 3; k++) { wx[k] = x; x += ww[k] + wgap; }
    const appear = ss(0.22, 0.38, u), tail = 1 - ss(0.42, 0.56, u);
    for (k = 0; k < 3; k++) {
      const m = ss(0.58 + k * 0.06, 0.82 + k * 0.06, u), slot = 3 - k, size = lerp(SM, 170, m), lx = lerp(wx[k], fx[slot], m), ly = lerp(rowY, base, m);
      c.fillStyle = GOLD;
      if (tail > 0 && appear > 0) { c.globalAlpha = appear * tail; c.font = "800 " + SM + "px " + DFONT; c.fillText(WORDS[k].slice(1), wx[k] + c.measureText(WORDS[k].charAt(0)).width, rowY); }
      c.globalAlpha = appear; c.font = "800 " + size.toFixed(1) + "px " + DFONT; c.fillText(WORDS[k].charAt(0), lx, ly);
    }
    /* once they have landed: an arrow under H C C pointing back the way it reads, and one bracket that still says BOB */
    const land = ss(0.9, 1, u);
    if (land > 0) {
      c.globalAlpha = land * 0.9; c.strokeStyle = GOLD; c.fillStyle = GOLD; c.lineWidth = 3; const ay = base + 30, a0 = fx[3] + w[3], a1 = fx[1];
      c.beginPath(); c.moveTo(a0, ay); c.lineTo(a1, ay); c.stroke(); c.beginPath(); c.moveTo(a1 - 2, ay); c.lineTo(a1 + 16, ay - 9); c.lineTo(a1 + 16, ay + 9); c.closePath(); c.fill();
      c.font = "500 22px monospace"; c.textAlign = "center";
      for (k = 0; k < 3; k++) c.fillText(WORDS[k], fx[3 - k] + w[3 - k] / 2, base + 62);
      c.textAlign = "left";
    }
    c.globalAlpha = 0.7; c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
    c.moveTo(x0, base + 76); c.lineTo(x0, base + 92); c.lineTo(x5 + w[5], base + 92); c.lineTo(x5 + w[5], base + 76); c.stroke();
    c.fillStyle = col; c.font = "500 22px monospace"; c.textAlign = "center"; c.fillText("BOB", (x0 + x5 + w[5]) / 2, base + 124); c.textAlign = "left";
    c.globalAlpha = 1;
    const rcx = 1010, rcy = 200, R = 110;
    c.strokeStyle = col; c.lineWidth = 4; c.globalAlpha = 0.6; c.beginPath(); c.arc(rcx, rcy, R, 0, 6.283); c.stroke();
    for (i = 0; i < 6; i++) { const a = t * 0.5 + i / 6 * 6.283, in3 = i >= 1 && i <= 3; c.globalAlpha = in3 ? ss(0.58, 0.9, u) : 1; c.fillStyle = in3 ? GOLD : col; c.beginPath(); c.arc(rcx + Math.cos(a) * R, rcy + Math.sin(a) * R, 15, 0, 6.283); c.fill(); }
    c.globalAlpha = 1;
  },
];

export function fitFont(c: Ctx, str: string, weight: number, size: number, family: string, maxW: number) {
  c.font = weight + " " + size + "px " + family;
  const w = c.measureText(str).width;
  if (w > maxW) { size = Math.floor(size * maxW / w); c.font = weight + " " + size + "px " + family; }
  return size;
}

/** a name plate in the corner of the drawn face */
function faceTag(c: Ctx, i: number, col: string) {
  c.save(); c.globalAlpha = 1; c.textBaseline = "middle"; c.textAlign = "right";
  c.font = "800 34px " + DFONT; const w1 = c.measureText(BIGNAME[i]).width; c.font = "900 40px " + CNFONT; const w2 = c.measureText(CN[i]).width, W = w1 + w2 + 58;
  c.fillStyle = INK; c.fillRect(FW - 28 - W, 26, W, 60); c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(FW - 28 - W, 26, W, 60);
  c.fillStyle = col; c.font = "800 34px " + DFONT; c.fillText(BIGNAME[i], FW - 44, 57); c.font = "900 40px " + CNFONT; c.fillText(CN[i], FW - 44 - w1 - 18, 57);
  c.restore();
}

/** DRAW[piece](canvas, time, colour, nameProgress) */
export const DRAW: FaceDraw[] = RAW.map((f, i) => (c, t, col, u) => { f(c, t, col, u); faceTag(c, i, i === 5 ? ME_GOLD : col); });

/** long sides: the Chinese name and the study in big capitals */
export function drawBand(cv: HTMLCanvasElement, i: number, col: string) {
  const c = cv.getContext("2d")!; c.fillStyle = INK; c.fillRect(0, 0, 1200, 400);
  c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 3; c.strokeRect(14, 14, 1172, 372);
  c.globalAlpha = 1; c.fillStyle = col; c.textBaseline = "middle"; c.textAlign = "left";
  c.font = "900 190px " + CNFONT; const cw = c.measureText(CN[i]).width; c.fillText(CN[i], 48, 205);
  const x0 = 48 + cw + 44; c.globalAlpha = 0.6; c.fillRect(x0 - 22, 70, 4, 260); c.globalAlpha = 1;
  const words = BIGNAME[i].split(" "), maxW = 1200 - x0 - 48;
  if (words.length > 1) { fitFont(c, words[0], 800, 128, DFONT, maxW); c.fillText(words[0], x0, 140); fitFont(c, words[1], 800, 128, DFONT, maxW); c.fillText(words[1], x0, 268); }
  else { fitFont(c, words[0], 800, 150, DFONT, maxW); c.fillText(words[0], x0, 205); }
}

/** end caps: just the Chinese name, as large as it fits */
export function drawCap(cv: HTMLCanvasElement, i: number, col: string) {
  const c = cv.getContext("2d")!; c.fillStyle = INK; c.fillRect(0, 0, 400, 400);
  c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 4; c.strokeRect(18, 18, 364, 364);
  c.globalAlpha = 1; c.fillStyle = col; c.textBaseline = "middle"; c.textAlign = "center"; fitFont(c, CN[i], 900, 250, CNFONT, 300); c.fillText(CN[i], 200, 208);
}

/** the pattern on the plain sides: leiwen, square thunder spirals */
export function patternTex(col: string) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 512; const c = cv.getContext("2d")!;
  c.fillStyle = INK; c.fillRect(0, 0, 512, 512); c.strokeStyle = col; c.lineWidth = 5; c.globalAlpha = 0.75;
  for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++) {
    const x = gx * 128 + 18, y = gy * 128 + 18, s = 92, flip = (gx + gy) % 2;
    c.save(); c.translate(x + s / 2, y + s / 2); if (flip) c.scale(-1, 1); c.translate(-s / 2, -s / 2);
    c.beginPath(); c.moveTo(0, s); c.lineTo(0, 0); c.lineTo(s, 0); c.lineTo(s, s * 0.78); c.lineTo(s * 0.24, s * 0.78); c.lineTo(s * 0.24, s * 0.26); c.lineTo(s * 0.74, s * 0.26); c.lineTo(s * 0.74, s * 0.54); c.lineTo(s * 0.48, s * 0.54); c.stroke(); c.restore();
  }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
