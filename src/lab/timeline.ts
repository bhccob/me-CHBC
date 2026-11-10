import { projects } from '~/data/projects';
import { flightLayout, timelineFor } from '~/journey/flight/layout';
import { headFrame } from '~/journey/head/time';
import type { Timeline } from '~/journey/timeline';

/**
 * LAB ONLY (throwaway). The live site's own timeline, unchanged frame for frame: the opening is frames 0 to 372, the flight
 * 350 to 477, the head from 477. Only the scroll per frame of the opening is shorter (its own pace), and the lab's page
 * ends a little into the head, once the scan has reached him.
 */
export const OPENING_PACE = 0.7;
/** How far into the head the lab goes: the head's `t`, past the scan band reaching him and the lid starting. */
const HEAD_T_END = 0.13;

export function labTimeline(): Timeline {
  const base = timelineFor(flightLayout(projects.byDate()));
  const last = Math.round(headFrame(HEAD_T_END, base));
  return { ...base, last, settled: last, paces: [{ from: 0, to: 336, times: OPENING_PACE }] };
}
