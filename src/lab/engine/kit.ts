import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoBlending,
  type Object3D,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  type Side,
  SRGBColorSpace,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ease, mix } from '~/journey/math';
import { canvasTexture, studioEnvironment, studioLights, type Rig as LightRig } from './look';

/**
 * LAB ONLY (throwaway). The few things every new subject is built from: one material palette (the robot's: dark
 * anodised metal, gold, PCB purple), a studio without a background (the page shows through), and the portal: a disc that
 * glows until the window opens, then lets the real tunnel through.
 */

export function kitMaterials() {
  const traces = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#190624';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c99a45';
    ctx.lineCap = 'round';
    let s = 3;
    const rnd = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      let x = w / 2 + (rnd() - 0.5) * 60, y = h / 2 + (rnd() - 0.5) * 60;
      ctx.lineWidth = 2 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const dir = Math.floor(rnd() * 8) * (Math.PI / 4);
        const len = 30 + rnd() * 110;
        x += Math.cos(dir) * len;
        y += Math.sin(dir) * len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#e6b84a';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  traces.colorSpace = SRGBColorSpace;
  const made = {
    metal: new MeshPhysicalMaterial({ color: '#1e1a24', metalness: 0.82, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    dark: new MeshStandardMaterial({ color: '#0f0d13', metalness: 0.4, roughness: 0.55 }),
    gold: new MeshPhysicalMaterial({ color: '#c99a45', metalness: 1, roughness: 0.26 }),
    steel: new MeshPhysicalMaterial({ color: '#8f8a98', metalness: 1, roughness: 0.3 }),
    pcb: new MeshPhysicalMaterial({ map: traces, roughness: 0.45, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: new Color(1, 0.66, 0.25), emissiveMap: traces, emissiveIntensity: 0 }),
    chip: new MeshStandardMaterial({ color: '#141016', roughness: 0.55, metalness: 0.1 }),
    led: new MeshStandardMaterial({ color: '#2a1d10', emissive: new Color(1, 0.7, 0.3), emissiveIntensity: 0 }),
    glass: new MeshPhysicalMaterial({ color: '#1b1626', metalness: 0.2, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.55 }),
    white: new MeshPhysicalMaterial({ color: '#d9d4cf', metalness: 0.05, roughness: 0.4, clearcoat: 0.5 }),
  };
  return {
    ...made,
    dispose() {
      traces.dispose();
      for (const material of Object.values(made)) material.dispose();
    },
  };
}

export type Kit = ReturnType<typeof kitMaterials>;

/** A mesh, shadows on. */
export function part(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export const box = (w: number, h: number, d: number, r = 0.012): BufferGeometry => (r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new BoxGeometry(w, h, d));
export const cyl = (rt: number, rb: number, h: number, seg = 32): BufferGeometry => new CylinderGeometry(rt, rb, h, seg);

/** A studio with no background: the page's dark shows through, the metal reflects a dark room with warm cards. */
export function studio(renderer: WebGLRenderer, key: { x: number; y: number; z: number; intensity: number }, target = new Vector3()): { scene: Scene; lights: LightRig } {
  const scene = new Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.7;
  const aim = new Group();
  aim.position.copy(target);
  const lights = studioLights(scene, aim, key);
  // Y is up here: the rig's key comes from up left, the rim from behind.
  lights.rim.position.set(4, 3.5, -5);
  lights.key.shadow.camera.near = 0.5;
  lights.key.shadow.camera.far = 40;
  return { scene, lights };
}

/** A floor that only catches the shadow, so the object stands somewhere without a visible floor. */
export function shadowFloor(y: number, size = 20, opacity = 0.45): Mesh {
  const floor = new Mesh(new PlaneGeometry(size, size), new ShadowMaterial({ opacity }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  floor.receiveShadow = true;
  return floor;
}

const PORTAL_VERTEX = /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** Glow while shut; once the window is on it fades to nothing and the tunnel shows through (alpha 0). */
const PORTAL_FRAGMENT = /* glsl */ `
uniform vec3 uGlow;
uniform float uK;
void main() { gl_FragColor = vec4(uGlow * (1.0 - uK), 1.0 - uK); }
`;

/** A surface the tunnel shows through: `glow` lights it (engine fire, a rotor's blur), `open` hands it to the tunnel. */
export class Portal {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(geometry: BufferGeometry, side: Side = DoubleSide) {
    this.material = new ShaderMaterial({ uniforms: { uGlow: { value: new Color(0, 0, 0) }, uK: { value: 0 } }, vertexShader: PORTAL_VERTEX, fragmentShader: PORTAL_FRAGMENT, blending: NoBlending, side, fog: false });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.renderOrder = 10;
  }

  set(glow: number, open: number, color: [number, number, number] = [2.6, 1.55, 0.5]): void {
    this.material.uniforms.uGlow.value.setRGB(color[0] * glow, color[1] * glow, color[2] * glow);
    this.material.uniforms.uK.value = open;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/** A study's parts arriving: hidden before `at`, sliding in from `from` (an offset) over `span` frames, eased out. */
export function arrive(object: Object3D, home: Vector3, from: Vector3, f: number, at: number, span = 20): void {
  object.visible = f >= at;
  const k = 1 - ease(f, at, at + span);
  object.position.set(home.x + from.x * k, home.y + from.y * k, home.z + from.z * k);
}

export { mix };
