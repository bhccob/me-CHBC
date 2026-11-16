# Redesign boundary: the new opening and the frozen brain

Written 2026-11-10 for the opening redesign (loader to brain). Read before touching the home page.

## Update 2026-11-12: the "one signal" brief

Bob's brief of 2026-11-12 replaces everything before the brain with one glowing trace (first view, Studies, Built, the
gauntlet hand, a push into the brain). Checked again on `bob-rebuild` at `97ee4df`: no frozen file has changed since this
document was first written (`git diff --stat 657ab58 HEAD` over the frozen paths is empty).

- **The line is the same.** The brain starts at `timeline.head[0]`: frame **477**, scroll **18,456 px** of 45,918 (40.2 %)
  with today's two projects. Scroll px do not depend on the window size. The brain itself is **930 frames** and
  **27,462 px** of scroll; the new opening may make `head[0]` earlier or later, but not those two numbers.
- **Marked in code** at `src/journey/timeline.ts` (the `head` line), `src/ui/journey/Journey.tsx` (where the brain's layers
  mount) and `src/journey/world/flight/TunnelScene.ts` (the brain's host scene), each with `THE BRAIN BOUNDARY`.
- **Checked by a test.** `tests/unit/journey/brain-boundary.test.ts` hashes every frozen file, the frozen CSS and calm-page
  parts, and the frozen copy in both languages (47 entries in `brain-boundary.lock.json`), and checks the brain's length.
  Any change on the frozen side fails it and names the file. The lock is rewritten only on Bob's yes:
  `BOUNDARY_UPDATE=1 npx vitest run tests/unit/journey/brain-boundary.test.ts`.
- **The flight is no longer kept.** The brief's Built world replaces the projects flight (frames 350 to 477), so the flight
  moves to the opening side. `TunnelScene` must stay as the brain's host: its scene, camera, background, fog and the `join`
  pose the brain starts from.
- **The hand-over changes from an iris to a push.** The compositor that does the iris today (`IrisWindow`, its
  `WindowEffect` after tone mapping) already lays the brain's picture under the opening's; a push is the same thing with a
  straight edge moving up the screen instead of a circle opening.
- **Gap: the ending the brief freezes does not exist yet.** The brief freezes "the eyes-open transition and the
  gaming-setup end page whose monitor shows 'let's talk'". The site has neither. Today the brain ends with the spit and the
  printed scan report titled "Let's talk." (`ScanReport.tsx`, copy `journey.end`). The eyes and the gaming setup exist only
  in the round 63 mock-up `tools/lab/mock/idea-eyes.html` ("Behind the Eyes"), with a stand-in setup, not committed.
  Until Bob decides, the lock freezes today's real ending.
- **Seen in the brain, set by the opening.** The frozen pour (`head/pour.ts`) pours in the four study fields
  (`journey.stack.labels.*.field`) and every project's title. Those keys must stay even if the stack goes (the test checks
  them), and adding Lumo and Locked to `data/projects.ts` adds their titles to what pours in. That is the frozen code doing
  what it does, not a change to it.
- **The brain's first frames show the tunnel's end.** Over head t 0 to 0.04 the gold tunnel's wires, rings and orb glow
  fade out. With no flight before it, that would be a tunnel the visitor never saw. Hiding them is an intro-side change in
  `TunnelScene`; the brain's own drawing does not change.

## The line

The brain is the head journey, "Into my head" (spec `docs/superpowers/specs/2026-11-08-bob-into-my-head-design.md`). It starts at `timeline.head[0]` (`src/journey/timeline.ts:72`): frame **477** on the live site with two projects, scroll **18,456 px** of 45,918 at 1440x810 (40.2 %). The chapter rail switches from Projects to Q&A on that frame, and the `head` stage starts loading 80 frames before it (`src/journey/stages.ts`).

| Frames (2 projects) | What | In the redesign |
|---|---|---|
| loader | Purple ink 客家 loader and the sound door | replaced |
| 0 to 44 | First view, story | replaced |
| 44 to 336 | Four field sheets, machine build, stack | replaced |
| 336 to 372 | Iris: the tunnel shows through the machine | replaced; this is the new seam |
| 350 to 477 | Projects flight through the gold tunnel | **kept as it is** (Bob, 2026-11-10) |
| 477 to 1407 | Brain: shaft, X-ray scan, six answers, spit, scan report | **frozen** |

The new opening must end by handing the screen to the tunnel exactly as the machine's iris does today: the tunnel drawn apart (`IrisWindow.drawTunnel`), shown through a hole in the picture in front (`IrisWindow.place`, the `WindowEffect` after tone mapping), and alone once the canvas is opaque at frame 372 (`IrisWindow.present`). Keep `timeline.ts` as it is, so every frame from 350 on lands where it does now.

## Frozen: no edits to code, visuals, timing, copy or assets

Checked byte for byte with `git diff --stat <base> -- <these paths>` at the end of the redesign.

- `src/journey/head/` (all): `cues`, `headBin`, `hud`, `objects`, `pour`, `readout`, `report`, `shape`, `thoughts`, `time`
- `src/journey/world/head/` (all): `HeadScene`, `draw`, `softBang`, `track`, `xray`
- `src/journey/sound/headEffects.ts`
- `src/ui/journey/ScanHud.tsx`, `HeadAnswers.tsx`, `ScanReport.tsx`, `applyHead.ts`
- `public/models/head.bin`, `tools/head/bake.mjs`, `tools/proof/head-frames.mjs`
- `tests/unit/journey/head-*.test.ts`
- Copy: `journey.head`, `journey.end` and `end.questions` in `src/i18n/en.ts` and `nl.ts`
- CSS: `src/styles/journey.css` lines 871 to 987 (calm answers, printed report, `.j-flash`) and 1191 to 1837 (HUD, answers, report)

## Kept as they are (not frozen by the brief, but the seam depends on them)

- The flight: `src/journey/world/flight/` (all), `src/journey/flight/` (all), `src/journey/world/displayOutput.ts`, `public/models/gate.glb`, `public/flight/`
- `src/journey/world/IrisWindow.ts`, the only path the tunnel and the head reach the screen by

## Shared files: the frozen part needs these, so they change only on the intro side

| File | What the brain needs from it |
|---|---|
| `src/journey/world/flight/TunnelScene.ts` | The head's host: it lives in `tunnel.scene`, uses the tunnel's camera, background, fog and FOV. `join`, `headPlace`, `headTrack` come from the flight's `layout.end`. Moving where the flight ends moves the head. |
| `src/journey/timeline.ts` | `head: [566 + shift, …]`, the `qa` and `contact` chapters, `trackHeightPx`. A change in the intro's length moves every head frame and scroll position. |
| `src/journey/stages.ts` | The `head` and `end` stages and the 80-frame early load. |
| `src/journey/world/World.ts` | The tunnel is updated only while `irisWindowOn || canvasOpaque`; the render switch at `:182-184`; `state.head`; `setLanding`. |
| `src/journey/world/portalWindow.ts` | `canvasOpaque(f) = f >= 372`. The head assumes it. |
| `src/ui/journey/JourneyCanvas.tsx` | The canvas, the quality ladder, `onFail` when `head` or `end` fails. |
| `src/ui/journey/Journey.tsx` | The one loop: `endClock`, `headT`, `Sound.frame`, `applyHead`, the report, the flash, the Contact jump. Mounts `ScanHud`, `HeadAnswers`, `ScanReport`. |
| `src/journey/loop.ts`, `jump.ts` | `glideTo`, `frameForHash` (`#contact`). |
| `src/journey/layers.ts` | `Box`, `boxesMeet`, `PHONE_WIDTH`, `RAIL_WIDTH` (the rest is intro). |
| `src/ui/journey/paper.ts` | `GROUND = '#130724'`, the head's background target (the rest is intro). |
| `src/journey/sound/music.ts`, `engine.ts`, `effects.ts`, `score.ts` | Head cues, ticks, rumble; `flightLevel` fades the rush into the head; a hard-coded `f > 500` hum filter. |
| `src/journey/head/pour.ts` (frozen) reads intro data | `t.journey.stack.labels.*.field`, project titles, `head.pourPlace`. Renaming the stack labels changes what pours into the head: keep those keys. |
| `src/journey/quality.ts`, `engine/quality.ts`, `scene/webgl.ts`, `journey/mode.ts` | The ladder (stars, samples), live / calm / Lite. |
| `src/ui/journey/ChapterRail.tsx`, `CalmJourney.tsx` | The `qa` and `contact` entries; the calm page's answers and printed report (lines 96 to 119). |
| Site-wide | `root.tsx` (fonts, theme colour), `Shell.tsx`, `SiteHeader`, `LockCursor`, `tokens.css`, `base.css`, `journey.css` 1 to 162, `data/projects.ts`, `data/profile.ts`, `debug/journeyDebug.ts`, `tools/proof/journey.mjs` |

## The brain's first frame (f = 477, head t = 0)

Measured from the code and seen on bhccob.com at 1440x810 on 2026-11-10.

- **Camera:** the flight's last pose. With two projects the flight ends at `layout.end = 108`, where the path is straight: position (0, 0, -108), looking at (0, 0, -117), up (0, 1, 0), bank 0. Near 0.05, far 900. FOV eases from the flight's `54 + 11 × speed` to 55 (68 on a phone, aspect < 0.8) with a 0.16 s time constant. Pointer sway as in the flight, handing over to the head's over t 0 to 0.03.
- **Background:** the flight's wash, about `#06050a`, turning to `#130724` over t 0 to 0.04 (frames 477 to about 510). `FogExp2` density 0.017.
- **Light:** one `PointLight` on the camera, gold `(1, 0.7, 0.28)`, intensity 22; a PMREM room at `environmentIntensity` 1.5. The head's materials are unlit and additive.
- **On screen:** the end of the gold tunnel (wires, rings, gates, streaks) with the orb's glow ahead, fading over t 0 to 0.04; the tunnel's parts hidden from t 0.1; 2,600 stars; faint gold octagon rings of the shaft. The head draws nothing until the scan band reaches it at t 0.09.
- **Post-processing:** none. From frame 372 the canvas shows the tunnel's own picture (ACES at exposure 1.2, sRGB encoded in its shaders, 4 MSAA samples at the top step). No grain, no bloom pass, no vignette.
- **DOM:** the header, the 1 px progress bar, the rail with Q&A current. The HUD is hidden at t = 0; its violet glow fades in over t 0 to 0.04.
- **Sound:** the flight's rush fades over frames 477 to 511; the first head cue (`scan`) at t 0.093.

## The seam's frame (where the new opening hands over)

The new opening hands over to the tunnel, not to the head. Today, at frame 336 the tunnel starts showing through the machine's iris and from 372 it is alone. At frames 336 to 350 the tunnel's camera stands at the flight's start (s = 0, `ramp(f, 350, 477)`), its streaks and light moving on their own; from 350 it flies. Whatever the new opening shows, it must at 372 cover the screen with the tunnel's picture and nothing else: no grain, no vignette, no letterbox, no DOM over it except the header and the rail.

## Tokens the frozen part uses

| Token | Value | Where |
|---|---|---|
| Ground | `#130724` (`--night`, `--void`, `GROUND`) | `tokens.css:16-18`, `paper.ts:110`, theme colour |
| Deeper | `#0c0515` (`--void-deep`, `--nebula-deep`) | `tokens.css:19-20` |
| Purple steps | `--pcb #190624`, `--lacquer #120418`, `--nebula #331846`, `--nebula-hi #401f57` | `tokens.css` |
| Gold, the one accent | `#e6b84a` (`--gold`, `--gold-ink`), at most about 6 % of a screen | `tokens.css:33,41` |
| Gold glows (scene only) | `--gold-glow #efb53d`, `--gold-core #fef0a9`, head `GOLD (0.93, 0.7, 0.28)` | `tokens.css`, `HeadScene.ts:67` |
| Ink | `#f2efe8` (`--ink`, `--gold-title`) | `tokens.css:35-36` |
| Quiet text | `--dim #9789bb`, `--lilac #b8aad8`, `--ink-dim #a5a2ad` | `tokens.css:37-39` |
| Display face | Barlow 800, uppercase, tracking -0.025 to -0.03em, line height 0.88 to 0.94 | `DESIGN.md`, `journey.css:1426` |
| Voice | Barlow 600 italic | `DESIGN.md` |
| Labels | IBM Plex Mono 500, uppercase, 11 to 13 px, tracking 0.14em | `base.css:130-143` |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)`; motion on transform and opacity only | `DESIGN.md` |
| Buttons and lines | 2 px radius, 1 px hairlines, no cards, no bordered boxes | `DESIGN.md` |

Two families only: Barlow and IBM Plex Mono. The 3D draws its words in the same two (`TunnelScene.ts:104`, `HeadScene.ts:990`).

## Rules the repo already sets

- Lenis is banned (`tests/unit/scene/banned-imports.test.ts`); the scroll is the browser's own, eased into one frame value (`smoothFrame`, 0.13 s).
- No Draco, Meshopt or KTX2: they need wasm, which the CSP does not allow (`tools/blender/pack.mjs`). Models use mesh quantization; textures are WebP.
- The pixel ratio tops out at 1.5 on the quality ladder (`src/journey/quality.ts`).
- Code art and Blender only; no AI images on the site.
- Never push: a push to `main` deploys, and Bob says go live.
