import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { en } from '~/i18n/en';
import { nl } from '~/i18n/nl';
import { flightLayout, timelineFor } from '~/journey/flight/layout';
import { HEAD_FRAMES } from '~/journey/head/time';
import { scrollFromFrame, trackHeightPx } from '~/journey/timeline';

/**
 * THE BRAIN BOUNDARY (opening redesign brief, 2026-11-12). Everything from the brain section on is frozen: its code, visuals,
 * timing, copy and assets. The opening (first view to the brain's first frame) may change freely; this test fails the moment
 * anything on the frozen side does. The line and the reasons are in docs/redesign-boundary.md.
 *
 * The lock is rewritten only on Bob's yes, by running this file with BOUNDARY_UPDATE=1.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOCK = join(ROOT, 'tests/unit/journey/brain-boundary.lock.json');

/** Whole folders and files on the frozen side. */
const FROZEN_DIRS = ['src/journey/head', 'src/journey/world/head'];
const FROZEN_FILES = [
  'src/journey/sound/headEffects.ts',
  'src/ui/journey/ScanHud.tsx',
  'src/ui/journey/HeadAnswers.tsx',
  'src/ui/journey/ScanReport.tsx',
  'src/ui/journey/applyHead.ts',
  'public/models/head.bin',
  'tools/head/bake.mjs',
  'tools/proof/head-frames.mjs',
];
/** The frozen tests: every `head-*.test.ts`. */
const FROZEN_TEST_DIR = 'tests/unit/journey';

/** Frozen parts of shared files, from one anchor to the next (or to the file's end), so the intro side may grow round them. */
const FROZEN_SLICES: { key: string; file: string; from: string; to: string | null; keepTo?: boolean }[] = [
  { key: 'src/styles/journey.css#calm-answers', file: 'src/styles/journey.css', from: '/* His six answers, still:', to: '/* A project open over the flight' },
  { key: 'src/styles/journey.css#head', file: 'src/styles/journey.css', from: "/*\n * Bob's head: the scanner's frame", to: null },
  { key: 'src/ui/journey/CalmJourney.tsx#qa', file: 'src/ui/journey/CalmJourney.tsx', from: '<section className="j-calm-qa"', to: '<ScanReport printed />', keepTo: true },
];

/** The frozen copy, in both languages. */
const FROZEN_COPY = {
  'en.journey.head': en.journey.head,
  'en.journey.end': en.journey.end,
  'en.end.questions': en.end.questions,
  'en.end.placeholder': en.end.placeholder,
  'nl.journey.head': nl.journey.head,
  'nl.journey.end': nl.journey.end,
  'nl.end.questions': nl.end.questions,
  'nl.end.placeholder': nl.end.placeholder,
};

/** Text with Windows line endings reads the same as with Unix ones; anything else is hashed byte for byte. */
function text(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
}

function sha(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function filesIn(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(ROOT.length).replace(/\\/g, '/'));
}

function slice({ file, from, to, keepTo }: (typeof FROZEN_SLICES)[number]): string {
  const source = text(file);
  const start = source.indexOf(from);
  if (start < 0 || source.indexOf(from, start + 1) >= 0) throw new Error(`${file}: the anchor "${from}" must stand exactly once`);
  if (to === null) return source.slice(start);
  const end = source.indexOf(to, start);
  if (end < 0) throw new Error(`${file}: the anchor "${to}" is gone`);
  return source.slice(start, keepTo ? end + to.length : end);
}

/** Every frozen thing and its hash, now. */
function current(): Record<string, string> {
  const out: Record<string, string> = {};
  const files = [
    ...FROZEN_DIRS.flatMap(filesIn),
    ...FROZEN_FILES,
    ...filesIn(FROZEN_TEST_DIR).filter((path) => /\/head-[^/]*\.test\.ts$/.test(path)),
  ].sort();
  for (const path of files) out[path] = path.endsWith('.bin') ? sha(readFileSync(join(ROOT, path))) : sha(text(path));
  for (const part of FROZEN_SLICES) out[part.key] = sha(slice(part));
  for (const [key, value] of Object.entries(FROZEN_COPY)) out[`copy:${key}`] = sha(JSON.stringify(value));
  return out;
}

describe('the brain boundary: nothing from the brain section on changes', () => {
  const now = current();

  if (process.env.BOUNDARY_UPDATE === '1') {
    it('rewrites the lock (only on Bob’s yes)', () => {
      writeFileSync(LOCK, `${JSON.stringify({ written: new Date().toISOString().slice(0, 10), entries: now }, null, 2)}\n`);
    });
    return;
  }

  const locked = (JSON.parse(readFileSync(LOCK, 'utf8')) as { entries: Record<string, string> }).entries;

  it('keeps every frozen file, slice and string byte for byte', () => {
    const changed = Object.keys(locked).filter((key) => key in now && now[key] !== locked[key]);
    const gone = Object.keys(locked).filter((key) => !(key in now));
    const added = Object.keys(now).filter((key) => !(key in locked));
    expect({ changed, gone, added }).toEqual({ changed: [], gone: [], added: [] });
  });

  it('keeps the brain’s own length: 930 frames and 27,462 px of scroll, whatever the opening does', () => {
    const tl = timelineFor(flightLayout(projects.byDate()));
    const max = trackHeightPx(tl);
    expect(tl.head[1] - tl.head[0]).toBe(HEAD_FRAMES);
    expect(HEAD_FRAMES).toBe(930);
    expect(Math.round(max - scrollFromFrame(tl.head[0], max, tl))).toBe(27462);
    expect(tl.chapters.find((chapter) => chapter.id === 'qa')?.from).toBe(tl.head[0]);
  });

  it('still has the words the frozen pour reads from the opening (head/pour.ts)', () => {
    for (const dictionary of [en, nl]) {
      for (const part of ['armour', 'controls', 'brain', 'body'] as const) {
        expect(dictionary.journey.stack.labels[part].field.length).toBeGreaterThan(0);
      }
      expect(dictionary.journey.head.pourPlace.length).toBeGreaterThan(0);
    }
  });
});
