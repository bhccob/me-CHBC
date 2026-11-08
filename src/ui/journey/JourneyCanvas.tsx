import { advance, Canvas, useFrame, useThree } from '@react-three/fiber';
import { type JSX, useEffect, useRef, useState } from 'react';
import codeScreenUrl from '~/assets/journey/code-screen.webp?url';
import type { Locale } from '~/i18n/Translator';
import type { Timeline } from '~/journey/timeline';
import type { StopReport } from '~/journey/world/flight/TunnelScene';
import { FrameJudge, startStep } from '~/engine/quality';
import { journeyQuality, journeySteps } from '~/journey/quality';
import { type JourneyStage, stagesToLoad } from '~/journey/stages';
import { World, type WorldState } from '~/journey/world/World';
import { gpuSpeed } from '~/scene/webgl';

export interface CanvasHandle {
  /** Moves the world to frame `f`, with the head at its own time `t`, and draws it. */
  frame(f: number, dt: number, now: number, t: number): WorldState;
  /** Where a project's screen stands on the page: left, top, width, height. */
  screenRect(id: string): [number, number, number, number] | null;
  /** What stands in the flight, for those checking it. */
  report(): { stops: StopReport[]; walls: number; head: { t: number; active: number; pressure: number; locale: string } | null };
  /** Where a finger holds, and where the view drifts with no pointer on the page: each -1 to 1. */
  pointer(x: number, y: number): void;
  drift(x: number, y: number): void;
  /** Whether a stage has come, the ladder's step, and the pixel ratio it draws at. */
  stageReady(stage: JourneyStage): boolean;
  step(): number;
  dpr(): number;
  /** @deprecated The old end page's press, gone with its universe; its callers go with that page (Into my head, Task 12). */
  hold(on: boolean, cancelled?: boolean): void;
}

interface HostProps {
  locale: Locale;
  timeline: Timeline;
  reduce: boolean;
  /** What the canvas shows, in words. */
  label: string;
  /** How much of the model has come. */
  onProgress: (share: number) => void;
  onReady: (handle: CanvasHandle) => void;
  onFail: (error: unknown) => void;
}

/** Inside the canvas: makes the world on R3F's renderer and draws it when the journey's loop says so. */
function Host({ locale, timeline, reduce, onProgress, onReady, onFail, onPixelRatio }: HostProps & { onPixelRatio: (ratio: number) => void }): null {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const world = useRef<World | null>(null);

  useEffect(() => {
    let live = true;
    const made = new World(gl, { locale, timeline, reduce, codeScreenUrl });
    made
      .load('machine', onProgress)
      .then(() => {
        if (!live) return;
        world.current = made;
        made.resize(gl.domElement.clientWidth, gl.domElement.clientHeight);
        made.warm(0, 0);
        // Where this GPU starts on the ladder, and whether its frames move it further down.
        const params = new URLSearchParams(location.search);
        const fine = matchMedia('(pointer: fine)').matches;
        const fixed = params.get('step');
        const ladder = Array.from({ length: journeySteps(fine) }, (_, n) => journeyQuality(n, fine));
        let step = fixed === null ? startStep(gpuSpeed(), { width: innerWidth, height: innerHeight }, devicePixelRatio, ladder) : Number(fixed);
        const governed = fixed === null || params.has('govern');
        const judge = new FrameJudge();
        const useStep = (): void => {
          const quality = journeyQuality(step, fine);
          onPixelRatio(quality.pixelRatio);
          made.setQuality(quality);
        };
        useStep();
        // What has come, and what is on its way: each stage once. With `stages=all` the proof harness asks for them all at once.
        const loaded = new Set<string>(['machine']);
        const ready = new Set<string>(['machine']);
        const load = (stage: JourneyStage): void => {
          loaded.add(stage);
          // Without the flight the journey still runs, with nothing standing in it. Without his head there is no journey
          // past the flight to run: the page falls back as it does when the 3D fails (spec 10).
          made.load(stage).then(
            () => ready.add(stage),
            (error: unknown) => {
              if (stage === 'head' || stage === 'end') {
                if (live) onFail(error);
              } else console.error(error);
            },
          );
        };
        if (params.get('stages') === 'all') (['flight', 'head', 'end'] as const).forEach(load);
        let lastNow: number | null = null;
        onReady({
          frame(f, dt, now, t) {
            for (const stage of stagesToLoad(f, timeline, loaded)) if (live) load(stage);
            const state = made.update(f, dt, now, t);
            advance(now);
            if (governed) {
              if (made.drew && lastNow !== null) {
                const down = judge.frame(now - lastNow);
                if (down > 0 && step < journeySteps(fine) - 1) {
                  step = Math.min(journeySteps(fine) - 1, step + down);
                  useStep();
                }
              } else if (!made.drew) judge.rest();
            }
            lastNow = now;
            return state;
          },
          stageReady: (stage) => ready.has(stage),
          step: () => step,
          dpr: () => gl.getPixelRatio(),
          screenRect: (id) => made.screenRect(id),
          report: () => made.report(),
          pointer: (x, y) => made.pointer(x, y),
          drift: (x, y) => made.drift(x, y),
          hold: () => {},
        });
      })
      .catch((error: unknown) => {
        if (live) onFail(error);
      });
    return () => {
      live = false;
      world.current = null;
      made.dispose();
    };
    // The language is left out on purpose: switching it keeps the world, and only its words change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, timeline, reduce, onProgress, onReady, onFail]);

  // The GPU can take the drawing away at any time: the words are still there, without the 3D.
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event): void => {
      event.preventDefault();
      onFail(new Error('the WebGL context was lost'));
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onFail]);

  useEffect(() => {
    world.current?.setLocale(locale);
  }, [locale]);

  useEffect(() => {
    world.current?.resize(size.width, size.height);
  }, [size.width, size.height, dpr]);

  useEffect(() => {
    const aim = (event: PointerEvent): void => {
      // A finger scrolls: it does not look around.
      if (event.pointerType === 'touch') return;
      world.current?.pointer((event.clientX / innerWidth) * 2 - 1, 1 - (event.clientY / innerHeight) * 2);
    };
    addEventListener('pointermove', aim, { passive: true });
    return () => removeEventListener('pointermove', aim);
  }, []);

  // A positive priority: R3F leaves the drawing to this.
  useFrame(() => world.current?.render(), 1);
  return null;
}

export interface JourneyCanvasProps extends HostProps {}

/** The journey's one canvas, hosted by React Three Fiber, which draws only on the journey's loop. */
export default function JourneyCanvas(props: JourneyCanvasProps): JSX.Element {
  // The canvas's own prop, since R3F sets it back to this each time the canvas draws again.
  const [pixelRatio, setPixelRatio] = useState(1.5);
  return (
    <Canvas
      className="journey-canvas"
      role="img"
      aria-label={props.label}
      frameloop="never"
      flat
      dpr={[Math.min(1, pixelRatio), pixelRatio]}
      gl={{ alpha: true, antialias: false, stencil: false, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3 }}
    >
      <Host {...props} onPixelRatio={setPixelRatio} />
    </Canvas>
  );
}
