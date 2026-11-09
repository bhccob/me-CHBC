import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, type Color, DynamicDrawUsage, Float32BufferAttribute, LineSegments, type Object3D, Points, ShaderMaterial, Sprite, SpriteMaterial, SRGBColorSpace, type Texture } from 'three';
import { displayReferred } from '../displayOutput';
import type { HeadUniforms } from './xray';

/**
 * The head scene's drawing kit, ported from mock-up 20 (`dotsMaterial`, `lineMaterial`, `glowMaterial`, `glowPoints`,
 * `lines`, `lightSprite`): glowing points, lines of light and soft light sprites, all added on top of each other, none
 * hiding another (spec 2026-11-08 "Into my head", section 9).
 */

const ADD = { transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending } as const;

/** Twinkling dots: the stars, and the brain's dust that lights where it is thinking. */
export function dotsMaterial(u: HeadUniforms, color: Color, size: number, brain = false): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uA: { value: 1 }, uTime: u.uTime, uPx: u.uPx, uSize: { value: size }, uRevealY: u.uRevealY, uAct: u.uAct, uReg: u.uReg },
    vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime, uPx, uSize, uRevealY; uniform float uAct[8]; uniform vec3 uReg[8]; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = length(mv.xyz);
        float tw = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed * 1.8) + aSeed * 37.0);
        float act = 0.0;
        ${brain ? 'for (int i = 0; i < 8; i++) { vec3 e = position - uReg[i]; act += uAct[i] * exp(-dot(e, e) / 0.02); }' : ''}
        vA = tw * (1.0 + 2.4 * act) * smoothstep(0.3, 2.4, d) * (1.0 - smoothstep(110.0, 260.0, d))${brain ? ' * smoothstep(uRevealY + 0.01, uRevealY - 0.1, position.y)' : ''};
        gl_PointSize = clamp(uSize * (1.0 + act) * uPx / max(-mv.z, 0.05), 1.0, 16.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); float s = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(uColor, uA * vA * s * s); }`,
    ...ADD,
  });
}

/** Lines of light, each end with its own brightness. */
export function lineMaterial(color: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uA: { value: 1 } },
    vertexShader: /* glsl */ `attribute float aShade; varying float vDist; varying float vShade;
      void main() { vShade = aShade; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uA; varying float vDist; varying float vShade;
      void main() { gl_FragColor = vec4(uColor, uA * vShade * smoothstep(0.3, 2.4, vDist)); }`,
    ...ADD,
  });
}

function glowMaterial(u: HeadUniforms, maxPx: number, glyphs: Texture | null): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uPx: u.uPx, uAtlas: { value: glyphs } },
    vertexShader: /* glsl */ `attribute vec3 aColor; attribute float aAlpha, aSize${glyphs ? ', aGlyph' : ''}; uniform float uPx; varying vec3 vC; varying float vA; varying float vG;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = length(mv.xyz);
        vC = aColor; vA = aAlpha * smoothstep(0.5, 4.5, d); vG = ${glyphs ? 'aGlyph' : '0.0'};
        gl_PointSize = aAlpha <= 0.002 ? 0.0 : clamp(aSize * uPx / max(-mv.z, 0.05), 1.0, ${maxPx.toFixed(1)});
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: glyphs
      ? /* glsl */ `uniform sampler2D uAtlas; varying vec3 vC; varying float vA; varying float vG;
        void main() { vec2 cell = vec2(mod(vG, 16.0), floor(vG / 16.0)); float a = texture2D(uAtlas, (cell + gl_PointCoord) / vec2(16.0, 8.0)).a;
          gl_FragColor = vec4(mix(vC, vec3(1.0, 0.97, 0.9), 0.25), vA * a); }`
      : /* glsl */ `varying vec3 vC; varying float vA;
        void main() { float r = length(gl_PointCoord - 0.5); float core = smoothstep(0.18, 0.0, r); float s = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(mix(vC, vec3(1.0, 0.97, 0.9), core * 0.6), vA * (s * s + core * 0.5)); }`,
    ...ADD,
  });
}

/** A set of glowing points, each with its own place, colour, brightness and size, changed every frame. */
export interface GlowPoints {
  points: Points;
  pos: Float32Array;
  col: Float32Array;
  alpha: Float32Array;
  size: Float32Array;
  glyph: Float32Array;
  n: number;
  /** Puts point `i` at `v`, with no array made for it: many thousands are placed every frame. */
  at(i: number, v: { x: number; y: number; z: number }): void;
  touch(sizes?: boolean): void;
  dispose(): void;
}

export function glowPoints(parent: Object3D, u: HeadUniforms, n: number, maxPx = 24, glyphs: Texture | null = null): GlowPoints {
  const g = new BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), alpha = new Float32Array(n), size = new Float32Array(n), glyph = new Float32Array(n);
  g.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
  g.setAttribute('aColor', new BufferAttribute(col, 3));
  g.setAttribute('aAlpha', new BufferAttribute(alpha, 1).setUsage(DynamicDrawUsage));
  g.setAttribute('aSize', new BufferAttribute(size, 1).setUsage(DynamicDrawUsage));
  if (glyphs) g.setAttribute('aGlyph', new BufferAttribute(glyph, 1));
  const material = glowMaterial(u, maxPx, glyphs);
  const points = new Points(g, material);
  points.frustumCulled = false;
  parent.add(points);
  return {
    points, pos, col, alpha, size, glyph, n,
    at(i, v) {
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    },
    touch(sizes = false) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      if (sizes) g.attributes.aSize.needsUpdate = true;
    },
    dispose() {
      parent.remove(points);
      g.dispose();
      material.dispose();
    },
  };
}

/** Lines of light from `pos` (pairs of ends) with each end's brightness in `shade`. */
export function lines(parent: Object3D, pos: ArrayLike<number>, shade: ArrayLike<number>, color: Color): { line: LineSegments; material: ShaderMaterial } {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(Array.from(pos), 3));
  g.setAttribute('aShade', new Float32BufferAttribute(Array.from(shade), 1));
  const material = lineMaterial(color);
  const line = new LineSegments(g, material);
  line.frustumCulled = false;
  parent.add(line);
  return { line, material };
}

/**
 * A sprite's material as the head draws it: added on, never fogged, and encoded for the screen by itself, since the tunnel's
 * picture is a render target that holds the screen's values (displayOutput.ts). Drawn so, it shows as the mock shows it.
 */
export function headSprite(map: Texture, color?: Color): SpriteMaterial {
  const material = new SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, opacity: 0, fog: false });
  if (color) material.color.copy(color);
  return displayReferred(material, false);
}

let lightTexture: CanvasTexture | null = null;

/** The soft round light every spark and glow is drawn with. */
function lightTex(): CanvasTexture {
  if (lightTexture) return lightTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,240,210,1)');
  g.addColorStop(0.22, 'rgba(255,205,130,0.45)');
  g.addColorStop(1, 'rgba(255,170,80,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  lightTexture = new CanvasTexture(c);
  lightTexture.colorSpace = SRGBColorSpace;
  return lightTexture;
}

export function lightSprite(parent: Object3D, scale: number): Sprite {
  const s = new Sprite(headSprite(lightTex()));
  s.scale.set(scale, scale, 1);
  parent.add(s);
  return s;
}
