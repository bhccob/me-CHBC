import { ease, ramp } from '../math';
import { INK, inkCharacters } from './plan';

/**
 * Purple ink, Bob's pick: one drop spreads through dark water as the files arrive, and 客家 appears in it, one character at a
 * time. Once he enters, the ink dissolves into the page and the characters move to their place on the first view. Plain
 * WebGL, so that it shows before three.js has arrived. From the mock's `theInk`.
 */

const VERTEX = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }';

const FRAGMENT = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uP; uniform float uLand;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(11.7,7.3); a*=.5; } return s; }
float sd(float a,float b,float x){ return 1.-smoothstep(b,a,x); }
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);
  float T=uT*.55;
  vec2 q=vec2(fbm(uv*1.9+vec2(0.,T*.09)),fbm(uv*1.9+vec2(5.2,1.3)-T*.07));
  vec2 w=vec2(fbm(uv*1.9+3.1*q+vec2(1.7,9.2)+T*.11),fbm(uv*1.9+3.1*q+vec2(8.3,2.8)-T*.09));
  float n=fbm(uv*1.5+3.3*w);
  float rad=mix(.015,1.5,pow(uP,.85));
  float d=length(uv*vec2(1.,1.1))+(n-.5)*.85*smoothstep(0.,.25,uP);
  float ink=sd(rad,rad-.32,d);
  float d1=pow(clamp(n*1.3,0.,1.),2.2);
  vec3 bg=vec3(.027,.023,.043);
  vec3 col=mix(bg,vec3(.06,.035,.17),ink);
  col=mix(col,vec3(.25,.15,.62),ink*d1);
  col=mix(col,vec3(.72,.62,1.),ink*pow(d1,4.5)*.36);
  float edge=sd(rad-.015,rad-.09,d)*smoothstep(rad-.22,rad-.09,d);
  col+=vec3(.3,.2,.8)*edge*.22*(1.-uP*.6);
  float nn=fbm(uv*2.3+w*1.4+vec2(3.,7.));
  float th=mix(-.25,1.02,uLand);
  float a=smoothstep(th,th+.2,nn);
  gl_FragColor=vec4(col*a,a);
}`;

const inOut = (v: number): number => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

export interface Ink {
  /** Draws at `p`, how far the ink has spread, and `q`, ms since he entered (negative before that). */
  draw(p: number, q: number, now: number): void;
  dispose(): void;
}

/** Starts the ink on its two canvases; null where WebGL is not there, and the page goes on without it. */
export function createInk(glCanvas: HTMLCanvasElement, textCanvas: HTMLCanvasElement, findHan: () => HTMLElement | null): Ink | null {
  const gl = glCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' });
  const x = textCanvas.getContext('2d');
  if (!gl || !x) return null;
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const shader = (type: number, source: string): WebGLShader => {
    const made = gl.createShader(type) as WebGLShader;
    gl.shaderSource(made, source);
    gl.compileShader(made);
    return made;
  };
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  const attribute = gl.getAttribLocation(program, 'a');
  const uRes = gl.getUniformLocation(program, 'uRes'), uT = gl.getUniformLocation(program, 'uT'), uP = gl.getUniformLocation(program, 'uP'), uLand = gl.getUniformLocation(program, 'uLand');
  let W = 0, H = 0, D = 1;

  return {
    draw(p, q, now) {
      if (innerWidth !== W || innerHeight !== H) {
        W = innerWidth;
        H = innerHeight;
        D = Math.min(2, devicePixelRatio || 1);
        textCanvas.width = Math.round(W * D);
        textCanvas.height = Math.round(H * D);
        const d = Math.min(1, devicePixelRatio || 1);
        glCanvas.width = Math.round(W * d);
        glCanvas.height = Math.round(H * d);
      }
      x.setTransform(D, 0, 0, D, 0, 0);
      const M = Math.min(W, H), k = q < 0 ? 0 : ease(q, 80, INK.land);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
      gl.uniform1f(uT, now * 0.001);
      gl.uniform1f(uP, p);
      gl.uniform1f(uLand, k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      x.clearRect(0, 0, W, H);
      // The two characters, written as the ink reaches them; then they go to their place on the page.
      const han = findHan(), rect = han?.getBoundingClientRect();
      const placed = rect !== undefined && rect.width > 0, fs0 = M * 0.21;
      const fsTarget = placed && han ? parseFloat(getComputedStyle(han).fontSize) : fs0;
      const mv = q < 0 ? 0 : inOut(ramp(q, 120, 1150));
      const fs = fs0 + (fsTarget - fs0) * mv;
      const cx0 = W / 2, cy0 = H * 0.46, tx = placed ? rect.left + rect.width / 2 : cx0, ty = placed ? rect.top + rect.height / 2 : cy0;
      const cx = cx0 + (tx - cx0) * mv, cy = cy0 + (ty - cy0) * mv;
      const [a1, a2] = inkCharacters(p), fadeAll = 1 - ramp(q, 1020, 1400);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `400 ${fs}px "Ma Shan Zheng", serif`;
      const colour = (a: number): string => `rgba(${Math.round(244 + (230 - 244) * mv)},${Math.round(238 + (184 - 238) * mv)},${Math.round(255 + (74 - 255) * mv)},${a * fadeAll})`;
      x.shadowColor = `rgba(150,110,255,${0.85 * (1 - mv)})`;
      x.shadowBlur = fs * 0.28 * (1 - mv * 0.8);
      if (a1 > 0) {
        x.fillStyle = colour(a1);
        x.fillText('客', cx, cy - fs * 0.52);
      }
      if (a2 > 0) {
        x.fillStyle = colour(a2);
        x.fillText('家', cx, cy + fs * 0.52);
      }
      x.shadowBlur = 0;
    },
    dispose() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
