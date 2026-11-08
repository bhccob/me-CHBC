# Dark Purple and Q&A Words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the site's ground from near-black to dark purple where it reads well, and make Bob's two edits to his Q&A answers.

**Architecture:** The ground is one token, `--night` in `src/styles/tokens.css`, plus four places that hard-code `#07060b`. They all point at the token, and a test guards contrast and stray copies. The answers live in `src/i18n/en.ts` and `nl.ts`, and a copy test pins them.

**Tech Stack:** CSS custom properties, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-bob-into-my-head-design.md`, sections 7 and 8. This plan runs before `2026-11-08-into-my-head.md`; neither depends on the other.

## Global Constraints

- Work on the branch `bob-rebuild`. Commit after each task. Never push: a push to `main` deploys, and only Bob says go live.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Messages follow the repo's style: `area: what is now true`.
- No subagents: Bob's standing rule. The work is done inline.
- The new ground is `#130724`. Darker and lighter steps come from the existing purples: `--nebula-deep #0c0515`, `--lacquer #120418`, `--pcb #190624`, `--nebula #331846`. Quiet text uses `--dim #9789bb` and `--lilac #b8aad8`. Gold stays the one accent, at most about 6 % of a screen.
- "Dont force too much, only do if it make sense" (Bob): a surface may stay near-black only where it needs deep contrast, and each such place goes on the review list in Task 1.
- Lighthouse accessibility stays at 100.
- Dutch is formal and drafted by the builder for Bob's review.

## Review Focus

- A text colour that passed on near-black may fail on purple: every text token is checked against `--night` (Task 1's test).
- Inside the portal the canvas is opaque and the tunnel paints its own tinted wash: it stays as it is, the first entry on the near-black list (Task 1).
- An open project or a project page (`.j-open-view`, `.ps-page`) sits over the journey: it must share the new ground, not flash black (Task 1's stray-copy test).
- The first view's paper canvas paints its own ground in `paper.ts`: it must match the token, or a seam shows at its edge (Task 1's test reads both).
- The software sheet repeats the "work with" sentence: change it with the answer, or the site says two things (Task 2).

---

### Task 1: Dark purple ground

**Files:**
- Modify: `src/styles/tokens.css` (the ratio rule in the header comment; `--night`, `--void`, `--void-deep`; every contrast note that names `--night` or `--void`)
- Modify: `src/styles/journey.css` (`--j-bg`; `.j-door-go` text colour; `.j-open-view` background)
- Modify: `src/styles/project-sheet.css` (`.ps-page` background)
- Modify: `src/ui/journey/paper.ts` (the fill that is `'#07060b'` today)
- Modify: `docs/art-direction.md` section 1 and `docs/art-direction/palette.json` (the night value)
- Test: `tests/unit/journey/palette.test.ts` (create)

**Interfaces:**
- Produces: `--night: #130724` as the page ground, read by Plan 2's head scene and report panel.
- Produces: `GROUND = '#130724'`, exported from `src/ui/journey/paper.ts`, the one place script code takes the ground from.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/journey/palette.test.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUND } from '~/ui/journey/paper';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string): string => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1].toLowerCase();
const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('the dark purple ground (Bob, 2026-11-08)', () => {
  it('is #130724, and the paper canvas paints the same', () => {
    expect(token('night')).toBe('#130724');
    expect(GROUND).toBe('#130724');
  });

  it('keeps every text colour readable on it', () => {
    for (const name of ['ink', 'gold-title', 'gold-ink', 'cream', 'lilac', 'gold']) expect(ratio(token(name), token('night'))).toBeGreaterThanOrEqual(7);
    for (const name of ['ink-dim', 'dim']) expect(ratio(token(name), token('night'))).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves no stray near-black ground in the styles or the page code', () => {
    const files = [...readdirSync('src/styles').map((f) => join('src/styles', f)), 'src/ui/journey/paper.ts'];
    for (const file of files) expect(readFileSync(file, 'utf8').toLowerCase(), file).not.toContain('#07060b');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/journey/palette.test.ts`
Expected: FAIL. `GROUND` is not exported, and `--night` is `#07060b`.

- [ ] **Step 3: Set the ground**

In `tokens.css`: `--night` and `--void` become `#130724`, and `--void-deep` becomes `#0c0515`. The header's ratio rule reads "about 60 % dark purple, 30 % deeper purple and near-black, at most 6 % gold". Recompute each contrast note against `#130724` with the test's formula. In `journey.css`, set `--j-bg: var(--night)`, and give `.j-door-go`'s `color` and `.j-open-view`'s `background` `var(--night)`. In `project-sheet.css`, give `.ps-page`'s `background` `var(--night)`. In `paper.ts`, add `export const GROUND = '#130724';` and use it for the fill. In `palette.json` and `art-direction.md` section 1, change the night value and say why: Bob's wish of 2026-11-08.

- [ ] **Step 4: Run the test and the rest of the suite**

Run: `npx vitest run tests/unit/journey/palette.test.ts`, then `npm test` and `npm run typecheck`
Expected: PASS. If a contrast check fails, lift that token within its own family, for example `--dim` toward `--lilac`, and note the new ratio.

- [ ] **Step 5: List what stays near-black, and check by eye**

Run the dev server (`.claude/launch.json`, "needle-dev") and walk the journey from the first view to the end at 1280×800 and 375×812. List in `docs/art-direction.md` section 1, under "Near-black on purpose", each surface that keeps a near-black ground and why. The tunnel's per-project wash (`TunnelScene` `washAt`) is the first entry: inside the portal the canvas is opaque. Then run Lighthouse on `/en/` and `/` with `lighthouserc.json`.
Expected: accessibility 100 on both. Take screenshots of the first view, a sheet, the stack and the portal for Bob's review.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/styles/journey.css src/styles/project-sheet.css src/ui/journey/paper.ts docs/art-direction.md docs/art-direction/palette.json tests/unit/journey/palette.test.ts
git commit -m "palette: the ground is dark purple #130724 (Bob, 2026-11-08), near-black only where it needs the contrast"
```

**Review stop:** Bob looks at the screenshots and the near-black list before Plan 2 starts.

### Task 2: Bob's two answer edits

**Files:**
- Modify: `src/i18n/en.ts` (the answers to "What are your hobbies?" and "What do you work with at the moment?" in `end.questions`, and the software sheet's sentence that repeats the second)
- Modify: `src/i18n/nl.ts` (the same three)
- Test: `tests/unit/journey/copy.test.ts` (add a `describe`)

**Interfaces:**
- Produces: the new answer text that the old Q&A shows now and Plan 2's answer cards show later.

- [ ] **Step 1: Write the failing test**

```ts
describe("Bob's answer edits (2026-11-08)", () => {
  const answer = (t: typeof en, q: string) => t.end.questions.find((x) => x.question === q)!.answer;

  it('says he has retired from powerlifting and table tennis', () => {
    expect(answer(en, 'What are your hobbies?')).toBe('I run, lift weights and play games. I competed at a high level in powerlifting and table tennis, and have since retired from both.');
    expect(answer(nl, 'Wat zijn je hobby’s?')).toBe('Ik hardloop, train met gewichten en game. Ik kwam op hoog niveau uit in powerliften en tafeltennis, en ben inmiddels met beide gestopt.');
  });

  it('names Roblox Studio next to Godot, wherever the sentence stands', () => {
    expect(answer(en, 'What do you work with at the moment?')).toContain('game development in Godot and Roblox Studio, and modern frameworks');
    expect(answer(nl, 'Waar werk je op dit moment mee?')).toContain('gameontwikkeling in Godot en Roblox Studio, en moderne frameworks');
    for (const text of [JSON.stringify(en), JSON.stringify(nl)]) expect(text).not.toMatch(/in Godot (and|en) modern/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/journey/copy.test.ts`
Expected: FAIL on both `it`s.

- [ ] **Step 3: Change the words**

Put the exact sentences from the test into `en.ts` and `nl.ts`. Make the same Roblox Studio change in the software sheet's sentence in both files, so they agree. Leave every other word as it is, including the full answer to "What is this site built with?".

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/journey/copy.test.ts tests/unit/journey/dutch-formal.test.ts`, then `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.ts src/i18n/nl.ts tests/unit/journey/copy.test.ts
git commit -m "qa: Roblox Studio next to Godot, and retired from powerlifting and table tennis (Bob's words)"
```
