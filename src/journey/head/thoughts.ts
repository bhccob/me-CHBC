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
