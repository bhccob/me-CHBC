import { tabStore } from '~/app/tabStore';
import { clamp, ramp, seeded } from '../math';
import { type Audio, audioLevel, currentAudio, startAudio } from './engine';
import { bell, burst, fall, gong, hello, HIT_SOUNDS, RUN_SOUNDS, snap, thump } from './effects';
import { dueEnding, dueHits, dueRuns, flightLevel, holdSounds, humLevel, motorLevel, padLevel, risingSweep, scrollSpeed } from './score';

/** The chords under the end page: D minor, B flat, F, C, in MIDI notes; and the few high notes over them. */
const CHORDS = [[38, 50, 53, 57], [34, 50, 53, 58], [41, 48, 53, 57], [36, 48, 52, 55]] as const;
const HIGH_NOTES = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84] as const;
const EIGHTH = 60 / 66 / 2;
const WANTED_KEY = 'journey-sound';
/** The master level while the sound is on. */
const LEVEL = 0.8;
/**
 * The events a browser counts as a person's own act, which it asks for before sound plays again. A touch counts on its
 * way up (pointerup, touchend), not on its way down, so pointerdown alone never woke a phone.
 */
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
const midi = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

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
  padGain: GainNode;
  pad: { osc: OscillatorNode }[];
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
  private timer = 0;
  private nextNote = 0;
  private note = 0;
  private f = 0;
  private speed = 0;
  private sp = 0;
  private breakNow = 0;
  private endLevel = 0;
  private startedAt = 0;
  private shift = 0;
  private landed = false;
  private holding = false;
  private readonly random = seeded(424242);
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
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(a.bus);
    const pad = ([[38, 0.085, 'sine', 0], [50, 0.04, 'triangle', 520], [53, 0.036, 'triangle', 520], [57, 0.032, 'triangle', 520]] as const).map(([note, level, type, cut]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = midi(note);
      g.gain.value = level;
      if (cut) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cut;
        osc.connect(filter);
        filter.connect(g);
      } else osc.connect(g);
      g.connect(padGain);
      osc.start();
      return { osc };
    });
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
      padGain,
      pad,
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
    this.nextNote = ctx.currentTime + 0.1;
    this.note = 0;
    this.timer = window.setInterval(() => this.pump(a), 60);
    hello(a);
  }

  private stopVoices(): void {
    const a = currentAudio();
    if (!a || !this.voices) return;
    clearInterval(this.timer);
    const t = a.ctx.currentTime, v = this.voices;
    v.padGain.gain.setTargetAtTime(0, t, 0.35);
    v.humGain.gain.setTargetAtTime(0, t, 0.25);
    v.motorGain.gain.setTargetAtTime(0, t, 0.1);
    for (const noise of [v.wind, v.low, v.riser]) {
      noise.gain.gain.setTargetAtTime(0, t, 0.2);
      noise.source.stop(t + 1.6);
    }
    for (const { osc } of v.pad) osc.stop(t + 2.2);
    for (const osc of v.hum) osc.stop(t + 1.6);
    v.motorOsc.stop(t + 1);
    this.voices = null;
  }

  private pump(a: Audio): void {
    if (!this.voices) return;
    // A timer held back (a background tab runs it once a second) plays the notes from now, not every one it missed.
    if (this.nextNote < a.ctx.currentTime) this.nextNote = a.ctx.currentTime + 0.05;
    while (this.nextNote < a.ctx.currentTime + 0.18) {
      const step = this.note, t = this.nextNote;
      if (step % 16 === 0) {
        const chord = CHORDS[Math.floor(step / 16) % 4];
        this.voices.pad.forEach(({ osc }, i) => osc.frequency.setTargetAtTime(midi(chord[i]), t, 0.5));
      }
      if (this.endLevel > 0.03 && step % 12 === 0 && this.random() > 0.5) bell(a, midi(HIGH_NOTES[Math.floor(this.random() * HIGH_NOTES.length)] + 12), 0.024 * this.endLevel, { at: t, duration: 5, attack: 0.04 });
      this.nextNote += EIGHTH;
      this.note++;
    }
    // Between the wires' snaps, the sparks keep crackling by themselves.
    if (this.breakNow > 0.02 && this.random() < this.breakNow * (0.22 + 0.5 * this.sp)) snap(a, 0.3 + 0.35 * this.random());
  }

  /** The sound at frame `f`, `dt` seconds on. */
  frame(f: number, dt: number): void {
    const prev = this.f;
    this.f = f;
    this.speed += (Math.abs(f - prev) / Math.max(0.004, dt) - this.speed) * 0.08;
    const a = currentAudio();
    const v = this.voices;
    if (!a || !v) return;
    const t = a.ctx.currentTime, fadeIn = ramp(t - this.startedAt, 0, 1.8), shift = this.shift;
    this.sp = scrollSpeed(this.speed);
    this.endLevel = ramp(f, 905 + shift, 926 + shift);
    const flight = flightLevel(f, shift);
    v.padGain.gain.setTargetAtTime(padLevel(f, shift), t, 0.25);
    v.humGain.gain.setTargetAtTime(humLevel(f, shift) * 0.34 * fadeIn, t, 0.2);
    v.humFilter.frequency.setTargetAtTime(f > 500 ? 720 : 300 + 160 * ramp(f, 26, 276), t, 0.3);
    v.wind.gain.gain.setTargetAtTime(flight * (0.025 + 0.085 * this.sp), t, 0.12);
    v.wind.filter.frequency.setTargetAtTime(320 + 2800 * this.sp, t, 0.12);
    v.low.gain.gain.setTargetAtTime(flight * (0.05 + 0.1 * this.sp), t, 0.14);
    v.riser.gain.gain.setTargetAtTime(risingSweep(f), t, 0.1);
    v.riser.filter.frequency.setTargetAtTime(280 + ramp(f, 322, 362) * 3600, t, 0.1);
    v.motorGain.gain.setTargetAtTime(motorLevel(f) * this.sp * 0.03, t, 0.07);
    v.motorOsc.frequency.setTargetAtTime(90 + 300 * this.sp + f * 0.16, t, 0.08);
    v.motorFilter.frequency.setTargetAtTime(600 + 1000 * this.sp, t, 0.1);
    this.breakNow = ramp(f, 630 + shift, 640 + shift) * (1 - ramp(f, 680 + shift, 692 + shift));
    for (const hit of dueHits(prev, f, this.speed, shift)) {
      this.counts[hit.name] = (this.counts[hit.name] ?? 0) + 1;
      HIT_SOUNDS[hit.name](a, hit.level);
    }
    for (const run of dueRuns(prev, f, this.speed, shift)) {
      this.counts[run.name] = (this.counts[run.name] ?? 0) + 1;
      RUN_SOUNDS[run.name](a, run.level, run.at - (run.name === 'wires' ? shift : 0));
    }
    for (const name of dueEnding(prev, f, shift)) {
      this.counts[name] = (this.counts[name] ?? 0) + 1;
      if (name === 'fall') fall(a);
      else {
        gong(a, 55, 0.26, 7);
        burst(a, 0.1, 2.6);
        thump(a, 0.3);
      }
    }
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

  /** Holding on the end page is quiet; letting go makes the soft whoosh, and nothing else. */
  hold(on: boolean): void {
    const sounds = holdSounds(on, this.holding);
    this.holding = on;
    const a = currentAudio();
    if (!a || !this.voices) return;
    for (const sound of sounds) {
      burst(a, sound.level, sound.seconds);
      this.counts[sound.name] = (this.counts[sound.name] ?? 0) + 1;
    }
  }

  /** What the proof harness reads. */
  report(): { on: boolean; running: boolean; context: string; level: number; counts: Record<string, number>; landed: boolean } {
    return { on: this.on, running: this.voices !== null, context: currentAudio()?.ctx.state ?? 'none', level: clamp(audioLevel()), counts: { ...this.counts }, landed: this.landed };
  }
}

export const Sound = new Music();
