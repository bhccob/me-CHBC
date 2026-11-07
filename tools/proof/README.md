# Proof harness

`journey.mjs` drives a real headless Edge through the built site, served the way GitHub Pages serves it, with real wheel,
touch and key input, and checks what the journey on the home page promises (spec
`docs/superpowers/specs/2026-11-05-bob-machine-rebuild-design.md`, section 11). It prints one `PASS` or `FAIL` line per
step, writes `results.json` and the stills to a folder, and exits 1 if a step failed. Every step also fails on a console
error, a page error or a CSP violation.

It is not part of the site or its tests, and it adds no dependency to the repo: Playwright lives outside it.

## Set up once

Install `playwright-core` in a folder of your own. It needs no browser download: the harness launches the Edge that is
already on the machine, through its `msedge` channel.

```
npm i --prefix C:/tools/playwright-check playwright-core
```

Point `PLAYWRIGHT_CORE` at the package. Any copy will do, such as the one in npm's `_npx` cache on a machine with the
Playwright MCP (`%LOCALAPPDATA%\npm-cache\_npx\<hash>\node_modules\playwright-core`).

```
set PLAYWRIGHT_CORE=C:\tools\playwright-check\node_modules\playwright-core
```

## Run

```
npm run build
node tools/proof/journey.mjs
```

It serves `dist/client` itself on port 4491 (`tools/serve-pages.mjs`, case-sensitive, 404 with `404.html`, as GitHub
Pages does) and reads the journey through `?proof`, which only then installs `window.__journeyDebug`.

| Variable | What it does |
| --- | --- |
| `STEPS` | a comma list of steps; all by default |
| `PROOF_DIR` | where `results.json` and the stills go; `./proof-out` by default |
| `BASE` | test another site, such as `https://bhccob.com`, instead of serving the build |
| `ROUTE` | the journey's address; `/` by default |
| `GPU=weak` | the low-power GPU, with the CPU throttled 4x, at 1080p: the slowest machine the site is held to |
| `WALK_TO` | how far `smooth` walks, in frames of the timeline |

## Steps

- **Speed:** `rungs`, `walk-down`, `jump-early`, `smooth`.
- **Phones and tablets:** `phone`, `tablet`, `rotate`, `end-touch`.
- **Fallbacks:** `reduced-motion`, `no-webgl`, `context-lost`, `keyboard`, `background-tab`, `no-script`.
- **The loader:** `loader`, `loader-quick`, `loader-new-tab`, `loader-door-keys`, `loader-reduced`, `give-up`.
- **The first view and the sheets:** `first-view`, `sheets`, `engineering-readable`, `stack`, `portal`.
- **The flight and the projects:** `flight`, `projects`, `project-open`, `project-direct`, `stills`.
- **The void and the end:** `dissolve`, `look-back`, `qa`, `bang-click`, `bang-scroll`, `end-page`, `end-orbit`, `end-hold`.
- **Cursor and sound:** `cursor`, `no-cursor`, `cursor-form`, `sound`.
- **Place and address:** `jumps`, `hash`, `reload-mid`, `resize-keeps-place`, `lang-keeps-place`.
- **The words:** `dutch-fit` walks the Dutch page at 1440x810 and 390x844, checks that all its words stay on the page
  and over nothing, and compares every English sentence against what the Dutch visitor is given, apart from the names
  and the agreed English labels.

## The download budget

`budget.mjs` walks the journey with a clean cache and sums what came over the wire: only the machine stage's files may
have come at the first view, and the whole journey must stay within 15 MB.

```
node tools/proof/budget.mjs
```
