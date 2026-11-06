import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { distanceAt, distanceTable, flightLayout, READ, readFrames, timelineFor } from '~/journey/flight/layout';

const dated = projects.byDate();
const real = flightLayout(dated);

describe('the flight, from the project data', () => {
  it('goes oldest first', () => {
    expect(dated.map((p) => p.id)).toEqual(['cookies-clicker', 'jontai-energy', 'steady', 'portle']);
  });

  it('stands each project where the approved mock-up has it, on alternating sides', () => {
    expect(real.stops.map((s) => s.s)).toEqual([40, 80, 116, 152]);
    expect(real.stops.map((s) => s.side)).toEqual([1, -1, 1, -1]);
    expect(real.stops.map((s) => s.id)).toEqual(dated.map((p) => p.id));
  });

  it('has a year gate before the first project of each year', () => {
    expect(real.years).toEqual([{ year: 2025, s: 20 }, { year: 2026, s: 60 }]);
  });

  it('spaces its gates as the mock-up does', () => {
    expect(real.gates).toEqual([8, 30, 48, 70, 88, 98, 106, 124, 134, 142, 160, 170]);
    expect(real.end).toBe(180);
  });

  it('reads each project at the frames of the spec', () => {
    readFrames(real, distanceTable(real)).forEach((f, i) => expect(Math.abs(f - [399, 448, 493, 537][i]), `read ${i}`).toBeLessThanOrEqual(1));
  });
});

describe('a project added to the data alone', () => {
  const more = flightLayout([...dated, { id: 'next', year: 2026 }]);
  const newYear = flightLayout([...dated, { id: 'next', year: 2027 }]);

  it('extends the flight', () => {
    expect([more.stops.at(-1)?.s, more.end, timelineFor(more).shift]).toEqual([188, 216, 43]);
    expect(timelineFor(more).flight).toEqual([350, 609]);
  });

  it('brings its own year gate in a new year', () => {
    expect(newYear.years.at(-1)).toEqual({ year: 2027, s: 172 });
    expect(newYear.stops.at(-1)?.s).toBe(192);
    expect(newYear.end).toBe(220);
  });

  it('stands no gate at a reading stop, however many there are', () => {
    for (const layout of [real, more, newYear, flightLayout([...dated, { id: 'a', year: 2026 }, { id: 'b', year: 2027 }, { id: 'c', year: 2027 }])]) {
      for (const gate of layout.gates) for (const stop of layout.stops) expect(Math.abs(gate - (stop.s - READ)), `gate ${gate}, stop ${stop.s}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the timeline it has with the real four', () => {
    const tl = timelineFor(real);
    expect([tl.shift, tl.last, tl.flight]).toEqual([0, 934, [350, 566]]);
  });
});

describe('the speed along the flight', () => {
  const table = distanceTable(real);

  it('goes from the start to the end', () => {
    expect(distanceAt(0, table)).toBe(0);
    expect(distanceAt(1, table)).toBeCloseTo(180, 3);
  });

  it('never stops', () => {
    for (let i = 1; i < 500; i++) expect(distanceAt(i / 500, table)).toBeGreaterThan(distanceAt((i - 1) / 500, table));
  });

  it('slows to about a fifth of its speed to read', () => {
    const timePerUnit = (s: number): number => {
      const k = Math.round((s / real.end) * table.n);
      return table.cum[k + 1] - table.cum[k];
    };
    expect(timePerUnit(100) / timePerUnit(real.stops[1].s - READ)).toBeCloseTo(0.2, 1);
  });
});

describe('what the flight needs of each project', () => {
  it('has the tints and kinds of the spec', () => {
    expect(dated.map((p) => p.flight.tint)).toEqual([[1, 0.6, 0.24], [1, 0.78, 0.42], [0.98, 0.86, 0.66], [0.58, 0.5, 1]]);
    expect(dated.map((p) => p.copy('en').flightKind)).toEqual(['School project', 'Concept website', 'Android app', 'Web app, early access']);
    expect(dated[0].copy('en').flightLine).toBe('A browser game built with a classmate around one satisfying loop: click, earn, reinvest.');
    expect(dated[1].copy('en').flightLine).toBe('A concept redesign for a store in Aruba, where the home page plays as one Aruban day.');
    expect(dated[2].copy('en').flightLine).toBe('A calm, private medication reminder for people working through hard things.');
    expect(dated[3].copy('en').flightLine).toBe('A private archive for your portfolio, your investment theses and the friends you trust with them.');
  });

  it('has its Dutch too', () => {
    for (const p of dated) {
      expect(p.copy('nl').flightKind.length).toBeGreaterThan(0);
      expect(p.copy('nl').flightLine.length).toBeGreaterThan(0);
    }
  });

  it('breaks its titles as the mock-up does', () => {
    expect(dated.map((p) => p.flight.titleLines)).toEqual([['Cookies', 'Clicker'], ['Jontai', 'Energy'], ['Steady'], ['Portle']]);
  });

  it('has its pieces: the floating cookie, the sun behind Jontai, three phones, the floating ring', () => {
    expect(dated.map((p) => p.flight.piece)).toEqual(['cookie', 'sun', undefined, 'ring']);
    expect(dated.map((p) => p.flight.screens)).toEqual(['wide', 'wide', 'phones', 'wide']);
    expect(dated[2].flight.images).toHaveLength(3);
  });

  it('keeps each picture small', () => {
    for (const p of dated) {
      for (const image of p.flight.images) expect(statSync(`public/flight/${image}`).size, image).toBeLessThanOrEqual(300_000);
      if (p.flight.pieceImage) expect(statSync(`public/flight/${p.flight.pieceImage}`).size).toBeLessThanOrEqual(300_000);
    }
  });
});
