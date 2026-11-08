# Into My Head Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rebuild's void, gold-line Q&A, collapse, bang and end page with one continuous journey: an X-ray scan of Bob's head, six answers read inside his brain, the spit, and the scan report over a soft big bang.

**Architecture:** The head journey takes the void's place in `TunnelScene`'s world, so the camera leaves the flight without a cut. A pure time layer (`src/journey/head/`) maps frames to the mock's journey `t` and runs the ending's own clock. The 3D parts (`src/journey/world/head/`), the page parts (`src/ui/journey/`) and the sound all read that one `t`. The head is baked once from the mock's distance fields into `public/models/head.bin`.

**Tech Stack:** TypeScript, React 19 with React Router prerender, Three.js (ShaderMaterial, MarchingCubes from `three/examples/jsm` at bake time), Web Audio, Vitest, the Playwright proof harness `tools/proof/journey.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-08-bob-into-my-head-design.md`. The look, the motion and the words come from mock-up 20, `.superpowers/brainstorm/828-1794127460/content/brain-dive-v20.html` (git-excluded, local only). Line numbers below are that file's.

## Global Constraints

- Work on the branch `bob-rebuild`. Commit after each task. Never push: a push to `main` deploys, and only Bob says go live.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Messages follow the repo's style: `area: what is now true`.
- No subagents: Bob's standing rule. The work is done inline.
- Run `2026-11-08-dark-purple-and-qa-words.md` first: this plan uses its `--night: #130724` and `GROUND`.
- Seamless motion is the first quality: no cut, jump or fade to black from the flight to the last link.
- Code art only. No AI images, no use of Bob's photos. The head is the mock's distance fields.
- Every word comes from `src/i18n/en.ts` and `nl.ts`, Dutch formal. The six answers stay Bob's own (`end.questions`). The internship company is never named.
- Ending links: GitHub, Instagram, Send a message (`/contact/`). No Email. The report has no Status line.
- The soft big bang is the mock's Universe bang at 0.45 strength: flash peak 0.22, three octagon rings, no camera orbit, no toy.
- Ending clock: from `SPIT_T = 0.932`, `t` runs to 1 over `FINALE_S = 4.8` seconds by time, rewinds when the scroll's `t` falls below `0.928`, and lands finished on a jump to Contact. Every ending sound fires from that clock.
- Targets from the rebuild spec, section 11, hold: weak-GPU median frame under 33 ms at 1080p, no frame over 100 ms after loading, shaders compiled while loading, `npm test`, `npm run typecheck`, `npm run audit`, Lighthouse 100 for accessibility, best practices and SEO.
- `public/models/head.bin` at most 3 MB.

## Review Focus

- **Scrolling back up out of the report into the mouth.** The clock rewinds, the report, scan line and bang vanish, and no ending sound replays on the way back. Tests: Task 2 (`endClock` rewinds) and Task 4 (`dueCues` plays nothing backwards).
- **Arriving straight at Contact** (header, rail, `#contact`, a reload in the ending). It lands on the finished report and plays none of the thirty-odd cues it skipped. Tests: Task 2 (`jumped` finishes the clock) and Task 4 (`jumped` plays nothing).
- **Switching language mid-journey.** Labels, read-out, answer cards, the words that pour in and the report change language in place, and the place holds. Tests: Task 6 (every head key in both languages) and the harness step `headLanguage` in Task 10.
- **Resizing or rotating a phone during an answer or the ending.** Cards follow their anchors, the labels lay out again, and the report's row tops are measured again, so the scan line prints the right rows. Harness step `headResize` in Task 11.
- **`head.bin` failing to load.** The shaft must not stand empty: the stage fails the same way a failed void stage does today, to the calm page with its Lite link. Harness step `headMissing` in Task 9.

---

### Task 1: The head's shape, baked

**Files:**
- Create: `src/journey/head/shape.ts`: the distance fields, ported from mock lines 500–616 (`ell`, `sell`, `smin`, `smax`, `cone`, `J`, `jawY`, `lowMass`, `headSdf0` as `headSdf`, `brainSdf`, `cutY`), and `pieceOf` for the lid (mock lines 893–899, style 2 only), plus `headOutline()` (mock `contour`, lines 1580–1594).
- Create: `src/journey/head/headBin.ts`: the file format.
- Create: `tools/head/bake.mjs`: runs MarchingCubes over the fields as the mock's `surfaceMesh` does (mock lines 867–885) and writes the file.
- Create: `public/models/head.bin`, built by the tool and committed.
- Modify: `package.json`: `"build:head": "tsx tools/head/bake.mjs"`.
- Test: `tests/unit/journey/head-shape.test.ts`

**Interfaces:**
- Produces: `headSdf(x: number, y: number, z: number): number`, `brainSdf(x, y, z): number` in head units (about 10 cm, face toward +z, chin −0.97, crown 1.22).
- Produces: `headOutline(): { head: Seg[]; brain: Seg[] }` with `type Seg = [[number, number], [number, number]]`, the side view in (z, y).
- Produces: `interface HeadPart { name: 'skin' | 'brain' | 'brainDust'; positions: Float32Array; normals?: Float32Array; extra?: Float32Array; index?: Uint32Array }`. For skin, `extra` is the lid piece (0 or 1). For brainDust, it is each point's seed.
- Produces: `encodeHead(parts: HeadPart[]): ArrayBuffer` and `decodeHead(buffer: ArrayBuffer): HeadPart[]`. The format: `'HEAD'`, then a little-endian u32 version (1), a u32 part count, and per part: a u8 name length, the name padded to 4 bytes, a u32 vertex count, a u32 index count, Int16 positions quantized to the part's box (the box stored first as 6 f32), Int8 normals ×3, Uint8 extra, then Uint32 indices. The decoder gives back floats.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/journey/head-shape.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brainSdf, headOutline, headSdf } from '~/journey/head/shape';
import { decodeHead, encodeHead } from '~/journey/head/headBin';

describe("Bob's head, from the mock's distance fields", () => {
  it('is inside at its middle, outside far off, crown at 1.22, chin near -0.97', () => {
    expect(headSdf(0, 0, 0)).toBeLessThan(0);
    expect(headSdf(0, 3, 0)).toBeGreaterThan(0);
    expect(Math.abs(headSdf(0, 1.22, -0.05))).toBeLessThan(0.04);
    expect(brainSdf(0, 0.47, -0.08)).toBeLessThan(0);
  });
  it('draws a side outline of head and brain', () => {
    const { head, brain } = headOutline();
    expect(head.length).toBeGreaterThan(200);
    expect(brain.length).toBeGreaterThan(100);
  });
});

describe('head.bin', () => {
  it('round-trips, within its quantizing', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0.5, -0.25, -1, 1, 1]);
    const [back] = decodeHead(encodeHead([{ name: 'brainDust', positions, extra: new Float32Array([0, 0.5, 1]) }]));
    expect(back.name).toBe('brainDust');
    back.positions.forEach((v, i) => expect(v).toBeCloseTo(positions[i], 3));
  });
  it('holds skin with its lid, brain and brain dust, in at most 3 MB', () => {
    const file = readFileSync('public/models/head.bin');
    expect(file.byteLength).toBeLessThanOrEqual(3 * 1024 * 1024);
    const parts = decodeHead(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    expect(parts.map((p) => p.name)).toEqual(['skin', 'brain', 'brainDust']);
    expect(new Set(parts[0].extra)).toEqual(new Set([0, 1]));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/journey/head-shape.test.ts`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Port the fields and write the format**

Port the fields line for line. Keep every constant, because they are Bob's approved proportions. `headOutline` uses the mock's `contour` at step 0.018 (head) and 0.014 (brain, x = 0.25), over z −1.25..1.25 and y −1.55..1.35.

- [ ] **Step 4: Bake**

`tools/head/bake.mjs` imports `shape.ts` through `tsx`, and three's `MarchingCubes`. It builds:
- skin: `headSdf`, resolution 108, centre (0, −0.42, 0), half-size 1.72, at most 170,000 triangles, with `extra` from `pieceOf`
- brain: `brainSdf`, resolution 80, centre (0, 0.47, −0.08), half-size 0.7, at most 120,000 triangles
- brainDust: 9,000 points on the brain's surface (mock `surfacePoints`, box [−0.6, 0.6, 0, 0.92, −0.8, 0.66])

Merge equal vertices into an index before writing.
Run: `npm run build:head`
Expected: `public/models/head.bin` written, and the tool prints its size, under 3 MB.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/journey/head-shape.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/journey/head/shape.ts src/journey/head/headBin.ts tools/head/bake.mjs public/models/head.bin package.json tests/unit/journey/head-shape.test.ts
git commit -m "head: Bob's head and brain baked once from the mock's distance fields, with the lid, into head.bin"
```

### Task 2: The head's time, and the ending's clock

**Files:**
- Create: `src/journey/head/time.ts`
- Create: `src/journey/head/thoughts.ts` with only `QA0 = 0.335`, `QA1 = 0.77`, `NQ = 6`, `HOLD = 0.021`, `dwellT(i)` and `holdOf(i)` (mock lines 1264–1267). The timeline needs `dwellT(0)`, and Task 3 adds the rest of the file.
- Modify: `src/journey/timeline.ts`: drop `void`, `dissolve`, `lookBack`, `qaReads`, `collapse`, `bang` and the questions' pace; add `head`; `last` becomes `head[1]`; chapters `qa` and `contact` move.
- Modify: `src/journey/stages.ts`: the stages are `'machine' | 'flight' | 'head' | 'end'`.
- Modify: `src/journey/jump.ts`: `railOpacity` fades out at `contact.from` instead of the collapse.
- Test: `tests/unit/journey/head-time.test.ts` (create), `tests/unit/journey/timeline.test.ts` (update), `tests/unit/journey/rail.test.ts` (update)

**Interfaces:**
- Produces, in `time.ts`: `HEAD_FRAMES = 930`; `SLOW: readonly (readonly [number, number])[] = [[0, 0], [0.082, 0.09], [0.4, 0.335], [0.95, 0.885], [0.979, 0.932], [1, 1]]`; `SPIT_T = 0.932`; `HOLD_IN = [0.885, 0.93] as const`; `FINALE_S = 4.8`.
- Produces: `headT(f: number, tl: Timeline): number`, 0 before `tl.head[0]`, 1 after `tl.head[1]`, and between them the mock's monotone cubic (`pchip`, mock lines 1279–1295) through `SLOW` on `(f - head[0]) / HEAD_FRAMES`.
- Produces: `headFrame(t: number, tl: Timeline): number`, the inverse (bisection is fine).
- Produces: `interface EndClock { at: number | null }` and `endClock(clock: EndClock, tScroll: number, nowS: number, jumped: boolean): number`. It mutates `clock` and returns the effective `t` everything reads.
- Produces: `Timeline.head: [number, number]` = `[566 + shift, 566 + shift + HEAD_FRAMES]`, the `qa` chapter `{ from: head[0], jump: Math.round(headFrame(dwellT(0))) }` (Task 3's `dwellT(0)` is 0.371), and the `contact` chapter `{ from: Math.round(headFrame(SPIT_T)), jump: last }`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/journey/head-time.test.ts
import { describe, expect, it } from 'vitest';
import { endClock, FINALE_S, headFrame, headT, HEAD_FRAMES, SPIT_T } from '~/journey/head/time';
import { buildTimeline } from '~/journey/timeline';

const tl = buildTimeline();
const at = (share: number) => tl.head[0] + share * HEAD_FRAMES;

describe("the head's time, at the mock's pace", () => {
  it('starts where the flight ends and runs 930 frames', () => {
    expect(tl.head).toEqual([566, 1496]);
    expect(tl.last).toBe(1496);
  });
  it('goes slowly through the scan and the trip to the mouth (Bob)', () => {
    expect(headT(tl.head[0], tl)).toBe(0);
    expect(headT(at(0.082), tl)).toBeCloseTo(0.09, 6);
    expect(headT(at(0.4), tl)).toBeCloseTo(0.335, 6);
    expect(headT(at(0.979), tl)).toBeCloseTo(SPIT_T, 6);
    for (let f = tl.head[0]; f < tl.head[1]; f += 3) expect(headT(f + 3, tl)).toBeGreaterThanOrEqual(headT(f, tl));
  });
  it('turns back into frames', () => {
    for (const t of [0.05, 0.371, 0.734, 0.9]) expect(headT(headFrame(t, tl), tl)).toBeCloseTo(t, 4);
  });
});

describe("the ending's own clock (Bob: the sound was out of step)", () => {
  it('follows the scroll before the spit', () => {
    expect(endClock({ at: null }, 0.9, 10, false)).toBe(0.9);
  });
  it('runs from the spit to 1 over 4.8 s by time', () => {
    const clock = { at: null };
    expect(endClock(clock, SPIT_T, 10, false)).toBeCloseTo(SPIT_T, 6);
    expect(endClock(clock, SPIT_T, 10 + FINALE_S / 2, false)).toBeCloseTo(SPIT_T + (1 - SPIT_T) / 2, 6);
    expect(endClock(clock, SPIT_T, 10 + FINALE_S + 3, false)).toBe(1);
  });
  it('rewinds above the spit', () => {
    const clock = { at: 10 };
    expect(endClock(clock, 0.9279, 12, false)).toBeCloseTo(0.9279, 6);
    expect(clock.at).toBeNull();
  });
  it('lands finished on a jump to Contact', () => {
    expect(endClock({ at: null }, SPIT_T + 0.01, 50, true)).toBe(1);
  });
});
```

Update `timeline.test.ts`: the first `it` checks `[tl.last, tl.shift, tl.flight, tl.head]` = `[1496, 0, [350, 566], [566, 1496]]`, and drops `void`, `dissolve`, `collapse`, `bang`, `lookBack` and `qaReads`. Chapters `qa` and `contact` check with `headT(chapter.jump)` close to 0.371, and `headT(contact.from)` close to `SPIT_T`. A longer flight (`buildTimeline(216)`) moves `head` by 43. `paces` holds only the studies.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/journey/head-time.test.ts tests/unit/journey/timeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `time.ts`, then the timeline, stages and rail**

`endClock`: below `SPIT_T - 0.004` set `at = null` and return `tScroll`. At or past `SPIT_T` with no clock, start it at `nowS`, or at `nowS - FINALE_S` when `jumped`. With a clock, return `SPIT_T + (1 - SPIT_T) * clamp((nowS - at) / FINALE_S)`. Otherwise return `tScroll`. In `stages.ts`, `head` starts at `tl.head[0]` and `end` at `headFrame(0.88)`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/journey/head-time.test.ts tests/unit/journey/timeline.test.ts tests/unit/journey/rail.test.ts tests/unit/journey/jump.test.ts`
Expected: PASS. Other journey tests that still read `tl.void` or `tl.bang` fail until Task 12 removes their code. Note them and leave them.

- [ ] **Step 5: Commit**

```bash
git add src/journey/head/time.ts src/journey/timeline.ts src/journey/stages.ts src/journey/jump.ts tests/unit/journey/head-time.test.ts tests/unit/journey/timeline.test.ts tests/unit/journey/rail.test.ts
git commit -m "head: its 930 frames at the mock's pace, and the ending's own 4.8 s clock that rewinds above the spit"
```

### Task 3: The thoughts, the answers' timing and the read-out

**Files:**
- Modify: `src/journey/head/thoughts.ts` (from Task 2): add `THOUGHTS` (mock lines 480–488, without the words), `CAMS`, `DOWN` and `DOWN_T` (mock lines 1263–1270).
- Create: `src/journey/head/readout.ts`
- Test: `tests/unit/journey/head-thoughts.test.ts`

**Interfaces:**
- Produces: `type ThoughtKey = 'plans' | 'career' | 'hobbies' | 'places' | 'skills' | 'site' | 'speech'`; `type RegionKey = 'prefrontal' | 'frontal' | 'motor' | 'parietal' | 'cerebellum' | 'wernicke' | 'broca' | 'whole' | 'brainstem' | 'jaw' | 'mouth'`; `type DoingKey = 'planning' | 'deciding' | 'moving' | 'place' | 'practice' | 'language' | 'speaking' | 'listening' | 'sorting' | 'relaying' | 'jaw' | 'pressure' | 'spitting'`; `type ObjectKind = 'cap' | 'rocket' | 'barbell' | 'globe' | 'block' | 'browser'`.
- Produces: `interface Thought { key: ThoughtKey; region: RegionKey; doing: DoingKey; c: [number, number, number]; object: ObjectKind | null }` and `THOUGHTS: readonly Thought[]` (seven; speech has no object).
- Produces: `dwellT(i: number): number`, `holdOf(i: number): number`, and `dwellWeights(t: number): number[]` (seven weights, mock line 2957).
- Produces: `answerShown(t: number, i: number): number` (mock lines 2974–2975).
- Produces: `type StatusKey = 'scanning' | 'takingIn' | 'found' | 'goingIn' | 'thought' | 'words' | 'down' | 'jaw' | 'holding' | 'spitting'` and `readoutAt(t: number, weights: readonly number[], pressure: number, act: readonly number[]): { status: StatusKey; n: number; region: RegionKey | null; doing: DoingKey | null; meter: number }` (mock lines 3106–3115; `n` is the percent, the count or the thought's number).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/journey/head-thoughts.test.ts
import { describe, expect, it } from 'vitest';
import { readoutAt } from '~/journey/head/readout';
import { answerShown, dwellT, dwellWeights, THOUGHTS } from '~/journey/head/thoughts';

describe('the six thoughts (spec 5.7)', () => {
  it('are read at the mock\'s stops, and Broca\'s area after them', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => dwellT(i).toFixed(3))).toEqual(['0.371', '0.444', '0.516', '0.589', '0.661', '0.734']);
    expect(dwellT(6)).toBe(0.795);
  });
  it('sit where the spec puts them, each with its object', () => {
    expect(THOUGHTS.map((x) => [x.key, x.region, x.doing, x.object])).toEqual([
      ['plans', 'prefrontal', 'planning', 'cap'], ['career', 'frontal', 'deciding', 'rocket'], ['hobbies', 'motor', 'moving', 'barbell'],
      ['places', 'parietal', 'place', 'globe'], ['skills', 'cerebellum', 'practice', 'block'], ['site', 'wernicke', 'language', 'browser'],
      ['speech', 'broca', 'speaking', null],
    ]);
  });
  it('light one at a time, fully at the stop and not at all halfway between', () => {
    expect(dwellWeights(dwellT(2))[2]).toBe(1);
    expect(dwellWeights((dwellT(2) + dwellT(3)) / 2).every((w) => w === 0)).toBe(true);
    expect(answerShown(dwellT(4), 4)).toBe(1);
    expect(answerShown(dwellT(4), 3)).toBe(0);
  });
});

describe("the scanner's read-out (spec 6)", () => {
  const w = (t: number) => dwellWeights(t);
  const none = [0, 0, 0, 0, 0, 0, 0, 0];
  it('says what is happening, from the scan to the spit', () => {
    expect(readoutAt(0.12, w(0.12), 0, none)).toMatchObject({ status: 'scanning' });
    expect(readoutAt(0.175, w(0.175), 0, none)).toMatchObject({ status: 'takingIn', region: 'whole', doing: 'listening' });
    expect(readoutAt(0.25, w(0.25), 0, none)).toMatchObject({ status: 'found', n: 6, doing: 'sorting' });
    expect(readoutAt(0.3, w(0.3), 0, none)).toMatchObject({ status: 'goingIn', region: 'prefrontal' });
    expect(readoutAt(dwellT(3), w(dwellT(3)), 0, none)).toMatchObject({ status: 'thought', n: 4, region: 'parietal', doing: 'place' });
    expect(readoutAt(0.8, w(0.8), 0, none)).toMatchObject({ status: 'words', region: 'broca' });
    expect(readoutAt(0.845, w(0.845), 0, none)).toMatchObject({ status: 'down', region: 'brainstem' });
    expect(readoutAt(0.87, w(0.87), 0, none)).toMatchObject({ status: 'jaw', region: 'jaw' });
    expect(readoutAt(0.9, w(0.9), 0.5, none)).toMatchObject({ status: 'holding', region: 'mouth', meter: 0.5 });
    expect(readoutAt(0.95, w(0.95), 0, none)).toMatchObject({ status: 'spitting', region: 'mouth' });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/journey/head-thoughts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement both modules from the mock lines named above**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/journey/head-thoughts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/journey/head/thoughts.ts src/journey/head/readout.ts tests/unit/journey/head-thoughts.test.ts
git commit -m "head: the six thoughts, when each answer shows, and what the scanner's read-out says"
```

### Task 4: The report's timing, the soft bang's timing, the cues

**Files:**
- Create: `src/journey/head/report.ts`
- Create: `src/journey/head/cues.ts`
- Test: `tests/unit/journey/head-report.test.ts`, `tests/unit/journey/head-cues.test.ts`

**Interfaces:**
- Produces: `scanLineAt(t: number): { opacity: number; widen: number; down: number }`. `widen` is `smooth(0.958, 0.962, t)` and `down` is `clamp((t - 0.962) / 0.024)`. `opacity` is 0 before 0.958, then `1 - smooth(0.986, 0.99, t)`.
- Produces: `rowShown(t: number, rowTop: number): number` = `clamp((scanLineAt(t).down - rowTop) / 0.09)`, where `rowTop` is the row's top as a share of the report's height.
- Produces: `reportFrameOpacity(t: number): number` = `smooth(0.958, 0.965, t)`.
- Produces: `softBangAt(t: number): { flash: number; rings: [number, number, number]; grow: number }`. `flash` is `exp(-(t - 0.958) / 0.004) * 0.22` from 0.958 on. Each ring k is `smooth(0.959 + 0.003k, 0.999, t)`. `grow` is `smooth(0.958, 0.99, t)`.
- Produces: `type HeadCue = 'scan' | 'lid' | 'label' | 'dive' | 'thought' | 'corridor' | 'down' | 'spit' | 'gather' | 'softBang' | 'print' | 'printTitle'`; `HEAD_CUES: readonly { t: number; cue: HeadCue; n: number }[]` (the mock's sound block in `draw()`, search `const cross = (x) =>`, and the ending's: scan 0.093, lid 0.115, label k at 0.205 + 0.008k, dive 0.3, thought i at `dwellT(i) - holdOf(i) - 0.008`, corridor between stops at the midpoint − 0.012, down at each `DOWN_T` − 0.006, spit `SPIT_T`, gather 0.95, softBang 0.958).
- Produces: `dueCues(prevT: number, t: number, jumped: boolean): { cue: HeadCue; n: number }[]`, which plays forward only and nothing on a jump; `printCues(prevT: number, t: number, rowTops: readonly number[], titleRow: number): { cue: 'print' | 'printTitle'; n: number }[]`; `pressureAt(t: number): number` = `smooth(0.885, 0.93, t) * (1 - smooth(0.932, 0.936, t))`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/journey/head-report.test.ts
import { describe, expect, it } from 'vitest';
import { reportFrameOpacity, rowShown, scanLineAt, softBangAt } from '~/journey/head/report';

describe('the scan line prints the report (spec 5.11)', () => {
  it('opens at the spark, sweeps down, and fades', () => {
    expect(scanLineAt(0.957).opacity).toBe(0);
    expect(scanLineAt(0.962)).toMatchObject({ opacity: 1, widen: 1, down: 0 });
    expect(scanLineAt(0.974).down).toBeCloseTo(0.5, 6);
    expect(scanLineAt(0.99).opacity).toBe(0);
  });
  it('prints a row only once the line has passed it', () => {
    expect(rowShown(0.974, 0.6)).toBe(0);
    expect(rowShown(0.986, 0.6)).toBe(1);
  });
  it('the panel is up before the line moves', () => expect(reportFrameOpacity(0.965)).toBe(1));
});

describe('the soft big bang (Bob: not too strong)', () => {
  it('flashes at 0.22 at most, with three rings, and grows over the ending', () => {
    expect(softBangAt(0.958).flash).toBeCloseTo(0.22, 6);
    expect(softBangAt(0.97).flash).toBeLessThan(0.02);
    expect(softBangAt(0.97).rings).toHaveLength(3);
    expect([softBangAt(0.958).grow, softBangAt(0.99).grow]).toEqual([0, 1]);
  });
});
```

```ts
// tests/unit/journey/head-cues.test.ts
import { describe, expect, it } from 'vitest';
import { dueCues, pressureAt, printCues } from '~/journey/head/cues';

describe('the head journey sounds in step', () => {
  it('plays each cue once, going forward', () => {
    expect(dueCues(0.11, 0.12, false)).toEqual([{ cue: 'lid', n: 0 }]);
    expect(dueCues(0.2, 0.25, false).filter((c) => c.cue === 'label')).toHaveLength(6);
  });
  it('plays nothing going back, and nothing on a jump', () => {
    expect(dueCues(0.99, 0.5, false)).toEqual([]);
    expect(dueCues(0.2, 1, true)).toEqual([]);
  });
  it('ticks each printed row, and pings the title', () => {
    expect(printCues(0.962, 0.986, [0.1, 0.5, 0.8], 2)).toEqual([{ cue: 'print', n: 0 }, { cue: 'print', n: 1 }, { cue: 'printTitle', n: 2 }]);
  });
  it('builds the pressure behind the lips and lets it go at the spit', () => {
    expect([pressureAt(0.88), pressureAt(0.93), pressureAt(0.94)]).toEqual([0, 1, 0]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/journey/head-report.test.ts tests/unit/journey/head-cues.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `report.ts` and `cues.ts`**

`printCues` fires a row's cue when `scanLineAt(t).down` first passes its top, from `prevT` to `t`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/journey/head-report.test.ts tests/unit/journey/head-cues.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/journey/head/report.ts src/journey/head/cues.ts tests/unit/journey/head-report.test.ts tests/unit/journey/head-cues.test.ts
git commit -m "head: when the scan line prints each row, the soft bang at 0.45 strength, and every sound cue in step"
```

### Task 5: The objects of light, and the words that pour in

**Files:**
- Create: `src/journey/head/objects.ts`: the six drawings as line segments, ported from mock lines 1162–1236 (`shapeLines` and `OBJECTS`), with no three.
- Create: `src/journey/head/pour.ts`
- Test: `tests/unit/journey/head-objects.test.ts`

**Interfaces:**
- Produces: `objectSegments(kind: ObjectKind): Float32Array`, xyz pairs in a unit box, and `objectSvgPath(kind: ObjectKind): string`, an orthographic side view in a 100×100 box for the calm page.
- Produces: `CODE_LINES = ['const bob = new Engineer()', 'SELECT * FROM ideas;', 'firmware.flash()', 'git commit -m "next"', 'while (learning) build();'] as const`, and `pourWords(locale: Locale): { text: string; mono: boolean }[]`. These are the four field names from `t.journey.stack.labels.*.field`, every project's title from `projects.byDate()`, the place line `t.journey.head.pourPlace` (Task 6), "React · Three.js", Blender, and the code lines (mono), interleaved one sans to one mono where the code lines last.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/journey/head-objects.test.ts
import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { objectSegments, objectSvgPath } from '~/journey/head/objects';
import { CODE_LINES, pourWords } from '~/journey/head/pour';

describe('the objects of light', () => {
  it.each(['cap', 'rocket', 'barbell', 'globe', 'block', 'browser'] as const)('%s is drawn in lines, inside its box', (kind) => {
    const s = objectSegments(kind);
    expect(s.length % 6).toBe(0);
    expect(s.length).toBeGreaterThan(60);
    expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(objectSvgPath(kind)).toMatch(/^M/);
  });
});

describe('what pours into his head (spec 5.4)', () => {
  it('is what the visitor saw: the fields, every project, the code', () => {
    const en = pourWords('en').map((w) => w.text);
    for (const project of projects.byDate()) expect(en).toContain(project.copy('en').title);
    expect(en).toEqual(expect.arrayContaining(['Software Engineering', 'Game Development', 'Cybersecurity', 'Mechatronics', ...CODE_LINES]));
  });
  it('keeps the code the same in Dutch', () => {
    expect(pourWords('nl').filter((w) => w.mono).map((w) => w.text)).toEqual(pourWords('en').filter((w) => w.mono).map((w) => w.text));
  });
});
```

(If a project's title field is named differently from `copy(locale).title`, use the field the flight already draws, `flightLine` or `titleLines`, and say so in the commit.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/journey/head-objects.test.ts`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Port `OBJECTS` and write `pourWords`**

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/journey/head-objects.test.ts`
Expected: PASS. `pourWords` reads Task 6's `pourPlace`, so do Task 6 before this step, or add that one key now.

- [ ] **Step 5: Commit**

```bash
git add src/journey/head/objects.ts src/journey/head/pour.ts tests/unit/journey/head-objects.test.ts
git commit -m "head: the six objects of light as lines, and the words that pour in drawn from what the visitor saw"
```

### Task 6: The head journey's words, in English and Dutch

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/nl.ts`: add `journey.head`. Remove `journey.qaWord`, `journey.collapse`, and from `journey.end` the keys `kicker`, `promise`, `note`, `toy` and `email`.
- Test: `tests/unit/journey/head-words.test.ts`

**Interfaces:**
- Produces `journey.head`:
  - `heading`: `{ eyebrow: 'Q&A · six questions', title: "What's on my mind", line: 'Everything you have seen so far goes in. Watch what lights up.' }`
  - `readout`: `{ title: 'Neural scan · live', subject: 'Subject', status: 'Status', region: 'Region', doing: 'Doing' }`
  - `status`: `{ scanning: 'Scanning {n} %', takingIn: 'Taking in {n}', found: '{n} thoughts found', foundOne: '1 thought found', goingIn: 'Going in', thought: 'Thought {n} / 06', words: 'Putting it into words', down: 'Sending it down', jaw: 'Down to the jaw', holding: 'Holding it in', spitting: 'Spitting it out' }`
  - `regions`, keyed by `RegionKey`: Prefrontal cortex, Frontal lobe, Motor cortex, Parietal lobe, Cerebellum, Wernicke's area, Broca's area, Whole brain, Brainstem, Jaw nerve, Mouth
  - `doings`, keyed by `DoingKey`: Planning, Deciding, Moving, Sense of place, Practice, Language, Speaking, Listening, Sorting, Relaying, Moving the jaw, Building pressure, Spitting
  - `topics`, keyed by `ThoughtKey` without speech: Plans, Career, Hobbies, Places, Skills, This site
  - `ruler: 'Slice {n}'`, `sideMap: 'Side view · you are here'`, `pourPlace: 'Rotterdam ← Aruba'`
  - `report`: `{ complete: 'Scan complete', subject: 'Subject', basedIn: 'Based in', basedInValue: 'Rotterdam', bornIn: 'Born in', bornInValue: 'Aruba', heritage: 'Heritage', heritageValue: 'Chinese', thoughtsRead: 'Thoughts read', stillMissing: 'Still missing', stillMissingValue: '1 · yours', scan: 'Scan 01 · side', nextStep: 'Next step' }`
- Keeps: `journey.end.title` ("Let's talk."), `github`, `instagram`, `message`, `reach`, `place`, `top`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/journey/head-words.test.ts
import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';

const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe("the head journey's words", () => {
  it('stand in both languages, key for key', () => expect(keys(nl.journey.head).sort()).toEqual(keys(en.journey.head).sort()));
  it("say Bob's heritage as the site already does, and no Status line", () => {
    expect(en.journey.head.report).toMatchObject({ heritage: 'Heritage', heritageValue: 'Chinese' });
    expect(keys(en.journey.head.report)).not.toContain('status');
  });
  it('drop the old end page words and Email', () => {
    for (const gone of ['kicker', 'promise', 'note', 'toy', 'email']) expect(en.journey.end).not.toHaveProperty(gone);
    expect(en.journey).not.toHaveProperty('collapse');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/journey/head-words.test.ts`
Expected: FAIL, `journey.head` does not exist.

- [ ] **Step 3: Add the words**

Draft the Dutch formally ("Wat ik in mijn hoofd heb" or better; Bob reviews). Keep `{n}` placeholders. The type checker will flag every use of a removed key; leave those until Task 12, or remove the use now if it is one line.

- [ ] **Step 4: Run it, and the Dutch checks**

Run: `npx vitest run tests/unit/journey/head-words.test.ts tests/unit/journey/dutch-formal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.ts src/i18n/nl.ts tests/unit/journey/head-words.test.ts
git commit -m "head: the scanner's, the labels' and the report's words in English and Dutch; the old end page words and Email go"
```

### Task 7: The X-ray material and the camera's way

**Files:**
- Create: `src/journey/world/head/xray.ts`: the shared uniforms and `xrayMaterial`, ported from mock lines 640–794. Keep the lid (style 2) only, and drop the bone and visitor variants.
- Create: `src/journey/world/head/track.ts`: the camera's way, ported from mock `timedCurve` (lines 1296–1306) and `buildTrack` (lines 1307–1384, the `ending >= 2` ride branch), with `dwellPose` and `corridor` (lines 1271–1278).
- Test: `tests/unit/journey/head-track.test.ts`

**Interfaces:**
- Produces: `interface HeadUniforms { uTime; uAxis; uReveal; uScanY; uScanOn; uOpen; uBlink; uEyeGlow; uGazeL; uGazeR; uAct: { value: number[] }; uReg: { value: number[] }; uReading; uPx }`, with `headUniforms(): HeadUniforms` and `xrayMaterial(u: HeadUniforms, color: Color, opts: { kind: 0 | 2; hole?: number; jaw?: boolean; split?: boolean; strength?: number }): ShaderMaterial`.
- Produces: `interface Pose { pos: Vector3; look: Vector3; up: Vector3 }` and `buildHeadTrack(join: Pose, place: Matrix4, phone: boolean): (t: number, out: Pose) => Pose`. `place` maps head units (S = 14, as in the mock) into the tunnel's world.
- Produces: `headPlace(join: Pose): Matrix4`, which stands the head below and ahead of the tunnel's exit, so the way bends from the tunnel's forward to straight down.

The join replaces the mock's first key (t 0, at [0, 250, 0]) with two keys. At t 0 is the flight's last pose. At t 0.03 is a point that bends the way down. Every mock key from t 0.06 on is kept. The ride's end keys are the mock's for the Scan report: `END_POS = (0, −5, 62)`, `END_LOOK = (0, −5, 110)` in head-world units.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/journey/head-track.test.ts
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildHeadTrack, headPlace } from '~/journey/world/head/track';

const join = { pos: new Vector3(0, 0, -180), look: new Vector3(0, 0, -190), up: new Vector3(0, 1, 0) };
const way = buildHeadTrack(join, headPlace(join), false);
const pose = (t: number) => way(t, { pos: new Vector3(), look: new Vector3(), up: new Vector3() });

describe("the camera's one way through his head", () => {
  it('starts exactly where the flight ends, looking the same way', () => {
    const p = pose(0);
    expect(p.pos.distanceTo(join.pos)).toBeLessThan(1e-3);
    expect(p.look.clone().sub(p.pos).normalize().dot(new Vector3(0, 0, -1))).toBeGreaterThan(0.999);
  });
  it('never jumps: no step is more than four times the median', () => {
    const steps: number[] = [];
    for (let t = 0; t < 1; t += 0.0005) steps.push(pose(t).pos.distanceTo(pose(t + 0.0005).pos));
    const median = [...steps].sort((a, b) => a - b)[steps.length >> 1];
    expect(Math.max(...steps)).toBeLessThan(median * 4 + 0.05);
  });
  it('looks straight down the shaft by t 0.06', () => {
    const p = pose(0.06);
    expect(p.look.clone().sub(p.pos).normalize().y).toBeLessThan(-0.95);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/journey/head-track.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Port the track and the material**

The material has no unit test. It is checked by eye in Task 9 against the mock at the same `t`.

- [ ] **Step 4: Run it**

Run: `npx vitest run tests/unit/journey/head-track.test.ts`
Expected: PASS. If the step check fails at the join, move the t 0.03 key, not the mock's keys.

- [ ] **Step 5: Commit**

```bash
git add src/journey/world/head/xray.ts src/journey/world/head/track.ts tests/unit/journey/head-track.test.ts
git commit -m "head: the X-ray look, and one smooth way from the flight's exit down the shaft to the mouth and out"
```

### Task 8: The head scene: scan, lid, pour, thoughts, mouth, spit, soft bang

**Files:**
- Create: `src/journey/world/head/HeadScene.ts`. It loads `head.bin` (Task 1). It builds the skin with the lid, the brain and the brain dust; neurons, edges, nodes and pulses (mock lines 1109–1161); clusters, somas and inward glow (1150–1160); the objects (Task 5) as `LineSegments`; fibres (1385–1414); optic nerves (1238–1257); lip rings and the outside light (1640–1678). It also exposes anchors for the page.
- Create: `src/journey/world/head/pour.ts`: the glyph atlas, the glyph stream, dust and the phrase cards (mock lines 989–1108, `PHRASES` replaced by `pourWords(locale)`).
- Create: `src/journey/world/head/spit.ts`: the voice swarm, the letters, the spray and the spark (mock lines 1679–1729, and the ride's spark in `draw()`: search `if (tau > 0 && ending >= 2)`).
- Create: `src/journey/world/head/softBang.ts`: nebula, puffs, galaxies and octagon rings (mock lines 1843–1956, without `yours`, `holdSeed` and `fireGalaxy`), with every alpha multiplied by 0.45 and its timing from `softBangAt` (Task 4).

**Interfaces:**
- Consumes: Task 1 `decodeHead` (the lid's pieces are baked into the skin's `extra`); Task 3 `THOUGHTS`, `dwellWeights`, `answerShown`; Task 4 `softBangAt`, `pressureAt`; Task 5 `objectSegments`, `pourWords`; Task 7 `xrayMaterial`, `headUniforms`.
- Produces: `class HeadScene { constructor(scene: Scene, place: Matrix4); load(url: string, renderer: WebGLRenderer, locale: Locale): Promise<void>; update(input: HeadInput): void; anchors(camera: Camera, width: number, height: number, out: HeadAnchors): void; setLocale(locale: Locale): void; setQuality(q: JourneyQuality): void; show(on: boolean): void; dispose(): void }`.
- Produces: `interface HeadInput { t: number; time: number; dt: number; camera: PerspectiveCamera; phone: boolean; reduce: boolean }`. The quiet side's `reading` is worked out inside, as the largest `answerShown(t, i)`, so the page and the 3D always agree.
- Produces: `interface HeadAnchors { labels: [number, number][]; cards: [number, number][]; spark: [number, number]; reportTop: [number, number]; you: [number, number]; headBox: Box }`, in CSS px. The labels are the six regions, the cards are the six answers' anchors (mock `placeAnchors`, lines 1504–1519), `reportTop` is where the spark lands, and `you` is the camera on the side map.
- Produces: `class SoftBang { constructor(scene: Scene); place(at: Vector3, camera: PerspectiveCamera): void; update(t: number, time: number): void; setQuality(q: JourneyQuality): void; dispose(): void }`.

- [ ] **Step 1: Build the scene from the mock, section by section, in the order above**

Every material is additive, with no depth write, as in the mock (`ADD`, line 687). The eyes look at the camera, blink every 2.6 to 6.2 s, and glow while things pour in (mock lines 3087–3090). The quiet side while reading dims the brain, network, signals and fibres by the mock's factors (search `(1 - 0.6 * reading)`). While the pressure builds, a little spray escapes at the seam of the lips (`spit.ts`, the mock's `pressure > 0.3` branch of the spray), and the head shakes once the camera is outside (search `head.position.set(Math.sin(time * 53)`).

- [ ] **Step 2: Check it by eye against the mock**

Start the mock (the spec, section 3) and the dev server side by side, both at 1280×800. Use `window.__mock.jump(t)` on the mock and the `?f=` frame for `headFrame(t)` on the site. Compare at t 0.03, 0.1, 0.13, 0.17, 0.25, 0.3, 0.371, 0.516, 0.734, 0.8, 0.87, 0.91, 0.94, 0.96, 0.99 and 1, and save each pair under `proof-out/head/`.
Expected: the same picture within the site's lighting. Note every difference, and fix it or list it for Bob.

- [ ] **Step 3: Commit**

```bash
git add src/journey/world/head
git commit -m "head: the scene, from the scan and the lid to the spit and the soft bang, as mock-up 20 draws it"
```

### Task 9: Into the tunnel's world

**Files:**
- Modify: `src/journey/world/flight/TunnelScene.ts`. `loadVoid` becomes `loadHead` (`HeadScene`), and `loadEnd` builds a `SoftBang`. `update` takes `t` and, past the flight, poses the camera from `buildHeadTrack`. It sets the background to `GROUND`, with fog off. It drops `VoidScene`, `Questions`, `Bang` and `Universe`, and with them `press`, `release`, `endReport`, `questionReport` and `fired`.
- Modify: `src/journey/world/World.ts`: `update(f, dt, now, t)`, `load('head' | 'end')`, and `headAnchors()` in place of `report().questions` and `report().end`.
- Modify: `src/ui/journey/JourneyCanvas.tsx`: pass `t` through, and expose `headAnchors()`.

**Interfaces:**
- Consumes: Task 7 `buildHeadTrack`, `headPlace`; Task 8 `HeadScene`, `SoftBang`; Task 2 `headT`.
- Produces: `World.update(f: number, dt: number, now: number, t: number): WorldState`, where `WorldState.head: HeadAnchors | null` replaces `flight.words` and `fired`.
- Produces: `World.report(): { stops: StopReport[]; walls: number; head: { t: number; active: number; pressure: number } | null }`, for the harness.

- [ ] **Step 1: Wire it**

The join pose is the flight's last pose: `center(end)`, looking toward `center(end + LOOK_AHEAD)`, with up `frameAt(end).U`. Hand it to `headPlace` and `buildHeadTrack` once the flight's layout is known. Behind the lips the view shakes with the pressure: offset the camera by `pressureAt(t)² × 0.09` head units on two sines (mock: search `const shake = pressure * pressure * 0.09`), until it is outside.

- [ ] **Step 2: Add the harness step `headMissing`, and run it**

In `tools/proof/journey.mjs`, block `/models/head.bin` with `page.route`, scroll past the flight, and expect the calm page with its Lite link, the same way a failed stage falls back today. Run it.
Expected: PASS.

- [ ] **Step 3: Walk the join**

Run the dev server, scroll from the last project's stop to the first label at an even pace, and record it with the harness's `smooth` step pointed at frames 540 to 820.
Expected: the `smooth` step's own threshold holds across the join. Screenshots at the tunnel's exit and at t 0.03 and 0.06 go to `proof-out/head/join-*.png`.

- [ ] **Step 4: Run the type check and the tests**

Run: `npm run typecheck`, `npm test`
Expected: the type check is clean apart from the old void, end and Q&A code that Task 12 removes. List those errors in the commit body. The branch is not live, and Task 12 leaves it clean.

- [ ] **Step 5: Commit**

```bash
git add src/journey/world src/ui/journey/JourneyCanvas.tsx tools/proof/journey.mjs
git commit -m "head: past the flight the camera bends down the shaft into his head, on the dark purple ground"
```

**Review stop (spec stage 2):** Bob judges the join, the scan, the lid, the pour and the labels, from the screenshots and the dev server.

### Task 10: The scanner on the page, and the six answers

**Files:**
- Create: `src/ui/journey/ScanHud.tsx`, with its root `<div class="j-hud" aria-hidden="true">`: the corners, the read-out, the ruler, the side map (`<canvas>` plus caption), the six labels with their leaders (SVG), the heading, the shade, and the violet glow (`radial-gradient(ellipse 70% 60% at 50% 45%, rgba(72, 30, 108, 0.2) 0%, rgba(40, 14, 64, 0.08) 45%, rgba(6, 2, 12, 0) 62%, rgba(6, 2, 12, 0.55) 100%)`).
- Create: `src/ui/journey/HeadAnswers.tsx`: six cards, each with the number in outline, `{topic} · {region}` in gold mono, the question in heavy capitals, and the answer. Questions and answers come from `t.end.questions`.
- Create: `src/ui/journey/applyHead.ts`
- Create: `src/journey/head/hud.ts`: `layoutLabels` (mock lines 1544–1579, pure), and the opacities `hudOpacity(t)` = `smooth(0.092, 0.112, t) * (1 - smooth(0.935, 0.955, t))`, `headingOpacity(t)` = `smooth(0.145, 0.165, t) * (1 - smooth(0.196, 0.212, t))`, `labelOpacity(t, k)` = `smooth(0.205 + 0.008k, 0.213 + 0.008k, t) * (1 - smooth(0.27, 0.288, t))` and `mapOpacity(t, reading)` = `hudOpacity(t) * smooth(0.27, 0.3, t) * (1 - 0.85 * reading)`.
- Modify: `src/ui/journey/Journey.tsx`: mount both, run the clock, and apply them each frame.
- Modify: `src/styles/journey.css`: their styles, from the mock's `#hud`, `.label`, `.q`, `#shade` and `#intro` rules, and phone rules at `max-width: 760px`.
- Test: `tests/unit/journey/head-page.test.ts`

**Interfaces:**
- Consumes: Task 2 `endClock`, `headT`; Task 3 `readoutAt`, `answerShown`, `dwellWeights`; Task 9 `WorldState.head`.
- Produces: `applyHead(els: HeadEls, t: number, anchors: HeadAnchors | null, words: HeadWords, phone: boolean): void`. The shade's opacity is the largest `answerShown(t, i)` × 0.95. For the "found" status it uses `foundOne` when `n` is 1.
- Produces: `layoutLabels(points: readonly [number, number][], box: Box, width: number, heights: readonly number[]): { x: number; y: number; side: -1 | 1 }[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/journey/head-page.test.ts
import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { headingOpacity, hudOpacity, labelOpacity, layoutLabels } from '~/journey/head/hud';
import { HeadAnswers } from '~/ui/journey/HeadAnswers';
import { ScanHud } from '~/ui/journey/ScanHud';
import { render } from './render';

describe('the six answers on the page (spec 5.7)', () => {
  it('are real text, numbered, each with its region', () => {
    const html = render(<HeadAnswers />, 'en');
    for (const { question, answer } of en.end.questions) {
      expect(html).toContain(question);
      expect(html).toContain(answer!);
    }
    expect(html).toContain('01');
    expect(html).toContain('Plans · Prefrontal cortex');
  });
});

describe('the scanner frame', () => {
  it('comes with the scan, and goes at the spit', () => {
    expect([hudOpacity(0.09), hudOpacity(0.5), hudOpacity(0.96)]).toEqual([0, 1, 0]);
    expect(headingOpacity(0.18)).toBe(1);
    expect(labelOpacity(0.24, 0)).toBe(1);
    expect(labelOpacity(0.3, 0)).toBe(0);
  });
  it('lays labels out on both sides, apart', () => {
    const out = layoutLabels([[500, 300], [520, 310], [700, 320], [710, 330], [600, 200], [650, 250]], { left: 400, top: 150, right: 800, bottom: 450 }, 1280, [40, 40, 40, 40, 40, 40]);
    expect(new Set(out.map((o) => o.side))).toEqual(new Set([-1, 1]));
  });
  it('carries its words, and decorates for screen readers', () => {
    const html = render(<ScanHud />, 'en');
    expect(html).toContain("What's on my mind");
    expect(html).toMatch(/class="j-hud"[^>]*aria-hidden="true"/);
  });
});
```

(Use the repo's `render(element, locale)` from `tests/unit/journey/render.ts`, with its signature as it stands.)

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/journey/head-page.test.ts`
Expected: FAIL, the modules do not exist.

- [ ] **Step 3: Build them**

Each card stands at its projected anchor with the mock's entry: scale from 0.94 to 1 and a blur of up to 6 px (mock lines 2977–2987). On a phone, cards sit lower and the shade runs top to bottom (mock line 71). The side map draws `headOutline()` (Task 1) once, then a dot per thought and the camera's arrow (mock `drawMini`, lines 1613–1639). The ruler says `Slice {n}` (mock line 3144). On phones, the ruler and the map's caption are hidden.

- [ ] **Step 4: Run the test, and check by eye**

Run: `npx vitest run tests/unit/journey/head-page.test.ts`
Expected: PASS. Then compare against the mock at t 0.17, 0.25 and each `dwellT(i)` at 1280×800 and 375×812, saved to `proof-out/head/`.

- [ ] **Step 5: Add the harness step `headLanguage`, and run it**

At t 0.5 (an answer showing) switch the language. Expect the place to hold (the shown frame within 2 of before), and the card, labels, read-out and the 3D's poured words to be in the other language.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/journey/ScanHud.tsx src/ui/journey/HeadAnswers.tsx src/ui/journey/applyHead.ts src/journey/head/hud.ts src/ui/journey/Journey.tsx src/styles/journey.css tests/unit/journey/head-page.test.ts tools/proof/journey.mjs
git commit -m "head: the scanner's frame, labels and read-out, and the six answers read one at a time with the brain gone quiet"
```

**Review stop (spec stage 3):** Bob reads the six answers on the dev server, at desktop and phone sizes.

### Task 11: The scan report

**Files:**
- Create: `src/ui/journey/ScanReport.tsx`, which replaces `EndWords.tsx`:
  - the header row: a blinking dot, "Scan complete", and the visitor's date and time with `Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`, set after hydration
  - six rows: subject, based in, born in, heritage, thoughts read ("6 / 6"), still missing
  - the head drawing (`<canvas>`, `headOutline()`) with "Scan 01 · side"
  - "Next step" with the title as `<h2 id="j-end-word">`
  - the links in `<nav id="contact">`: GitHub, Instagram, and Send a message (`<Link>` to `PAGES.contact`)
  - the scan line, and the footer bar (© year Bob Chung · place · Back to the start)
- Modify: `src/ui/journey/applyHead.ts`: `applyReport(els: ReportEls, t: number, rowTops: readonly number[]): void` sets the panel's opacity, the scan line's transform (`translateY(down * height) scaleX(widen)`) and each row's `clip-path: inset(0 X% 0 0)` from `rowShown`. `measureReport(els): number[]` measures row tops on load, resize and language change.
- Modify: `src/ui/journey/Journey.tsx`: the report replaces `EndWords`. The page's flash element (the one `layers.flash` drives today) takes `softBangAt(t).flash` at the spark's point. A jump to Contact (rail, header, `#contact`, or the first frame after a load) passes `jumped = true` to the clock.
- Modify: `src/styles/journey.css`: the report's styles from the mock's `#report` rules, on a `--night` panel at 0.78 opacity, with gold corner marks.
- Test: `tests/unit/journey/head-report-page.test.ts`

**Interfaces:**
- Consumes: Task 4 `scanLineAt`, `rowShown`, `reportFrameOpacity`, `softBangAt`; Task 6 `journey.head.report`.
- Produces: `rowTops` for the sound's `printCues` (Task 12).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/journey/head-report-page.test.ts
import { describe, expect, it } from 'vitest';
import { ScanReport } from '~/ui/journey/ScanReport';
import { render } from './render';

describe('the scan report (spec 5.11)', () => {
  const html = render(<ScanReport />, 'en');
  it('reports what the scan found, with his heritage and no Status line', () => {
    for (const word of ['Scan complete', 'Bob Chung', 'Rotterdam', 'Aruba', 'Chinese', '6 / 6', '1 · yours', 'Next step', "Let's talk."]) expect(html).toContain(word);
    expect(html).not.toContain('Status');
  });
  it('offers GitHub, Instagram and Send a message, and no Email', () => {
    expect(html).toContain('github.com');
    expect(html).toContain('instagram.com');
    expect(html).toContain('/en/contact/');
    expect(html).not.toContain('mailto:');
  });
  it('says the same in Dutch', () => expect(render(<ScanReport />, 'nl')).toContain('Chinees'));
});
```

(Use the Dutch value you chose in Task 6.)

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/journey/head-report-page.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Build the report and its timing**

- [ ] **Step 4: Run the test, and walk the ending by eye**

Run: `npx vitest run tests/unit/journey/head-report-page.test.ts`
Expected: PASS. Then play the ending on the dev server at 1280×800 and 375×812, and compare with the mock at t 0.94, 0.958, 0.966, 0.974, 0.986 and 1 (`proof-out/head/end-*.png`). Scroll back above the spit and check the report is gone.

- [ ] **Step 5: Add the harness step `headResize`, and run it**

Resize from 1280×800 to 390×844 at `dwellT(2)` and again 0.3 s after the scan line starts. Expect the card to stay inside the page at its anchor, and the printed rows to be exactly those above the scan line (`measureReport` ran again).
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/journey/ScanReport.tsx src/ui/journey/applyHead.ts src/ui/journey/Journey.tsx src/styles/journey.css tests/unit/journey/head-report-page.test.ts tools/proof/journey.mjs
git commit -m "head: the scan line prints the report over a soft big bang, ending on Let's talk with GitHub, Instagram and Send a message"
```

**Review stop (spec stages 4 and 5):** Bob plays the trip down to the mouth, the spit and the ending, with sound.

### Task 12: Sound, the calm page, and the old code gone

**Files:**
- Create: `src/journey/sound/headEffects.ts`: `playHeadCue(a: Audio, cue: HeadCue, n: number): void` and `setRumble(a: Audio, level: number): void`, ported from mock `tone`, `noiseHit` and `sfx` (lines 2753–2798: scan, crack, tick, ping, thought, whoosh, spit, gather, and v20's `softBang`). `softBang` plays the soft boom and the scan's sweep together, as the scan line opens. `print` is a tick, and `printTitle` is a ping. The six label pings play at one pitch (spec section 14).
- Modify: `src/journey/sound/score.ts`: remove `break`, `break-end`, `qa-word`, `q1` to `q6`, and the `wires` and `gears` runs.
- Modify: `src/journey/sound/music.ts`: `frame(f, dt, t)`, which plays `dueCues`, `printCues` (row tops from Task 11), ticks while things pour in (9 a second while `t` is 0.12 to 0.22), and the rumble at `pressureAt(t) * 0.6`. Remove the end page's pad, `dueEnding` and the hold sounds.
- Modify: `src/ui/journey/CalmJourney.tsx`: the Q&A as six still pages (number, `{topic} · {region}`, question, answer, and `<svg class="j-calm-object" aria-hidden="true">` drawing `objectSvgPath`), then `<ScanReport printed />` with every row shown and no scan line. `ScanReport` takes `printed?: boolean`.
- Delete: `src/journey/world/void/` (all), `src/journey/world/end/` (all), `src/journey/bang.ts`, `src/journey/end.ts`, `src/journey/qaType.ts`, `src/ui/journey/QaWords.tsx`, `src/ui/journey/QaText.tsx`, `src/ui/journey/EndWords.tsx`, and their uses in `Journey.tsx` (the light's click, `playBang`, the end page's orbit, drift, hold and tilt).
- Delete: `tests/unit/journey/void-path.test.ts`, `qa.test.ts`, `qa-words.test.ts`, `bang.test.ts`, `end.test.ts`. Update `access.test.ts`, `layers.test.ts` (no `flash` or `hint` in `layersAt`) and `sound.test.ts`.
- Test: `tests/unit/journey/head-sound.test.ts`, `tests/unit/journey/head-calm.test.ts`

**Interfaces:**
- Consumes: Task 4 `HeadCue`, `dueCues`, `printCues`, `pressureAt`; Task 5 `objectSvgPath`; Task 11 `ScanReport`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/journey/head-sound.test.ts
import { describe, expect, it } from 'vitest';
import { HEAD_CUES } from '~/journey/head/cues';
import { playHeadCue } from '~/journey/sound/headEffects';
import { HITS, RUNS } from '~/journey/sound/score';
import { fakeAudio } from './sound-fake';

describe('the head journey sounds', () => {
  it('has a sound for every cue', () => {
    const a = fakeAudio();
    for (const { cue, n } of HEAD_CUES) expect(() => playHeadCue(a, cue, n)).not.toThrow();
    for (const cue of ['print', 'printTitle'] as const) expect(() => playHeadCue(a, cue, 0)).not.toThrow();
  });
  it('no longer plays the gold line, the gears or the break', () => {
    expect(HITS.map(([, name]) => name)).not.toContain('q1');
    expect(RUNS.map((run) => run.name)).not.toContain('gears');
  });
});
```

(Use the fake `Audio` the existing `sound.test.ts` builds. If it is inline there, move it to `tests/unit/journey/sound-fake.ts` in this step.)

```ts
// tests/unit/journey/head-calm.test.ts
import { describe, expect, it } from 'vitest';
import { en } from '~/i18n/en';
import { CalmJourney } from '~/ui/journey/CalmJourney';
import { render } from './render';

describe('with less motion asked for (spec section 10)', () => {
  const html = render(<CalmJourney />, 'en');
  it('shows the six answers still, each with its region and object', () => {
    for (const { question } of en.end.questions) expect(html).toContain(question);
    expect(html).toContain('Plans · Prefrontal cortex');
    expect(html.match(/<svg[^>]*class="j-calm-object"/g)).toHaveLength(6);
  });
  it('ends on the printed report', () => {
    expect(html).toContain('Scan complete');
    expect(html).not.toContain('mailto:');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/journey/head-sound.test.ts tests/unit/journey/head-calm.test.ts`
Expected: FAIL.

- [ ] **Step 3: Do the sound, then the calm page, then the removal**

- [ ] **Step 4: Run everything**

Run: `npm test`, `npm run typecheck`, `npm run build`, `npm run audit`
Expected: all clean, and no file left referring to `tl.void`, `tl.bang`, `Universe`, `Questions` or `EndWords`. Check with `rg -n "tl\.(void|bang|collapse|qaReads)|EndWords|QaWords|world/void|world/end" src tests`, which should find nothing.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "head: its sounds on the one clock, the calm page's still answers and printed report; the void, gold line and old end page go"
```

### Task 13: Proof, phone and weak GPU

**Files:**
- Modify: `tools/proof/journey.mjs`. Remove `lookBack`, `dissolveStep`, `qaStep`, `bangClick`, `bangScroll`, `endPage`, `endOrbit`, `endHold` and `endTouch`. Add these steps:
  - `headScan`: the lid is open by t 0.13; six labels show at t 0.25
  - `headThoughts`: each card is readable at its stop, inside the page, with the shade on
  - `headSpit`: one spark, the pressure read-out, the spark lands at `reportTop`
  - `endClock`: the report is finished 4.8 s after the spit, scrolling up rewinds it, and `#contact` lands finished
  - `headReport`: the rows' text in English and Dutch, three links, no `mailto:`
- Keep `headMissing` (Task 9), `headLanguage` (Task 10) and `headResize` (Task 11). Update `reducedMotion`, `smallScreen`, `dutchFit`, `noWebgl` and `keyboard` for the new markup. Keep `smooth`, `rungs` and `walk-down`, pointed over the head journey.

- [ ] **Step 1: Write the steps**

- [ ] **Step 2: Run the harness on a strong GPU, then on the weak one**

Run: `npm run build`, start the "journey" preview from `.claude/launch.json` (port 4490), then `node tools/proof/journey.mjs`. Run it again in Edge with `--force_low_power_gpu` and CDP CPU throttling at 4×, as the rebuild spec's section 11 says.
Expected: every step passes. Median frame under 33 ms at 1080p on the weak run, no frame over 100 ms after loading, no console or CSP errors. Report the numbers, and if a target misses, lower the head's quality rungs (glyph, dust and galaxy counts) before anything else.

- [ ] **Step 3: Run the head steps in Firefox and WebKit, and on a real phone**

Run the harness's head steps with Playwright's `firefox` and `webkit`, then open the preview on a real phone over the local network and play the journey once.
Expected: the head steps pass in both, and the phone plays without stutter at the join, the answers or the ending. Note anything that differs.

- [ ] **Step 4: Run Lighthouse**

Run Lighthouse with `lighthouserc.json` on `/` and `/en/`.
Expected: 100 for accessibility, best practices and SEO.

- [ ] **Step 5: Commit**

```bash
git add tools/proof/journey.mjs
git commit -m "proof: the head journey's steps, from the scan to the report, in both languages, on phones, and with head.bin missing"
```

**Review stop (spec stage 6):** Bob reviews Dutch, the phone pass and the weak-GPU numbers. Nothing goes live until he says so.
