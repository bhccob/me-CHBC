import { Group, Matrix4, type Material, type Mesh, type MeshStandardMaterial, type Object3D, Quaternion } from 'three';
import type { FlightLayout } from '../../flight/layout';
import { ease, mix, TAU } from '../../math';
import { displayReferred } from '../displayOutput';
import { frameAt, type PathFrame } from './path';

/** A year, as the digits it is built from. */
export function yearDigits(year: number): string[] {
  return String(year).split('');
}

/** Where each digit stands, centred on the whole, for how wide each one is. */
export function digitPlaces(widths: readonly number[]): number[] {
  const total = widths.reduce((sum, width) => sum + width, 0);
  let x = -total / 2;
  return widths.map((width) => {
    const place = x + width / 2;
    x += width;
    return place;
  });
}

/** Where the gates stand: the plain ones first, then a year gate at each year. */
export function gatePlaces(layout: FlightLayout): { s: number; year?: number }[] {
  return [...layout.gates.map((s) => ({ s })), ...layout.years.map(({ s, year }) => ({ s, year }))];
}

/** How far a year gate's iris has opened, 0 to 1, with `distance` still to go to it. */
export function irisOpening(distance: number): number {
  return ease(26 - distance, 0, 17);
}

/** A gate shows from 3 behind you to this far ahead. */
const SEEN_AHEAD = 95;
const YEAR_ABOVE = 2.32;
const YEAR_FRONT = 0.34;
const YEAR_SCALE = 0.6;

interface Blade {
  node: Object3D;
  rest: number;
}

interface Gate {
  s: number;
  group: Group;
  gears: Object3D[];
  blades: Blade[] | null;
  spin: number;
}

/** Faces the gate along the path: its front to the camera. */
function facing(frame: PathFrame): Quaternion {
  const back = frame.T.clone().negate();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(frame.R, frame.U, back));
}

/** Gates along the path: the Blender model, cloned. Their gears turn as you pass; a year gate's iris opens as you reach it. */
export class Gates {
  readonly group = new Group();
  private readonly items: Gate[] = [];
  private readonly materials = new Set<Material>();
  private readonly model: Object3D;

  constructor(model: Object3D) {
    this.model = model;
    model.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.renderOrder = -2;
      const material = mesh.material as MeshStandardMaterial;
      material.transparent = true;
      this.materials.add(displayReferred(material, true));
      // How the approved mock-up lit them.
      if (material.name === 'led') material.emissiveIntensity = 1.5;
      if (material.name === 'steel') {
        material.roughness = 0.34;
        material.color.setRGB(0.3, 0.3, 0.33);
      }
      if (material.name === 'graphite') {
        material.color.setRGB(0.1, 0.1, 0.115);
        material.roughness = 0.44;
        material.metalness = 0.95;
      }
      if (material.name === 'blade') {
        material.color.setRGB(0.16, 0.16, 0.18);
        material.metalness = 0.95;
        material.roughness = 0.38;
      }
      if (material.name === 'year') {
        material.metalness = 0.8;
        material.roughness = 0.36;
        material.emissiveIntensity = 0.5;
      }
    });
  }

  private part(name: string): Object3D {
    const part = this.model.getObjectByName(name);
    if (!part) throw new Error(`the gate has no part "${name}"`);
    return part;
  }

  private yearOf(year: number): Group {
    const digits = yearDigits(year).map((digit) => this.part(`digit-${digit}`));
    const places = digitPlaces(digits.map((digit) => digit.userData.advance as number));
    const group = new Group();
    digits.forEach((digit, i) => {
      const copy = digit.clone(true);
      copy.position.set(places[i], 0, 0);
      group.add(copy);
    });
    group.position.set(0, YEAR_ABOVE, YEAR_FRONT);
    group.scale.setScalar(YEAR_SCALE);
    return group;
  }

  /** Stands a gate at every place in the layout. */
  place(layout: FlightLayout): void {
    for (const { s, year } of gatePlaces(layout)) {
      const frame = frameAt(s, layout.end);
      const group = new Group();
      group.position.copy(frame.p);
      group.quaternion.copy(facing(frame));
      const body = this.part('frame').clone(true);
      group.add(body);
      const gears: Object3D[] = [];
      body.traverse((object) => {
        if (/^gear-\d$/.test(object.name)) gears.push(object);
      });
      let blades: Blade[] | null = null;
      if (year !== undefined) {
        const shutter = this.part('blades').clone(true);
        group.add(shutter);
        blades = shutter.children.map((node) => ({ node, rest: (Number(node.name.split('-')[1]) / 12) * TAU }));
        group.add(this.yearOf(year));
      }
      this.group.add(group);
      this.items.push({ s, group, gears, blades, spin: s * 0.37 });
    }
  }

  /** All of them or none, for drawing everything once before anything shows. */
  show(on: boolean): void {
    for (const item of this.items) item.group.visible = on;
  }

  update(s: number, dissolve: number): void {
    const opacity = 1 - ease(dissolve, 0.1, 0.72);
    this.materials.forEach((material) => {
      material.opacity = opacity;
    });
    for (const item of this.items) {
      const distance = item.s - s;
      const on = distance > -3 && distance < SEEN_AHEAD && dissolve < 0.74;
      item.group.visible = on;
      if (!on) continue;
      item.gears.forEach((gear, i) => {
        gear.rotation.z = (s + item.spin) * 0.42 * (i % 2 ? 1 : -1);
      });
      if (!item.blades) continue;
      const open = irisOpening(distance);
      const size = mix(1, 0.08, ease(open, 0.5, 1));
      for (const { node, rest } of item.blades) {
        node.rotation.z = rest + Math.PI + mix(0.2, 1.46, open);
        node.scale.set(size, size, 1);
        node.visible = open < 0.995;
      }
    }
  }

  dispose(): void {
    this.model.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    this.materials.forEach((material) => material.dispose());
  }
}
