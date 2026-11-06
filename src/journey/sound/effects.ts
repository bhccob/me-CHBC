import { ramp } from '../math';
import type { Audio } from './engine';
import type { HitName, RunName } from './score';

/** Every sound belongs to something the machine is doing. From the mock's effects; Bob approved them by ear. */

const envelope = (g: GainNode, t: number, attack: number, peak: number, decay: number): void => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
};

function fxNoise(a: Audio, type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, at?: number, sweepTo?: number): void {
  const t = at ?? a.ctx.currentTime, source = a.ctx.createBufferSource(), filter = a.ctx.createBiquadFilter(), g = a.ctx.createGain();
  source.buffer = a.noise;
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
  envelope(g, t, attack, peak, decay);
  source.connect(filter);
  filter.connect(g);
  g.connect(a.fx);
  source.start(t, Math.random() * 2, attack + decay + 0.05);
}

function fxOsc(a: Audio, type: OscillatorType, f0: number, f1: number, peak: number, attack: number, decay: number, at?: number, band?: number): void {
  const t = at ?? a.ctx.currentTime, osc = a.ctx.createOscillator(), g = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  envelope(g, t, attack, peak, decay);
  if (band) {
    const filter = a.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = band;
    filter.Q.value = 0.9;
    osc.connect(filter);
    filter.connect(g);
  } else osc.connect(g);
  g.connect(a.fx);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function clunk(a: Audio, v: number, { pitch = 92, metal = 1, len = 0.22 }: { pitch?: number; metal?: number; len?: number } = {}): void {
  fxOsc(a, 'sine', pitch, pitch * 0.55, 0.42 * v, 0.004, len);
  fxNoise(a, 'bandpass', 620, 0.9, 0.16 * v, 0.002, 0.05);
  fxNoise(a, 'highpass', 2600, 0.5, 0.05 * v * metal, 0.001, 0.03);
  if (metal > 0.05) for (const [freq, decay] of [[417, 0.22], [1127, 0.16], [2311, 0.1]] as const) fxOsc(a, 'sine', freq, freq, 0.024 * v * metal, 0.001, decay);
}

function clack(a: Audio, v: number): void {
  const t = a.ctx.currentTime;
  fxNoise(a, 'bandpass', 3100, 2.5, 0.12 * v, 0.001, 0.018, t);
  fxNoise(a, 'bandpass', 2100, 2.5, 0.09 * v, 0.001, 0.022, t + 0.016);
}

const keyTick = (a: Audio, v: number): void => fxNoise(a, 'bandpass', 2600 + Math.random() * 1400, 2, 0.05 * v, 0.001, 0.02);

function gearTick(a: Audio, v: number): void {
  fxNoise(a, 'bandpass', 1900, 3, 0.07 * v, 0.001, 0.016);
  fxOsc(a, 'sine', 310, 240, 0.02 * v, 0.001, 0.03);
}

function whirr(a: Audio, v: number, f0: number, f1: number, duration: number): void {
  fxOsc(a, 'sawtooth', f0, f1, 0.05 * v, 0.03, duration, undefined, 1000);
  fxOsc(a, 'sine', f0 / 2, f1 / 2, 0.035 * v, 0.03, duration);
}

const hiss = (a: Audio, v: number, duration: number): void => fxNoise(a, 'highpass', 3200, 0.4, 0.06 * v, 0.02, duration);

function zap(a: Audio, v: number): void {
  fxNoise(a, 'bandpass', 5200, 6, 0.05 * v, 0.001, 0.06);
  fxOsc(a, 'square', 1800, 400, 0.012 * v, 0.001, 0.05);
}

function crack(a: Audio, v: number): void {
  fxNoise(a, 'lowpass', 7000, 0.5, 0.22 * v, 0.002, 0.7, undefined, 300);
  fxOsc(a, 'sine', 110, 34, 0.35 * v, 0.004, 0.6);
  for (const [freq, decay] of [[731, 0.5], [1873, 0.4], [3119, 0.3]] as const) fxOsc(a, 'sine', freq, freq * 0.97, 0.04 * v, 0.001, decay);
}

export function snap(a: Audio, v: number): void {
  fxNoise(a, 'highpass', 4200 + Math.random() * 3000, 1, 0.09 * v, 0.001, 0.018 + Math.random() * 0.03);
  const freq = 1700 + Math.random() * 4200;
  fxOsc(a, 'sine', freq, freq * 0.9, 0.012 * v, 0.001, 0.05 + Math.random() * 0.1);
}

const question = (a: Audio, v: number): void => {
  clack(a, 0.8 * v);
  whirr(a, 0.4 * v, 180, 260, 0.35);
  clunk(a, 0.35 * v, { pitch: 130, metal: 0.5 });
};

export const HIT_SOUNDS: Readonly<Record<HitName, (a: Audio, v: number) => void>> = {
  wake: (a, v) => {
    clack(a, 0.6 * v);
    zap(a, 0.5 * v);
  },
  'code-drop': (a, v) => whirr(a, 0.5 * v, 160, 320, 0.7),
  'code-on': (a, v) => zap(a, 0.7 * v),
  'code-land': (a, v) => clunk(a, 0.55 * v, { pitch: 120, metal: 0.6 }),
  'pad-drop': (a, v) => whirr(a, 0.5 * v, 180, 340, 0.8),
  'pad-land': (a, v) => clunk(a, 0.6 * v, { pitch: 150, metal: 0.25 }),
  'pad-a': (a, v) => clack(a, 0.7 * v),
  'pad-b': (a, v) => clack(a, 0.6 * v),
  'armour-move': (a, v) => whirr(a, 0.6 * v, 110, 220, 1),
  'wall-1': (a, v) => clunk(a, 0.75 * v, { pitch: 78 }),
  'lid-move': (a, v) => hiss(a, 0.5 * v, 0.6),
  'wall-2': (a, v) => clunk(a, 0.75 * v, { pitch: 74 }),
  'wall-3': (a, v) => clunk(a, 0.75 * v, { pitch: 78 }),
  'wall-4': (a, v) => clunk(a, 0.75 * v, { pitch: 72 }),
  'lid-seat': (a, v) => clunk(a, 1 * v, { pitch: 62, len: 0.4 }),
  lock: (a, v) => {
    clack(a, 1 * v);
    clunk(a, 0.35 * v, { pitch: 180 });
  },
  'ring-spin': (a, v) => whirr(a, 0.7 * v, 140, 520, 0.7),
  'legs-slide': (a, v) => whirr(a, 0.5 * v, 120, 300, 1.4),
  'ring-seat': (a, v) => clunk(a, 0.7 * v, { pitch: 96 }),
  'drive-1': (a, v) => clack(a, 0.7 * v),
  'drive-2': (a, v) => clack(a, 0.7 * v),
  'drive-3': (a, v) => clack(a, 0.7 * v),
  'legs-seat': (a, v) => clunk(a, 0.55 * v, { pitch: 110 }),
  'stand-up': (a, v) => {
    whirr(a, 1 * v, 90, 360, 1.6);
    hiss(a, 0.5 * v, 1);
  },
  stands: (a, v) => {
    clunk(a, 1.1 * v, { pitch: 52, len: 0.5 });
    hiss(a, 0.7 * v, 0.9);
  },
  'stack-open': (a, v) => {
    hiss(a, 0.7 * v, 0.9);
    whirr(a, 0.5 * v, 200, 120, 0.8);
  },
  'stack-stop': (a, v) => clack(a, 0.6 * v),
  'stack-1': (a, v) => clunk(a, 0.45 * v, { pitch: 100 }),
  'stack-2': (a, v) => clunk(a, 0.45 * v, { pitch: 94 }),
  'stack-3': (a, v) => clunk(a, 0.45 * v, { pitch: 88 }),
  'stack-4': (a, v) => clunk(a, 0.8 * v, { pitch: 70 }),
  'shield-off': (a, v) => {
    hiss(a, 0.8 * v, 0.8);
    whirr(a, 0.6 * v, 300, 110, 0.7);
  },
  'iris-open': (a, v) => clunk(a, 0.9 * v, { pitch: 48, len: 0.6 }),
  break: (a, v) => crack(a, 1 * v),
  'break-end': (a, v) => {
    for (let i = 0; i < 8; i++) {
      const freq = 2300 + Math.random() * 3600;
      fxOsc(a, 'sine', freq, freq * 0.96, 0.012 * v * (1 - i / 9), 0.002, 0.22, a.ctx.currentTime + i * 0.07);
    }
  },
  'qa-word': (a, v) => clunk(a, 0.7 * v, { pitch: 70, len: 0.4 }),
  q1: question,
  q2: question,
  q3: question,
  q4: question,
  q5: question,
  q6: question,
};

/** The small things that follow the scroll. `at` is the frame, less any shift of a longer flight. */
export const RUN_SOUNDS: Readonly<Record<RunName, (a: Audio, v: number, at: number) => void>> = {
  typing: (a, v) => keyTick(a, v),
  'iris-teeth': (a, v) => gearTick(a, 1.3 * v),
  wires: (a, v, at) => snap(a, (0.5 + 0.5 * Math.sin(Math.PI * ramp(at, 630, 690))) * v),
  gears: (a, v) => gearTick(a, 0.62 * v),
};

/** A soft bell, of the few high notes on the end page. */
export function bell(a: Audio, freq: number, velocity: number, { at, duration = 2.6, attack = 0.006 }: { at?: number; duration?: number; attack?: number } = {}): void {
  const t = at ?? a.ctx.currentTime, osc = a.ctx.createOscillator(), g = a.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, velocity), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g);
  g.connect(a.bus);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export function gong(a: Audio, freq: number, velocity: number, duration: number): void {
  const t = a.ctx.currentTime, carrier = a.ctx.createOscillator(), modulator = a.ctx.createOscillator(), depth = a.ctx.createGain(), g = a.ctx.createGain();
  carrier.frequency.value = freq;
  modulator.frequency.value = freq * 1.41;
  depth.gain.setValueAtTime(freq * 2.4, t);
  depth.gain.exponentialRampToValueAtTime(1, t + duration * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(velocity, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  modulator.connect(depth);
  depth.connect(carrier.frequency);
  carrier.connect(g);
  g.connect(a.bus);
  carrier.start(t);
  modulator.start(t);
  carrier.stop(t + duration + 0.1);
  modulator.stop(t + duration + 0.1);
}

export function thump(a: Audio, velocity: number): void {
  const t = a.ctx.currentTime, osc = a.ctx.createOscillator(), g = a.ctx.createGain();
  osc.frequency.setValueAtTime(74, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.16);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(velocity, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(g);
  g.connect(a.bus);
  osc.start(t);
  osc.stop(t + 0.4);
}

export function burst(a: Audio, velocity: number, duration: number): void {
  const t = a.ctx.currentTime, source = a.ctx.createBufferSource(), filter = a.ctx.createBiquadFilter(), g = a.ctx.createGain();
  source.buffer = a.noise;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(5000, t);
  filter.frequency.exponentialRampToValueAtTime(180, t + duration);
  g.gain.setValueAtTime(velocity, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(filter);
  filter.connect(g);
  g.connect(a.bus);
  source.start(t);
  source.stop(t + duration + 0.1);
}

/** The falling tone as everything collapses into one light. */
export function fall(a: Audio): void {
  const t = a.ctx.currentTime, osc = a.ctx.createOscillator(), g = a.ctx.createGain();
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 1.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  osc.connect(g);
  g.connect(a.bus);
  osc.start(t);
  osc.stop(t + 1.3);
}

/** The clack as the sound comes on. */
export const hello = (a: Audio): void => clack(a, 0.5);
