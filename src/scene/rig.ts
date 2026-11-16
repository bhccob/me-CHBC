/* renderer, camera and lights */
import * as THREE from "three";

/* The look was tuned on an older three.js (r128). Two settings keep that exact look on the current one:
   1. colours are used as written, not converted (the old default);
   2. point lights fade in a straight line to their range (the old default), instead of the new physical fall-off.
   Light strengths below are the prototype's numbers times π, which is what the old version did internally. */
THREE.ColorManagement.enabled = false;
(() => {
  const re = /float getDistanceAttenuation\([^)]*\)\s*\{[\s\S]*?return distanceFalloff;\s*\}/;
  const old = `float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) { return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent ); }
	return 1.0;
}`;
  const chunk = THREE.ShaderChunk.lights_pars_begin;
  if (re.test(chunk)) THREE.ShaderChunk.lights_pars_begin = chunk.replace(re, old);
  else console.warn("The Lock: three.js changed its light fall-off code; point lights will look different. See src/scene/rig.ts.");
})();

export const PI = Math.PI;
export const CAM_Z = 18, TAN = Math.tan(20 * Math.PI / 180);

export interface Rig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** light mode for phones and weak machines: fewer fragments and dust, a simpler glow */
  lite: boolean;
  phone: boolean;
  /** what fits on screen at the lock's distance, in world units */
  view: { aspect: number; wide: boolean; halfW: number; halfH: number };
  resize(): void;
  /** lowers the sharpness one step if frames are slow. returns false when it cannot go lower */
  lowerQuality(): boolean;
}

export function createRig(canvas: HTMLCanvasElement): Rig {
  const phone = window.matchMedia("(pointer:coarse)").matches && Math.min(window.screen.width, window.screen.height) < 820;
  const lite = phone || (navigator.hardwareConcurrency || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  let dprCap = phone ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0912, 22, 48);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(0, 0, CAM_Z);
  scene.add(new THREE.AmbientLight(0x8a86b0, 0.9 * PI));
  const key = new THREE.DirectionalLight(0xfff1d6, 1.0 * PI); key.position.set(6, 9, 12); scene.add(key);
  const l1 = new THREE.PointLight(0x8a6cff, 1.5 * PI, 60, 1); l1.position.set(-12, 4, 8); scene.add(l1);
  const l2 = new THREE.PointLight(0x5fd6ab, 0.9 * PI, 60, 1); l2.position.set(10, -8, 6); scene.add(l2);

  const view = { aspect: 1, wide: true, halfW: 10, halfH: 6 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    view.aspect = w / h; camera.aspect = view.aspect; camera.updateProjectionMatrix();
    view.halfH = TAN * CAM_Z; view.halfW = view.halfH * view.aspect; view.wide = view.aspect > 1.05;
  }
  function lowerQuality() {
    if (dprCap <= 1) return false;
    dprCap = Math.max(1, dprCap - 0.5);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    resize();
    return true;
  }
  window.addEventListener("resize", resize);
  resize();
  return { renderer, scene, camera, lite, phone, view, resize, lowerQuality };
}
