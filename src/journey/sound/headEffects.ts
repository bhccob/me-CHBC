import { pressureAt } from '../head/cues';
import type { HeadCue } from '../head/cues';
import { ease } from '../math';
import type { Audio } from './engine';
import { fxNoise, fxOsc } from './effects';

/**
 * The head journey's sounds (spec 2026-11-08 "Into my head", section 6a), ported from mock-up 20's `tone`, `noiseHit` and
 * `sfx`: the scan's sweep, the lid's crack, soft ticks while things pour in, a ping for each label, a whoosh for each trip,
 * a soft tone for each thought, the rumble of the pressure, the spit, the spark gathering, the soft boom, and the report's
 * ticks. All made in code, as the site's other sounds are; nothing recorded.
 */

/** A tone from `f0` to `f1`, `delay` seconds from now (mock `tone`). */
const tone = (a: Audio, type: OscillatorType, f0: number, f1: number, peak: number, attack: number, decay: number, delay = 0): void => fxOsc(a, type, f0, f1, peak, attack, decay, a.ctx.currentTime + delay);

/** Filtered noise, its filter swept from `f0` to `f1` (mock `noiseHit`). */
const noise = (a: Audio, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, attack: number, decay: number, delay = 0): void =>
  fxNoise(a, type, f0, q, peak, attack, decay, a.ctx.currentTime + delay, f1 !== f0 ? f1 : undefined);

/** The thoughts' tones, as steps above 220 Hz. */
const NOTES = [1, 1.125, 1.25, 1.5, 1.667, 1.875, 2] as const;

/**
 * The spit against the mock's: through the site's compressor at the mock's level it peaked at 0.56 to 0.61, over the
 * harness's no-distortion bar of 0.6, and well over the machine's loudest (0.41).
 */
const SPIT_LEVEL = 0.75;

/** The labels' one pitch: six pings at one note make no melody (spec section 14; Bob wants no melody on the site). */
const LABEL_PING = 0;

const scan = (a: Audio): void => {
  tone(a, 'sine', 160, 720, 0.05, 0.4, 2.4);
  for (let i = 0; i < 7; i++) tone(a, 'square', 1400, 1400, 0.006, 0.002, 0.03, i * 0.33);
};

const tick = (a: Audio): void => {
  const f = 1600 + Math.random() * 1800;
  tone(a, 'sine', f, f, 0.01, 0.002, 0.07);
};

const ping = (a: Audio, k: number): void => {
  const f = 520 + k * 62;
  tone(a, 'sine', f, f, 0.045, 0.005, 0.9);
  tone(a, 'sine', f * 2.01, f * 2.01, 0.012, 0.005, 0.5);
};

const whoosh = (a: Audio, v: number): void => noise(a, 'bandpass', 280, 1900, 0.9, 0.12 * v, 0.25, 0.65);

const SOUNDS: Readonly<Record<HeadCue, (a: Audio, n: number) => void>> = {
  scan,
  // The lid: a crack.
  lid: (a) => {
    noise(a, 'bandpass', 1800, 600, 3, 0.08, 0.005, 0.25);
    tone(a, 'sine', 90, 60, 0.12, 0.01, 0.5);
  },
  label: (a) => ping(a, LABEL_PING),
  dive: (a) => whoosh(a, 1),
  thought: (a, n) => {
    const f = 220 * NOTES[Math.min(NOTES.length - 1, Math.max(0, n))];
    tone(a, 'sine', f, f, 0.08, 0.01, 1.8);
    tone(a, 'sine', f * 2.76, f * 2.76, 0.02, 0.005, 0.7);
    noise(a, 'bandpass', 900, 3000, 2, 0.02, 0.01, 0.4);
  },
  corridor: (a) => whoosh(a, 0.6),
  down: (a) => whoosh(a, 0.5),
  // The spit: a hard "p", the burst of air and spray, a wet tail; at SPIT_LEVEL of the mock's, the loudest moment of the site.
  spit: (a) => {
    tone(a, 'sine', 170, 48, 0.42 * SPIT_LEVEL, 0.004, 0.22);
    noise(a, 'bandpass', 300, 3400, 1.1, 0.62 * SPIT_LEVEL, 0.015, 0.55);
    noise(a, 'highpass', 2600, 6500, 0.7, 0.2 * SPIT_LEVEL, 0.004, 0.32);
    noise(a, 'bandpass', 1100, 420, 2.2, 0.14 * SPIT_LEVEL, 0.06, 0.9, 0.08);
    noise(a, 'highpass', 3000, 7000, 0.8, 0.05 * SPIT_LEVEL, 0.25, 0.9, 0.12);
  },
  // The spark gathering: a short rising tone.
  gather: (a) => {
    tone(a, 'sine', 55, 420, 0.07, 0.42, 0.08);
    noise(a, 'bandpass', 200, 2400, 1.4, 0.06, 0.4, 0.1);
  },
  // The soft big bang: the scan's sweep as the line opens, and a low, soft boom.
  softBang: (a) => {
    scan(a);
    tone(a, 'sine', 70, 38, 0.1, 0.01, 1.4);
    noise(a, 'lowpass', 600, 120, 0.7, 0.05, 0.02, 1.2);
  },
  // The report: a tick for each line it prints, and a ping for "Let's talk."
  print: (a) => tick(a),
  printTitle: (a) => ping(a, 5),
};

/** Plays a cue of the head journey; `n` is which label, thought or turn it is. */
export function playHeadCue(a: Audio, cue: HeadCue, n: number): void {
  SOUNDS[cue](a, n);
}

/** One of the soft ticks while things pour in. */
export const pourTick = tick;

/** The chance of a pouring tick this frame: nine a second while things pour in (mock: `dt * 9 * streamOn`). */
export function pourTickChance(t: number, dt: number): number {
  if (t <= 0.12 || t >= 0.22) return 0;
  const streaming = ease(t, 0, 0.04) * (1 - ease(t, 0.23, 0.29));
  return dt * 9 * streaming;
}

/** How loud the low rumble is: it grows with the pressure behind his lips, and goes at the spit. */
export const rumbleLevel = (t: number): number => pressureAt(t) * 0.6;

const rumbles = new WeakMap<Audio, { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode }>();

/** The rumble of the pressure: low noise, louder and a little brighter as it builds (mock `rumbleGain`). Made on first use. */
export function setRumble(a: Audio, level: number): void {
  let voice = rumbles.get(a);
  if (!voice) {
    if (level <= 0) return;
    const source = a.ctx.createBufferSource(), filter = a.ctx.createBiquadFilter(), gain = a.ctx.createGain();
    source.buffer = a.noise;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 110;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(a.fx);
    source.start();
    voice = { source, filter, gain };
    rumbles.set(a, voice);
  }
  const t = a.ctx.currentTime;
  voice.gain.gain.setTargetAtTime(Math.max(0, level), t, 0.05);
  voice.filter.frequency.setTargetAtTime(110 + (level / 0.6) * 120, t, 0.05);
}

/** The rumble stopped, with the sound. */
export function stopRumble(a: Audio): void {
  const voice = rumbles.get(a);
  if (!voice) return;
  const t = a.ctx.currentTime;
  voice.gain.gain.setTargetAtTime(0, t, 0.1);
  voice.source.stop(t + 0.6);
  rumbles.delete(a);
}
