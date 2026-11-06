/** The small math the journey shares. Pure: no DOM, no three. */

export const TAU = Math.PI * 2;

export const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

/** Where `value` is between `from` and `to`, as 0 to 1. */
export const ramp = (value: number, from: number, to: number): number => clamp((value - from) / (to - from));

export const ez = (x: number): number => x * x * (3 - 2 * x);

/** `ramp`, with soft ends. */
export const ease = (value: number, from: number, to: number): number => ez(ramp(value, from, to));

/** Up over `a` to `b`, then down over `c` to `d`. */
export const band = (value: number, a: number, b: number, c: number, d: number): number => ease(value, a, b) * (1 - ease(value, c, d));

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Past 1 a little, and back: `o` is how far. */
export function backOut(x: number, o = 1.4): number {
  const t = x - 1;
  return 1 + t * t * ((o + 1) * t + o);
}

/** A repeatable random number source. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** The Catmull-Rom spline through `b` and `c`, at `t` from 0 to 1. */
export function catmullRom(a: number, b: number, c: number, d: number, t: number): number {
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
}
