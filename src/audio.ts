/* Sound: everything is synthesised with WebAudio, nothing is downloaded, and it only starts if the visitor asks for it.
   One set, "stone": dry and close, short knocks of stone on stone, almost no tail, no sliding tones.
   The one exception is the moment the lock closes on the last page, which uses the bigger close. */

let AC: AudioContext | null = null;
let master: GainNode, bus: GainNode, whoosh: GainNode, noiseBuf: AudioBuffer;
let soundOn = false;
/* Phones and tablets. Their small speakers cannot play the low thumps this sound is made of, so on them every hit also
   gets a short knock higher up, where a small speaker is strong, and the whole mix is turned up. Still stone on stone:
   no notes, nothing that hisses, nothing that rings. Computers keep the sound exactly as it was. */
const small = typeof window !== "undefined" && window.matchMedia("(pointer:coarse)").matches;
const watchers: ((on: boolean) => void)[] = [];

export const isSoundOn = () => soundOn;
export const onSoundChange = (fn: (on: boolean) => void) => { watchers.push(fn); };

function later(fn: () => void, ms: number) { setTimeout(() => { if (soundOn) try { fn(); } catch { /* sound is never worth an error */ } }, ms); }

/** one burst of filtered noise */
function nz(ftype: BiquadFilterType, f0: number, f1: number, Q: number, vol: number, att: number, dur: number) {
  const ac = AC!, t = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = ftype; f.Q.value = Q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.05);
}
function tone(type: OscillatorType, f0: number, f1: number, vol: number, attack: number, dur: number, cutoff?: number) {
  const ac = AC!, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  let out: AudioNode = g;
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur); g.connect(f); out = f; }
  o.connect(g); out.connect(bus); o.start(t); o.stop(t + dur + 0.1);
}
/** a sliding tone, shaken by a second tone: metallic, unstable, not a note */
function warp(f0: number, f1: number, modF: number, depth: number, vol: number, attack: number, dur: number) {
  const ac = AC!, t = ac.currentTime, car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
  car.frequency.setValueAtTime(f0, t); car.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8); mod.frequency.setValueAtTime(modF, t); mod.frequency.linearRampToValueAtTime(modF * 0.6, t + dur);
  mg.gain.setValueAtTime(depth, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.1), t + dur); mod.connect(mg); mg.connect(car.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  car.connect(g); g.connect(bus); car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
}
/** a narrow band of air that slides through three pitches */
function sweep(vol: number, dur: number, a: number, b: number, c: number) {
  const ac = AC!, t = ac.currentTime, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; bp.type = "bandpass"; bp.Q.value = 11; bp.frequency.setValueAtTime(a, t); bp.frequency.exponentialRampToValueAtTime(b, t + dur * 0.45); bp.frequency.exponentialRampToValueAtTime(c, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.1);
}
/** filtered noise: air and weight, no pitch */
function rumble(vol: number, dur: number, cut: number) {
  const ac = AC!, t = ac.currentTime, src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; lp.type = "lowpass"; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(60, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp); lp.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.1);
}

/** small speakers only: the same hit, where a phone can play it. one short dull knock, gone in a tenth of a second */
function knock(f0: number, f1: number, vol: number, dur: number) {
  if (!small) return;
  nz("bandpass", f0, f1, 1.3, vol, 0.002, dur); tone("triangle", f0 * 0.45, f0 * 0.2, vol * 0.55, 0.002, dur * 1.7);
}

/* ---- the events ---- */

/** the camera reaches a piece */
export function arrive() {
  if (!soundOn) return;
  nz("lowpass", 900, 120, 1, 1.2, 0.003, 0.18); tone("sine", 95, 38, 1.3, 0.003, 0.5); knock(900, 500, 0.9, 0.09);
  later(() => { nz("bandpass", 240, 160, 6, 0.9, 0.002, 0.12); tone("triangle", 130, 60, 0.7, 0.002, 0.2); }, 90);
}
/** a slab knocks into its place in the wall */
export function tock() {
  if (!soundOn) return;
  nz("bandpass", 210, 150, 7, 1.4, 0.002, 0.1); tone("sine", 98, 52, 1.1, 0.002, 0.28); knock(1000, 620, 1.0, 0.07);
}
/** a piece is rammed home into the lock */
export function clack(vol: number) {
  if (!soundOn) return;
  nz("lowpass", 1100, 100, 1, vol, 0.002, 0.22); tone("sine", 105, 34, vol * 1.3, 0.003, 0.8); nz("bandpass", 320, 200, 8, vol * 0.6, 0.002, 0.12); knock(850, 450, vol * 0.95, 0.1);
}
/** the wall is whole. lands the instant it is, no lead-in */
export function seal() {
  if (!soundOn) return;
  tone("sine", 80, 30, 1.5, 0.004, 1.2); nz("lowpass", 700, 90, 1, 1.2, 0.003, 0.25); nz("bandpass", 260, 170, 7, 0.7, 0.002, 0.12); knock(800, 420, 1.0, 0.12);
}
/** something very heavy landing: a sub drop, a body thump, a crack on top and a short dull clank. only used by the finale */
function bigClack(vol: number) {
  const ac = AC!, t = ac.currentTime;
  tone("sine", 110, 27, vol * 1.3, 0.004, 1.9);
  tone("triangle", 180, 55, vol * 0.7, 0.003, 0.5);
  tone("sawtooth", 62, 60, vol * 0.35, 0.01, 1.4, 900);
  warp(96, 28, 137, 340, vol * 0.28, 0.004, 1.3);
  const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; lp.type = "lowpass"; lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(90, t + 0.5);
  g.gain.setValueAtTime(vol * 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); src.connect(lp); lp.connect(g); g.connect(bus); src.start(t); src.stop(t + 0.7);
  [187, 243, 331, 402].forEach((f, i) => { tone("triangle", f, f * 0.93, vol * 0.05, 0.003, 0.35 - i * 0.05); }); // detuned on purpose so it does not read as a note
}
/** the lock closes: the biggest hit, a long falling sub, and a rumble that rolls away. no chord, no bells */
export function finale() {
  if (!soundOn) return;
  bigClack(1.3); knock(760, 380, 1.3, 0.14); tone("sine", 58, 22, 1.4, 0.01, 4.5); tone("sine", 31, 26, 1, 0.4, 6); rumble(0.8, 6, 420); warp(160, 24, 71, 620, 0.45, 0.02, 5.5); sweep(0.7, 5, 3200, 400, 90);
}
/** wind that follows how fast the page is moving. amount 0..0.9 */
export function wind(amount: number) {
  if (soundOn && AC) whoosh.gain.setTargetAtTime(amount * (small ? 1.6 : 1), AC.currentTime, 0.15);
}

export function setSound(on: boolean) {
  soundOn = on && !!AC;
  if (AC) {
    if (on && AC.state === "suspended") void AC.resume();
    master.gain.setTargetAtTime(soundOn ? (small ? 2.2 : 1.45) : 0, AC.currentTime, 0.25); // louder on small speakers; the limiter keeps it clean
  }
  watchers.forEach((fn) => fn(soundOn));
}
export function toggleSound() { try { if (!AC) initSound(); setSound(!soundOn); } catch { /* no sound on this device */ } }

export function initSound() {
  if (AC) return;
  try {
    const C: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    AC = new C();
  } catch { AC = null; return; }
  const ac = AC, sr = ac.sampleRate;
  /* everything runs into one bus, then a long dark hall and a limiter, so hits are big without clipping */
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 10; comp.attack.value = 0.004; comp.release.value = 0.3; comp.connect(ac.destination);
  master = ac.createGain(); master.gain.value = 0; master.connect(comp);
  bus = ac.createGain(); bus.connect(master);
  const hall = ac.createConvolver(), ir = ac.createBuffer(2, Math.floor(sr * 4.2), sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < d.length; i++) { const e = Math.pow(1 - i / d.length, 2.6); lp += ((Math.random() * 2 - 1) - lp) * 0.22; d[i] = lp * e * 2.2; } }
  hall.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.5; bus.connect(hall); hall.connect(wet); wet.connect(master);
  /* what plays all the time goes through its own quiet channel and fades in slowly, so it sits far behind the events */
  const dbus = ac.createGain(); dbus.gain.setValueAtTime(0.0001, ac.currentTime); dbus.gain.linearRampToValueAtTime(0.22, ac.currentTime + 6); dbus.connect(bus);
  noiseBuf = ac.createBuffer(1, sr * 2, sr); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  /* wind that follows scroll speed: low and wide. its pitch drifts up and down by itself */
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(); src.buffer = noiseBuf; src.loop = true; bp.type = "bandpass"; bp.frequency.value = small ? 460 : 300; bp.Q.value = 3.2; // a little higher on small speakers, or the wind is not there at all
  const wl = ac.createOscillator(), wg = ac.createGain(); wl.frequency.value = 0.23; wg.gain.value = 190; wl.connect(wg); wg.connect(bp.frequency); wl.start();
  whoosh = ac.createGain(); whoosh.gain.value = 0; src.connect(bp); bp.connect(whoosh); whoosh.connect(bus); src.start();
  /* the background: only very low air, no tone at all */
  const b = ac.createBufferSource(), l = ac.createBiquadFilter(), g = ac.createGain(); b.buffer = noiseBuf; b.loop = true; l.type = "lowpass"; l.frequency.value = 110; g.gain.value = 0.7; b.connect(l); l.connect(g); g.connect(dbus); b.start();
  /* leaving the tab stops the sound; coming back brings it straight back */
  document.addEventListener("visibilitychange", () => {
    if (!AC) return;
    if (document.hidden) void AC.suspend(); else if (soundOn) void AC.resume();
  });
}
