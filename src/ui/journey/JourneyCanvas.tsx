import { advance, Canvas, useFrame, useThree } from '@react-three/fiber';
import { type JSX, useEffect, useRef } from 'react';
import codeScreenUrl from '~/assets/journey/code-screen.webp?url';
import type { Locale } from '~/i18n/Translator';
import type { Timeline } from '~/journey/timeline';
import type { StopReport } from '~/journey/world/flight/TunnelScene';
import type { UniverseReport } from '~/journey/world/end/Universe';
import type { QuestionReport } from '~/journey/world/void/Questions';
import { World, type WorldState } from '~/journey/world/World';

export interface CanvasHandle {
  /** Moves the world to frame `f` and draws it. */
  frame(f: number, dt: number, now: number): WorldState;
  /** Where a project's screen stands on the page: left, top, width, height. */
  screenRect(id: string): [number, number, number, number] | null;
  /** What stands in the flight, for those checking it. */
  report(): { stops: StopReport[]; walls: number; questions: QuestionReport[]; end: UniverseReport | null };
  /** A press on the end page, and letting go. */
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
function Host({ locale, timeline, reduce, onProgress, onReady, onFail }: HostProps): null {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
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
        made.warm(0);
        onReady({
          frame(f, dt, now) {
            const state = made.update(f, dt, now);
            advance(now);
            return state;
          },
          screenRect: (id) => made.screenRect(id),
          report: () => made.report(),
          hold: (on, cancelled) => made.hold(on, cancelled),
        });
        // What the flight needs comes after the first view. Without it the tunnel still runs, with nothing standing in it.
        return made.load('flight').catch((error: unknown) => console.error(error));
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
  }, [size.width, size.height]);

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
  return (
    <Canvas
      className="journey-canvas"
      role="img"
      aria-label={props.label}
      frameloop="never"
      flat
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, stencil: false, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 3 }}
    >
      <Host {...props} />
    </Canvas>
  );
}
