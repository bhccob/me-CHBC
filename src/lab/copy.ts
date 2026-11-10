import type { ConceptId } from './concepts/types';

/**
 * LAB ONLY (throwaway). The words of each preview, in English only. Draft lines for Bob to change; none of this goes into
 * en.ts or nl.ts until a concept is chosen.
 */

export type LoaderKind = 'psu' | 'pnp' | 'line' | 'scan' | 'crank';

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
  loader: LoaderKind;
  /** A storyboard of stills rather than a scroll preview. */
  stills?: boolean;
}

const LINE = 'Software engineer, moving into mechatronics.';

export const COPY: Record<ConceptId, LabCopy> = {
  a: {
    id: 'a',
    name: 'Chain reaction',
    idea: 'One bench, one shot. Each part makes the next one move.',
    line: LINE,
    loader: 'psu',
    steps: [
      { n: '01', title: 'Mechanics', line: 'A lead screw turns. The drawer comes out.' },
      { n: '02', title: 'Mechatronics', line: 'It trips a switch. The arm takes the part.' },
      { n: '03', title: 'Electronics', line: 'Seated. Current runs through the copper.' },
      { n: '04', title: 'Software', line: 'The screen wakes and writes the name.' },
    ],
  },
  b: {
    id: 'b',
    name: 'Assembly',
    idea: 'A machine builds the name out of real parts, then powers it.',
    line: LINE,
    loader: 'pnp',
    steps: [
      { n: '01', title: 'Mechanics', line: 'A gantry runs on two rails.' },
      { n: '02', title: 'Mechatronics', line: 'Two heads find the marks and place the parts.' },
      { n: '03', title: 'Electronics', line: 'Heat. The solder flows and the joints hold.' },
      { n: '04', title: 'Software', line: 'Power on. The firmware sends the first signal.' },
    ],
  },
  c: {
    id: 'c',
    name: 'Blueprint',
    idea: 'One line draws everything, then it becomes real.',
    line: LINE,
    loader: 'line',
    steps: [
      { n: '01', title: 'Mechanics', line: 'First a drawing: a drawer, to a tolerance.' },
      { n: '02', title: 'Mechatronics', line: 'The drawer becomes an arm: joints, reach, limits.' },
      { n: '03', title: 'Software', line: 'The arm becomes a screen: what it is told to do.' },
      { n: '04', title: 'Electronics', line: 'Then it is real, and the line is a signal.' },
    ],
  },
  d: {
    id: 'd',
    name: 'Scan',
    idea: "The brain's own scanner reads the name first, and finds a machine inside it.",
    line: LINE,
    loader: 'scan',
    stills: true,
    steps: [
      { n: '01', title: 'Surface', line: 'The scan band reaches the name.' },
      { n: '02', title: 'Mechanism', line: 'Under the letters: what moves.' },
      { n: '03', title: 'Circuit', line: 'Under that: what carries current.' },
      { n: '04', title: 'Core', line: 'At the middle, one part: BC-2006.' },
    ],
  },
  e: {
    id: 'e',
    name: 'Mechanism',
    idea: 'The name is the machine. Scroll is the crank.',
    line: LINE,
    loader: 'crank',
    stills: true,
    steps: [
      { n: '01', title: 'Input', line: 'Scroll turns the B.' },
      { n: '02', title: 'Transmission', line: 'Each letter drives the next.' },
      { n: '03', title: 'Contact', line: 'The G closes a switch.' },
      { n: '04', title: 'Output', line: 'Current reaches BC-2006.' },
    ],
  },
};

/** What the loader's instrument reads at `p`, 0 to 1. */
export function loaderReading(kind: LoaderKind, p: number): { value: string; unit: string; label: string } {
  const pad = (n: number, width: number, digits = 0): string => n.toFixed(digits).padStart(width, '0');
  switch (kind) {
    case 'psu':
      return { value: pad(p * 5, 5, 2), unit: 'V', label: `Bench supply · ${pad(p * 0.42, 4, 2)} A` };
    case 'pnp':
      return { value: pad(Math.round(p * 100), 3), unit: '/100', label: 'Placed · fiducials found' };
    case 'line':
      return { value: (p * 120).toFixed(2), unit: 'mm', label: 'Line length' };
    case 'scan':
      return { value: pad(Math.round(p * 100), 3), unit: '%', label: 'Scan · slice 0 to 256' };
    case 'crank':
      return { value: pad(p * 10, 4, 1), unit: '/ 10', label: 'Turns of the crank' };
  }
}
