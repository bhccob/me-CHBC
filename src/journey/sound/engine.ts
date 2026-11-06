/**
 * The site's sound, made in code in the browser, with no audio files. A context starts only on a click or a key, as browsers
 * ask. Everything goes through one master gain, so that the switch silences it at once. From the mock's `audioInit`.
 */

export interface Audio {
  ctx: AudioContext;
  master: GainNode;
  /** With a long reverb: the rush, the pad, the gong. */
  bus: GainNode;
  /** Nearly dry, so that a clunk stays a clunk. */
  fx: GainNode;
  analyser: AnalyserNode;
  noise: AudioBuffer;
}

let audio: Audio | null = null;

export const currentAudio = (): Audio | null => audio;

/** The audio, made on the first call; call it from a click or a key. Null where the browser has none. */
export function startAudio(): Audio | null {
  if (audio) {
    if (audio.ctx.state === 'suspended') void audio.ctx.resume();
    return audio;
  }
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  const master = ctx.createGain();
  master.gain.value = 0;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.2;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  master.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(ctx.destination);

  const length = Math.round(ctx.sampleRate * 3.4), impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  reverb.connect(wet);
  wet.connect(master);

  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(reverb);
  const fx = ctx.createGain(), send = ctx.createGain();
  send.gain.value = 0.22;
  fx.connect(master);
  fx.connect(send);
  send.connect(reverb);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  audio = { ctx, master, bus, fx, analyser, noise };
  return audio;
}

/** How loud it is right now, 0 to 1. */
export function audioLevel(): number {
  if (!audio) return 0;
  const samples = new Float32Array(audio.analyser.fftSize);
  audio.analyser.getFloatTimeDomainData(samples);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}
