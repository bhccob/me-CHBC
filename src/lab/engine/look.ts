import {
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  FogExp2,
  HemisphereLight,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * LAB ONLY (throwaway). The one world every concept is built in: one material palette, one light rig, one room the
 * metal reflects. Colours come from the frozen brain's tokens (docs/redesign-boundary.md): the dark purple ground, one
 * gold, ink, and the purple steps.
 */

export const TOKENS = {
  night: '#130724',
  deep: '#0c0515',
  black: '#07050b',
  pcb: '#190624',
  nebula: '#331846',
  gold: '#e6b84a',
  ink: '#f2efe8',
  dim: '#9789bb',
  lilac: '#b8aad8',
} as const;

/** Gold that glows: above the bloom's threshold, in linear light. */
export const GOLD_HOT = new Color(2.6, 1.55, 0.5);
export const GOLD_WARM = new Color(1.0, 0.7, 0.28);

/** A canvas drawn once (or again on demand) as a texture. */
export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** The dark room the metal reflects: a warm softbox up left, a long strip right, a violet floor card. */
export function studioEnvironment(renderer: WebGLRenderer): Texture {
  const room = new Scene();
  const parts: Mesh[] = [new Mesh(new SphereGeometry(20, 16, 12), new MeshBasicMaterial({ color: new Color(0.01, 0.008, 0.016), side: BackSide }))];
  const card = (x: number, y: number, z: number, w: number, h: number, c: [number, number, number]): void => {
    const mesh = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(c[0], c[1], c[2]), side: DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    parts.push(mesh);
  };
  card(-9, 11, 6, 9, 6, [3.2, 2.7, 2.1]);
  card(13, 3, -2, 1.2, 14, [1.6, 1.25, 0.8]);
  card(0, -12, 0, 16, 16, [0.16, 0.08, 0.26]);
  card(-6, 2, -14, 10, 4, [0.35, 0.3, 0.55]);
  room.add(...parts);
  const generator = new PMREMGenerator(renderer);
  const { texture } = generator.fromScene(room, 0.04);
  generator.dispose();
  for (const part of parts) {
    part.geometry.dispose();
    (part.material as MeshBasicMaterial).dispose();
  }
  return texture;
}

export interface Rig {
  key: SpotLight;
  rim: SpotLight;
  fill: HemisphereLight;
  /** Brings the whole rig up from dark (the lamp comes on), 0 to 1. */
  level(k: number): void;
}

/** One warm key up left, a violet rim behind right, a purple bounce. Every concept uses this rig. */
export function studioLights(scene: Scene, target: Object3D, key = { x: -6, y: 8, z: 6, intensity: 520 }): Rig {
  const keyLight = new SpotLight(0xffdcb0, key.intensity, 0, 0.52, 0.8, 2);
  keyLight.position.set(key.x, key.y, key.z);
  keyLight.target = target;
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.radius = 6;
  const rim = new SpotLight(0x9a86ff, 420, 0, 0.7, 0.9, 2);
  rim.position.set(7, 5, -7);
  rim.target = target;
  const fill = new HemisphereLight(0x2a1640, 0x07020b, 0.28);
  scene.add(keyLight, rim, fill, target);
  const base = { key: keyLight.intensity, rim: rim.intensity, fill: fill.intensity };
  return {
    key: keyLight,
    rim,
    fill,
    level(k: number) {
      keyLight.intensity = base.key * k;
      rim.intensity = base.rim * (0.25 + 0.75 * k);
      fill.intensity = base.fill * (0.4 + 0.6 * k);
    },
  };
}

/** The ground everything stands in: near-black with the site's purple in it, and fog that takes the far side. */
export function studioScene(renderer: WebGLRenderer, fogDensity = 0.045): Scene {
  const scene = new Scene();
  scene.background = new Color(TOKENS.black);
  scene.fog = new FogExp2(TOKENS.black, fogDensity);
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.42;
  return scene;
}

/** An ESD bench mat: dark, matte, with a faint grid. */
function matTexture(): CanvasTexture {
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#16121c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(184,170,216,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64 + 0.5, 0);
      ctx.lineTo(i * 64 + 0.5, h);
      ctx.moveTo(0, i * 64 + 0.5);
      ctx.lineTo(w, i * 64 + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(184,170,216,0.035)';
    for (let i = 0; i < 32; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 16 + 0.5, 0);
      ctx.lineTo(i * 16 + 0.5, h);
      ctx.moveTo(0, i * 16 + 0.5);
      ctx.lineTo(w, i * 16 + 0.5);
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** The one palette of materials. Made once per concept, disposed with it. */
export function palette() {
  const mat = matTexture();
  mat.repeat.set(9, 4);
  const made = {
    /** Anodised dark aluminium: housings, the drawer, the monitor. */
    metal: new MeshPhysicalMaterial({ color: '#2b2633', metalness: 0.85, roughness: 0.36, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    /** Bare aluminium: links, rails, the gantry. */
    alu: new MeshPhysicalMaterial({ color: '#9a94a2', metalness: 1, roughness: 0.28 }),
    /** Black acetal and rubber: feet, cables, grips. */
    black: new MeshStandardMaterial({ color: '#100d14', roughness: 0.62, metalness: 0.1 }),
    copper: new MeshPhysicalMaterial({ color: '#c17a43', metalness: 1, roughness: 0.3 }),
    tin: new MeshPhysicalMaterial({ color: '#cfc9d8', metalness: 1, roughness: 0.32 }),
    /** Solder mask: the site's own PCB purple. */
    board: new MeshPhysicalMaterial({ color: TOKENS.pcb, roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    /** A chip's moulded package. */
    chip: new MeshStandardMaterial({ color: '#141016', roughness: 0.58, metalness: 0.05 }),
    /** Smoked glass, only on what floats. */
    glass: new MeshPhysicalMaterial({ color: '#b8aad8', metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }),
    bench: new MeshStandardMaterial({ map: mat, roughness: 0.86, metalness: 0 }),
    /** The far wall: there to catch a little light, so the dark has depth. */
    wall: new MeshStandardMaterial({ color: '#0d0912', roughness: 0.95, metalness: 0 }),
    gold: new MeshBasicMaterial({ color: GOLD_HOT.clone() }),
    led: new MeshBasicMaterial({ color: new Color(0.25, 0.05, 0.05) }),
  };
  return {
    ...made,
    dispose() {
      mat.dispose();
      for (const material of Object.values(made)) material.dispose();
    },
  };
}

export type Palette = ReturnType<typeof palette>;
