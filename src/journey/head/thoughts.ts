/**
 * The six thoughts inside Bob's head, and when each is read, in the head's own time `t` (head/time.ts), from mock-up 20
 * (spec 2026-11-08 "Into my head", section 5.7). Pure: no three, no DOM.
 */

/** The answers stand between these two points of `t`, six of them, evenly. */
export const QA0 = 0.335;
export const QA1 = 0.77;
export const NQ = 6;
/** How long each answer holds, either side of its stop. */
export const HOLD = 0.021;
const SEG = (QA1 - QA0) / NQ;

/** Where thought `i` is read; the seventh, Broca's area, comes after the six. */
export const dwellT = (i: number): number => (i < NQ ? QA0 + (i + 0.5) * SEG : 0.795);

/** How long thought `i` holds either side of its stop. */
export const holdOf = (i: number): number => (i < NQ ? HOLD : 0.012);

export type ThoughtKey = 'plans' | 'career' | 'hobbies' | 'places' | 'skills' | 'site' | 'speech';
export type RegionKey = 'prefrontal' | 'frontal' | 'motor' | 'parietal' | 'cerebellum' | 'wernicke' | 'broca' | 'whole' | 'brainstem' | 'jaw' | 'mouth';
export type DoingKey = 'planning' | 'deciding' | 'moving' | 'place' | 'practice' | 'language' | 'speaking' | 'listening' | 'sorting' | 'relaying' | 'jaw' | 'pressure' | 'spitting';
export type ObjectKind = 'cap' | 'rocket' | 'barbell' | 'globe' | 'block' | 'browser';

export interface Thought {
  key: ThoughtKey;
  region: RegionKey;
  doing: DoingKey;
  /** Where it sits in the brain, in head units: +x is the head's own left, where language and speech sit. */
  c: [number, number, number];
  /** Its one object of light; the seventh, speech, has none. */
  object: ObjectKind | null;
}

/** Each question as a thought: the part of the brain it lights, what that part does, and where (mock lines 480-488). */
export const THOUGHTS: readonly Thought[] = [
  { key: 'plans', region: 'prefrontal', doing: 'planning', c: [-0.12, 0.5, 0.12], object: 'cap' },
  { key: 'career', region: 'frontal', doing: 'deciding', c: [0.16, 0.7, -0.02], object: 'rocket' },
  { key: 'hobbies', region: 'motor', doing: 'moving', c: [-0.12, 0.76, -0.24], object: 'barbell' },
  { key: 'places', region: 'parietal', doing: 'place', c: [0.16, 0.6, -0.5], object: 'globe' },
  { key: 'skills', region: 'cerebellum', doing: 'practice', c: [-0.06, 0.06, -0.52], object: 'block' },
  { key: 'site', region: 'wernicke', doing: 'language', c: [0.42, 0.3, -0.24], object: 'browser' },
  { key: 'speech', region: 'broca', doing: 'speaking', c: [0.42, 0.36, 0.2], object: null },
];

/** Where the camera reads each thought from, in head units (mock `CAMS`). */
export const CAMS: readonly [number, number, number][] = [[0.06, 0.53, 0.36], [-0.02, 0.6, 0.2], [0.04, 0.64, -0.02], [-0.02, 0.58, -0.26], [0.02, 0.32, -0.34], [0.18, 0.28, -0.36], [0.24, 0.32, 0.0]];

/** The way down from Broca's area: back to the brainstem, down it, forward along the nerve to the jaw, into the mouth. */
export const DOWN: readonly [number, number, number][] = [[0.3, 0.2, 0.05], [0.08, -0.04, -0.18], [0.12, -0.34, -0.12], [0.1, -0.5, 0.16], [0.02, -0.53, 0.4]];
export const DOWN_T: readonly number[] = [0.822, 0.838, 0.853, 0.867, 0.879];

/** The mock's `smooth(a, b, x)`. */
const smooth = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** How much each of the seven thoughts is being read at `t`, 0 to 1: one at a time, fully at its stop. */
export function dwellWeights(t: number): number[] {
  return THOUGHTS.map((_, i) => {
    const T = dwellT(i), h = holdOf(i);
    return smooth(T - h - 0.018, T - h, t) * (1 - smooth(T + h, T + h + 0.018, t));
  });
}

/** How much answer `i`'s words show at `t`: they come a little after the region lights and go a little before it dims. */
export function answerShown(t: number, i: number): number {
  const T = dwellT(i);
  return smooth(T - HOLD - 0.016, T - HOLD + 0.004, t) * (1 - smooth(T + HOLD - 0.004, T + HOLD + 0.016, t));
}

/** The answer nearest `t` among the six: what the read-out names between two stops. */
export function nearestThought(t: number): number {
  let best = 0;
  for (let i = 1; i < NQ; i++) if (Math.abs(dwellT(i) - t) < Math.abs(dwellT(best) - t)) best = i;
  return best;
}
