import { clamp, ease } from '../math';
import { type DoingKey, nearestThought, QA0, type RegionKey, THOUGHTS } from './thoughts';
import { SPIT_T } from './time';

/**
 * What the scanner's read-out says at `t`, from the scan to the spit (spec 2026-11-08 "Into my head", section 6; mock lines
 * 3104-3115). Keys, not words: the page looks them up in `journey.head`. Pure.
 */

export type StatusKey = 'scanning' | 'takingIn' | 'found' | 'goingIn' | 'thought' | 'words' | 'down' | 'jaw' | 'holding' | 'spitting';

export interface Readout {
  status: StatusKey;
  /** The percent scanned, the count taken in, the thoughts found, or the thought's number. */
  n: number;
  region: RegionKey | null;
  doing: DoingKey | null;
  meter: number;
}

/**
 * The read-out at `t`. `weights` is `dwellWeights(t)`, `pressure` the pressure behind the lips, and `act` how lit each
 * region is. Between two answers it names the nearer one.
 */
export function readoutAt(t: number, weights: readonly number[], pressure: number, act: readonly number[]): Readout {
  if (t < 0.147) {
    const scanned = clamp((t - 0.09) / 0.055);
    return { status: 'scanning', n: Math.round(scanned * 100), region: null, doing: null, meter: scanned };
  }
  if (t < 0.2) {
    const f = ease(t, 0.15, 0.2);
    return { status: 'takingIn', n: Math.round(9400 * f), region: 'whole', doing: 'listening', meter: f };
  }
  if (t < 0.29) {
    const n = clamp(Math.floor((t - 0.205) / 0.008) + 1, 0, 6);
    return { status: 'found', n, region: 'whole', doing: 'sorting', meter: n / 6 };
  }
  if (t < QA0) return { status: 'goingIn', n: 0, region: THOUGHTS[0].region, doing: THOUGHTS[0].doing, meter: 0.3 };
  if (t < 0.78) {
    let k = -1, most = 0;
    for (let i = 0; i < 6; i++) if (weights[i] > most) [k, most] = [i, weights[i]];
    if (k < 0) k = nearestThought(t);
    return { status: 'thought', n: k + 1, region: THOUGHTS[k].region, doing: THOUGHTS[k].doing, meter: clamp(act[k] ?? 0) };
  }
  if (t < 0.83) return { status: 'words', n: 0, region: 'broca', doing: 'speaking', meter: clamp(act[6] ?? 0) };
  if (t < 0.858) return { status: 'down', n: 0, region: 'brainstem', doing: 'relaying', meter: ease(t, 0.83, 0.858) };
  if (t < 0.88) return { status: 'jaw', n: 0, region: 'jaw', doing: 'jaw', meter: ease(t, 0.858, 0.88) };
  if (t < SPIT_T) return { status: 'holding', n: 0, region: 'mouth', doing: 'pressure', meter: pressure };
  return { status: 'spitting', n: 0, region: 'mouth', doing: 'spitting', meter: 1 };
}
