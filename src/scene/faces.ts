/* the 2D drawings on the pieces: one live drawing per face, the name bands on the long sides, the end caps */
import * as THREE from "three";
import { PIECES, DIRECTIONS, ME_SIDES } from "../content";
import { clamp, ss, lerp, rnd, rr } from "../util";

export const FW = 1200, FH = 400;
export const CN = PIECES.map((p) => p.cn), BIGNAME = PIECES.map((p) => p.big);
export const CNFONT = "'Noto Serif SC','Songti SC','SimSun',serif", DFONT = "'Bricolage Grotesque',Arial,sans-serif";
const INK = "#0c0b15", BONE = "#efe8d6", DIM = "#8d88a3", ME_GOLD = "#f2cf7a";
/** the combination piece's code: the three studies, in the order its dials land on them */
const KEY = (["software", "design", "mechatronics"] as const).map((id) => PIECES.find((p) => p.id === id)!);

type Ctx = CanvasRenderingContext2D;
/** c: the face's canvas, t: time in seconds, col: the piece's colour, u: 0..1 progress of the name animation (Me only) */
export type FaceDraw = (c: Ctx, t: number, col: string, u: number) => void;

function faceBase(c: Ctx, col: string) {
  c.fillStyle = INK; c.fillRect(0, 0, FW, FH);
  c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 3; c.strokeRect(14, 14, FW - 28, FH - 28); c.globalAlpha = 1;
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
  function design(c, t, col) { /* product design: a curve drawn with the pen tool, a screen being laid out, type and colour */
    faceBase(c, col);
    /* the pen: a curve is drawn out from its first anchor, the handles of the anchor it is heading for showing */
    const u = (t * 0.32) % 1.25, draw = clamp(u / 0.85, 0, 1), P0 = [70, 330], C1 = [90, 120], C2 = [330, 360], P1 = [360, 150];
    const bz = (k: number, a: number, b: number, cc: number, d: number) => { const m = 1 - k; return m * m * m * a + 3 * m * m * k * b + 3 * m * k * k * cc + k * k * k * d; };
    c.lineCap = "round"; c.strokeStyle = BONE; c.lineWidth = 7; c.beginPath(); c.moveTo(P0[0], P0[1]);
    for (let k = 0; k <= 40; k++) { const q = draw * k / 40; c.lineTo(bz(q, P0[0], C1[0], C2[0], P1[0]), bz(q, P0[1], C1[1], C2[1], P1[1])); }
    c.stroke();
    c.strokeStyle = col; c.lineWidth = 2.5; c.globalAlpha = 0.8;
    c.beginPath(); c.moveTo(P0[0], P0[1]); c.lineTo(C1[0], C1[1]); c.moveTo(P1[0], P1[1]); c.lineTo(C2[0], C2[1]); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = col; [C1, C2].forEach((h) => { c.beginPath(); c.arc(h[0], h[1], 9, 0, 6.283); c.fill(); });
    c.fillStyle = INK; c.strokeStyle = BONE; c.lineWidth = 4; [P0, P1].forEach((h) => { c.fillRect(h[0] - 11, h[1] - 11, 22, 22); c.strokeRect(h[0] - 11, h[1] - 11, 22, 22); });
    const px = bz(draw, P0[0], C1[0], C2[0], P1[0]), py = bz(draw, P0[1], C1[1], C2[1], P1[1]);
    c.fillStyle = col; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 14, py + 38); c.lineTo(px + 26, py + 26); c.closePath(); c.fill(); /* the pen's nib */
    c.lineCap = "butt";
    /* the screen: its parts snap into place one after another, then it starts again */
    const sx = 450, sy = 104, sw = 330, sh = 262, cyc = (t * 0.28) % 1;
    c.strokeStyle = col; c.lineWidth = 5; rr(c, sx, sy, sw, sh, 22); c.stroke();
    c.globalAlpha = 0.25; c.strokeStyle = col; c.lineWidth = 1.5; for (let g = 1; g < 6; g++) { c.beginPath(); c.moveTo(sx + g * sw / 6, sy + 10); c.lineTo(sx + g * sw / 6, sy + sh - 10); c.stroke(); } c.globalAlpha = 1;
    const parts: [number, number, number, number, string][] = [[24, 22, 282, 34, col], [24, 72, 180, 92, "rgba(239,232,214,.22)"], [218, 72, 88, 40, ME_GOLD], [218, 124, 88, 40, "#5fd6ab"], [24, 182, 220, 14, BONE], [24, 206, 150, 12, DIM], [240, 196, 66, 40, col]];
    parts.forEach((pt, k) => {
      const on = ss(k * 0.08, k * 0.08 + 0.07, cyc) * (1 - ss(0.9, 0.98, cyc)); if (on <= 0) return;
      c.globalAlpha = on; c.fillStyle = pt[4]; rr(c, sx + pt[0], sy + pt[1] + (1 - on) * 26, pt[2], pt[3], 6); c.fill();
    });
    c.globalAlpha = 1;
    /* the pointer drags the last part in */
    const dk = parts.length - 1, dOn = ss(dk * 0.08 - 0.06, dk * 0.08 + 0.07, cyc), ax = sx + 240 + 40 + (1 - dOn) * 120, ay = sy + 216 + (1 - dOn) * 50;
    if (cyc < 0.9) { c.fillStyle = BONE; c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, ay + 44); c.lineTo(ax + 12, ay + 33); c.lineTo(ax + 22, ay + 52); c.lineTo(ax + 30, ay + 48); c.lineTo(ax + 20, ay + 29); c.lineTo(ax + 36, ay + 29); c.closePath(); c.fill(); c.stroke(); }
    /* type and colour */
    c.fillStyle = BONE; c.textBaseline = "alphabetic"; c.textAlign = "left"; c.font = "800 128px " + DFONT; c.fillText("Aa", 845, 262);
    const sw4 = [col, ME_GOLD, BONE, "#5fd6ab"], pick = Math.floor(t * 0.8) % 4;
    sw4.forEach((cl, k) => { const cx = 870 + k * 74, cy = 320; c.fillStyle = cl; c.beginPath(); c.arc(cx, cy, 24, 0, 6.283); c.fill(); if (k === pick) { c.strokeStyle = BONE; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, 34, 0, 6.283); c.stroke(); } });
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
  function combination(c, t, col) { /* the conclusion: a combination lock whose code is the three studies. the dials land on them one by one, and with all three in, it opens */
    faceBase(c, col);
    const cyc = (t * 0.32) % 1.5, k = Math.min(3, Math.floor(cyc * 3)), open = k >= 3;
    const lx = 205, ly = 240, lift = open ? -38 : 0;
    c.strokeStyle = BONE; c.lineWidth = 24; c.lineCap = "round"; c.beginPath();
    c.moveTo(lx - 58, ly - 60 + lift); c.lineTo(lx - 58, ly - 110 + lift); c.arc(lx, ly - 110 + lift, 58, Math.PI, 0); c.lineTo(lx + 58, open ? ly - 110 + lift : ly - 60); c.stroke(); c.lineCap = "butt";
    c.fillStyle = open ? "#5fd6ab" : col; rr(c, lx - 100, ly - 64, 200, 150, 18); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(lx, ly, 20, 0, 6.283); c.fill(); c.fillRect(lx - 8, ly, 16, 44);
    c.textBaseline = "middle"; c.textAlign = "center";
    for (let i = 0; i < 3; i++) {
      const x = 410 + i * 252, got = i < k, p = KEY[i];
      c.lineWidth = 4; c.strokeStyle = got ? p.color : col; c.strokeRect(x, 124, 200, 120);
      if (got) { /* landed: the study's Chinese name, in its own colour, and its name under it */
        c.fillStyle = p.color; c.font = "900 64px " + CNFONT; c.fillText(p.cn, x + 100, 166);
        fitFont(c, p.short.toUpperCase(), 700, 26, "monospace", 184); c.fillText(p.short.toUpperCase(), x + 100, 220);
      } else { /* still spinning */
        const s = i * 7 + Math.floor(t * 14), ch = (n: number) => String.fromCharCode(33 + Math.floor(rnd(n) * 90));
        c.font = "800 52px monospace"; c.fillStyle = col; c.globalAlpha = 0.75; c.fillText(ch(s) + ch(s + 3), x + 100, 186); c.globalAlpha = 1;
      }
      if (i < 2) { c.fillStyle = DIM; c.font = "800 44px monospace"; c.fillText("+", x + 226, 186); }
    }
    c.fillStyle = DIM; c.fillRect(410, 266, 704, 10); c.fillStyle = open ? "#5fd6ab" : col; c.fillRect(410, 266, 704 * k / 3, 10);
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

/** sides 2 to 4 of the Me piece. `flip`: the back side is drawn upside down, so it reads the right way up once the
    piece has turned it to the front */
export function drawMeSide(cv: HTMLCanvasElement, k: number, flip: boolean) {
  const c = cv.getContext("2d")!, S = ME_SIDES[k], W = FW, H = FH;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (flip) { c.translate(W, H); c.rotate(Math.PI); }
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  c.strokeStyle = ME_GOLD; c.globalAlpha = 0.55; c.lineWidth = 3; c.strokeRect(14, 14, W - 28, H - 28); c.globalAlpha = 1;
  c.textBaseline = "middle"; c.textAlign = "left";
  const ls = (c as unknown as { letterSpacing?: string });
  c.fillStyle = ME_GOLD; c.font = "900 40px " + CNFONT; c.fillText(CN[5], 52, 74);
  c.font = "500 26px monospace"; ls.letterSpacing = "5px"; c.fillText(S.label.toUpperCase(), 110, 76);
  c.textAlign = "right"; c.fillStyle = DIM; c.fillText((k + 1) + " / 4", W - 52, 76); c.textAlign = "left"; ls.letterSpacing = "0px";
  if (S.stats) {
    S.stats.forEach((st, n) => {
      const x = 52 + n * 560; c.fillStyle = BONE; fitFont(c, st[0], 800, 170, DFONT, 500); c.fillText(st[0], x, 216);
      c.fillStyle = ME_GOLD; c.font = "500 28px monospace"; ls.letterSpacing = "4px"; c.fillText(st[1].toUpperCase(), x + 4, 326); ls.letterSpacing = "0px";
    });
  } else if ((S.big || "").length <= 3) { /* a short value, like 4+: very large on the left, its words beside it */
    c.fillStyle = BONE; c.font = "800 230px " + DFONT; const bw = c.measureText(S.big || "").width; c.fillText(S.big || "", 44, 236);
    if (S.small) { c.fillStyle = "#b9b3c9"; c.font = "500 58px " + DFONT; c.fillText(S.small, 44 + bw + 50, 250); }
  } else {
    c.fillStyle = BONE; fitFont(c, S.big || "", 800, 150, DFONT, W - 110); c.fillText(S.big || "", 48, 200);
    if (S.small) { c.fillStyle = "#b9b3c9"; c.font = "500 46px " + DFONT; c.fillText(S.small, 52, 314); }
  }
  c.restore();
}

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
