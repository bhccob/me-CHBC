import type { ConceptId } from './concepts/types';

/**
 * LAB ONLY (throwaway). The words of each preview, in English only. The robot's study lines are the site's own (en.ts);
 * the study names are Bob's (2026-11-10). The PC's lines are drafts for him to change.
 */

export type LoaderKind = 'drawn' | 'boot';

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
  /** The closing words, as the object stands complete. */
  close: { title: string; line: string };
  loader: LoaderKind;
}

const LINE = 'Software engineer, moving into mechatronics.';

export const COPY: Record<ConceptId, LabCopy> = {
  b: {
    id: 'b',
    name: 'Drawn, then built',
    idea: 'Each part is drawn in gold first, then a scan line prints it solid.',
    line: LINE,
    loader: 'drawn',
    steps: [
      { n: '01', title: 'Software Engineering', line: 'The brain. The code that makes it think.' },
      { n: '02', title: 'Game & App Development', line: 'The controls. How a person plays with it.' },
      { n: '03', title: 'Cybersecurity', line: 'The armour. What keeps it safe.' },
      { n: '04', title: 'Mechatronics', line: 'The body. Gears, motors and movement.' },
    ],
    close: { title: 'One machine.', line: 'Each field I learn is one layer of it.' },
  },
  d: {
    id: 'd',
    name: 'Desk PC',
    idea: 'One PC built from the four studies; the camera goes in through its front fan.',
    line: LINE,
    loader: 'boot',
    steps: [
      { n: '01', title: 'Software Engineering', line: 'The board. Where the code runs.' },
      { n: '02', title: 'Game & App Development', line: 'The graphics card. What draws the game.' },
      { n: '03', title: 'Cybersecurity', line: 'The case. Nothing gets in that should not.' },
      { n: '04', title: 'Mechatronics', line: 'The fans and the pump. Motors that keep it cool.' },
    ],
    close: { title: 'One machine.', line: 'Each field I learn is one part of it.' },
  },
};

/** What the loader's instrument reads at `p`, 0 to 1. */
export function loaderReading(kind: LoaderKind, p: number): { value: string; unit: string; label: string } {
  switch (kind) {
    case 'drawn':
      return { value: (p * 140).toFixed(1), unit: 'mm', label: 'Drawing the first line' };
    case 'boot':
      // A PC's memory test at power on, counting up to 32 GB.
      return { value: String(Math.round(p * 32768)).padStart(5, '0'), unit: 'MB', label: 'Memory test · BC-2006' };
  }
}
