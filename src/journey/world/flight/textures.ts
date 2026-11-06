import { AdditiveBlending, CanvasTexture, type Color, DoubleSide, LinearMipmapLinearFilter, Mesh, type MeshBasicMaterial, MeshBasicMaterial as BasicMaterial, NoColorSpace, PlaneGeometry, ShaderMaterial, type Texture, TextureLoader } from 'three';
import { displayReferred } from '../displayOutput';
import type { Rgb } from './path';

/** Pictures and words as the flight draws them: all in the screen's values, as the approved mock-up did. */

const PLAIN_VERTEX = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';

export async function loadPicture(url: string, anisotropy: number): Promise<Texture> {
  const texture = await new TextureLoader().loadAsync(url);
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  return texture;
}

/** A screen: its picture with a thin line of the project's colour round rounded corners, melting away on one side if asked. */
export function screenMaterial(map: Texture, melt: number, round: number, aspect: number, tint: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, uA: { value: 1 }, uOn: { value: 1 }, uMelt: { value: melt }, uRound: { value: round }, uAspect: { value: aspect }, uTint: { value: tint } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    vertexShader: PLAIN_VERTEX,
    fragmentShader: /* glsl */ `uniform sampler2D map; uniform float uA,uOn,uMelt,uRound,uAspect; uniform vec3 uTint; varying vec2 vUv;
      void main(){
        vec3 c=texture2D(map,vUv).rgb*uOn;
        float m=uMelt>.5?smoothstep(0.,.36,vUv.x):uMelt<-.5?smoothstep(0.,.36,1.-vUv.x):1.;
        vec2 q=abs(vUv-.5)*vec2(uAspect,1.)-(vec2(uAspect,1.)*.5-uRound);
        float d=length(max(q,0.))-uRound;
        float inside=1.-smoothstep(-.002,.002,d);
        float line=smoothstep(-.012,-.003,d)*inside;
        c=mix(c,uTint*1.25,line*.85*smoothstep(.2,.8,m));
        gl_FragColor=vec4(c,uA*m*inside);
      }`,
  });
}

/** A floating piece: a picture with its own edges. */
export function pieceMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, uA: { value: 1 } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: PLAIN_VERTEX,
    fragmentShader: 'uniform sampler2D map; uniform float uA; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); gl_FragColor=vec4(c.rgb,c.a*uA); }',
  });
}

/** A soft pool of the dark, so that a project is the one bright thing while you read it. */
export function hushMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uA: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: PLAIN_VERTEX,
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float d=length((vUv-.5)*2.); gl_FragColor=vec4(vec3(.012,.010,.018),uA*smoothstep(1.,.42,d)); }',
  });
}

/** Light behind something: the glow's picture, added on, in a colour. */
export function glowMaterial(map: Texture, color: Rgb, opacity: number): MeshBasicMaterial {
  const material = new BasicMaterial({ map, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false, fog: false, opacity });
  material.color.setRGB(color[0], color[1], color[2]);
  return displayReferred(material, false);
}

/** How a line of words arrives: from the left, in its own window of the approach. */
function textMaterial(map: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { map: { value: map }, uA: { value: 1 }, uReveal: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    vertexShader: PLAIN_VERTEX,
    fragmentShader: 'uniform sampler2D map; uniform float uA,uReveal; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); float r=smoothstep(vUv.x-.1,vUv.x,uReveal*1.1); gl_FragColor=vec4(c.rgb,c.a*uA*r); }',
  });
}

export interface TextPlate {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  width: number;
  height: number;
  /** Where it rests, front to back. */
  z: number;
  /** The part of the approach it arrives over. */
  window: readonly [number, number];
}

/** Draws words on a canvas and stands them on a plane: `ppu` pixels to a unit. */
export function textPlate(draw: (x: CanvasRenderingContext2D) => void, ppu: number, w: number, h: number, anisotropy: number): TextPlate {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  const mesh = new Mesh(new PlaneGeometry(w / ppu, h / ppu), textMaterial(texture));
  mesh.frustumCulled = false;
  return { mesh, width: w / ppu, height: h / ppu, z: 0, window: [0, 1] };
}

/** A soft round glow, used wherever light gathers. */
export function glowTexture(): CanvasTexture {
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

/** A plane curved a little round its middle, so that a screen feels held in space. */
export function curvedPlane(w: number, h: number, bend: number): PlaneGeometry {
  const geometry = new PlaneGeometry(w, h, 36, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setZ(i, x * x * bend);
  }
  geometry.computeVertexNormals();
  return geometry;
}
