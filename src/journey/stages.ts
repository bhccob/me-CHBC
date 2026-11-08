import type { Timeline } from './timeline';

/** The journey loads in stages: the first view waits for nothing later. Pure. */

export type JourneyStage = 'machine' | 'flight' | 'head' | 'end';

const ORDER: readonly JourneyStage[] = ['machine', 'flight', 'head', 'end'];

/** How far ahead the next stage starts loading, in frames. */
const AHEAD = 80;

/** Where each stage starts: the head where the flight leaves off, and the soft bang behind the report with the spit. */
function startOf(stage: JourneyStage, tl: Timeline): number {
  if (stage === 'machine') return 0;
  if (stage === 'flight') return 340;
  if (stage === 'head') return tl.head[0];
  return tl.chapters.at(-1)?.from ?? tl.last;
}

/** The stage frame `f` stands in. */
export function stageFor(f: number, tl: Timeline): JourneyStage {
  let now: JourneyStage = 'machine';
  for (const stage of ORDER) if (f >= startOf(stage, tl)) now = stage;
  return now;
}

/** What to load now: the current stage first, then the next once it is within 80 frames. */
export function stagesToLoad(f: number, tl: Timeline, loaded: ReadonlySet<string>): JourneyStage[] {
  const now = stageFor(f, tl);
  const list: JourneyStage[] = loaded.has(now) ? [] : [now];
  const next = ORDER[ORDER.indexOf(now) + 1];
  if (next && !loaded.has(next) && startOf(next, tl) - f <= AHEAD) list.push(next);
  return list;
}
