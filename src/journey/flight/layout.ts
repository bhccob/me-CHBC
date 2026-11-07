import { ease } from '../math';
import { buildTimeline, type Timeline } from '../timeline';

/**
 * The flight, worked out from the projects alone, so that adding a project extends it with no other code. With the four of
 * the approved mock-up it gives the mock's numbers. Pure: no three.
 */

/** How far before a project the camera reads it, in distance units. */
export const READ = 4.7;

/** The first stop's year gate, and how far on things stand from each other. */
const FIRST_YEAR = 20;
const YEAR_TO_STOP = 20;
const STOP_TO_YEAR = 20;
const SAME_YEAR = 36;
const TAIL = 28;

export interface FlightStop {
  id: string;
  s: number;
  side: 1 | -1;
  year: number;
}

export interface FlightLayout {
  stops: FlightStop[];
  years: { year: number; s: number }[];
  gates: number[];
  end: number;
}

export function flightLayout(list: readonly { id: string; year: number }[]): FlightLayout {
  const stops: FlightStop[] = [], years: FlightLayout['years'] = [], gates: number[] = [8];
  list.forEach(({ id, year }, i) => {
    const before = stops.at(-1);
    let s: number;
    if (!before || before.year !== year) {
      const yearAt = before ? before.s + STOP_TO_YEAR : FIRST_YEAR;
      years.push({ year, s: yearAt });
      gates.push(yearAt + 10);
      s = yearAt + YEAR_TO_STOP;
    } else s = before.s + SAME_YEAR;
    stops.push({ id, s, side: i % 2 ? -1 : 1, year });
    gates.push(s + 8);
    const next = list[i + 1];
    if (!next) gates.push(s + 18);
    else if (next.year === year) gates.push(s + 18, s + 26);
  });
  return { stops, years, gates, end: (stops.at(-1)?.s ?? 0) + TAIL };
}

export interface DistanceTable {
  cum: Float64Array;
  n: number;
  end: number;
  /** How long the whole flight takes, in the table's own time: slow stretches count for more. */
  time: number;
}

/** How scroll turns into distance: slow where you read, quick between, never still. */
export function distanceTable(layout: FlightLayout): DistanceTable {
  const n = Math.round((3000 * layout.end) / 180), cum = new Float64Array(n + 1);
  const reads = layout.stops.map((stop) => stop.s - READ);
  for (let i = 1; i <= n; i++) {
    const s = (i / n) * layout.end;
    let slow = 0.55 * (1 - ease(s, 8, 18));
    for (const r of reads) slow = Math.max(slow, ease(s, r - 7, r - 3) * (1 - ease(s, r + 0.6, r + 2.4)));
    for (const y of layout.years) slow = Math.max(slow, 0.25 * ease(s, y.s - 9, y.s - 5) * (1 - ease(s, y.s - 1, y.s + 1)));
    cum[i] = cum[i - 1] + 1 / (1 - 0.8 * slow);
  }
  const total = cum[n];
  for (let i = 0; i <= n; i++) cum[i] /= total;
  return { cum, n, end: layout.end, time: total * (layout.end / n) };
}

/** The approved mock-up's four, whose flight took 216 frames: the measure of a frame of the flight's time. */
const MOCK_FOUR = [{ id: 'a', year: 2025 }, { id: 'b', year: 2026 }, { id: 'c', year: 2026 }, { id: 'd', year: 2026 }];
const MOCK_FRAMES = 216;
let framesPerTime = 0;

/**
 * How many frames a flight takes: as many for each stretch of its time as the mock-up's did, so that its start plays
 * frame for frame the same whatever projects come after, and taking one off or adding one moves only what follows.
 */
export function flightFrames(table: DistanceTable): number {
  if (framesPerTime === 0) framesPerTime = MOCK_FRAMES / distanceTable(flightLayout(MOCK_FOUR)).time;
  return Math.round(table.time * framesPerTime);
}

/** The distance along the flight, for how far through its frames it is, 0 to 1. */
export function distanceAt(t: number, { cum, n, end }: DistanceTable): number {
  let lo = 0, hi = n;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= t) lo = m;
    else hi = m;
  }
  const u = (t - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
  return ((lo + Math.min(1, Math.max(0, u))) / n) * end;
}

/** The frame each project is read at. */
export function readFrames(layout: FlightLayout, table: DistanceTable): number[] {
  const [from, to] = buildTimeline(layout.end, undefined, flightFrames(table)).flight;
  return layout.stops.map((stop) => Math.round(from + table.cum[Math.round(((stop.s - READ) / layout.end) * table.n)] * (to - from)));
}

/** The whole journey's timeline, with this flight in it. */
export function timelineFor(layout: FlightLayout): Timeline {
  const table = distanceTable(layout);
  return buildTimeline(layout.end, readFrames(layout, table), flightFrames(table));
}
