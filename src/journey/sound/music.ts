import { tabStore } from '~/app/tabStore';
import { dueCues, printCues } from '../head/cues';
import { clamp, ramp } from '../math';
import { type Audio, audioLevel, currentAudio, startAudio } from './engine';
import { hello, HIT_SOUNDS, RUN_SOUNDS } from './effects';
import { playHeadCue, pourTick, pourTickChance, rumbleLevel, setRumble, stopRumble } from './headEffects';
import { dueHits, dueRuns, flightLevel, humLevel, motorLevel, risingSweep, scrollSpeed } from './score';

const WANTED_KEY = 'journey-sound';
/** A step of the head's `t` this large in one frame is a jump: it plays nothing, rather than every cue at once. */
const T_JUMP = 0.05;
/** Scrolled this fast, frames a second, it is a jump too (as the machine's hits read it). */
const JUMP_FRAMES_PER_SECOND = 170;
/** The master level while the sound is on. */
const LEVEL = 0.8;
/**
 * The events a browser counts as a person's own act, which it asks for before sound plays again. A touch counts on its
 * way up (pointerup, touchend), not on its way down, so pointerdown alone never woke a phone.
 */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

/** The switch as he left it in this tab; storage a browser has blocked reads as off and writes nothing. */
function wanted(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    return storage.getItem(WANTED_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  tabStore.setItem(WANTED_KEY, on ? '1' : '0');
}

const pageHidden = (): boolean => typeof document !== 'undefined' && document.hidden;

type NoiseVoice = { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode };

interface Voices {
  humGain: GainNode;
  humFilter: BiquadFilterNode;
  hum: OscillatorNode[];
  motorOsc: OscillatorNode;
  motorGain: GainNode;
  motorFilter: BiquadFilterNode;
  wind: NoiseVoice;
  low: NoiseVoice;
  riser: NoiseVoice;
}

/** The site's sound, frame by frame. There is one, for the page. */
class Music {
  on = false;
  readonly counts: Record<string, number> = {};
  private voices: Voices | null = null;
  private f = 0;
  /** The head's own time, as last heard. */
  private t = 0;
  private speed = 0;
  private sp = 0;
  private startedAt = 0;
  private shift = 0;
  private landed = false;
  /** The scan report's rows, as the page measured them, and which is the title's. */
  private rowTops: readonly number[] = [];
  private titleRow = -1;
  private readonly listeners = new Set<() => void>();
  /** Takes away the listeners that wait for a tap to wake the sound; null while none wait. */
  private unarm: (() => void) | null = null;
  /** The context whose changes of state it follows. */
  private watched: AudioContext | null = null;
  /** The master was brought down for a hidden page, and comes up again with it. */
  private quieted = false;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setShift(shift: number): void {
    this.shift = shift;
  }

  /** The scan report's rows, each top a share of its height, and the title's row: the line ticks as it prints each. */
  setReportRows(rowTops: readonly number[], titleRow: number): void {
    this.rowTops = rowTops;
    this.titleRow = titleRow;
  }

  /** The door: sound on or off, from his click or key. It starts playing once the page has risen. */
  enter(on: boolean): void {
    this.set(on);
  }

  /** The page has risen. */
  land(): void {
    this.landed = true;
    if (this.on) this.startVoices();
  }

  /** The header's switch. */
  toggle(): void {
    this.set(!this.on);
    if (this.on) this.startVoices();
  }

  /** After a reload he had sound on: the next tap, click or key brings it back, as browsers ask. */
  resumeIfWanted(storage: Pick<Storage, 'getItem'> = tabStore): () => void {
    if (!wanted(storage)) return () => {};
    const resume = (): void => {
      stop();
      // set() makes the context or wakes it; if the browser still holds it, set() waits for the next tap itself.
      this.set(true);
      if (this.landed) this.startVoices();
    };
    const stop = (): void => {
      for (const type of GESTURES) removeEventListener(type, resume, true);
    };
    for (const type of GESTURES) addEventListener(type, resume, true);
    return stop;
  }

  /** The home page has gone (another page of the site): its voices stop, and the switch keeps his choice for its return. */
  sleep(): void {
    this.disarm();
    this.stopVoices();
  }

  private set(on: boolean): void {
    const a = on ? startAudio() : currentAudio();
    this.on = on && a !== null;
    if (a) {
      this.follow(a);
      this.quieted = false;
      a.master.gain.cancelScheduledValues(a.ctx.currentTime);
      a.master.gain.setTargetAtTime(this.on ? LEVEL : 0, a.ctx.currentTime, this.on ? 0.2 : 0.06);
      if (this.on && a.ctx.state !== 'running') this.arm();
    }
    if (!this.on) {
      this.disarm();
      this.stopVoices();
    }
    remember(this.on);
    for (const listener of this.listeners) listener();
  }

  /** Follows the context's state: a phone may pause it by itself (a call, another app), and it wakes at the next tap. */
  private follow(a: Audio): void {
    if (this.watched === a.ctx) return;
    this.watched = a.ctx;
    a.ctx.addEventListener?.('statechange', () => {
      if (!this.on) return;
      if (a.ctx.state === 'running') {
        this.disarm();
        this.fadeUp(a);
      } else if (!pageHidden()) this.arm();
    });
  }

  /** Waits for his next tap, click or key to wake the sound, once: a second call while it waits adds nothing. */
  private arm(): void {
    if (this.unarm) return;
    const wake = (): void => {
      const a = currentAudio();
      if (!a || !this.on) {
        this.disarm();
        return;
      }
      void a.ctx.resume().then(() => this.woke(a), () => {});
    };
    for (const type of GESTURES) addEventListener(type, wake, true);
    this.unarm = () => {
      for (const type of GESTURES) removeEventListener(type, wake, true);
      this.unarm = null;
    };
  }

  private disarm(): void {
    this.unarm?.();
  }

  /** After a resume: playing, so the taps need not wait any more, and the master comes back up. */
  private woke(a: Audio): void {
    if (a.ctx.state !== 'running') return;
    this.disarm();
    this.fadeUp(a);
  }

  /** Brings the master down at once, for a page about to be hidden. */
  private quiet(a: Audio): void {
    const gain = a.master.gain, t = a.ctx.currentTime;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(gain.value, t);
    gain.linearRampToValueAtTime(0, t + 0.04);
    this.quieted = true;
  }

  /** Brings the master back up from silence after a hidden page, so that nothing comes back in a burst. */
  private fadeUp(a: Audio): void {
    if (!this.quieted) return;
    this.quieted = false;
    const gain = a.master.gain, t = a.ctx.currentTime;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(0, t);
    gain.setTargetAtTime(this.on ? LEVEL : 0, t, 0.25);
  }

  private noiseVoice(a: Audio, type: BiquadFilterType, freq: number, q: number): NoiseVoice {
    const source = a.ctx.createBufferSource(), filter = a.ctx.createBiquadFilter(), gain = a.ctx.createGain();
    source.buffer = a.noise;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(a.bus);
    source.start();
    return { source, filter, gain };
  }

  private startVoices(): void {
    const a = currentAudio();
    if (!a || this.voices) return;
    const { ctx } = a;
    this.startedAt = ctx.currentTime;
    // The machine's own hum: one steady electrical note, not a chord.
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    humGain.connect(a.fx);
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 340;
    humFilter.connect(humGain);
    const hum = ([[55, 'sine', 0.26], [110, 'sawtooth', 0.09], [165, 'triangle', 0.06]] as const).map(([freq, type, level]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = level;
      osc.connect(g);
      g.connect(humFilter);
      osc.start();
      return osc;
    });
    // The motor that runs while parts are moving.
    const motorOsc = ctx.createOscillator(), motorGain = ctx.createGain(), motorFilter = ctx.createBiquadFilter();
    motorOsc.type = 'sawtooth';
    motorOsc.frequency.value = 120;
    motorFilter.type = 'bandpass';
    motorFilter.frequency.value = 900;
    motorFilter.Q.value = 0.8;
    motorGain.gain.value = 0;
    motorOsc.connect(motorFilter);
    motorFilter.connect(motorGain);
    motorGain.connect(a.fx);
    motorOsc.start();
    this.voices = {
      humGain,
      humFilter,
      hum,
      motorOsc,
      motorGain,
      motorFilter,
      wind: this.noiseVoice(a, 'bandpass', 500, 0.5),
      low: this.noiseVoice(a, 'lowpass', 170, 0.3),
      riser: this.noiseVoice(a, 'bandpass', 300, 1.6),
    };
    hello(a);
  }

  private stopVoices(): void {
    const a = currentAudio();
    if (!a || !this.voices) return;
    const t = a.ctx.currentTime, v = this.voices;
    stopRumble(a);
    v.humGain.gain.setTargetAtTime(0, t, 0.25);
    v.motorGain.gain.setTargetAtTime(0, t, 0.1);
    for (const noise of [v.wind, v.low, v.riser]) {
      noise.gain.gain.setTargetAtTime(0, t, 0.2);
      noise.source.stop(t + 1.6);
    }
    for (const osc of v.hum) osc.stop(t + 1.6);
    v.motorOsc.stop(t + 1);
    this.voices = null;
  }

  /**
   * The sound at frame `f`, `dt` seconds on, with the head at its own time `t`: the machine's and the flight's by the scroll,
   * the head's by `t`, so the ending's sounds keep in step with its picture.
   */
  frame(f: number, dt: number, t = 0): void {
    const prev = this.f, prevT = this.t;
    this.f = f;
    this.t = t;
    this.speed += (Math.abs(f - prev) / Math.max(0.004, dt) - this.speed) * 0.08;
    const a = currentAudio();
    const v = this.voices;
    if (!a || !v) return;
    const now = a.ctx.currentTime, fadeIn = ramp(now - this.startedAt, 0, 1.8), shift = this.shift;
    this.sp = scrollSpeed(this.speed);
    const flight = flightLevel(f, shift);
    v.humGain.gain.setTargetAtTime(humLevel(f) * 0.34 * fadeIn, now, 0.2);
    v.humFilter.frequency.setTargetAtTime(f > 500 ? 720 : 300 + 160 * ramp(f, 26, 276), now, 0.3);
    v.wind.gain.gain.setTargetAtTime(flight * (0.025 + 0.085 * this.sp), now, 0.12);
    v.wind.filter.frequency.setTargetAtTime(320 + 2800 * this.sp, now, 0.12);
    v.low.gain.gain.setTargetAtTime(flight * (0.05 + 0.1 * this.sp), now, 0.14);
    v.riser.gain.gain.setTargetAtTime(risingSweep(f), now, 0.1);
    v.riser.filter.frequency.setTargetAtTime(280 + ramp(f, 322, 362) * 3600, now, 0.1);
    v.motorGain.gain.setTargetAtTime(motorLevel(f) * this.sp * 0.03, now, 0.07);
    v.motorOsc.frequency.setTargetAtTime(90 + 300 * this.sp + f * 0.16, now, 0.08);
    v.motorFilter.frequency.setTargetAtTime(600 + 1000 * this.sp, now, 0.1);
    for (const hit of dueHits(prev, f, this.speed, shift)) {
      this.counts[hit.name] = (this.counts[hit.name] ?? 0) + 1;
      HIT_SOUNDS[hit.name](a, hit.level);
    }
    for (const run of dueRuns(prev, f, this.speed, shift)) {
      this.counts[run.name] = (this.counts[run.name] ?? 0) + 1;
      RUN_SOUNDS[run.name](a, run.level, run.at);
    }
    // His head: its cues as `t` passes them, soft ticks while things pour in, the rumble of the pressure, the report's lines.
    setRumble(a, rumbleLevel(t));
    const jumped = Math.abs(t - prevT) > T_JUMP || this.speed >= JUMP_FRAMES_PER_SECOND;
    for (const { cue, n } of dueCues(prevT, t, jumped)) this.play(a, cue, n);
    if (!jumped) for (const { cue, n } of printCues(prevT, t, this.rowTops, this.titleRow)) this.play(a, cue, n);
    if (Math.random() < pourTickChance(t, dt)) {
      pourTick(a);
      this.counts.pour = (this.counts.pour ?? 0) + 1;
    }
  }

  private play(a: Audio, cue: Parameters<typeof playHeadCue>[1], n: number): void {
    this.counts[cue] = (this.counts[cue] ?? 0) + 1;
    playHeadCue(a, cue, n);
  }

  /**
   * A tab nobody is looking at keeps quiet, and comes back as it was, with nothing saved up: at once where the browser
   * allows it, else at his next tap, click or key. The switch says what it said before.
   */
  watchVisibility(hidden: boolean): void {
    const a = currentAudio();
    if (!a) return;
    if (hidden) {
      this.disarm();
      this.quiet(a);
      void a.ctx.suspend().catch(() => {});
      return;
    }
    if (!this.on) return;
    if (a.ctx.state === 'running') {
      this.fadeUp(a);
      return;
    }
    this.arm();
    void a.ctx.resume().then(() => this.woke(a), () => {});
  }

  /** What the proof harness reads. */
  report(): { on: boolean; running: boolean; context: string; level: number; counts: Record<string, number>; landed: boolean } {
    return { on: this.on, running: this.voices !== null, context: currentAudio()?.ctx.state ?? 'none', level: clamp(audioLevel()), counts: { ...this.counts }, landed: this.landed };
  }
}

export const Sound = new Music();
