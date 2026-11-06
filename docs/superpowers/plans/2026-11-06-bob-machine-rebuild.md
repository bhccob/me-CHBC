# One Machine Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline. Bob's standing rule (2026-10-26) is "DO NOT use subagent", so subagent-driven-development is not an option here. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page of bhccob.com with one scroll-driven live 3D journey: a machine gets built, opens an iris, and you fly past the projects, out into a void, past the Q&A and into a big bang that ends on "Let's talk."

**Architecture:** New code lives in `src/journey/` (pure timing and choreography with unit tests, plain Three.js scene classes in `src/journey/world/`) and `src/ui/journey/` (the DOM layers). One rAF loop turns native scroll into a single frame value `f` and hands it to the DOM layers, the world and the sound; React Three Fiber hosts the one canvas and renders on `advance()`. It is built beside the old home behind `JOURNEY=1` at `/journey/`, and swapped in at stage 7, so the old site keeps working until then.

**Tech Stack:** React Router 8.5 static prerender, React 19, three 0.186.1, @react-three/fiber 9.8.2, postprocessing 6.39.5, Vite 8, Vitest 5 (`tests/unit/**/*.test.ts`, node environment, React checked through `renderToStaticMarkup`), TypeScript 7, Web Audio, Blender 5.2 headless, Playwright core with Edge for the proof harness.

**Spec:** `docs/superpowers/specs/2026-11-05-bob-machine-rebuild-design.md`, approved by Bob on 2026-11-06, with its section 14 calls as written. The mock-up in `.superpowers/rebuild-mock/` (git-ignored, do not delete) is the source of truth for look and motion; "port" below means bring that code across and keep its values.

## Global Constraints

- Work on branch `bob-rebuild`, from `origin/main` (59b867f). Never push until Bob says go live, because a push to `main` deploys. No subagents.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` names its files. Stage only this plan's files.
- Bob reviews each stage on a local page before the next starts. Do not start the next stage without his word.
- Never name the internship company or the Cookies Clicker classmate. Make no claim about Bob that the spec does not hold.
- No AI images or video. Art is code, models come from Blender. Dark, calm, one focal point per scene. No machine or robot on the end page. No project grid or list in the journey. Project screens about 30% of the page wide, always with their text.
- No sound in the loader. No music, bells or melodies before the ending. Sound is made in code, with no Higgsfield audio.
- Colours: ink `#f2efe8`, gold `#e6b84a`, background `#07060b`, plus the sheet colours in spec 5.3 and project tints in 5.6. Gold is the one accent.
- CSP stays: `font-src 'self'`, no `'unsafe-inline'` scripts, no `'unsafe-eval'`, no `'wasm-unsafe-eval'`. So no Draco or Meshopt in GLBs (`KHR_mesh_quantization` needs no decoder and is allowed). `assetsInlineLimit: 0` stays: every asset is a file, never a data URI.
- All words live in `src/i18n/en.ts` and `nl.ts`. Words shown in 3D are drawn from them at runtime; only BOB CHUNG and SYSTEMS BUILDER may be in textures or models. Bob's marked wording in spec section 5 is exact.
- The Q&A says the 3D runs on "Three.js through React Three Fiber", so R3F stays the canvas host. Do not edit Bob's six answers.
- Targets: whole journey at most 15 MB in stages; median frame under 33 ms on the weak-GPU test at 1080p; no frame over 100 ms after loading; `npm test`, `npm run typecheck`, `npm run audit`, Lighthouse 100 for accessibility, best practices and SEO, 0 code-scanning alerts.
- Do not build the mock-only list in spec section 3 (`window.__flight`, `#end-*`, end version picker, other end designs, the flipbook unless Bob chooses it at Task 5).
- Report short and plain. Say what was not verified.

## Review Focus

1. **Reload or Back in the middle of the journey:** you land at the same place after a quick loader, with no flash of another chapter; if sound was on it stays silent until the next click, then resumes. Tests: harness `reload-mid` (Task 7), `soundAfterReload` (Task 12).
2. **Jumping far ahead before later scenes have loaded** (header Contact, `/#contact`, End key, scrollbar drag on a slow connection): the page stays dark and calm until that scene is ready, never blank or broken, and no pile of sounds fires. Tests: `dueHits` speed cut (Task 12), harness `jump-early` (Task 26).
3. **Resizing or rotating mid-journey:** same frame, paper and bands repainted, canvas sharp. Tests: harness `resize-keeps-place` (Task 7), `rotate` (Task 25).
4. **WebGL context lost, laptop sleep, background tab:** a lost context ends on the Lite fallback, never a blank page; a return from sleep does not jump the story or blast a sound. Tests: harness `context-lost` and `background-tab` (Task 24).
5. **Language switch mid-journey, and Dutch being longer:** the switch keeps your place; Dutch titles, sheet words and answers fit their space in 2D and 3D. Tests: harness `lang-keeps-place` (Task 7), `wrapLines` (Task 17), harness `dutch-fit` (Task 27).

## Stage review procedure

Each stage's last task ends with this. Do all of it, then stop.

1. `npm test && npm run typecheck`: all pass.
2. `JOURNEY=1 PUBLIC_WEB3FORMS_KEY=local-proof-placeholder npm run build`, then `STEPS=<the stage's steps> node tools/proof/journey.mjs`: one `PASS` per step, no console or CSP errors.
3. `GPU=weak STEPS=smooth node tools/proof/journey.mjs`: note median, p95 and worst frame.
4. Write `.superpowers/rebuild-review/stage<N>/index.html`: live stills beside the mock's at the same frames.
5. Serve it and the site (`PORT=4490 npm run preview`, the site at `/journey/`).
6. Update `20-projects/portfolio-bc/Portfolio-BC Status and Next.md` in the vault (local commit of that file only) and the project memory note.
7. Tell Bob in short plain words what to look at and what was not verified. **Stop until he answers.** His changes go in before the next stage.

## Files

| Path | Responsibility |
|---|---|
| `src/journey/math.ts`, `timeline.ts`, `layers.ts` | Pure: easing, chapter and frame tables, what each DOM layer does at frame `f` |
| `src/journey/loop.ts` | The one rAF: scroll to `f`, then layers, sound, world, `advance()` |
| `src/journey/machine/` | Pure port of `pose(f)` and `CAM`, part names |
| `src/journey/flight/layout.ts` | Pure: stops, gates, years and distance table from project data |
| `src/journey/world/` | Three.js: `World`, `MachineScene`, `IrisWindow`, `flight/`, `void/`, `end/` |
| `src/journey/sound/` | `score.ts` pure, `engine.ts`, `effects.ts`, `music.ts` |
| `src/journey/cursor/lock.ts`, `src/ui/LockCursor.tsx` | Lock cursor |
| `src/journey/loader/` | Purple ink in plain WebGL, door logic, real progress |
| `src/journey/quality.ts` | The journey's ladder, on `startStep` and `FrameJudge` from `src/engine/quality.ts` |
| `src/ui/journey/` | `Journey`, `JourneyCanvas`, `paper`, `FirstView`, `Story`, `FieldSheet`, `bands`, `StackWords`, `PortalWord`, `ProjectLinks`, `EndWords`, `ChapterRail`, `ProgressLine`, `InkLoader`, `SoundButton`, `CalmJourney` |
| `src/styles/journey.css` | Fonts, tokens, layers |
| `tools/blender/machine.py`, `gate.py` | Models, moved from the mock |
| `tools/proof/journey.mjs` | The new harness; replaces `needle.mjs` at Task 28 |
| `tests/unit/journey/` | Unit tests |

---

# Stage 1: the live machine against the approved renders

### Task 1: Branch and review route

**Files:**
- Modify: `src/app/routes.ts`, `react-router.config.ts`, `src/app/handle.ts`, `src/data/pages.ts`
- Create: `src/app/routes/journey.tsx`, `src/ui/journey/Journey.tsx`, `tests/unit/journey/route.test.ts`

**Interfaces:**
- Produces: `JOURNEY_PATHS = ['/journey/', '/en/journey/']` and `journeyEnabled(): boolean` (`process.env.JOURNEY === '1'`) in `src/data/pages.ts`; `HANDLES.journey = { route: 'journey', scene: null }`; `Journey(): JSX.Element`.

- [ ] **Step 1: Branch and take a baseline**

```bash
git switch -c bob-rebuild origin/main
npm ci
npm test && npm run typecheck
git add docs/superpowers/specs/2026-11-05-bob-machine-rebuild-design.md docs/superpowers/plans/2026-11-06-bob-machine-rebuild.md
git commit -m "spec: the machine rebuild's design and plan, approved by Bob"
```

Expected: tests and types pass on the untouched code. `.claude/launch.json` and `.impeccable/config.json` stay uncommitted.

- [ ] **Step 2: Write the failing test** `tests/unit/journey/route.test.ts`

```ts
it('has no review route by default', async () => { expect(await pathsWith(undefined)).not.toContain('/journey/'); });
it('has both review routes with JOURNEY=1', async () => {
  const paths = await pathsWith('1');
  expect(paths).toContain('/journey/'); expect(paths).toContain('/en/journey/');
});
it('gives the review route its own handle and no old scene', () => {
  expect(handleOf([{ handle: HANDLES.journey, pathname: '/journey/' }])).toEqual({ route: 'journey', scene: null });
});
```

`pathsWith` stubs the env (`vi.stubEnv`), resets modules and reads `src/app/routes` as `tests/unit/routes.test.ts` does.

- [ ] **Step 3: Run it.** `npx vitest run tests/unit/journey/route.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.** Add the routes and prerender paths only when `journeyEnabled()`. `PAGES` is untouched, so the sitemap and old tests do not see them. `handleOf` accepts `JOURNEY_PATHS`. `Journey` renders an empty `<div className="journey" />`; the route module exports `meta` from `head()` with `noindex` and `handle`.
- [ ] **Step 5: Run.** `npm test && npm run typecheck && JOURNEY=1 PUBLIC_WEB3FORMS_KEY=local-proof-placeholder npm run build`. Expected: pass, and `dist/client/journey/index.html` and `dist/client/en/journey/index.html` exist.
- [ ] **Step 6: Commit.** `git commit -m "journey: a review route beside the old home, behind JOURNEY=1"`

### Task 2: The timeline

**Files:**
- Create: `src/journey/math.ts`, `src/journey/timeline.ts`, `tests/unit/journey/timeline.test.ts`

**Interfaces:**
- Produces in `math.ts`: `clamp, ramp, ez, ease, band, mix, backOut, seeded, catmullRom`.
- Produces in `timeline.ts`: `HOLD = 0.035`, `SMOOTH_S = 0.13`, `SCROLL_PX_PER_FRAME = 30.6`, `type ChapterId`, and
  ```ts
  interface Timeline { last: number; shift: number; flight: [number, number]; reads: number[]; void: [number, number]; dissolve: [number, number]; lookBack: number; qaReads: number[]; collapse: [number, number]; bang: [number, number]; settled: number; chapters: readonly { id: ChapterId; from: number; jump: number }[] }
  buildTimeline(flightEnd?: number, reads?: readonly number[]): Timeline   // flightEnd defaults to 180
  frameFromScroll(scrollY: number, maxScroll: number, tl: Timeline): number
  scrollFromFrame(f: number, maxScroll: number, tl: Timeline): number
  smoothFrame(shown: number, target: number, dt: number): number
  chapterAt(f: number, tl: Timeline): ChapterId
  trackHeightPx(tl: Timeline): number
  ```

- [ ] **Step 1: Write the failing test**

```ts
const tl = buildTimeline();
expect([tl.last, tl.flight, tl.void, tl.dissolve, tl.collapse, tl.bang, tl.settled]).toEqual([934, [350, 566], [566, 888], [630, 690], [858, 880], [880, 928], 934]);
expect(tl.reads).toEqual([399, 448, 493, 537]);
expect(tl.qaReads).toEqual([707, 736, 765, 795, 824, 853]);
expect(tl.chapters.map((c) => c.from)).toEqual([0, 46, 102, 154, 206, 278, 340, 640, 856]);
expect(tl.chapters.map((c) => c.jump)).toEqual([0, 72, 124, 188, 250, 302, 392, 668, 934]);
expect([chapterAt(45, tl), chapterAt(46, tl), chapterAt(339, tl), chapterAt(340, tl), chapterAt(856, tl)]).toEqual(['who', 'software', 'stack', 'projects', 'contact']);
// a longer flight pushes everything after it along by 1.2 frames per unit of distance
const longer = buildTimeline(216);
expect([longer.shift, longer.flight[1], longer.last, longer.qaReads[0]]).toEqual([43, 609, 977, 750]);
// scroll: the first view holds for the first 3.5%
expect(frameFromScroll(35, 1000, tl)).toBeCloseTo(0, 6);
expect(frameFromScroll(1000, 1000, tl)).toBe(934);
expect(scrollFromFrame(frameFromScroll(420, 1000, tl), 1000, tl)).toBeCloseTo(420, 3);
expect(smoothFrame(0, 100, 0.13)).toBeCloseTo(63.2, 1);
```

- [ ] **Step 2: Run it.** `npx vitest run tests/unit/journey/timeline.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Values from spec section 4 and `machine.html` (`CHAPTERS`, `HOLD`, the `frame()` head). Only frames after the flight move with `shift`. Pure: no DOM, no three.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the timeline as one table, longer with more projects"`

### Task 3: Export the machine from Blender

**Files:**
- Create: `tools/blender/machine.py` (from the mock, with an `export` mode), `tools/code_screen.mjs` (from `code.mjs`), `src/journey/machine/parts.ts`, `public/models/machine.glb`, `src/assets/journey/code-screen.webp`, `tests/fixtures/machine-pose.json`, `tests/fixtures/machine-anchors.json`, `tests/unit/journey/machine-asset.test.ts`, `tests/unit/journey/glb.ts`
- Modify: `package.json` (dev `@gltf-transform/cli`, pinned; script `build:models`)

**Interfaces:**
- Produces: `PART_NAMES: readonly string[]`, `type PartName`, every node `pose(f)` drives; `machine-pose.json` as `{ [frame]: { parts: { [name]: { p, r, s, on } }, camera: { position, target, up, lens, fstop, shift, roll }, emit, lights } }` for frames 0, 36, 112, 190, 262, 304, 345, 360; `machine-anchors.json` as `{ [frame]: { armour | controls | brain | body: { point: [x, y, z], uv: [u, v] } } }` for frames 276 to 326 in steps of 2, from the `pts` dict in `machine.py`; `readGlbJson(path)` in `tests/unit/journey/glb.ts`, which later tests share.

- [ ] **Step 1: Write the failing test**

```ts
const gltf = readGlbJson('public/models/machine.glb');
it('holds every part the pose drives', () => { for (const n of PART_NAMES) expect(gltf.nodes.map((x) => x.name)).toContain(n); });
it('needs no wasm decoder', () => { expect(gltf.extensionsUsed ?? []).not.toEqual(expect.arrayContaining(['KHR_draco_mesh_compression'])); expect(gltf.extensionsUsed ?? []).not.toContain('EXT_meshopt_compression'); });
it('stays small', () => { expect(statSync('public/models/machine.glb').size).toBeLessThanOrEqual(5_000_000); });
it('has a pose for each review frame', () => { expect(Object.keys(fixture)).toEqual(['0', '36', '112', '190', '262', '304', '345', '360']); });
```

- [ ] **Step 2: Run it.** `npx vitest run tests/unit/journey/machine-asset.test.ts`. Expected: FAIL (no file).
- [ ] **Step 3: Implement the `export` mode.** `blender -b --factory-startup --python tools/blender/machine.py -- export <glb> <pose.json> <anchors.json>`. It skips the shaft, posters and panels (`show(..., False)` in `pose`), unhides everything before export, keeps node names and hierarchy, uses `export_format='GLB', export_apply=True, export_yup=False`, and reads the code screen from `src/assets/journey/code-screen.webp`. The fixtures record `pose(f)`'s local transforms and `place_camera(f)` values, and anchors from `world_to_camera_view` at 16:9. `npm run build:models` runs Blender at `C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe`, then `gltf-transform weld`, `dedup` and `quantize`.
- [ ] **Step 4: Run** `node tools/code_screen.mjs`, `npm run build:models`, then the test. Expected: PASS. If the file is over 5 MB, drop bevel segments in the script rather than raise the limit.
- [ ] **Step 5: Commit.** `git commit -m "models: the machine from Blender, with its pose as test data"`

### Task 4: Port the choreography

**Files:**
- Create: `src/journey/machine/choreography.ts`, `src/journey/machine/camera.ts`, `tests/unit/journey/choreography.test.ts`

**Interfaces:**
- Consumes: `PART_NAMES`; the fixtures; `src/journey/math.ts`.
- Produces:
  ```ts
  interface PartPose { p: [number, number, number]; r: [number, number, number]; s: [number, number, number]; on: boolean }
  interface MachinePose { parts: Record<PartName, PartPose>; emit: { pulse: number; led: number; key: number; code: number }; lights: { key: number; rim: number; strip: number; low: number; bench: number; top: number; lamp: number }; typed: number }
  machinePose(f: number): MachinePose
  interface CameraPose { position: Vec3; target: Vec3; up: Vec3; lens: number; fstop: number; shift: number; roll: number }
  cameraPose(f: number): CameraPose
  fovFor(lens: number, aspect: number): number      // vertical degrees, the mock's cover rule, tall rule below aspect 1
  pageFit(f: number, aspect: number): number        // machineScale
  fitProjection(m: number[], shift: number, scale: number, aspect: number): void // film shift, then scale about (1, -0.24) in NDC
  ```

- [ ] **Step 1: Write the failing test**

```ts
for (const [frame, want] of Object.entries(fixture)) for (const name of PART_NAMES) {
  const got = machinePose(+frame).parts[name];
  expect(got.on).toBe(want.parts[name].on);
  if (got.on) { expectClose(got.p, want.parts[name].p, 1e-3); expectClose(got.r, want.parts[name].r, 1e-3); expectClose(got.s, want.parts[name].s, 1e-3); }
}
it('sees through the same lens as Blender', () => { // project: cameraPose + fovFor + fitProjection at 16:9, scale 1, through three's Matrix4
  for (const [f, labels] of Object.entries(anchors)) for (const a of Object.values(labels)) expectClose(project(a.point, +f), a.uv, 0.002);
});
expect(fovFor(50, 16 / 9)).toBeCloseTo(22.9, 1); expect(fovFor(50, 2)).toBeCloseTo(20.4, 1); expect(fovFor(50, 4 / 3)).toBeCloseTo(22.9, 1); expect(fovFor(50, 0.5)).toBeCloseTo(51.3, 1);
for (const [f, v] of [[0, 0.9], [34, 1], [64, 0.84], [184, 0.76], [292, 0.94], [344, 1], [700, 0.76]]) expect(pageFit(f, 16 / 9)).toBeCloseTo(v, 5);
expect(pageFit(100, 0.5)).toBe(1);
```


- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `pose` (`machine.py:896`), `place_camera`, `CAM`, `TUNNEL`, `spline` and `machineScale` (`machine.html`). No three in `choreography.ts`. Blender axes stay: the machine's world runs Z-up with `camera.up` from the pose.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the machine's pose and camera, proved against Blender's numbers"`

### Task 5: The live machine, and Bob's first review

**Files:**
- Create: `src/journey/world/World.ts`, `src/journey/world/MachineScene.ts`, `src/journey/world/looks.ts`, `src/journey/loop.ts`, `src/ui/journey/JourneyCanvas.tsx`, `src/debug/journeyDebug.ts`, `tools/proof/journey.mjs`
- Modify: `src/ui/journey/Journey.tsx`, `tools/proof/README.md`

**Interfaces:**
- Consumes: `machinePose`, `cameraPose`, `fovFor`, `pageFit`, `fitProjection`, `frameFromScroll`, `smoothFrame`.
- Produces:
  ```ts
  class World { constructor(renderer: WebGLRenderer, input: WorldInput); load(stage: 'machine' | 'flight' | 'void' | 'end'): Promise<void>; update(f: number, dt: number, now: number): WorldState; render(): void; resize(w: number, h: number): void; pointer(x: number, y: number, down: boolean): void; dispose(): void }
  interface WorldInput { words: Dictionary['journey']; locale: Locale; timeline: Timeline; projects: readonly Project[]; reduce: boolean }
  interface WorldState { anchors: Record<'armour' | 'controls' | 'brain' | 'body', [number, number]>; hover: string | null; opaque: boolean; fired: number }
  startLoop(deps: { timeline: Timeline; onFrame: (f: number, dt: number, now: number) => void }): () => void   // reads scrollY; reduced motion skips smoothing
  ```
- `window.__journeyDebug` exists behind `?proof` only: `{ frame(): number; scene(): string[]; frameTimes(): number[]; quality(): number }`.
- `JourneyCanvas` is lazy-loaded, R3F `<Canvas frameloop="never" gl={{ alpha: true, antialias: false }}>`; a `useFrame(() => world.render(), 1)` draws, and `loop.ts` calls `advance(now)`.

- [ ] **Step 1: Write the harness and its first failing step.** `tools/proof/journey.mjs` takes needle.mjs's scaffolding: it serves `dist/client` as `tools/serve-pages.mjs` does, runs `STEPS`, prints `PASS`/`FAIL`, writes `results.json`, fails on any console error, page error or CSP violation. `ROUTE` defaults to `/journey/`, `GPU=weak` adds `--force_low_power_gpu` and CDP CPU throttling 4x at 1080p. Step `stills`: for frames 0, 36, 112, 190, 262, 304, 345, 360 scroll there by real wheel input, wait to settle, save a JPEG, and check the frame's mean brightness is above the page's background and the machine's region differs from an empty canvas. Port `smooth` from `needle.mjs:3026` to walk frames 0 to 366, reading `frameTimes()`.
- [ ] **Step 2: Run.** `JOURNEY=1 PUBLIC_WEB3FORMS_KEY=local-proof-placeholder npm run build && STEPS=stills,smooth node tools/proof/journey.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement `MachineScene`.** GLTFLoader for `/models/machine.glb`, then apply `machinePose` per frame. In `looks.ts`, match the Cycles look: `AgXToneMapping` at exposure `2 ** 0.7`; materials from `machine.py`'s `material()` values; `RectAreaLight`s (`RectAreaLightUniformsLib.init()`) at the Blender lights' places and `lights` energies; one soft-shadow spot at the key light; an environment from PMREM of emissive strips as in `tunnel.src.js`; bloom and depth of field through `postprocessing`, with focus and f-stop from `cameraPose`. Compile during load.
- [ ] **Step 4: Run again.** Expected: PASS.
- [ ] **Step 5: Stage review** for steps `stills,smooth`. The page shows the eight frames, mock flipbook (`frames/`) beside live, and the weak-GPU numbers. Ask Bob one question: is live good enough to go on? **The spec makes this his decision.** If no, the fallback is a lighter flipbook for this part only: only `MachineScene` and Task 10's `IrisWindow` change.
- [ ] **Step 6: Commit.** `git commit -m "journey: the machine runs live, with the harness and the first review"`

---

# Stage 2: loader, first view, story, sheets, stack, portal

### Task 6: Fonts, tokens and words

**Files:**
- Modify: `package.json` (`@fontsource/barlow`, `@fontsource/ibm-plex-mono`, dev `@fontsource/ma-shan-zheng`, pinned), `src/i18n/en.ts`, `src/i18n/nl.ts`
- Create: `tools/fonts/hakka.mjs`, `public/fonts/hakka.otf`, `src/styles/journey.css`, `tests/unit/journey/fonts.test.ts`, `tests/unit/journey/copy.test.ts`

**Interfaces:**
- Produces: `t.journey` with `hero`, `story`, `sheets` (four), `stack`, `portal`, `flight`, `qaWord`, `collapse`, `end`, `rail`, `sound`, `loader`, `calm`; each sheet is `{ title: string[]; facts: { label: string; value: string }[]; line: { lead: string; rest: string }; titleBlock: string }`; the `Dictionary` type covers `nl.ts`. CSS custom properties `--j-ink`, `--j-gold`, `--j-bg`, `--j-sheet-<n>-paper`, `--j-sheet-<n>-word`.

- [ ] **Step 1: Write the failing tests**

```ts
// fonts
const hakka = opentype.parse(readFileSync('public/fonts/hakka.otf').buffer);
expect(hakka.charToGlyph('客').index).toBeGreaterThan(0); expect(hakka.charToGlyph('家').index).toBeGreaterThan(0);
expect(statSync('public/fonts/hakka.otf').size).toBeLessThanOrEqual(40_000);
// copy: Bob's own words, exact
const s = en.journey.sheets;
expect(s[0].facts).toContainEqual({ label: 'Stack', value: 'Full-stack' });
expect(s[0].facts).toContainEqual({ label: 'Studied', value: 'MBO 4, Rotterdam' });
expect(s[1].facts).toContainEqual({ label: 'Engine', value: 'Godot, Roblox Studio' });
expect(s[1].facts).toContainEqual({ label: 'Built', value: 'Browser, Roblox and platform games' });
expect(s[2].facts).toContainEqual({ label: 'Now', value: 'Intern at a cybersecurity company' });
expect(s[2].facts).toContainEqual({ label: 'Possible direction', value: 'DevSecOps, firmware security' });
expect(s[3].facts).toContainEqual({ label: 'Interested and exploring', value: 'Sensors, motors, circuits' });
expect(s[3].facts).toContainEqual({ label: 'Goal', value: "Own company or a master's degree" });
expect(s.map((x) => x.titleBlock)).toEqual(['MBO, now · Sheet 1 of 4 · Systems Builder', 'MBO, now · Sheet 2 of 4 · Systems Builder', 'Internship, now · Sheet 3 of 4 · Systems Builder', 'HBO, next · Sheet 4 of 4 · Systems Builder']);
expect(en.journey.hero.words).toEqual(['games.', 'security.', 'machines.']);
expect(en.journey.hero.seal).toBe('PROGRAMMER');
expect(en.journey.end.title).toBe("Let's talk.");
expect(en.journey.end.note).toBe('If any of this gave you an idea, a project or a question, I would like to hear it.');
expect(en.journey.loader).toMatchObject({ withSound: 'Enter with sound', without: 'Enter without' });
expect(Object.keys(nl.journey)).toEqual(Object.keys(en.journey));
```

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** `tools/fonts/hakka.mjs` reads the woff slices holding U+5BA2 and U+5BB6 from `@fontsource/ma-shan-zheng` through `opentype.js`, and writes an OTF with `.notdef` and the two glyphs. `journey.css` declares it with that `unicode-range`, imports Barlow's `latin` 400 to 800 with italics and Plex Mono's `latin` 400 and 500, and holds the layer order: paper, sheets, canvas, front words. All English comes from spec section 5; draft the Dutch formally, for Bob's review at Task 27.
- [ ] **Step 4: Run** `node tools/fonts/hakka.mjs` and the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: self-hosted fonts, tokens and all the words, in both languages"`

### Task 7: Native scroll, rail, progress, header, jumps

**Files:**
- Create: `src/ui/journey/ChapterRail.tsx`, `src/ui/journey/ProgressLine.tsx`, `src/journey/jump.ts`, `tests/unit/journey/jump.test.ts`, `tests/unit/journey/rail.test.ts`
- Modify: `src/ui/journey/Journey.tsx`, `src/ui/SiteHeader.tsx`, `src/ui/LangSwitch.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `Timeline`, `scrollFromFrame`, `chapterAt`.
- Produces:
  ```ts
  frameForHash(hash: string, tl: Timeline, stopIds?: readonly string[]): number | null   // '#projects' -> 392, '#contact' -> tl.last, '#project-<id>' -> that stop's read
  glideTo(f: number, tl: Timeline, reduce: boolean): void   // native smooth scroll, instant with reduced motion
  rememberPlace(f: number): void; takePlace(): number | null // sessionStorage 'journey-place', read once
  railOpacity(f: number): number                             // 1, fading to 0 over frames 860 to 870
  ```

- [ ] **Step 1: Write the failing tests**

```ts
expect(frameForHash('#projects', tl)).toBe(392); expect(frameForHash('#contact', tl)).toBe(934); expect(frameForHash('#nope', tl)).toBeNull();
expect([railOpacity(859), railOpacity(870)]).toEqual([1, 0]);
const html = renderToStaticMarkup(createElement(ChapterRail, { timeline: tl, labels: en.journey.rail }));
for (const word of ['Who', 'Software', 'Games', 'Security', 'Mechatronics', 'Stack', 'Projects', 'Q&amp;A', 'Contact']) expect(html).toContain(word);
```

Harness steps: `jumps` (header and rail glide to their chapter; current one gold), `hash` (`#projects`, `#contact`), `reload-mid` (reload at frame 450, lands within 2 frames with no other chapter's words shown in between), `resize-keeps-place` (resize at frame 450, frame stays within 2), `lang-keeps-place` (switch language at frame 450, lands within 2 frames).

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** A tall track of `trackHeightPx` so resizing does not change the frame. On the journey route the header shows Bob Chung (to the top), Projects, Contact, the language link and a slot for the sound button. The language link calls `rememberPlace` before it navigates. The rail is hidden on phones and clickable; progress is a 1 px gold line.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: native scroll with rail, progress, jumps, and your place kept"`

### Task 8: Paper, first view and story

**Files:**
- Create: `src/journey/layers.ts`, `src/ui/journey/paper.ts`, `src/ui/journey/FirstView.tsx`, `src/ui/journey/Story.tsx`, `tests/unit/journey/layers.test.ts`, `tests/unit/journey/first-view.test.ts`, `tests/unit/journey/render.ts`
- Modify: `src/ui/journey/Journey.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `band`, `t.journey.hero`, `t.journey.story`, `profile.ageOn()`.
- Produces: `layersAt(f: number, tl: Timeline, tall: boolean): LayerStates`, the single table the loop writes to the DOM, as `{ [layer]: { opacity: number; y?: number } }`; later tasks add their layers here. `paintPaper(canvas, opts)`, `growTree(now)`, `rollDigits(progress: number, from: number, to: number): number`. For tests, `render(component, props?)` in `tests/unit/journey/render.ts` gives `renderToStaticMarkup` inside a `MemoryRouter` at `/en/`, and `escape(text)` gives the text as the markup holds it.

- [ ] **Step 1: Write the failing tests**

```ts
const at = (f: number) => layersAt(f, tl, false);
expect(at(0).hero.opacity).toBe(1); expect(at(22).hero).toEqual({ opacity: 0, y: -40 }); // machine.html: heroOut over frames 3 to 22
const html = render(FirstView, { age: 20 });
expect(html).toContain('FROM CODE'); expect(html).toContain("I'm Bob Chung, 20. Born and raised in Aruba, now in Rotterdam, studying software and heading for mechatronics.");
expect(html).toContain('See my projects'); expect(html).toContain('客家'); expect(html).toContain('PROGRAMMER');
expect(html).toMatch(/<h1/);
expect(rollDigits(1, 18, 20)).toBe(20); // the story's digits end on the real age
```

Harness `first-view`: the word rolls every 2.4 s, the tree grows, the button lands at frame 392, the story's digits end on `profile.ageOn()`.

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `paintBase`, the tree and sparks, the rolling word, the seal and story from `machine.html`. Copy `frame()`'s windows into `layersAt` unchanged. Paper draws only while `f < 70`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the first view and the story"`

### Task 9: The four field sheets

**Files:**
- Create: `src/ui/journey/FieldSheet.tsx`, `src/ui/journey/bands.ts`, `tests/unit/journey/sheets.test.ts`
- Modify: `src/ui/journey/Journey.tsx`, `src/journey/layers.ts`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `t.journey.sheets`, `--j-sheet-*`, `layersAt`.
- Produces: `paintBand(canvas, kind: 'seigaiha' | 'pixels' | 'keyfret' | 'gears')`; `sheetWindows = [[44, 66], [98, 120], [152, 174], [204, 226]]`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(sheetWindows).toEqual([[44, 66], [98, 120], [152, 174], [204, 226]]);
expect(at(44).sheets[0].y).toBe(112); expect(at(66).sheets[0].y).toBe(0); // vh: slides up with a tilt, then stays under the next
const html = render(FieldSheet, { sheet: en.journey.sheets[3], n: 3 });
expect(html).toContain('Mechatronics'); expect(html).toContain('Engineering'); expect(html).toContain('The body.');
```

Harness `sheets`: at frames 72, 124, 188, 250, the giant word sits behind the machine, the facts and title block show, and the rail does not cross the machine's right leg. `engineering-readable`: at frame 250 on 1440x810 and 1920x1080, the word "Engineering" is at most 30% covered by the machine's projected bounds.

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port the sheets and `paintBand` from `machine.html`, with four sheets, not five. Fix the two rough spots from spec section 13: move or scale the word so "Engineering" reads, and tuck the rail away from the leg on that sheet.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the four field sheets"`

### Task 10: Stack and portal

**Files:**
- Create: `src/ui/journey/StackWords.tsx`, `src/ui/journey/PortalWord.tsx`, `src/journey/world/IrisWindow.ts`, `src/journey/world/flight/TunnelScene.ts` (a dark stand-in until Task 15), `tests/unit/journey/portal.test.ts`
- Modify: `src/journey/world/World.ts`, `src/journey/world/MachineScene.ts`, `src/journey/layers.ts`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `WorldState.anchors`, `machinePose`.
- Produces: `irisWindowOn(f: number): boolean` (true for 338 to 366), `canvasOpaque(f: number): boolean` (false before frame 366, true from there to the end), `IrisWindow` (renders `TunnelScene` to a half-size target and shows it on a disc under the blades, sampling by `gl_FragCoord`, so blades and sleeve cover it by depth; no stencil).

- [ ] **Step 1: Write the failing tests**

```ts
expect([irisWindowOn(337), irisWindowOn(345), irisWindowOn(367)]).toEqual([false, true, false]);
expect([canvasOpaque(365), canvasOpaque(366)]).toEqual([false, true]);
expect(render(StackWords)).toContain('Each field I learn is one layer of it.');
```

Harness `stack`: at frame 304, each of the four labels is within 12 px of `anchors` on the page and reads Armour / Cybersecurity, Controls / Game Development, Brain / Software Engineering, Body / Mechatronics. `portal`: stills at 332, 345, 352, 360, 370; the iris region differs from the blades; average brightness between consecutive frames from 350 to 372 jumps by less than 12%, so there is no cut.

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Shield shrinks and turns away, nine blades open, sleeve glows, "Projects" shows over it, per `pose`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the stack, and the iris opening onto the tunnel with no cut"`

### Task 11: Purple ink loader and the way in

**Files:**
- Create: `src/journey/loader/ink.ts`, `src/journey/loader/plan.ts`, `src/journey/loader/progress.ts`, `src/ui/journey/InkLoader.tsx`, `tests/unit/journey/loader.test.ts`
- Modify: `src/ui/journey/Journey.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `t.journey.loader`, `World.load('machine')`.
- Produces:
  ```ts
  loaderPlan(v: { seenThisTab: boolean; reload: boolean; reduced: boolean }): 'full' | 'quick' | 'none'
  doorAction(input: 'with' | 'without' | 'Enter' | 'wheel' | 'touch'): 'with-sound' | 'without-sound'
  inkCharacters(p: number): [number, number]   // alpha of 客 and 家: 0.16 to 0.5, 0.5 to 0.86
  INK = { min: 4200, land: 1900 }; GIVE_UP_MS = 12000
  ```
- Must stay out of three's chunk: `ink.ts` uses raw WebGL, so the loader shows before three arrives.

- [ ] **Step 1: Write the failing tests**

```ts
expect(loaderPlan({ seenThisTab: false, reload: false, reduced: false })).toBe('full');
expect(loaderPlan({ seenThisTab: true, reload: false, reduced: false })).toBe('quick');
expect(loaderPlan({ seenThisTab: true, reload: true, reduced: false })).toBe('quick');
expect(loaderPlan({ seenThisTab: false, reload: false, reduced: true })).toBe('none');
expect(doorAction('Enter')).toBe('with-sound'); expect(doorAction('wheel')).toBe('without-sound'); expect(doorAction('touch')).toBe('without-sound');
expect(inkCharacters(0.1)).toEqual([0, 0]); expect(inkCharacters(1)).toEqual([1, 1]);
```

Harness `loader` (ink, 客 then 家, the door, characters fly to the first view, no cut, silent), `loader-quick`, `loader-new-tab` (full again), `loader-door-keys`, `loader-reduced`, `give-up` (load stalled: the door or the Lite fallback shows, nobody is stuck).

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port the shader, `theInk` and the door from `loader.src.js`. Progress is real: GLB bytes by fetch stream, chunks by import. No words under the characters and no seal in the loader.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the purple ink loader and the way in"`

### Task 12: Sound

**Files:**
- Create: `src/journey/sound/score.ts`, `engine.ts`, `effects.ts`, `music.ts`, `src/ui/journey/SoundButton.tsx`, `tests/unit/journey/sound.test.ts`
- Modify: `src/journey/loop.ts`, `src/ui/SiteHeader.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `doorAction`, `Timeline` (post-flight frames move with `shift`).
- Produces:
  ```ts
  HITS: readonly [frame: number, name: string, play: EffectName][]; RUNS; MOVES   // from music_r22.src.js
  dueHits(prev: number, f: number, framesPerSec: number, shift?: number): { name: string; level: number }[]   // nothing at 170 frames/s or more; level is 1, or 0.42 going back; `shift` moves the frames after the flight
  dueRuns(prev: number, f: number, framesPerSec: number, shift?: number): { name: string; level: number }[]
  motorOn(f: number, framesPerSec: number): boolean
  humLevel(f: number): number; rushLevel(f: number, speed: number): number; padLevel(f: number): number
  soundAfterReload(wanted: boolean, gesture: boolean): 'silent' | 'playing'
  ```
- `music.ts` exposes `Sound.enter(on: boolean)`, `Sound.toggle()`, `Sound.frame(f, dt)`, `Sound.hold(on: boolean)`, `Sound.level(): number`, and `counts` behind `?proof`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(dueHits(193, 195, 30).map((h) => h.name)).toEqual(['lid-seat']);
expect(dueHits(100, 900, 900)).toEqual([]);                    // a jump plays nothing
expect(dueHits(195, 193, 30)[0].level).toBeCloseTo(0.42);      // going back is softer
expect(dueRuns(72, 73.6, 30).map((r) => r.name)).toEqual(['typing']);
expect(humLevel(450)).toBe(0); expect(padLevel(892)).toBe(0); expect(padLevel(926)).toBeGreaterThan(0);
expect(rushLevel(450, 0.5)).toBeGreaterThan(0); expect(rushLevel(100, 1)).toBe(0);
expect(motorOn(120, 30)).toBe(true); expect(motorOn(120, 0)).toBe(false); expect(motorOn(140, 30)).toBe(false);
expect(soundAfterReload(true, false)).toBe('silent'); expect(soundAfterReload(true, true)).toBe('playing'); expect(soundAfterReload(false, true)).toBe('silent');
```

Harness `sound` (from `scratchpad/study/ld4.mjs`): walk at about 130 px per wheel step; every HIT fires once, peak at most 0.45, `Sound off` reads 0 within 1.2 s, no audio during the loader, first sound only after a gesture.

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port the audio engine and the round 22 block from `loader.src.js`, keeping its levels and the end page's notes: Bob approved them by ear. The AudioContext starts only on a gesture. The wanted state is in `sessionStorage`; after a reload it waits for the next click or key.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the machine's sounds, as Bob approved them"`

### Task 13: Lock cursor, and the stage 2 review

**Files:**
- Create: `src/journey/cursor/lock.ts`, `src/ui/LockCursor.tsx`, `tests/unit/journey/lock.test.ts`
- Modify: `src/app/Shell.tsx`, `src/styles/journey.css`, `tools/proof/journey.mjs`

**Interfaces:**
- Produces:
  ```ts
  lockTarget(v: { px: number; py: number; screen: boolean; rect: { left: number; top: number; width: number; height: number } | null }): { cx: number; cy: number; hw: number; hh: number; len: number; locked: boolean }
  cornerStiffness(sx: number, sy: number, dirX: number, dirY: number, motion: number, locked: boolean): number
  cursorOn(fine: boolean, hover: boolean, reduced: boolean): boolean
  HOVERABLE = 'a,button,[data-jump],input,textarea,select'
  ```
- Runs on every page, because the header is the same everywhere (my call). Over `input` and `textarea` the corners frame the field and the native text cursor stays.

- [ ] **Step 1: Write the failing test**

```ts
expect(lockTarget({ px: 5, py: 6, screen: false, rect: null })).toEqual({ cx: 5, cy: 6, hw: 13, hh: 13, len: 6, locked: false });
expect(lockTarget({ px: 5, py: 6, screen: false, rect: { left: 10, top: 20, width: 100, height: 40 } })).toEqual({ cx: 60, cy: 40, hw: 59, hh: 27, len: 9, locked: true });
expect(lockTarget({ px: 5, py: 6, screen: false, rect: { left: 0, top: 0, width: 560, height: 40 } })).toMatchObject({ hw: 20, hh: 20, len: 8, locked: false });
expect(lockTarget({ px: 5, py: 6, screen: true, rect: null })).toMatchObject({ hw: 50, hh: 32, len: 12 });
expect(cornerStiffness(1, 1, 0.707, 0.707, 1, false)).toBeGreaterThan(cornerStiffness(-1, -1, 0.707, 0.707, 1, false));
expect([cursorOn(true, true, false), cursorOn(false, false, false), cursorOn(true, true, true)]).toEqual([true, false, false]);
```

Harness `cursor`: on a mouse the corners close around `#go`'s bounds within 400 ms and the page takes no clicks from the canvas; `no-cursor` for touch and reduced motion; `cursor-form` on `/contact/`: an input shows the text cursor.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `cursor()` from `loader.src.js` unchanged in look. A press pinches 4 px, a release sends corners out over 0.34 s, OPEN sits on a dark window over a project.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "cursor: Lock, Bob's pick"`
- [ ] **Step 6: Stage review** for steps `stills,first-view,sheets,engineering-readable,stack,portal,loader,loader-quick,loader-new-tab,loader-door-keys,loader-reduced,give-up,sound,cursor,no-cursor,cursor-form,jumps,hash,reload-mid,resize-keeps-place,lang-keeps-place`.

---

# Stage 3: flight and projects

### Task 14: Flight data and layout

**Files:**
- Modify: `src/data/projects.ts`, `src/journey/timeline.ts`, `tests/unit/projects.test.ts`
- Create: `src/journey/flight/layout.ts`, `tools/flight_assets.mjs`, `public/flight/*.webp`, `tests/unit/journey/flight-layout.test.ts`

**Interfaces:**
- Produces in `projects.ts`: `flight: { startedOn: string; tint: [number, number, number]; screens: 'wide' | 'phones'; piece?: 'cookie' | 'sun' | 'ring'; images: string[] }` on `ProjectData`; title lines and one line are read from `t`; `projects.byDate(): Project[]`.
- Produces in `layout.ts`:
  ```ts
  READ = 4.7
  flightLayout(list: readonly { id: string; year: number }[]): { stops: { id: string; s: number; side: 1 | -1; year: number }[]; years: { year: number; s: number }[]; gates: number[]; end: number }
  distanceTable(layout: FlightLayout): { cum: Float64Array; n: number }
  distanceAt(t: number, table): number
  readFrames(layout: FlightLayout, table): number[]
  timelineFor(layout: FlightLayout): Timeline   // buildTimeline(layout.end, readFrames(...))
  ```

- [ ] **Step 1: Write the failing test**

```ts
const real = flightLayout(projects.byDate());
expect(projects.byDate().map((p) => p.id)).toEqual(['cookies-clicker', 'jontai-energy', 'steady', 'portle']);
expect(real.stops.map((s) => s.s)).toEqual([40, 80, 116, 152]);
expect(real.stops.map((s) => s.side)).toEqual([1, -1, 1, -1]);
expect(real.years).toEqual([{ year: 2025, s: 20 }, { year: 2026, s: 60 }]);
expect(real.gates).toEqual([8, 30, 48, 70, 88, 98, 106, 124, 134, 142, 160, 170]);
expect(real.end).toBe(180);
readFrames(real, distanceTable(real)).forEach((f, i) => expect(Math.abs(f - [399, 448, 493, 537][i])).toBeLessThanOrEqual(1));
// a project added to the data alone
const more = flightLayout([...projects.byDate(), { id: 'next', year: 2026 }]);
expect([more.stops.at(-1)!.s, more.end, timelineFor(more).shift]).toEqual([188, 216, 43]);
const newYear = flightLayout([...projects.byDate(), { id: 'next', year: 2027 }]);
expect(newYear.years.at(-1)).toEqual({ year: 2027, s: 172 }); expect(newYear.stops.at(-1)!.s).toBe(192);
for (const l of [real, more, newYear]) for (const g of l.gates) for (const s of l.stops) expect(Math.abs(g - (s.s - READ))).toBeGreaterThanOrEqual(5);
```

The rules behind those numbers: a first project or a new year puts a year gate 20 after the last stop (20 for the first) and the stop 20 after that; the same year is 36 on; the end is 28 past the last stop. Gates: 8 at the start; a year gate's +10; each stop's +8; then +18 and +26 if the next stop has the same year, or +18 if it is the last.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `TABLE` and `distanceAt` from `tunnel.src.js`. `tools/flight_assets.mjs` ports `assets6.mjs` to files: the cookie painted out, the cookie and ring cut out, at most 300 KB each. Dates: Cookies 2025, Jontai 2026-01-19, Steady 2026-10-25, Portle 2026-10-28.
- [ ] **Step 4: Run** `node tools/flight_assets.mjs` and the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "flight: stops, gates and years come from the project data"`

### Task 15: The tunnel

**Files:**
- Modify: `src/journey/world/flight/TunnelScene.ts`, `src/journey/world/World.ts`, `tools/proof/journey.mjs`
- Create: `src/journey/world/flight/path.ts`, `tests/unit/journey/flight-path.test.ts`

**Interfaces:**
- Consumes: `FlightLayout`, `distanceAt`.
- Produces: `center(s, end, out: Vector3)`, `frameAt(s, end)`, `tintAt(s, layout): [r, g, b]`, `fovAt(speed): number`, `bankAt(s, end): number`; `TunnelScene implements { scene; camera; update(f, dt, now); dispose() }`.

- [ ] **Step 1: Write the failing test**

```ts
const t = distanceTable(real);
const timePerUnit = (s: number) => { const k = Math.round((s / real.end) * t.n); return t.cum[k + 1] - t.cum[k]; };
expect(timePerUnit(100) / timePerUnit(real.stops[1].s - READ)).toBeCloseTo(0.2, 1); // at a stop it moves at a fifth of its speed between stops
for (let i = 1; i < 500; i++) expect(distanceAt(i / 500, t)).toBeGreaterThan(distanceAt((i - 1) / 500, t)); // it never stops
expect(tintAt(real.stops[3].s, real)).toEqual([0.58, 0.5, 1]);
expect(center(0, 180, new Vector3()).length()).toBeCloseTo(0, 6); // it starts at the mouth, straight
```

Harness `flight`: stills at 370, 420, 470, 520, 560; the wires and rings draw; streak length grows with speed; no console errors.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port the path, wires, rings, streaks, wash, fog, FOV and banking from `tunnel.src.js`, reading `layout.end` where it reads `END`. Remove the mock-only modes (`sun`, `form`, `word`).
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "flight: the tunnel, moving while you read"`

### Task 16: Gates and year gates

**Files:**
- Create: `tools/blender/gate.py` (from the mock, with digit parts), `public/models/gate.glb`, `src/journey/world/flight/Gates.ts`, `tests/unit/journey/gates.test.ts`
- Modify: `src/journey/world/flight/TunnelScene.ts`, `package.json` (`build:models`)

**Interfaces:**
- Produces: `yearDigits(year: number): string[]`; `Gates.place(layout)` clones the gate at `layout.gates`, and at `layout.years` builds a year from `digit-0` to `digit-9`.

- [ ] **Step 1: Write the failing test**

```ts
const nodes = readGlbJson('public/models/gate.glb').nodes.map((n) => n.name);
for (let d = 0; d <= 9; d++) expect(nodes).toContain(`digit-${d}`);
expect(yearDigits(2027)).toEqual(['2', '0', '2', '7']);
expect(statSync('public/models/gate.glb').size).toBeLessThanOrEqual(1_200_000);
```

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Gears turn as you pass, the iris on a year gate opens as you reach it (`placeGate` in `tunnel.src.js`).
- [ ] **Step 4: Run** `npm run build:models`, then the test. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "flight: gates, and year gates that work for any year"`

### Task 17: Project stops

**Files:**
- Create: `src/journey/world/flight/ProjectStop.ts`, `WallScreens.ts`, `textures.ts`, `src/ui/journey/ProjectLinks.tsx`, `tests/unit/journey/stops.test.ts`
- Modify: `src/journey/world/flight/TunnelScene.ts`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `FlightLayout`, `flight` data, `t.journey.flight`, project copy in the visitor's language.
- Produces: `wrapLines(text: string, width: number, measure: (s: string) => number): string[]`; `screenShare(width: number, distance: number, fovDeg: number, aspect: number): number`; `nearAt(dist: number): number`; `WorldState.hover`. `ProjectLinks` renders each project's title, year, kind, line and "Open project" as real links.

- [ ] **Step 1: Write the failing test**

```ts
const measure = (s: string) => s.length * 10;
const long = 'Een concept-herontwerp voor een winkel op Aruba, waarbij de homepagina verloopt als één Arubaanse dag.';
expect(wrapLines(long, 300, measure).every((l) => measure(l) <= 300)).toBe(true);
expect(wrapLines('Onafgebrokenwoordzonderspatiesdatheellangis', 200, measure).every((l) => measure(l) <= 200)).toBe(true);
expect(screenShare(2.45, 4.7, 54, 16 / 9)).toBeCloseTo(0.3, 1);
expect(nearAt(0)).toBe(1); expect(nearAt(15)).toBe(0);
const html = render(ProjectLinks);
expect(html).toContain('A browser game built with a classmate around one satisfying loop: click, earn, reinvest.');
expect(html.indexOf('Cookies Clicker')).toBeLessThan(html.indexOf('Jontai Energy'));
```

Harness `projects`: at each read frame one stop is the only bright thing (far gates and wires dim), its text comes from the dictionary in both languages, four wall screens per project step back while you read, hovering the screen sets `#tunnel.hot`; pieces present (floating cookie, sun glow, three phones at three depths, floating ring).

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `curved`, `makeText`, `wrapLines`, `buildWords`, `layout` and the per-project pieces from `tunnel.src.js`. Long unbroken words split rather than overflow.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "flight: each project, with its screen and words belonging together"`

### Task 18: Opening a project in place, and the stage 3 review

**Files:**
- Create: `src/ui/journey/openProject.ts`, `tests/unit/journey/open-project.test.ts`
- Modify: `src/ui/ProjectView.tsx`, `src/app/routes/project.tsx`, `src/ui/LangSwitch.tsx`, `src/ui/journey/Journey.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `WorldState.hover`, `frameForHash`.
- Produces: `openProject(id: string, f: number): void` and `closeProject(): void`. Decision: the overlay uses `history.pushState` rather than a router navigation, so the track and the scroll stay mounted under it; `popstate` closes it. `closeHref(id: string, locale: Locale): string` gives `/#project-<id>` for a direct visit. `langPathWhileOpen(pathname: string, locale: Locale): string` keeps the language link right.

- [ ] **Step 1: Write the failing test**

```ts
expect(closeHref('steady', 'nl')).toBe('/#project-steady'); expect(closeHref('steady', 'en')).toBe('/en/#project-steady');
expect(frameForHash('#project-steady', tl, ['cookies-clicker', 'jontai-energy', 'steady', 'portle'])).toBe(tl.reads[2]);
expect(langPathWhileOpen('/projects/steady/', 'en')).toBe('/en/projects/steady/');
```

Harness `project-open`: click at frame 448; the screen grows to fill the view; the address is `/projects/jontai-energy/`; case text, pictures and links show; Back closes it within 2 frames of the same place; focus returns to the link. `project-direct`: `/projects/steady/` works with WebGL off and its close link lands at Steady's stop.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Build on the existing `View` in `ProjectView.tsx`. Background goes `inert`, scroll locks, the world pauses.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "flight: a project opens in place, and Back puts you where you were"`
- [ ] **Step 6: Prove a project from data alone.** Add a fifth entry to `src/data/projects.ts`, with the page route any project needs in `src/data/pages.ts` and `src/app/handle.ts`. Build, run `STEPS=flight,projects node tools/proof/journey.mjs`, keep the stills for the review page, then `git checkout -- src/data/projects.ts src/data/pages.ts src/app/handle.ts`. Expected: PASS, with nothing under `src/journey/` or `src/ui/journey/` changed.
- [ ] **Step 7: Stage review** for steps `flight,projects,project-open,project-direct,portal,sound`.

---

# Stage 4: void, look-back, Q&A

### Task 19: Void, look-back and the tunnel breaking

**Files:**
- Create: `src/journey/world/void/path.ts`, `VoidScene.ts`, `Dissolve.ts`, `tests/unit/journey/void-path.test.ts`
- Modify: `src/journey/world/World.ts`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `Timeline` (`void`, `dissolve`, `shift`), `TunnelScene`'s wires.
- Produces: `voidAt(d, out)`, `voidDistance(t)`, `qaReadFrames(tl): number[]`, `lookFrame(tl): number`; `VoidScene implements` the scene shape of `TunnelScene`.

- [ ] **Step 1: Write the failing test**

```ts
qaReadFrames(tl).forEach((f, i) => expect(Math.abs(f - [707, 736, 765, 795, 824, 853][i])).toBeLessThanOrEqual(1));
expect(Math.abs(lookFrame(tl) - 642)).toBeLessThanOrEqual(2);
expect(qaReadFrames(buildTimeline(216))[0] - qaReadFrames(tl)[0]).toBe(43);
```

Harness `look-back`: at 642 the whole tunnel hangs over its reflection; `dissolve`: wires at 630, sparks at 660, only stars at 690; the sparks' count falls to 0 and the star count rises; the machine is not in the visible scene.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `VOID`, `TABLE2`, `buildVoid`, `layoutVoid` and the dissolve from `tunnel.src.js`. The mirror floor uses one reflection pass that the ladder can drop.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "void: out of the portal, the look back, and the tunnel breaking into stars"`

### Task 20: The Q&A, and the stage 4 review

**Files:**
- Create: `src/journey/world/void/Questions.ts`, `GoldBus.ts`, `src/ui/journey/QaText.tsx`, `tests/unit/journey/qa.test.ts`
- Modify: `src/journey/world/void/VoidScene.ts`, `src/journey/layers.ts`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `t.end.questions` (Bob's, unchanged), `t.journey.qaWord`, `wrapLines`.
- Produces: `QaText` as the real, visually hidden list; `questionSide(i: number): 1 | -1`; `busStep(i: number)`.

- [ ] **Step 1: Write the failing test**

```ts
const html = render(QaText);
for (const q of en.end.questions) expect(html).toContain(escape(q.question));
for (const q of en.end.questions) expect(html).toContain(escape(q.answer));
expect([0, 1, 2].map(questionSide)).toEqual([1, -1, 1]);
```

Harness `qa`: "Q&A" stands at about frame 668; at each of the six read frames the question, answer, leader line and numbered gear show, on alternating sides, and the answer's text is inside the page on 1440x810 and 1280x720 in both languages.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port from `tunnel.src.js`. Open-spoked gold gear with the number in hollow type, the bus stepping sideways at each stop.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "void: Bob's questions along the gold line"`
- [ ] **Step 6: Stage review** for steps `look-back,dissolve,qa,sound`.

---

# Stage 5: collapse, bang, end page

### Task 21: Collapse and big bang

**Files:**
- Create: `src/journey/world/end/Collapse.ts`, `Bang.ts`, `src/journey/bang.ts`, `tests/unit/journey/bang.test.ts`
- Modify: `src/journey/world/World.ts`, `src/journey/layers.ts`, `src/ui/journey/Journey.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Produces in `bang.ts`: `flashAt(f, tl): number`, `RINGS = 7`, `hintOpacity(f): number`, `playBang(tl): void` (scrolls to the end over 4200 ms; instant with reduced motion).

- [ ] **Step 1: Write the failing test**

```ts
let top = 0; for (let f = 870; f < 934; f += 0.25) top = Math.max(top, flashAt(f, tl));
expect(top).toBeCloseTo(0.42, 2);
expect(RINGS).toBe(7);
expect([hintOpacity(860), hintOpacity(875), hintOpacity(890)]).toEqual([0, 0.9, 0]);
```

Harness `bang-click`: the point of light with "Click the light to let it go, or keep scrolling" at 870; a click plays to the end in 3.6 to 5 s. `bang-scroll`: scrolling scrubs; the peak on-screen brightness stays below the mock's value at the same frame plus 5%.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `updateBang`, the rings, sparks from hot to cool, and streaks from `tunnel.src.js`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "end: everything falls into one light, and the soft big bang"`

### Task 22: The end page, and the stage 5 review

**Files:**
- Create: `src/journey/world/end/Universe.ts`, `src/journey/end.ts`, `src/ui/journey/EndWords.tsx`, `tests/unit/journey/end.test.ts`
- Modify: `src/journey/world/World.ts`, `src/ui/journey/Journey.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Produces in `end.ts`: `orbitAngles(mx: number, my: number): { yaw: number; pitch: number }`, `MAX_GALAXIES = 8`, `addGalaxy<T>(list: T[], g: T): T[]`, `gravity(dx: number, dy: number, hold: number): [number, number]`.
- `World.pointer` drives orbit, stars and hold, and `Sound.hold` its rising tone. A press on a link does not start a hold. Email, links and the year come from `profile`.

- [ ] **Step 1: Write the failing test**

```ts
expect(orbitAngles(1, 1)).toEqual({ yaw: expect.closeTo(26 * DEG), pitch: expect.closeTo(15 * DEG) });
expect(addGalaxy(Array(8).fill(0), 1)).toHaveLength(8);
const html = render(EndWords);
const order = ['End of portfolio', "Let's talk.", 'Every universe starts small. So does every project.', 'If any of this gave you an idea', 'Move to pull the stars.'];
order.reduce((at, w) => { const i = html.indexOf(escape(w)); expect(i).toBeGreaterThan(at); return i; }, -1);
for (const w of ['bhccob@gmail.com', 'GitHub', '@bhccob', 'Instagram', 'Send a message', 'Back to the start', 'Rotterdam, born in Aruba']) expect(html).toContain(w);
expect(html).toContain('href="/en/contact/"'); expect(html).toContain('href="mailto:bhccob@gmail.com"');
```

Harness `end-page`: "Let's talk." sharpens from a blur; four galaxies, gas and the dark gate; the words stay inside the gate's inner edge on 1440x810 and 1920x1080; no machine node is visible. `end-orbit`, `end-hold`: holding grows a light and letting go leaves a galaxy, at most eight, and the hint goes after the first; links still work while the toy is live.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Port `galaxyGeo`, `fireBang`, `updateUniverse` and the page words from the mock's `bang` mode. All 3D stays faint, so the words are the one bright thing.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "end: Let's talk, with a universe you can start yourself"`
- [ ] **Step 6: Stage review** for steps `bang-click,bang-scroll,end-page,end-orbit,end-hold,sound`.

---

# Stage 6: other pages, access, phones, speed, Dutch

### Task 23: Other pages in the new style

**Files:**
- Modify: `src/ui/ContactForm.tsx`, `src/ui/NotFoundPage.tsx`, `src/ui/lite/*`, `src/app/routes/{contact,lite,not-found,project}.tsx`, `src/styles/base.css`, `src/styles/tokens.css`, `tools/build/og.mjs`, `src/seo/structured.ts`, their tests

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/lite.test.ts
for (const s of en.journey.sheets) for (const f of s.facts) expect(lite).toContain(escape(f.value));
for (const p of projects.all()) expect(lite).toContain(p.title);
for (const q of en.end.questions) expect(lite).toContain(escape(q.question));
// tests/unit/ui/contact-page.test.ts keeps its form and mailto checks
// tests/unit/journey/pages-style.test.ts
for (const font of ['Montserrat', 'Unbounded', 'Martian Mono']) expect(readFileSync('src/styles/base.css', 'utf8')).not.toContain(font);
// tests/unit/structured.test.ts
expect(personLd().description).toContain('Aruba');
```

- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** New fonts, colours and header on `/contact/`, `/lite/`, 404 and project pages, carrying no new ideas. New share images. Addresses unchanged.
- [ ] **Step 4: Run** `npm test && npm run typecheck`, the build, and `python tools/site_audit.py dist/client --strict`. Expected: pass, and the audit stops on nothing.
- [ ] **Step 5: Commit.** `git commit -m "pages: contact, Lite, 404 and project pages in the new style"`

### Task 24: Access and fallbacks

**Files:**
- Create: `src/ui/journey/CalmJourney.tsx`, `tests/unit/journey/access.test.ts`
- Modify: `src/ui/journey/Journey.tsx`, `src/ui/journey/JourneyCanvas.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `webglSupport()` from `src/scene/webgl.ts`, `FallbackCard`.
- Produces: `journeyMode(v: { webgl: 'ok' | 'none' | 'software'; reduced: boolean; failed: boolean }): 'live' | 'calm' | 'lite-link'`. Decision for reduced motion (my call in the spec): `CalmJourney`, a normal scrolling page of the same words and links on the paper colours, with stills, no flight, collapse, bang or orbit.

- [ ] **Step 1: Write the failing test**

```ts
expect(journeyMode({ webgl: 'ok', reduced: false, failed: false })).toBe('live');
expect(journeyMode({ webgl: 'ok', reduced: true, failed: false })).toBe('calm');
expect(journeyMode({ webgl: 'none', reduced: false, failed: false })).toBe('lite-link');
expect(journeyMode({ webgl: 'ok', reduced: false, failed: true })).toBe('lite-link');
const html = render(Journey); // the prerender
for (const s of en.journey.sheets) expect(html).toContain(s.line.lead);
for (const p of projects.all()) expect(html).toContain(p.title);
for (const q of en.end.questions) expect(html).toContain(escape(q.question));
expect(html).toContain('bhccob@gmail.com');
```

Harness `no-webgl` (never blank, Lite one link away), `reduced-motion`, `keyboard` (every link and the rail reachable, focus visible, focus scrolls its chapter into place), `context-lost` (`WEBGL_lose_context` at frame 450 ends on the fallback with the words reachable), `background-tab` (hidden 30 s then back: `f` unchanged within 2, sound level at most the resting level, no burst), `no-script` (the text is in the HTML).

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** `dt` is clamped as in the mock; AudioContext suspends on `visibilitychange`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: readable without 3D, without motion, and by keyboard"`

### Task 25: Phones and tablets

**Files:**
- Modify: `src/journey/machine/camera.ts`, `src/journey/world/end/Universe.ts`, `src/journey/world/World.ts`, `src/ui/journey/*.tsx`, `src/styles/journey.css`, `tools/proof/journey.mjs`, `tests/unit/journey/end.test.ts`

**Interfaces:**
- Produces in `end.ts`: `touchPlan(dx: number, dy: number): 'orbit' | 'scroll'` (more sideways than down is orbit), `driftAngles(t: number): { yaw: number; pitch: number }`.

- [ ] **Step 1: Write the failing test**

```ts
expect(touchPlan(30, 4)).toBe('orbit'); expect(touchPlan(4, 30)).toBe('scroll');
expect(Math.abs(driftAngles(10).yaw)).toBeLessThan(26 * DEG);
```

Harness `phone` at 390x844 and `tablet` at 820x1180, both by touch: words not covered by the machine on each sheet, no dark bands at the portal, end links and the bottom line do not wrap badly, rail hidden. `rotate`: portrait to landscape at frame 450 stays within 2 frames. `end-touch`: drift replaces orbit, long press selects no text and opens no menu, hold and release works.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Fix each phone rough spot from spec section 13.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: phones and tablets"`

### Task 26: Speed

**Files:**
- Create: `src/journey/quality.ts`, `src/journey/stages.ts`, `tools/proof/budget.mjs`, `tests/unit/journey/quality.test.ts`
- Modify: `src/engine/quality.ts` (`startStep` takes the ladder's costs, default unchanged), `src/journey/world/*`, `src/ui/journey/JourneyCanvas.tsx`, `tools/proof/journey.mjs`

**Interfaces:**
- Consumes: `startStep`, `FrameJudge`, `gpuBench`. Each step's `cost` is measured on the weak GPU, as the old ladder's were.
- Produces:
  ```ts
  interface JourneyQuality { cost: number; pixelRatio: number; stars: number; galaxies: number; clouds: number; wallScreens: number; bloom: number; dof: boolean; mirror: boolean }
  journeyQuality(step: number, finePointer: boolean): JourneyQuality
  World.setQuality(q: JourneyQuality): void   // handed on to each scene
  stageFor(f: number, tl: Timeline): 'machine' | 'flight' | 'void' | 'end'
  stagesToLoad(f: number, tl: Timeline, loaded: ReadonlySet<string>): string[]  // the current one first, then the next once it is within 80 frames
  ```

- [ ] **Step 1: Write the failing test**

```ts
const a = journeyQuality(0, true), b = journeyQuality(1, true), z = journeyQuality(99, true);
expect(b.pixelRatio).toBeLessThan(a.pixelRatio);             // resolution goes first
expect([b.stars, b.galaxies, b.clouds, b.wallScreens]).toEqual([a.stars, a.galaxies, a.clouds, a.wallScreens]);
expect(z.stars).toBeLessThan(a.stars); expect(z.wallScreens).toBeLessThan(a.wallScreens);
expect(stagesToLoad(0, tl, new Set())).toEqual(['machine']);
expect(stagesToLoad(300, tl, new Set(['machine']))).toEqual(['flight']);
expect(stagesToLoad(900, tl, new Set(['machine']))[0]).toBe('end');
```

`tools/proof/budget.mjs` walks the whole journey with a clean cache and sums transferred bytes. Expected at most 15 MB, and at the first view only the machine stage's files have been fetched. Harness: port `smooth`, `rungs` (each step by itself) and `walk-down` (`needle.mjs:3026-3106`) to the whole journey; `jump-early`: with the network throttled, press End at frame 10; the page stays dark with no error until the end stage is ready, then shows the end page, and sound fires no pile-up.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** The ladder lowers resolution, then stars, galaxies, clouds and wall screens, changing in place and never recompiling. Shaders compile during each stage's load. The strong-GPU look stays as approved.
- [ ] **Step 4: Run** the tests, `node tools/proof/budget.mjs`, `STEPS=smooth,rungs,walk-down,jump-early node tools/proof/journey.mjs`, and `GPU=weak STEPS=smooth node tools/proof/journey.mjs`. Expected: PASS; weak GPU median under 33 ms, worst under 100 ms. If a target is missed, tune the ladder, then report the numbers to Bob rather than lowering the target.
- [ ] **Step 5: Commit.** `git commit -m "journey: loads in stages and holds its frames on a weak GPU"`

### Task 27: Dutch and the documents, and the stage 6 review

**Files:**
- Modify: `src/i18n/nl.ts`, `PRODUCT.md`, `DESIGN.md`, `tools/proof/journey.mjs`, `tools/proof/README.md`

- [ ] **Step 1: Write the failing check.** Harness `dutch-fit`: at `/journey/` (Dutch), each sheet's words and every project's and question's text stay inside the page and do not overlap at 1440x810 and 390x844, and no English word from `en.journey` is left in the Dutch page (a list of the sentences compared, excluding names and the agreed English labels).
- [ ] **Step 2: Run it.** `STEPS=dutch-fit node tools/proof/journey.mjs`. Expected: FAIL on the drafts it finds.
- [ ] **Step 3: Implement.** Finish the formal Dutch, shorter where it does not fit. Rewrite `DESIGN.md` from the shipped site. Rewrite `PRODUCT.md`: the goal stays; the "No collaboration wording" rule goes for this page, because Bob asked for "LETS TALK" himself. Update the proof README.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "journey: the Dutch, and the product and design documents"`
- [ ] **Step 6: Stage review** with every step of the harness. Show Bob the new Dutch for his review: he reads it, as section 7 asks.

---

# Stage 7: swap and go live

### Task 28: The swap, and removing the old site

**Files:**
- Modify: `src/app/routes/home.tsx`, `src/app/routes.ts`, `react-router.config.ts`, `src/app/handle.ts`, `src/app/Shell.tsx`, `src/data/pages.ts`, `src/ui/SiteHeader.tsx`, `src/seo/*`, `package.json`, `vite.config.ts`, `README.md`, `tools/proof/README.md`
- Delete: `src/app/routes/journey.tsx`; `src/scene/` except `webgl.ts`, `gpuBench.ts`, `timeouts.ts`; `src/engine/bob`, `core`, `studio`, `palette.ts`, `loading.ts`, `stillness.ts`, `AngleSpring.ts`; `src/input/`; `src/state/` and `src/debug/` except what `journeyDebug` needs; the old `src/ui` parts (`AreaCaption`, `AreaDots`, `QaRing`, `LightFacts`, `SignalReadout`, `SkipButton`, `WorldNames`, `Poster`, `ledSky`, `tornMask`, and those only they import); `src/assets/storm`, `masks`, `renders`; `public/models/bob-compass.glb`; `tools/blender/bead_*`, `bob_*`, `export_compass.py`, `light_dive.py`, `run_*`, `storm_plates.py`; `tools/masks.ts`, `tools/storm_webp.mjs`, `tools/proof/needle.mjs`, `compass.mjs`; the tests of all of these
- Remove packages: `@fontsource-variable/*`, and `maath`, `@react-three/drei`, `@react-three/postprocessing`, `gsap`, `zustand` if nothing imports them

- [ ] **Step 1: Write the failing test,** replacing `tests/unit/home-page.test.ts`

```ts
expect(render(Home)).toContain('See my projects');
expect(await routePaths()).not.toContain('/journey/');
for (const file of sourceFiles('src')) expect(readFileSync(file, 'utf8')).not.toMatch(/VirtualScroll|SceneHost|scene\/bob|engine\/bob/);
```
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Swap and delete,** in one commit, so the site is never half-switched. The harness's `ROUTE` default becomes `/`. Replace tests of removed code rather than keep them. Remove what only the old scenes read: project fields (`object`, `testPoints`, `motion`) and word blocks (`needle`, `lightDive`, `terminal`, and `compass` except what Lite uses). Check Bob's "What is this site built with?" answer is still true word for word: TypeScript, React, React Router, static HTML in Dutch and English, Three.js through React Three Fiber, Blender models, automated tests, a browser test with real input, the Python auditor. If any part stopped being true, ask Bob before changing his words.
- [ ] **Step 4: Run** `npm test && npm run typecheck && PUBLIC_WEB3FORMS_KEY=local-proof-placeholder npm run build && npm run audit && node tools/proof/journey.mjs && node tools/proof/budget.mjs`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "journey: it is the home page now; the old scenes, models, fonts and scroll are gone"`

### Task 29: Go-live check, and deploy on Bob's word

**Files:**
- Modify (after go-live only): `.impeccable/config.json`, `.claude/launch.json`

- [ ] **Step 1: Run the bars,** as the deploy workflow does: `npm audit --audit-level=high`, `python -m unittest discover tools -v`, `python tools/site_audit.py dist/client --strict`, `npx --yes @lhci/cli@0.15.1 autorun` (100 for accessibility, best practices, SEO); then the harness in Edge; `npx playwright` Firefox and WebKit runs of `first-view,flight,qa,end-page` if those browsers are installed, otherwise say they were not run. Expected: all pass; record every number.
- [ ] **Step 2: Hand over.** List what passed and what only Bob can check: a real phone, real Safari, a real weak laptop, the sound on his speakers. Show the final stills and numbers. Ask: go live? **Nothing past here happens without his word.**
- [ ] **Step 3: On his word, deploy.**

```bash
git fetch origin
git merge origin/main
npm test && npm run typecheck
git push origin bob-rebuild:main
```

Expected: the deploy workflow and CodeQL go green (`gh run list --branch main`), with 0 code-scanning alerts. If an alert appears, fix it and report it.

- [ ] **Step 4: Check the live site.** `BASE=https://bhccob.com STEPS=first-view,flight,qa,end-page,no-webgl,reduced-motion,phone node tools/proof/journey.mjs`. Expected: PASS.
- [ ] **Step 5: Tidy up.** Remove the mock-only ignores from `.impeccable/config.json` and the review entries from `.claude/launch.json`. Commit the config change on the branch only if Bob wants it pushed. Update the vault, decision log and memory. Ask Bob before deleting `.superpowers/rebuild-mock/`: that is his call.

---

## Decisions this plan adds (for Bob to overrule)

- Built at `/journey/` behind `JOURNEY=1` until the swap, so old tests and the old home keep working (spec section 15).
- Plain Three.js scene classes hosted by R3F, because the mock's working code is plain Three.js and Bob's Q&A says React Three Fiber (spec section 15).
- The iris view is a render target on a disc under the blades, not a stencil, so it works through the post chain (spec section 15).
- A project opens over the page by `history.pushState`, so the scroll track stays put under it.
- GLBs are quantized, not Draco or Meshopt, because the CSP bans wasm.
- The Lock cursor runs on every page, and text fields keep their text cursor.
- `CalmJourney` is the reduced-motion form: a normal scrolling page of the same words, with stills.
- If the door has not appeared after 12 s of loading, it shows anyway or Lite is offered, so nobody is stuck.
