import type { Audio } from '~/journey/sound/engine';

/**
 * A stand-in for the browser's audio, for the sounds' tests: every node takes any call, and every value an oscillator is
 * started at is written down, so a test can hear what pitch a sound plays.
 */

const METHODS = new Set(['connect', 'disconnect', 'start', 'stop', 'getFloatTimeDomainData', 'setPeriodicWave']);

export interface FakeAudio extends Audio {
  /** The pitches oscillators were set to, in order. */
  pitches: number[];
}

function param(onSet?: (value: number) => void) {
  return {
    value: 0,
    setTargetAtTime: () => {},
    setValueAtTime: (value: number) => onSet?.(value),
    cancelScheduledValues: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  };
}

function node(onFrequency?: (value: number) => void): Record<string, unknown> {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      if (METHODS.has(key)) return () => {};
      return (target[key] = param(key === 'frequency' ? onFrequency : undefined));
    },
  });
}

export function fakeAudio(): FakeAudio {
  const pitches: number[] = [];
  const ctx = new Proxy(
    { currentTime: 0, sampleRate: 8, destination: node(), state: 'running', createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }) } as Record<string | symbol, unknown>,
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'createOscillator') return () => node((value) => pitches.push(value));
        if (typeof key === 'string' && key.startsWith('create')) return () => node();
        return undefined;
      },
    },
  ) as unknown as AudioContext;
  const audio = { ctx, master: node(), bus: node(), fx: node(), analyser: node(), noise: { duration: 3 }, pitches };
  return audio as unknown as FakeAudio;
}
