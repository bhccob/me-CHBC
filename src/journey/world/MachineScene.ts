import { Color, LinearFilter, type Material, type Mesh, type MeshStandardMaterial, Object3D, PerspectiveCamera, RectAreaLight, Scene, ShaderMaterial, ShadowMaterial, SpotLight, SRGBColorSpace, Texture, TextureLoader, Uniform, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { cameraPose, fitProjection, fovFor, pageFit } from '../machine/camera';
import { machinePose } from '../machine/choreography';
import { PART_NAMES, type PartName } from '../machine/parts';
import { AREA_LIGHTS, areaIntensity, GLOW_SCALE, LIGHT_SCALE, type LightName, lowLightLevel, shadowOpacity, sleeveGlow } from './looks';

/** What the model's parts and lights are, once it has loaded. */
const MODEL_URL = '/models/machine.glb';

/** The share of the key light that comes from the spot, the only light that casts a shadow. */
const SHADOW_SHARE = 0.25;

/**
 * The machine, live: the Blender model with `machinePose` and `cameraPose` applied at every frame. Its background is empty,
 * so the page's paper and sheets show behind it.
 */
export class MachineScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(30, 16 / 9, 0.05, 400);
  private readonly parts = new Map<PartName, Object3D>();
  private readonly glow = new Map<string, MeshStandardMaterial>();
  private readonly lights = new Map<LightName, RectAreaLight>();
  private readonly spot = new SpotLight(0xfff5e6, 0, 0, 0.62, 0.9, 1.4);
  private readonly target = new Vector3();
  private readonly codeUrl: string;
  private readonly catcher = new ShadowMaterial({ opacity: 0.6 });
  private readonly sleeveWall = new ShaderMaterial({
    // Behind the rings, which stand a hair off the wall: no flicker where you see them edge on.
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
    uniforms: { glow: new Uniform(0), color: new Uniform(new Color().setRGB(1.0, 0.72, 0.32)) },
    vertexShader: /* glsl */ `
      varying vec3 vPlace;
      void main() {
        vPlace = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // The wall as the sleeve's four rings of light show it: a soft halo round each, as Cycles lit it.
    fragmentShader: /* glsl */ `
      uniform float glow;
      uniform vec3 color;
      varying vec3 vPlace;
      float halo(float z) { float d = (vPlace.z - z) / 0.05; return exp(-d * d); }
      void main() {
        float light = halo(0.05) + halo(-0.3) + halo(-0.65) + halo(-1.0);
        gl_FragColor = vec4(color * (0.003 + light * 0.11) * glow, 1.0);
      }
    `,
  });
  private aspect = 16 / 9;

  constructor(codeUrl: string) {
    this.codeUrl = codeUrl;
  }

  /** Fetches the model and its code screen, and sets up the light. */
  async load(onProgress?: (share: number) => void): Promise<void> {
    RectAreaLightUniformsLib.init();
    const [gltf, code] = await Promise.all([new GLTFLoader().loadAsync(MODEL_URL, (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      }), new TextureLoader().loadAsync(this.codeUrl)]);
    this.scene.add(gltf.scene);
    for (const name of PART_NAMES) {
      const part = gltf.scene.getObjectByName(name);
      if (!part) throw new Error(`the model has no part "${name}"`);
      part.rotation.order = 'XYZ';
      this.parts.set(name, part);
    }
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material as MeshStandardMaterial;
      if (['led', 'key', 'pulse', 'code-screen'].includes(material.name)) this.glow.set(material.name, material);
    });
    this.dressFloor();
    this.parts.get('sleeve')?.traverse((object) => {
      const mesh = object as Mesh;
      // The rings themselves burn brighter than Blender's number, since nothing here adds the light they cast on each other.
      if (mesh.isMesh && (mesh.material as Material).name === 'ledsleeve') (mesh.material as MeshStandardMaterial).emissiveIntensity = 3;
      if (mesh.isMesh && (mesh.material as Material).name === 'wall') {
        (mesh.material as Material).dispose();
        mesh.material = this.sleeveWall;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
    this.dressCodeScreen(code);
    this.addLights();
  }

  /** The floor only catches the machine's shadow, as Blender's shadow catcher did: the page shows through it. */
  private dressFloor(): void {
    for (const name of ['floor', 'floor-cover'] as const) {
      this.parts.get(name)?.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        (mesh.material as Material).dispose();
        mesh.material = this.catcher;
        mesh.castShadow = false;
      });
    }
  }

  private dressCodeScreen(texture: Texture): void {
    const screen = this.glow.get('code-screen');
    if (!screen) throw new Error('the model has no code screen');
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    screen.emissiveMap = texture;
    screen.needsUpdate = true;
  }

  private addLights(): void {
    for (const spec of AREA_LIGHTS) {
      const light = new RectAreaLight(0xffffff, 0, spec.width, spec.height);
      light.color.setRGB(...spec.color);
      light.position.set(...spec.position);
      light.up.set(0, 0, 1);
      light.lookAt(...spec.target);
      this.scene.add(light);
      this.lights.set(spec.name, light);
    }
    const key = AREA_LIGHTS[0];
    this.spot.position.set(...key.position);
    this.spot.target.position.set(...key.target);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.radius = 18;
    this.spot.shadow.blurSamples = 20;
    this.spot.shadow.bias = -0.0004;
    this.spot.shadow.normalBias = 0.012;
    this.spot.shadow.camera.near = 1;
    this.spot.shadow.camera.far = 14;
    this.scene.add(this.spot, this.spot.target);
  }

  /** Shows every part, for the one draw that compiles and uploads them all before the journey shows. */
  showAll(): void {
    for (const part of this.parts.values()) part.visible = true;
  }

  /** Puts everything where frame `f` has it. */
  update(f: number): void {
    const pose = machinePose(f);
    for (const name of PART_NAMES) {
      const part = this.parts.get(name);
      if (!part) continue;
      const { p, r, s, on } = pose.parts[name];
      part.visible = on;
      if (!on) continue;
      part.position.set(p[0], p[1], p[2]);
      part.rotation.set(r[0], r[1], r[2]);
      part.scale.set(s[0], s[1], s[2]);
    }
    for (const [name, level] of [['led', pose.emit.led], ['key', pose.emit.key], ['pulse', pose.emit.pulse], ['code-screen', pose.emit.code]] as const) {
      const material = this.glow.get(name);
      if (material) material.emissiveIntensity = level * GLOW_SCALE;
    }
    for (const spec of AREA_LIGHTS) {
      const light = this.lights.get(spec.name);
      if (!light) continue;
      const share = spec.name === 'key' ? 1 - SHADOW_SHARE : spec.name === 'low' ? lowLightLevel(pose.parts.floor.p[2]) : 1;
      const watts = pose.lights[spec.name] * share;
      light.intensity = areaIntensity(watts, spec.width, spec.height);
    }
    this.catcher.opacity = shadowOpacity(pose.parts.floor.p[2]);
    this.sleeveWall.uniforms.glow.value = sleeveGlow(f);
    // A spot of the key light's share: candela at its distance that lights the middle of the machine as the area would.
    const keyAt = AREA_LIGHTS[0].position;
    const distance2 = keyAt[0] * keyAt[0] + keyAt[1] * keyAt[1] + keyAt[2] * keyAt[2];
    this.spot.intensity = (pose.lights.key * SHADOW_SHARE * LIGHT_SCALE * distance2) / (Math.PI * 16);
    this.placeCamera(f);
  }

  private placeCamera(f: number): void {
    const cam = cameraPose(f);
    this.camera.position.set(...cam.position);
    this.camera.up.set(...cam.up);
    this.target.set(...cam.target);
    this.camera.lookAt(this.target);
    if (cam.roll !== 0) this.camera.rotateZ(cam.roll);
    this.camera.fov = fovFor(cam.lens, this.aspect);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    fitProjection(this.camera.projectionMatrix.elements as unknown as number[], cam.shift, pageFit(f, this.aspect), this.aspect);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
  }

  dispose(): void {
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    });
    this.spot.shadow.dispose();
    this.catcher.dispose();
  }
}
