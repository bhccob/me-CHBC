import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoBlending,
  Path,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  Shape,
  Vector3,
  BackSide,
} from 'three';
import { canvasTexture, GOLD_HOT, type Palette } from './look';

/**
 * LAB ONLY (throwaway). The BC-2006 part: one chip every concept ends on. Its lid slides open onto an octagonal port;
 * the port's floor writes no alpha, so the stage's iris window shows the real tunnel through it (the same way the
 * machine's iris does on the live site, IrisWindow.ts). Chip-local units: the package is 1 wide, its top at `TOP`.
 */

export const TOP = 0.12;
/** The port's inradius: its flat sides stand this far from the middle. */
export const PORT_IN = 0.25;
const PORT_OUT = PORT_IN / Math.cos(Math.PI / 8);
const FLOOR = 0.022;

function octagon(radius: number): [number, number][] {
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return [Math.cos(a) * radius, Math.sin(a) * radius] as [number, number];
  });
}

const MASK_VERTEX = /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** Glow while shut; from the window on, it fades to nothing and the tunnel shows through (alpha 0). */
const MASK_FRAGMENT = /* glsl */ `
uniform vec3 uGlow;
uniform float uK;
void main() { gl_FragColor = vec4(uGlow * (1.0 - uK), 1.0 - uK); }
`;

export class Chip {
  readonly group = new Group();
  private readonly left: Mesh;
  private readonly right: Mesh;
  private readonly slit: MeshBasicMaterial;
  private readonly sleeve: MeshStandardMaterial;
  private readonly mask: ShaderMaterial;
  private readonly light = new PointLight(0xffc56b, 0, 2.2, 2);
  private readonly slitMesh: Mesh;
  private opened = 0;
  private readonly owned: { dispose(): void }[] = [];

  constructor(p: Palette) {
    const body = new Shape();
    const h = 0.5, r = 0.05;
    body.moveTo(-h + r, -h);
    body.lineTo(h - r, -h);
    body.quadraticCurveTo(h, -h, h, -h + r);
    body.lineTo(h, h - r);
    body.quadraticCurveTo(h, h, h - r, h);
    body.lineTo(-h + r, h);
    body.quadraticCurveTo(-h, h, -h, h - r);
    body.lineTo(-h, -h + r);
    body.quadraticCurveTo(-h, -h, -h + r, -h);
    const hole = new Path();
    octagon(PORT_OUT).forEach(([x, y], i) => (i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
    hole.closePath();
    body.holes.push(hole);
    const bodyGeometry = new ExtrudeGeometry(body, { depth: TOP, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 });
    bodyGeometry.rotateX(-Math.PI / 2);
    const package_ = new Mesh(bodyGeometry, p.chip);
    package_.castShadow = true;
    package_.receiveShadow = true;
    this.group.add(package_);

    // The port's wall: lit from inside once the signal is there.
    this.sleeve = new MeshStandardMaterial({ color: '#1a1420', metalness: 0.6, roughness: 0.4, emissive: new Color(1, 0.62, 0.22), emissiveIntensity: 0, side: BackSide });
    const sleeve = new Mesh(new CylinderGeometry(PORT_OUT * 0.998, PORT_OUT * 0.998, TOP - FLOOR, 8, 1, true), this.sleeve);
    sleeve.rotation.y = Math.PI / 8;
    sleeve.position.y = FLOOR + (TOP - FLOOR) / 2;
    this.group.add(sleeve);

    // The floor: the seam. It glows while the lid is shut and writes no alpha once the window is on.
    this.mask = new ShaderMaterial({ uniforms: { uGlow: { value: GOLD_HOT.clone().multiplyScalar(0) }, uK: { value: 0 } }, vertexShader: MASK_VERTEX, fragmentShader: MASK_FRAGMENT, blending: NoBlending, fog: false });
    const floor = new Mesh(new CircleGeometry(PORT_OUT * 1.001, 8), this.mask);
    floor.rotation.x = -Math.PI / 2;
    floor.rotation.z = Math.PI / 8;
    floor.position.y = FLOOR;
    floor.renderOrder = 10;
    this.group.add(floor);

    // The lid: two leaves that slide apart, with a gold slit where they meet.
    const leaf = new BoxGeometry(PORT_OUT + 0.05, 0.014, 2 * (PORT_OUT + 0.05));
    this.left = new Mesh(leaf, p.metal);
    this.right = new Mesh(leaf, p.metal);
    for (const m of [this.left, this.right]) {
      m.castShadow = true;
      m.position.y = TOP + 0.016;
      this.group.add(m);
    }
    this.slit = new MeshBasicMaterial({ color: GOLD_HOT.clone().multiplyScalar(0) });
    const slit = new Mesh(new BoxGeometry(0.006, 0.004, 2 * PORT_OUT), this.slit);
    slit.position.y = TOP + 0.024;
    this.slitMesh = slit;
    this.group.add(slit);
    this.owned.push(leaf, slit.geometry, this.slit, this.sleeve, sleeve.geometry, this.mask, floor.geometry, bodyGeometry);

    // The laser-etched mark along the near edge, and pin one.
    const mark = canvasTexture(1024, 160, (ctx, w, hh) => {
      ctx.clearRect(0, 0, w, hh);
      ctx.fillStyle = 'rgba(242,239,232,0.6)';
      ctx.font = '500 92px "IBM Plex Mono"';
      ctx.textBaseline = 'middle';
      ctx.fillText('BC-2006', 24, hh / 2);
      ctx.font = '500 52px "IBM Plex Mono"';
      ctx.textAlign = 'right';
      ctx.fillText('R2 · 2611', w - 24, hh / 2 + 6);
    });
    const markMaterial = new MeshStandardMaterial({ map: mark, transparent: true, roughness: 0.4, depthWrite: false });
    const decal = new Mesh(new PlaneGeometry(0.86, 0.134), markMaterial);
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, TOP + 0.0095, 0.395);
    this.group.add(decal);
    const dot = new Mesh(new CircleGeometry(0.03, 24), new MeshStandardMaterial({ color: '#2a2430', roughness: 0.9 }));
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(-0.4, TOP + 0.0095, -0.4);
    this.group.add(dot);
    this.owned.push(mark, markMaterial, decal.geometry, dot.geometry, dot.material as MeshStandardMaterial);

    // Gull-wing pins, nine a side.
    const pin = new BoxGeometry(0.034, 0.016, 0.1);
    const pins = new InstancedMesh(pin, p.tin, 36);
    const m = new Matrix4();
    let n = 0;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 9; i++) {
        const along = -0.36 + (i * 0.72) / 8;
        m.makeRotationY((side * Math.PI) / 2);
        m.multiply(new Matrix4().makeTranslation(along, 0.012, 0.54));
        pins.setMatrixAt(n++, m);
      }
    }
    pins.castShadow = true;
    this.group.add(pins);
    this.owned.push(pin);

    this.light.position.set(0, TOP + 0.35, 0);
    this.group.add(this.light);
  }

  /** The lid: 0 shut, 1 open. */
  open(k: number): void {
    const off = (PORT_OUT + 0.05) / 2 + k * (PORT_OUT + 0.08);
    this.left.position.x = -off;
    this.right.position.x = off;
    this.opened = k;
    this.slitMesh.visible = k < 0.02;
  }

  /** The signal inside: the slit, the port's wall and the light above it. */
  glow(k: number): void {
    this.slit.color.copy(GOLD_HOT).multiplyScalar(0.8 * k);
    this.sleeve.emissiveIntensity = 0.8 * k * (0.3 + 0.7 * this.opened);
    this.mask.uniforms.uGlow.value.copy(GOLD_HOT).multiplyScalar(0.9 * k);
    this.light.intensity = 0.05 * k;
  }

  /** The window: 0 the port's floor glows, 1 the tunnel shows through it. */
  window(k: number): void {
    this.mask.uniforms.uK.value = k;
  }

  /** The middle of the port's floor, in world space. */
  portCenter(out: Vector3): Vector3 {
    this.group.updateMatrixWorld();
    return this.group.localToWorld(out.set(0, FLOOR, 0));
  }

  /** A point on the port's rim, in world space. */
  portEdge(out: Vector3): Vector3 {
    this.group.updateMatrixWorld();
    return this.group.localToWorld(out.set(PORT_IN, TOP, 0));
  }

  dispose(): void {
    for (const thing of this.owned) thing.dispose();
  }
}
