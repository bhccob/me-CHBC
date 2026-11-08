import { AdditiveBlending, type Color, DoubleSide, ShaderMaterial, Vector3 } from 'three';
import { MOUTH_W, MOUTH_Y } from '../../head/shape';
import { THOUGHTS } from '../../head/thoughts';

/**
 * The scanner's look, ported from mock-up 20's `xrayMaterial` (spec 2026-11-08 "Into my head", sections 5.2 and 5.3): bright
 * where a surface turns away from you, as an X-ray is; the head drawn in rings of equal depth from where you stand; a bright
 * slice where the scan passes; the brain lit where it is thinking; the lid lifting at its hinge; the eyes that look at you.
 * The lid is the only way the skull opens (Bob: "i like lid the best").
 */

/** The values every X-ray material shares, set once a frame by the head scene. */
export interface HeadUniforms {
  uMouth: { value: number };
  uJaw: { value: number };
  uLip: { value: number };
  uTime: { value: number };
  uPx: { value: number };
  uRevealY: { value: number };
  uScanY: { value: number };
  uScanOn: { value: number };
  uAxis: { value: Vector3 };
  uOpen: { value: number };
  uSeam: { value: number };
  uPuff: { value: number };
  uBlink: { value: number };
  uEyeGlow: { value: number };
  uGazeL: { value: Vector3 };
  uGazeR: { value: Vector3 };
  uAct: { value: number[] };
  uReg: { value: Vector3[] };
}

export function headUniforms(): HeadUniforms {
  return {
    uMouth: { value: 0.012 },
    uJaw: { value: 0 },
    uLip: { value: 0 },
    uTime: { value: 0 },
    uPx: { value: 800 },
    uRevealY: { value: -2.2 },
    uScanY: { value: -2.2 },
    uScanOn: { value: 0 },
    uAxis: { value: new Vector3(1, 0, 0) },
    uOpen: { value: 0 },
    uSeam: { value: 0 },
    uPuff: { value: 0 },
    uBlink: { value: 0 },
    uEyeGlow: { value: 0 },
    uGazeL: { value: new Vector3(0, 0, 1) },
    uGazeR: { value: new Vector3(0, 0, 1) },
    uAct: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
    // The seven thoughts' places, and an eighth for the visual cortex at the back.
    uReg: { value: [...THOUGHTS.map((thought) => new Vector3(...thought.c)), new Vector3(0.06, 0.44, -0.62)] },
  };
}

const HINGE_Y = -0.12;
const HINGE_Z = -0.32;

const MOVES = /* glsl */ `
  uniform float uJaw, uOpen, uPuff;
  void puffMove(inout vec3 p, vec3 n) {
    if (uPuff <= 0.0) return;
    vec3 c = vec3(abs(p.x) - 0.36, p.y + 0.42, p.z - 0.5);
    float w = exp(-dot(c * c, vec3(1.0 / 0.018, 1.0 / 0.03, 1.0 / 0.035)));
    vec3 l = vec3(p.x, p.y + 0.53, p.z - 0.8);
    float wl = exp(-dot(l * l, vec3(1.0 / 0.03, 1.0 / 0.006, 1.0 / 0.01)));
    p += normalize(n + vec3(1e-6)) * w * uPuff * 0.15;
    p.z += w * uPuff * 0.06 + wl * uPuff * 0.06;
  }
  vec3 rotA(vec3 v, vec3 a, float g) { float c = cos(g), s = sin(g); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
  float cutY(float z) { return 0.56 + 0.06 * z; }
  // The lid, hinged at the back of the skull.
  void lidMove(inout vec3 p, inout vec3 n, float piece) {
    if (piece < 0.5 || uOpen <= 0.0) return;
    vec3 pivot = vec3(0.0, cutY(-0.98), -0.98), axis = vec3(1.0, 0.0, 0.0);
    float g = -1.8 * uOpen;
    p = pivot + rotA(p - pivot, axis, g);
    p.y += 0.1 * uOpen;
    n = rotA(n, axis, g);
  }
  // The jaw turning about its hinge: the lower lip, chin and jaw, not the neck.
  void jawMove(inout vec3 p, inout vec3 n) {
    float w = smoothstep(-0.55, -0.6, p.y) * smoothstep(-0.35, 0.05, p.z) * (1.0 - smoothstep(-0.98, -1.1, p.y));
    if (w <= 0.0 || uJaw <= 0.0) return;
    vec3 hinge = vec3(0.0, ${HINGE_Y.toFixed(3)}, ${HINGE_Z.toFixed(3)});
    p = hinge + rotA(p - hinge, vec3(1.0, 0.0, 0.0), uJaw * w);
    n = rotA(n, vec3(1.0, 0.0, 0.0), uJaw * w);
  }`;

export interface XrayOptions {
  /** 0 the skin, 2 the brain. */
  kind: 0 | 2;
  /** Whether the mouth is a hole the words come out of. */
  hole?: boolean;
  jaw?: boolean;
  /** Whether it comes apart at the lid's cut. */
  split?: boolean;
  strength?: number;
}

export function xrayMaterial(u: HeadUniforms, color: Color, { kind, hole = false, jaw = false, split = false, strength = 1 }: XrayOptions): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uA: { value: 1 },
      uStrength: { value: strength },
      uKind: { value: kind },
      uHole: { value: hole ? 1 : 0 },
      uMoveJaw: { value: jaw ? 1 : 0 },
      uSplit: { value: split ? 1 : 0 },
      ...u,
    },
    vertexShader: /* glsl */ `attribute float aPiece; uniform float uMoveJaw, uSplit, uKind; varying vec3 vLocal; varying vec3 vNw; varying vec3 vPw; varying float vDist; varying float vPiece; ${MOVES}
      void main() {
        vec3 p = position, n = normal;
        vLocal = position;
        vPiece = aPiece;
        if (uKind < 0.5) puffMove(p, n);
        if (uMoveJaw > 0.5) jawMove(p, n);
        if (uSplit > 0.5) lidMove(p, n, aPiece);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vPw = wp.xyz;
        vNw = normalize(mat3(modelMatrix) * n);
        vec4 mv = viewMatrix * wp;
        vDist = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor, uGazeL, uGazeR, uAxis; uniform float uA, uStrength, uKind, uHole, uMouth, uLip, uTime, uPx, uRevealY, uScanY, uScanOn, uSplit, uSeam, uBlink, uEyeGlow;
      uniform float uAct[8]; uniform vec3 uReg[8];
      varying vec3 vLocal; varying vec3 vNw; varying vec3 vPw; varying float vDist; varying float vPiece;
      float cutY(float z) { return 0.56 + 0.06 * z; }
      float pieceOf(vec3 p) { return p.y < cutY(p.z) ? 0.0 : 1.0; }
      bool inMouth(vec3 p) {
        if (uHole < 0.5 || p.z < 0.55) return false;
        vec2 m = vec2(p.x / ${MOUTH_W.toFixed(3)}, (p.y - (${MOUTH_Y.toFixed(3)})) / max(uMouth, 0.0005));
        return dot(m, m) < 1.0;
      }
      float lipGlow(vec3 p) {
        if (uHole < 0.5 || p.z < 0.62) return 0.0;
        vec2 m = vec2(p.x / ${(MOUTH_W + 0.03).toFixed(3)}, (p.y - (${MOUTH_Y.toFixed(3)})) / max(uMouth * 2.4, 0.05));
        return uLip * smoothstep(1.9, 0.95, length(m));
      }
      float activity(vec3 p) { float a = 0.0; for (int i = 0; i < 8; i++) { vec3 d = p - uReg[i]; a += uAct[i] * exp(-dot(d, d) / 0.02); } return a; }
      float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        if (inMouth(vLocal)) discard;
        if (uSplit > 0.5 && abs(pieceOf(vLocal) - vPiece) > 0.5) discard;
        float rv = smoothstep(uRevealY + 0.01, uRevealY - 0.12, vLocal.y);
        if (rv < 0.002) discard;
        vec3 N = normalize(vNw), V = normalize(cameraPosition - vPw);
        float nv = dot(N, V), facing = abs(nv);
        float near = smoothstep(0.7, 3.6, vDist) * (1.0 - smoothstep(700.0, 880.0, vDist));
        float sd = (vLocal.y - uScanY) / 0.016;
        float band = uScanOn * exp(-sd * sd);
        float seam = uSplit * uSeam * smoothstep(0.018, 0.0, abs(vLocal.y - cutY(vLocal.z)));
        float a; vec3 c;
        if (uKind < 0.5) {
          float rim = pow(1.0 - facing, 2.4);
          float zc = dot(vLocal, uAxis) / 0.034, fw = max(fwidth(zc), 1e-4);
          float line = 1.0 - smoothstep(0.5, 1.5, abs(fract(zc + 0.5) - 0.5) / fw);
          float front = smoothstep(0.0, 0.3, nv);
          float lines = line * front;
          vec3 eC = vec3(vLocal.x > 0.0 ? 0.27 : -0.27, 0.12, 0.68);
          vec3 q = vLocal - eC;
          float onEye = (1.0 - smoothstep(0.96, 1.16, length(q / vec3(0.095, 0.075, 0.095)))) * smoothstep(0.0, 0.03, q.z) * front;
          float g = dot(normalize(q), vLocal.x > 0.0 ? uGazeL : uGazeR);
          float iris = onEye * (1.2 * exp(-pow((g - 0.86) / 0.03, 2.0)) + 0.7 * smoothstep(0.85, 0.88, g) * (1.0 - smoothstep(0.955, 0.97, g)));
          float qy = q.y / 0.075, lidY = 1.0 - 2.2 * uBlink;
          iris *= (1.0 - smoothstep(lidY - 0.1, lidY + 0.1, qy)) * (1.0 + 1.6 * uEyeGlow);
          float lid = onEye * uBlink * exp(-pow((qy - lidY) / 0.14, 2.0)) * 1.4;
          float lg = lipGlow(vLocal) * 0.35;
          float neck = smoothstep(-1.75, -1.1, vLocal.y);
          a = uA * uStrength * rv * near * neck * (0.02 + 0.8 * rim + 0.2 * lines + 0.9 * iris + 0.9 * lid + 0.6 * lg + 0.9 * seam);
          c = uColor * (0.6 + 0.8 * rim) + vec3(1.0, 0.93, 0.8) * (0.55 * lines + 0.8 * (iris + lid) + 0.7 * seam);
          c = mix(c, vec3(1.0, 0.9, 0.72), lg);
        } else {
          float act = activity(vLocal);
          float rim = pow(1.0 - facing, 2.0);
          float h = hash3(floor(vLocal * 46.0));
          float fl = smoothstep(0.93, 1.0, fract(h * 7.0 + uTime * (0.08 + 0.2 * h))) * smoothstep(0.42, 0.08, length(fract(vLocal * 46.0) - 0.5)) * smoothstep(2.0, 9.0, vDist);
          a = uA * uStrength * rv * near * (0.028 + 0.5 * rim + act * (0.2 + 0.85 * rim) + fl * (0.12 + 0.5 * act));
          c = mix(uColor * (0.6 + 0.7 * rim), vec3(1.0, 0.88, 0.62), clamp(act * 0.9 + fl * 0.3, 0.0, 1.0));
        }
        a += uA * rv * near * band * (uKind < 0.5 ? 1.1 : 0.55);
        c += vec3(1.0, 0.9, 0.7) * band;
        gl_FragColor = vec4(c, a);
      }`,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
}
