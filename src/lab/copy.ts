import type { ConceptId } from './concepts/types';

/**
 * LAB ONLY (throwaway). The words of each preview, in English only. The study lines are the site's own (en.ts, "The
 * brain. The code that makes it think." and so on); the study names are Bob's (2026-11-10).
 */

export type LoaderKind = 'exhibit' | 'drawn' | 'dusk';

export interface LabStep {
  n: string;
  title: string;
  line: string;
}

export interface LabCopy {
  id: ConceptId;
  name: string;
  idea: string;
  /** The one line about what Bob does, under the name. */
  line: string;
  steps: readonly LabStep[];
  /** The closing words, as the machine stands complete. */
  close: { title: string; line: string };
  loader: LoaderKind;
}

const LINE = 'Software engineer, moving into mechatronics.';

const STEPS: readonly LabStep[] = [
  { n: '01', title: 'Software Engineering', line: 'The brain. The code that makes it think.' },
  { n: '02', title: 'Game & App Development', line: 'The controls. How a person plays with it.' },
  { n: '03', title: 'Cybersecurity', line: 'The armour. What keeps it safe.' },
  { n: '04', title: 'Mechatronics', line: 'The body. Gears, motors and movement.' },
];

const CLOSE = { title: 'One machine.', line: 'Each field I learn is one layer of it.' };

export const COPY: Record<ConceptId, LabCopy> = {
  a: { id: 'a', name: 'Exhibit', idea: 'The machine shown like a sculpture; the words come in on their own pages.', line: LINE, steps: STEPS, close: CLOSE, loader: 'exhibit' },
  b: { id: 'b', name: 'Drawn, then built', idea: 'Each part is drawn in gold first, then a scan line prints it solid.', line: LINE, steps: STEPS, close: CLOSE, loader: 'drawn' },
  c: { id: 'c', name: 'Dusk', idea: 'The machine builds itself against a sunset; at night its own lights take over.', line: LINE, steps: STEPS, close: CLOSE, loader: 'dusk' },
};

/** What the loader's instrument reads at `p`, 0 to 1. */
export function loaderReading(kind: LoaderKind, p: number): { value: string; unit: string; label: string } {
  const pad = (n: number, width: number, digits = 0): string => n.toFixed(digits).padStart(width, '0');
  switch (kind) {
    case 'exhibit':
      return { value: pad(Math.round(p * 100), 3), unit: '%', label: 'Lighting the room' };
    case 'drawn':
      return { value: (p * 140).toFixed(1), unit: 'mm', label: 'Drawing the first line' };
    case 'dusk': {
      const minutes = Math.round(p * 52);
      return { value: `18:${pad(minutes, 2)}`, unit: '', label: 'Sunset · Aruba, 18:52' };
    }
  }
}
