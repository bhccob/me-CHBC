import { Box2, ExtrudeGeometry, type Shape, Vector2 } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { NAME_OUTLINE } from '../concepts/name-outline';

/**
 * LAB ONLY (throwaway). BOB / CHUNG in Barlow 800 as solid letters, from the same outline concept C traces. Units are
 * ems; font units are y-down, so the mesh is turned half over on x (no mirror), and the front faces +z.
 */

export interface Letter {
  shape: Shape;
  /** Centre in ems, y up, the name's middle at the origin. */
  center: Vector2;
  size: Vector2;
}

function shapes(): Shape[] {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${NAME_OUTLINE.d}"/></svg>`;
  const data = new SVGLoader().parse(svg);
  return data.paths.flatMap((path) => SVGLoader.createShapes(path));
}

/** The name, extruded `depth` ems deep, and each letter's place. Turn the mesh by π on x and scale by 1/upm. */
export function nameSolid(depth: number): { geometry: ExtrudeGeometry; letters: Letter[] } {
  const all = shapes();
  const upm = NAME_OUTLINE.upm;
  const geometry = new ExtrudeGeometry(all, { depth: depth * upm, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 2, curveSegments: 10 });
  const half = new Vector2((NAME_OUTLINE.width * upm) / 2, (NAME_OUTLINE.height * upm) / 2);
  geometry.translate(-half.x, -half.y, 0);
  const letters = all
    .map((shape) => {
      const box = new Box2().setFromPoints(shape.getPoints(8));
      const c = box.getCenter(new Vector2());
      return { shape, center: new Vector2((c.x - half.x) / upm, -(c.y - half.y) / upm), size: box.getSize(new Vector2()).divideScalar(upm) };
    })
    .sort((a, b) => (a.center.y > 0 ? 0 : 1) - (b.center.y > 0 ? 0 : 1) || a.center.x - b.center.x);
  return { geometry, letters };
}
