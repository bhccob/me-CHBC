import { AdditiveBlending, CanvasTexture, Color, FogExp2, type Mesh, NoColorSpace, PerspectiveCamera, Scene, Sprite, SpriteMaterial, Vector2, Vector3 } from 'three';
import { distanceAt, type DistanceTable, distanceTable, type FlightLayout } from '../../flight/layout';
import { clamp, ez, mix, ramp } from '../../math';
import { displayReferred, displayValue } from '../displayOutput';
import { bankAt, center, fovAt, frameAt, nearestStop, type Rgb, tintAt, washAt } from './path';
import { makeRings, makeStreaks, makeWires, type StreakUniforms, tunnelUniforms, type TunnelUniforms } from './tunnelParts';

export interface TunnelInput {
  layout: FlightLayout;
  tints: readonly Rgb[];
  /** The frames the flight runs over. */
  frames: readonly [number, number];
  reduce: boolean;
}

/** How the flight is moving, for those who ask. */
export interface FlightState {
  s: number;
  speed: number;
  fov: number;
}

const ORB_AHEAD = 58;
const LOOK_AHEAD = 9;
const FULL_SPEED = 15;

function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const x = canvas.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.09, 'rgba(255,255,255,.62)');
  g.addColorStop(0.3, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  return texture;
}

const place = new Vector3();
const look = new Vector3();

/** The flight: one curving tunnel you never stop in, only slow down to read. */
export class TunnelScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(54, 16 / 9, 0.05, 900);
  readonly state: FlightState = { s: 0, speed: 0, fov: 54 };
  private readonly input: TunnelInput;
  private readonly table: DistanceTable;
  private readonly uniforms: TunnelUniforms = tunnelUniforms();
  private readonly streaks: StreakUniforms;
  private readonly meshes: Mesh[];
  private readonly orb: Sprite;
  private readonly fog = new FogExp2(0x000000, 0.017);
  private readonly background = new Color();
  private readonly mouse = new Vector2();
  private readonly aim = new Vector2();
  private last: number | null = null;
  private phone = false;

  constructor(input: TunnelInput) {
    this.input = input;
    this.table = distanceTable(input.layout);
    // Held in the screen's values, as the picture is: a render target takes them from these colours as they stand.
    this.scene.background = this.background;
    this.fog.color = this.background;
    this.scene.fog = this.fog;
    this.scene.add(this.camera);

    const end = input.layout.end;
    const wires = makeWires(end, this.uniforms);
    const rings = makeRings(end, this.uniforms);
    const streaks = makeStreaks(this.uniforms);
    this.streaks = streaks.speed;
    this.meshes = [wires, rings, streaks.mesh];
    this.scene.add(wires, rings);
    this.camera.add(streaks.mesh);

    this.orb = new Sprite(displayReferred(new SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, fog: false }), false));
    this.orb.scale.setScalar(22);
    this.orb.renderOrder = -5;
    this.scene.add(this.orb);
  }

  /** Where the pointer aims, -1 to 1 each way. */
  pointer(x: number, y: number): void {
    this.aim.set(x, y);
  }

  update(f: number, dt: number, now: number): void {
    const { layout, tints, frames, reduce } = this.input;
    const end = layout.end;
    const s = distanceAt(ramp(f, frames[0], frames[1]), this.table);
    const moved = this.last === null || dt <= 0 ? 0 : Math.abs(s - this.last) / dt;
    this.last = s;
    const state = this.state;
    state.s = s;
    state.speed = reduce ? 0 : state.speed + (clamp(moved / FULL_SPEED, 0, 1.6) - state.speed) * (1 - Math.exp(-dt / 0.14));
    this.uniforms.uTime.value = reduce ? 0 : now / 1000;

    // The camera, leaning into bends, with a little of the pointer.
    this.mouse.lerp(this.aim, 1 - Math.exp(-dt / 0.28));
    const m = reduce ? 0 : 1;
    const frame = frameAt(s, end);
    center(s, end, place)
      .addScaledVector(frame.R, this.mouse.x * 0.24 * m)
      .addScaledVector(frame.U, this.mouse.y * 0.14 * m);
    center(s + LOOK_AHEAD, end, look)
      .addScaledVector(frame.R, this.mouse.x * 0.62 * m)
      .addScaledVector(frame.U, this.mouse.y * 0.36 * m);
    const camera = this.camera;
    camera.position.copy(place);
    camera.up.copy(frame.U);
    camera.lookAt(look);
    camera.rotateZ(bankAt(frame.T));
    state.fov += (fovAt(state.speed, this.phone) - state.fov) * (dt > 0 ? 1 - Math.exp(-dt / 0.16) : 1);
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
    this.streaks.uTravel.value = s + (reduce ? 0 : now / 6000);
    this.streaks.uSpeed.value = state.speed;

    // The colour follows the nearest project.
    const { near } = nearestStop(s, layout);
    const tint = tintAt(s, layout, tints);
    this.uniforms.uTint.value.setRGB(tint[0], tint[1], tint[2]);
    const wash = washAt(tint, near);
    this.background.setRGB(displayValue(wash[0]), displayValue(wash[1]), displayValue(wash[2]));
    const calm = ez(near);
    this.uniforms.uCalm.value = calm;
    this.fog.density = mix(0.017, 0.085, calm);

    center(Math.min(s + ORB_AHEAD, end + ORB_AHEAD), end, this.orb.position);
    this.orb.material.color.setRGB(tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.phone = this.camera.aspect < 0.8;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as { dispose(): void }).dispose();
    }
    this.orb.material.map?.dispose();
    this.orb.material.dispose();
  }
}
