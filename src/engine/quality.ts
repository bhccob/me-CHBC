/**
 * Where a page view starts on a speed ladder, and when its frames ask to go down it. The ladder itself is the caller's
 * (the journey's, src/journey/quality.ts): each step names the pixel ratio it draws at and what it costs a frame.
 */

/** What ./gpuBench.ts timed the GPU the steps' `cost` were measured on (an AMD Radeon of two compute units, a weak one), ms. */
export const BENCH_REFERENCE_MS = 13;

/** The frame a step must fit to be started on, ms: 60 Hz. */
export const START_BUDGET_MS = 17;

/**
 * A GPU that times this quick or quicker starts at the best whatever the screen, ms: a strong card does much better than the
 * weak one the costs were measured on would say (an RTX 4080 Super draws 4K at the best step in about 9 ms).
 */
export const STRONG_MS = 1;

/**
 * The first step of `ladder` this GPU can hold on a screen of `screen` CSS px at `devicePixelRatio`: each step's cost at the pixels it
 * would draw, scaled by how the GPU timed (`benchMs`) against the one the costs were measured on. With no timing it is the
 * best step, and the governor judges it by its frames.
 */
export function startStep(benchMs: number | null, screen: { width: number; height: number }, devicePixelRatio: number, ladder: readonly { cost: number; pixelRatio: number }[]): number {
  if (benchMs === null || !Number.isFinite(benchMs) || benchMs < 0 || benchMs <= STRONG_MS) return 0;
  const speed = benchMs / BENCH_REFERENCE_MS;
  const steps = ladder.findIndex((q) => {
    const ratio = Math.min(Math.max(devicePixelRatio, 1), q.pixelRatio);
    const millions = (screen.width * screen.height * ratio * ratio) / 1e6;
    return q.cost * millions * speed <= START_BUDGET_MS;
  });
  return steps === -1 ? ladder.length - 1 : steps;
}

/** A frame longer than this is a sleep or a one-off stall, not the frame rate, ms. */
const NOT_A_FRAME_MS = 250;
/** How much drawing a verdict is drawn from, ms and frames. */
const WINDOW_MS = 700;
const WINDOW_FRAMES = 12;
/** The drawing a step is given to settle before it is judged, ms. */
const SETTLE_MS = 300;
/** A frame rate under these (in ms a frame, the worst tenth left out) takes one step down, or two. */
export const SLOW_MS = 24;
export const VERY_SLOW_MS = 45;
/** A step that did not take this much off the frame did not help. */
const HELPED = 0.92;

/**
 * Judges the frames the canvas draws back to back (the governor tells it each one's length, and `rest`s it when the scene
 * sleeps) and says how many steps down they ask for, 0 mostly. It waits for enough drawing to be sure; leaves out the worst
 * tenth, so a stall is not the frame rate; and it gives up after two steps that did not help: then it is not the GPU
 * holding the frames back (a slow CPU, a browser or a battery saver holding them to 30 a second), and lower quality would
 * cost the look for nothing.
 */
export class FrameJudge {
  private frames: number[] = [];
  private spent = 0;
  private settling = 0;
  private lastSlow: number | null = null;
  private useless = 0;

  /** A frame of `ms`: the steps down it now asks for. */
  frame(ms: number): number {
    if (!(ms > 0) || ms > NOT_A_FRAME_MS || this.useless >= 2) return 0;
    if (this.settling > 0) {
      this.settling -= ms;
      return 0;
    }
    this.frames.push(ms);
    this.spent += ms;
    if (this.spent < WINDOW_MS || this.frames.length < WINDOW_FRAMES) return 0;
    const sorted = [...this.frames].sort((a, b) => a - b);
    const kept = sorted.slice(0, Math.ceil(sorted.length * 0.9));
    const mean = kept.reduce((sum, f) => sum + f, 0) / kept.length;
    this.frames = [];
    this.spent = 0;
    if (this.lastSlow !== null) {
      this.useless = mean < this.lastSlow * HELPED ? 0 : this.useless + 1;
      this.lastSlow = null;
      if (this.useless >= 2) return 0;
    }
    if (mean <= SLOW_MS) return 0;
    this.lastSlow = mean;
    this.settling = SETTLE_MS;
    return mean > VERY_SLOW_MS ? 2 : 1;
  }

  /** The scene went to sleep: what comes next is a new run of frames. */
  rest(): void {
    this.frames = [];
    this.spent = 0;
  }
}
