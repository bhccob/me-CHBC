/* the six pieces: geometry, materials, the six slips of the Me piece, and its glow */
import * as THREE from "three";
import { PIECES, ME_SLIPS } from "../content";
import { DRAW, FW, FH, drawBand, drawCap, patternTex, DFONT } from "./faces";
import type { Rig } from "./rig";

/* assembled poses: [position, long axis, face normal] */
const POSES = [
  [[0, 0, 1], [1, 0, 0], [0, 0, 1]],
  [[1, 0, 0], [0, 1, 0], [1, 0, 0]],
  [[0, 1, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 0, -1], [1, 0, 0], [0, 0, -1]],
  [[-1, 0, 0], [0, 1, 0], [-1, 0, 0]],
  [[0, -1, 0], [0, 0, 1], [0, -1, 0]],
];
export const ME = 5;
export const ME_GOLD = "#f2cf7a";

export interface PieceRig {
  mesh: THREE.Mesh;
  /** the plain patterned side (used by the slips) */
  plain: THREE.MeshStandardMaterial;
  band: THREE.MeshStandardMaterial;
  cap: THREE.MeshStandardMaterial;
  face: THREE.MeshStandardMaterial;
  edges: THREE.LineBasicMaterial;
  bcv: HTMLCanvasElement; ccv: HTMLCanvasElement; btex: THREE.CanvasTexture; ctex: THREE.CanvasTexture;
  /** the drawn face */
  ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture;
  col: string;
  /** colour of the edges and the names (gold on the Me piece) */
  ecol: string;
  /** where it sits in the finished lock */
  aPos: THREE.Vector3; axis: THREE.Vector3; aQuat: THREE.Quaternion;
}
export interface Slat { mesh: THREE.Mesh; lm: THREE.MeshBasicMaterial; em: THREE.LineBasicMaterial; cvs: HTMLCanvasElement; tex: THREE.CanvasTexture; line: number; y: number }
/** the slip being read, grown into a taller block of the piece that carries its own text. there are two: a low wide
    one for wide screens (label left, sentence right) and a tall one for phones (label on top, sentence under it) */
export interface MeCard {
  mesh: THREE.Mesh; em: THREE.LineBasicMaterial; cvs: HTMLCanvasElement; tex: THREE.CanvasTexture; shown: number;
  /** the block's full height, in the piece's own units */
  h: number;
  /** how much of that height the line now on it needs (0..1). the writing is centred, so a shorter card shows it all */
  frac: number;
}
export interface Aura { group: THREE.Group; light: THREE.PointLight | null; shells: THREE.Sprite[]; sparks: THREE.Mesh[] }

function srgb(cv: HTMLCanvasElement) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export function buildPieces(rig: Rig, built: (label: string) => void) {
  const geo = new THREE.BoxGeometry(6, 2, 2), edgeGeo = new THREE.EdgesGeometry(geo);
  const pieces: PieceRig[] = POSES.map((P, i) => {
    const col = PIECES[i].color, isMe = i === ME, ecol = isMe ? ME_GOLD : col, pat = patternTex(ecol);
    const plain = new THREE.MeshStandardMaterial({ color: isMe ? 0x4a4052 : 0x17151f, metalness: isMe ? 0.55 : 0.3, roughness: isMe ? 0.45 : 0.7, emissive: 0xffffff, emissiveMap: pat, emissiveIntensity: 0.5 });
    const bcv = document.createElement("canvas"); bcv.width = 1200; bcv.height = 400;
    const ccv = document.createElement("canvas"); ccv.width = ccv.height = 400;
    const btex = srgb(bcv), ctex = srgb(ccv);
    const band = plain.clone(); band.emissiveMap = btex; band.emissiveIntensity = 0.75;
    const cap = plain.clone(); cap.emissiveMap = ctex; cap.emissiveIntensity = 0.75;
    const cv = document.createElement("canvas"); cv.width = FW; cv.height = FH; const ctx = cv.getContext("2d")!;
    const tex = srgb(cv);
    const face = new THREE.MeshStandardMaterial({ color: 0x0c0b15, metalness: 0, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, [cap, cap, band, band, face, band]);
    const edges = new THREE.LineBasicMaterial({ color: new THREE.Color(ecol), transparent: true, opacity: 0.85 });
    mesh.add(new THREE.LineSegments(edgeGeo, edges)); rig.scene.add(mesh);
    if (isMe) { const e2 = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(ecol), transparent: true, opacity: 0.45 })); e2.scale.setScalar(1.035); mesh.add(e2); }
    const X = new THREE.Vector3(P[1][0], P[1][1], P[1][2]), Z = new THREE.Vector3(P[2][0], P[2][1], P[2][2]), Y = new THREE.Vector3().crossVectors(Z, X);
    const aQuat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    DRAW[i](ctx, 1.5, col, 1); tex.needsUpdate = true;
    built("Piece " + (i + 1) + " of 6 built");
    return { mesh, plain, band, cap, face, edges, bcv, ccv, btex, ctex, ctx, tex, col, ecol, aPos: new THREE.Vector3(P[0][0], P[0][1], P[0][2]), axis: X, aQuat };
  });

  /* the Me piece, cut into six slips that can spread apart */
  const slatGroup = new THREE.Group(); slatGroup.visible = false; rig.scene.add(slatGroup);
  const slats: Slat[] = [];
  const me = pieces[ME];
  for (let k = 0; k < 6; k++) {
    const g = new THREE.BoxGeometry(6, 1 / 3, 2), uv = g.attributes.uv;
    for (let v = 16; v < 20; v++) uv.setY(v, (k + uv.getY(v)) / 6); // each slip keeps its strip of the piece's face
    const m = new THREE.Mesh(g, [me.plain, me.plain, me.plain, me.plain, me.face, me.plain]);
    const cvs = document.createElement("canvas"); cvs.width = 1440; cvs.height = 80;
    const tex = srgb(cvs);
    const lm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(6, 1 / 3), lm); lab.position.z = 1.004; m.add(lab);
    const em = new THREE.LineBasicMaterial({ color: 0xf2cf7a, transparent: true, opacity: 0 });
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), em));
    slatGroup.add(m); slats.push({ mesh: m, lm, em, cvs, tex, line: 5 - k, y: (k - 2.5) / 3 });
  }

  /* the card. a real block of the piece, not a floating sheet: the slips' width and depth, the piece's own side
     material on five faces, the same gold edge lines. its front face is the text of the line being read */
  const makeCard = (h: number, cw: number, ch: number): MeCard => {
    const cvs = document.createElement("canvas"); cvs.width = cw; cvs.height = ch;
    const tex = srgb(cvs), g = new THREE.BoxGeometry(6, h, 2);
    const mesh = new THREE.Mesh(g, [me.plain, me.plain, me.plain, me.plain, new THREE.MeshBasicMaterial({ map: tex }), me.plain]);
    const em = new THREE.LineBasicMaterial({ color: 0xf2cf7a, transparent: true, opacity: 0 });
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), em)); mesh.visible = false; slatGroup.add(mesh);
    return { mesh, em, cvs, tex, shown: -1, h, frac: 1 };
  };
  const meCard = makeCard(1.05, 1800, 300);
  /* a phone is narrow: the wide card's sentence would be about 9 px high there. the phone's card is as wide as the
     piece and up to 4.2 high, and takes only the height its line needs */
  const meCardTall = makeCard(4.2, 1200, 840);
  const wrap = (c: CanvasRenderingContext2D, txt: string, maxW: number) => {
    const out: string[] = []; let line = "";
    txt.split(" ").forEach((w) => { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line); return out;
  };
  /** line number in gold at the top left, the label large on the left, a thin gold rule, the sentence wrapped on the right */
  function drawMeCard(card: MeCard, k: number) {
    if (card === meCardTall) { drawTallCard(k); return; }
    const cardCv = card.cvs, cardTex = card.tex;
    const c = cardCv.getContext("2d")!, W = 1800, H = 300, lab = ME_SLIPS[k][0];
    c.fillStyle = "#0c0b15"; c.fillRect(0, 0, W, H);
    c.textBaseline = "middle"; c.textAlign = "left";
    c.fillStyle = "#f2cf7a"; c.font = "500 24px monospace"; c.fillText("0" + (k + 1) + " / 06", 44, 62);
    let fs = 82; c.font = "800 " + fs + "px " + DFONT;
    while (fs > 40 && c.measureText(lab).width > 470) { fs -= 4; c.font = "800 " + fs + "px " + DFONT; } // the label shrinks until it fits
    c.fillStyle = "#efe8d6"; c.fillText(lab, 44, 168);
    c.fillStyle = "rgba(242,207,122,.6)"; c.fillRect(548, 48, 3, H - 96);
    let ts = 46, lines: string[];
    do { c.font = "500 " + ts + "px " + DFONT; lines = wrap(c, ME_SLIPS[k][1], 1170); ts -= 3; } while (lines.length * (ts + 13) > H - 50 && ts > 26); // the sentence shrinks until it fits
    const lh = ts + 15, y0 = H / 2 - (lines.length - 1) * lh / 2;
    c.fillStyle = "#efe8d6"; lines.forEach((l, n) => { c.fillText(l, 588, y0 + n * lh); });
    cardTex.needsUpdate = true; meCard.shown = k;
  }
  /** the phone's card: line number in gold, the label under it, a thin gold rule, the sentence wrapped across the
      full width. everything is centred up and down, and `frac` says how much of the card it fills */
  function drawTallCard(k: number) {
    const card = meCardTall, c = card.cvs.getContext("2d")!, W = 1200, H = 840, PAD = 56, lab = ME_SLIPS[k][0];
    c.fillStyle = "#0c0b15"; c.fillRect(0, 0, W, H);
    c.textBaseline = "middle"; c.textAlign = "left";
    let ts = 60, lines: string[], lh = 0, total = 0;
    do { c.font = "500 " + ts + "px " + DFONT; lines = wrap(c, ME_SLIPS[k][1], W - 2 * PAD); lh = ts + 30; total = 244 + lines.length * lh; ts -= 3; } while (total > H - 2 * PAD && ts > 30); // the sentence shrinks until it fits
    ts += 3;
    const y = (H - total) / 2;
    c.fillStyle = "#f2cf7a"; c.font = "500 32px monospace"; c.fillText("0" + (k + 1) + " / 06", PAD, y + 20);
    let fs = 88; c.font = "800 " + fs + "px " + DFONT;
    while (fs > 44 && c.measureText(lab).width > W - 2 * PAD) { fs -= 4; c.font = "800 " + fs + "px " + DFONT; }
    c.fillStyle = "#efe8d6"; c.fillText(lab, PAD, y + 112);
    c.fillStyle = "rgba(242,207,122,.6)"; c.fillRect(PAD, y + 186, W - 2 * PAD, 3);
    c.fillStyle = "#efe8d6"; c.font = "500 " + ts + "px " + DFONT;
    lines.forEach((l, n) => { c.fillText(l, PAD, y + 244 + lh * (n + 0.5)); });
    card.frac = Math.min(1, (total + 2 * PAD) / H);
    card.tex.needsUpdate = true; card.shown = k;
  }

  /* a glow made only of soft light: round blurs strung along the length of the Me piece. each one always faces you and
     fades to nothing at its rim, so there is no edge to see, but together they follow the piece as it turns */
  const aura: Aura = { group: new THREE.Group(), light: null, shells: [], sparks: [] };
  rig.scene.add(aura.group);
  {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256; const c = cv.getContext("2d")!, g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(242,207,122,.6)"); g.addColorStop(0.22, "rgba(242,207,122,.26)"); g.addColorStop(0.55, "rgba(242,207,122,.07)"); g.addColorStop(1, "rgba(242,207,122,0)"); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    const gtex = new THREE.CanvasTexture(cv);
    for (let n = 0; n < 7; n++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.x = (n - 3) * 0.95; sp.scale.set(5.2, 5.2, 1); aura.group.add(sp); aura.shells.push(sp);
    }
    if (!rig.lite) { aura.light = new THREE.PointLight(0xf2cf7a, 0, 30, 1); aura.light.position.z = 2.5; aura.group.add(aura.light); } // light mode: the soft blurs only, no extra lamp
    const sm = new THREE.MeshBasicMaterial({ color: 0xf2cf7a });
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), sm); aura.group.add(s); aura.sparks.push(s); }
  }

  function drawSlats() {
    slats.forEach((sl) => {
      const c = sl.cvs.getContext("2d")!; c.fillStyle = "#0c0b15"; c.fillRect(0, 0, 1440, 80);
      c.textBaseline = "middle"; c.textAlign = "left"; c.fillStyle = "#efe8d6"; c.font = "800 50px " + DFONT; c.fillText(ME_SLIPS[sl.line][0], 28, 42);
      c.textAlign = "right"; c.fillStyle = "#8d88a3"; c.font = "500 22px monospace"; c.fillText("0" + (sl.line + 1) + " / 06", 1412, 42);
      sl.tex.needsUpdate = true;
    });
  }
  /** (re)draws everything with words on it. called again once the fonts are in */
  function drawNames() {
    pieces.forEach((pc, i) => {
      drawBand(pc.bcv, i, pc.ecol); drawCap(pc.ccv, i, pc.ecol); pc.btex.needsUpdate = pc.ctex.needsUpdate = true;
      if (i < ME) { DRAW[i](pc.ctx, 1.5, pc.col, 1); pc.tex.needsUpdate = true; }
    });
    drawSlats(); meCard.shown = meCardTall.shown = -1;
  }
  drawNames();
  return { pieces, slats, slatGroup, aura, meCard, meCardTall, drawMeCard, drawNames };
}
