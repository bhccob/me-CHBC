import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { projects } from '~/data/projects';
import { distanceAt, distanceTable, flightLayout, READ, readFrames, timelineFor } from '~/journey/flight/layout';

const dated = projects.byDate();
const real = flightLayout(dated);
/** The approved mock-up's four: the spacing rules are proved on them, whatever the site has now. */
const four = [{ id: 'a', year: 2025 }, { id: 'b', year: 2026 }, { id: 'c', year: 2026 }, { id: 'd', year: 2026 }];
const mock = flightLayout(four);

describe('the flight, from the project data', () => {
  it('goes oldest first: Cookies Clicker, then Jontai Energy', () => {
    expect(dated.map((p) => p.id)).toEqual(['cookies-clicker', 'jontai-energy']);
  });

  it('stands its two projects where the mock-up stood its first two, on alternating sides', () => {
    expect(real.stops.map((s) => s.s)).toEqual([40, 80]);
    expect(real.stops.map((s) => s.side)).toEqual([1, -1]);
    expect(real.stops.map((s) => s.id)).toEqual(dated.map((p) => p.id));
  });

  it('has a year gate before the first project of each year', () => {
    expect(real.years).toEqual([{ year: 2025, s: 20 }, { year: 2026, s: 60 }]);
  });

  it('spaces its gates as the mock-up does, and ends a tail after the last', () => {
    expect(real.gates).toEqual([8, 30, 48, 70, 88, 98]);
    expect(real.end).toBe(108);
  });

  it('reads each project in order, inside the flight', () => {
    const tl = timelineFor(real);
    const reads = readFrames(real, distanceTable(real));
    expect(reads).toHaveLength(2);
    expect(reads[0]).toBeGreaterThan(tl.flight[0]);
    expect(reads[1]).toBeGreaterThan(reads[0]);
    expect(reads[1]).toBeLessThan(tl.flight[1]);
  });

  it('is shorter with two, and what comes after it comes that much sooner', () => {
    const tl = timelineFor(real);
    expect(tl.shift).toBeLessThan(0);
    expect(tl.flight[0]).toBe(350);
    expect(tl.flight[1]).toBe(566 + tl.shift);
    expect(tl.last).toBe(1496 + tl.shift);
    expect(tl.head).toEqual([566 + tl.shift, 1496 + tl.shift]);
  });
});

/** How far along the flight a layout is at frame `f`. */
const sAt = (layout: ReturnType<typeof flightLayout>, f: number): number => {
  const tl = timelineFor(layout);
  return distanceAt(Math.min(1, Math.max(0, (f - tl.flight[0]) / (tl.flight[1] - tl.flight[0]))), distanceTable(layout));
};

describe('the flight\'s frames: the same stretch of it in each, whatever follows (round 22)', () => {
  // Within half a unit, half a frame's travel at full speed: a flight is a whole number of frames, so it may be half a frame
  // longer or shorter than its time would make it.
  it('plays frame for frame as the mock-up did, up to its last project', () => {
    for (let f = 350; f <= 448; f += 2) expect(Math.abs(sAt(real, f) - sAt(mock, f)), `frame ${f}`).toBeLessThan(0.5);
  });

  it('reads its two projects at the mock-up\'s frames', () => {
    expect(timelineFor(real).reads).toEqual(timelineFor(mock).reads.slice(0, 2));
  });

  it('keeps every frame before a project that is added as it was', () => {
    const more = flightLayout([...four, { id: 'next', year: 2026 }]);
    for (let f = 350; f <= 537; f += 3) expect(Math.abs(sAt(more, f) - sAt(mock, f)), `frame ${f}`).toBeLessThan(0.5);
    expect(timelineFor(more).shift).toBeGreaterThan(0);
  });
});

describe('the mock-up\'s four, where the spacing rules were set', () => {
  it('stands each where the approved mock-up has it', () => {
    expect(mock.stops.map((s) => s.s)).toEqual([40, 80, 116, 152]);
    expect(mock.gates).toEqual([8, 30, 48, 70, 88, 98, 106, 124, 134, 142, 160, 170]);
    expect(mock.end).toBe(180);
  });

  it('reads each at the frames of the spec', () => {
    readFrames(mock, distanceTable(mock)).forEach((f, i) => expect(Math.abs(f - [399, 448, 493, 537][i]), `read ${i}`).toBeLessThanOrEqual(1));
  });
});

describe('a project added to the data alone', () => {
  const more = flightLayout([...four, { id: 'next', year: 2026 }]);
  const newYear = flightLayout([...four, { id: 'next', year: 2027 }]);

  it('extends the flight', () => {
    // As many frames more as its stretch of the flight's time takes (round 22: counted by time, not by distance).
    expect([more.stops.at(-1)?.s, more.end, timelineFor(more).shift]).toEqual([188, 216, 45]);
    expect(timelineFor(more).flight).toEqual([350, 611]);
  });

  it('brings its own year gate in a new year', () => {
    expect(newYear.years.at(-1)).toEqual({ year: 2027, s: 172 });
    expect(newYear.stops.at(-1)?.s).toBe(192);
    expect(newYear.end).toBe(220);
  });

  it('stands no gate at a reading stop, however many there are', () => {
    for (const layout of [real, mock, more, newYear, flightLayout([...four, { id: 'e', year: 2026 }, { id: 'f', year: 2027 }, { id: 'g', year: 2027 }])]) {
      for (const gate of layout.gates) for (const stop of layout.stops) expect(Math.abs(gate - (stop.s - READ)), `gate ${gate}, stop ${stop.s}`).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the timeline it has with the mock-up\'s four', () => {
    const tl = timelineFor(mock);
    expect([tl.shift, tl.last, tl.flight]).toEqual([0, 1496, [350, 566]]);
  });
});

describe('the speed along the flight', () => {
  const table = distanceTable(real);

  it('goes from the start to the end', () => {
    expect(distanceAt(0, table)).toBe(0);
    expect(distanceAt(1, table)).toBeCloseTo(real.end, 3);
  });

  it('never stops', () => {
    for (let i = 1; i < 500; i++) expect(distanceAt(i / 500, table)).toBeGreaterThan(distanceAt((i - 1) / 500, table));
  });

  it('slows to about a fifth of its speed to read', () => {
    const timePerUnit = (s: number): number => {
      const k = Math.round((s / real.end) * table.n);
      return table.cum[k + 1] - table.cum[k];
    };
    expect(timePerUnit((real.stops[0].s + real.stops[1].s) / 2) / timePerUnit(real.stops[1].s - READ)).toBeCloseTo(0.2, 1);
  });
});

describe('what the flight needs of each project', () => {
  it('has the tints and kinds of the spec', () => {
    expect(dated.map((p) => p.flight.tint)).toEqual([[1, 0.6, 0.24], [1, 0.78, 0.42]]);
    expect(dated.map((p) => p.copy('en').flightKind)).toEqual(['School project', 'Concept website']);
    expect(dated[0].copy('en').flightLine).toBe('A browser game built with a classmate around one satisfying loop: click, earn, reinvest.');
    expect(dated[1].copy('en').flightLine).toBe('A concept redesign for a store in Aruba, where the home page plays as one Aruban day.');
  });

  it('has its Dutch too', () => {
    for (const p of dated) {
      expect(p.copy('nl').flightKind.length).toBeGreaterThan(0);
      expect(p.copy('nl').flightLine.length).toBeGreaterThan(0);
    }
  });

  it('breaks its titles as the mock-up does', () => {
    expect(dated.map((p) => p.flight.titleLines)).toEqual([['Cookies', 'Clicker'], ['Jontai', 'Energy']]);
  });

  it('has its pieces: the floating cookie, the sun behind Jontai', () => {
    expect(dated.map((p) => p.flight.piece)).toEqual(['cookie', 'sun']);
    expect(dated.map((p) => p.flight.screens)).toEqual(['wide', 'wide']);
  });

  it('keeps each picture small', () => {
    for (const p of dated) {
      for (const image of p.flight.images) expect(statSync(`public/flight/${image}`).size, image).toBeLessThanOrEqual(300_000);
      if (p.flight.pieceImage) expect(statSync(`public/flight/${p.flight.pieceImage}`).size).toBeLessThanOrEqual(300_000);
    }
  });
});
