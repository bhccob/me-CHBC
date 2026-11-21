/* the six pieces: geometry, materials, the four written sides of the Me piece, and its glow */
import * as THREE from "three";
import { PIECES } from "../content";
import { DRAW, FW, FH, drawBand, drawCap, patternTex, drawMeSide } from "./faces";
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
/** the Me piece's own materials while its chapter is on screen: sides 2, 3 and 4 written on its top, back and bottom.
    the scroll turns the piece about its long axis, a quarter turn per stop, so each comes to the front in turn */
export interface MeSides { mats: THREE.Material[]; plain: THREE.Material[]; draw(): void }
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

  /* the Me piece's written sides. BoxGeometry's material order is +x, -x, +y (top), -y (bottom), +z (front), -z (back).
     a quarter turn about the long axis brings the top to the front, then the back, then the bottom */
  const me = pieces[ME];
  const sideCv = [0, 1, 2].map(() => { const cv = document.createElement("canvas"); cv.width = FW; cv.height = FH; return cv; });
  const sideMat = sideCv.map((cv) => new THREE.MeshStandardMaterial({ color: 0x0c0b15, metalness: 0, roughness: 0.9, emissive: 0xffffff, emissiveMap: srgb(cv), emissiveIntensity: 0.5 }));
  const meSides: MeSides = {
    plain: me.mesh.material as THREE.Material[],
    mats: [me.cap, me.cap, sideMat[0], sideMat[2], me.face, sideMat[1]],
    draw() { sideCv.forEach((cv, n) => { drawMeSide(cv, n + 1, n === 1); (sideMat[n].emissiveMap as THREE.Texture).needsUpdate = true; }); },
  };
  meSides.draw();

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

  /** (re)draws everything with words on it. called again once the fonts are in */
  function drawNames() {
    pieces.forEach((pc, i) => {
      drawBand(pc.bcv, i, pc.ecol); drawCap(pc.ccv, i, pc.ecol); pc.btex.needsUpdate = pc.ctex.needsUpdate = true;
      if (i < ME) { DRAW[i](pc.ctx, 1.5, pc.col, 1); pc.tex.needsUpdate = true; }
    });
    meSides.draw();
  }
  drawNames();
  return { pieces, meSides, aura, drawNames };
}
