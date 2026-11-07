import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Leaving the tab (or the phone's browser) and coming back: the sound must come back with the page, not stay paused under a
 * switch that still says "Sound on". A fake AudioContext stands in for the browser's.
 */

type Listener = (event?: unknown) => void;

const param = () => ({
  value: 0,
  setTargetAtTime: vi.fn(),
  setValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});

const METHODS = new Set(['connect', 'disconnect', 'start', 'stop', 'getFloatTimeDomainData', 'setPeriodicWave']);

function node(): Record<string, unknown> {
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      if (METHODS.has(key)) return () => {};
      return (target[key] = param());
    },
  });
}

class FakeContext {
  static made: FakeContext[] = [];
  state: 'running' | 'suspended' | 'interrupted' = 'running';
  currentTime = 0;
  sampleRate = 8;
  destination = node();
  /** A browser that wants a fresh tap before it plays again leaves the context suspended on a plain resume(). */
  needsGesture = false;
  gesture = false;
  resumes = 0;
  private readonly listeners = new Set<Listener>();

  constructor() {
    FakeContext.made.push(this);
    return new Proxy(this, {
      get(target, key) {
        if (key in target) return (target as unknown as Record<string | symbol, unknown>)[key];
        if (typeof key === 'string' && key.startsWith('create')) return () => node();
        return undefined;
      },
    });
  }

  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }

  addEventListener(_type: string, listener: Listener) {
    this.listeners.add(listener);
  }

  private to(state: FakeContext['state']) {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  async suspend() {
    this.to('suspended');
  }

  async resume() {
    this.resumes++;
    if (this.needsGesture && !this.gesture) return;
    this.to('running');
  }
}

/** The window's own listeners, so the test can count them and fire a tap. */
const windowListeners = new Map<string, Set<Listener>>();
const fire = (type: string) => {
  for (const listener of [...(windowListeners.get(type) ?? [])]) listener({ type });
};
const listenerCount = () => [...windowListeners.values()].reduce((sum, set) => sum + set.size, 0);

async function freshSound() {
  vi.resetModules();
  const { Sound } = await import('~/journey/sound/music');
  return Sound;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  FakeContext.made = [];
  windowListeners.clear();
  const store = new Map<string, string>();
  vi.stubGlobal('window', { AudioContext: FakeContext, setInterval: () => 1, clearInterval: () => {}, setTimeout, clearTimeout });
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
  vi.stubGlobal('document', { hidden: false, visibilityState: 'visible' });
  vi.stubGlobal('addEventListener', (type: string, listener: Listener) => {
    if (!windowListeners.has(type)) windowListeners.set(type, new Set());
    windowListeners.get(type)!.add(listener);
  });
  vi.stubGlobal('removeEventListener', (type: string, listener: Listener) => {
    windowListeners.get(type)?.delete(listener);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const hide = (Sound: Awaited<ReturnType<typeof freshSound>>) => {
  (document as { hidden: boolean }).hidden = true;
  Sound.watchVisibility(true);
};
const show = (Sound: Awaited<ReturnType<typeof freshSound>>) => {
  (document as { hidden: boolean }).hidden = false;
  Sound.watchVisibility(false);
};

describe('the sound after leaving the page and coming back', () => {
  it('sleeps while the page is hidden', async () => {
    const Sound = await freshSound();
    Sound.enter(true);
    Sound.land();
    hide(Sound);
    await flush();
    expect(FakeContext.made[0].state).toBe('suspended');
    expect(Sound.on).toBe(true);
  });

  it('plays again as soon as the page is back, where the browser allows it', async () => {
    const Sound = await freshSound();
    Sound.enter(true);
    Sound.land();
    hide(Sound);
    await flush();
    show(Sound);
    await flush();
    expect(FakeContext.made[0].state).toBe('running');
  });

  it('plays again at the next tap where the browser asks for one, though the switch was on all along', async () => {
    const Sound = await freshSound();
    Sound.enter(true);
    Sound.land();
    const ctx = FakeContext.made[0];
    hide(Sound);
    await flush();
    ctx.needsGesture = true;
    show(Sound);
    await flush();
    expect(ctx.state).toBe('suspended');
    ctx.gesture = true;
    fire('touchend');
    await flush();
    expect(ctx.state).toBe('running');
  });

  it('stays quiet on coming back when the sound was off', async () => {
    const Sound = await freshSound();
    Sound.enter(true);
    Sound.land();
    Sound.toggle();
    const ctx = FakeContext.made[0];
    const before = ctx.resumes;
    hide(Sound);
    await flush();
    show(Sound);
    await flush();
    expect(ctx.resumes).toBe(before);
    expect(ctx.state).toBe('suspended');
  });

  it('does not pile up listeners over many visits away', async () => {
    const Sound = await freshSound();
    Sound.enter(true);
    Sound.land();
    const ctx = FakeContext.made[0];
    ctx.needsGesture = true;
    for (let i = 0; i < 6; i++) {
      hide(Sound);
      await flush();
      show(Sound);
      await flush();
    }
    const armed = listenerCount();
    expect(armed).toBeLessThanOrEqual(5);
    ctx.gesture = true;
    fire('pointerup');
    await flush();
    expect(ctx.state).toBe('running');
    expect(listenerCount()).toBe(0);
  });

  it('stops its voices when the home page goes, and keeps the switch for its return', async () => {
    const Sound = await freshSound();
    Sound.enter(true);
    Sound.land();
    expect(Sound.report().running).toBe(true);
    Sound.sleep();
    expect(Sound.report().running).toBe(false);
    expect(Sound.on).toBe(true);
    Sound.land();
    expect(Sound.report().running).toBe(true);
  });
});
