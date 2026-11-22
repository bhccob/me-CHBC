/* Sound: everything is synthesised with WebAudio, nothing is downloaded, and it only starts if the visitor asks for it.
   Visitors hear one set, deep (DEFAULT_SOUND in content.ts): big low hits that roll away in a dark hall, heavy landings
   as the wall assembles, the lock on the end page as deep always sounded, and a rush of air while the camera travels. The other
   sets (SOUNDS in content.ts) are kept for the sound lab (sounds.html, dev server only), to try and tune by ear.
   Every set keeps to the same rules: hits land the instant something happens, no notes, no chords, no bells, nothing
   that hisses, nothing that drones. Two kinds:
   - knock sets only sound when something lands. They differ in what the pieces seem to be made of and the room:
     stone (dry knocks, almost no tail: the original set), wood (hollow hardwood with a little rattle), iron (latch
     clicks and dull clunks with a warped metal edge), felt (soft padded thumps, the quietest) and deep;
   - slide sets take one of those and add friction wherever a piece is dragged: the about-me piece turning, the slabs
     gliding into the wall, the pieces rammed into the lock and pulled apart, and scrolling itself, which drags instead
     of blowing. A slide is noise in a low band, shaken by a stick-slip judder that slows as it comes to rest. It always
     starts with the movement, never before a hit. deepslide (deep, with a heavy slab), drawer (wood), grind (stone)
     and rail (iron).
   Travel, the sound while the camera moves between the pieces, is chosen apart from the hits (TRAVELS in content.ts):
   wind, drag, rush, thrum, track, pass-by or silence. With none chosen, a set uses its own (rush for deep, drag for the
   slide sets, wind for the rest). All of them follow how fast the page moves, and are silent when it is still. */
import { TRAVELS, DEFAULT_SOUND, type SoundId, type TravelId } from "./content";

let AC: AudioContext | null = null;
let master: GainNode, bus: GainNode, whoosh: GainNode, wet: GainNode, windBand: BiquadFilterNode, noiseBuf: AudioBuffer;
/* the travel sounds that run all the time at no strength, and are opened by speed: drag, rush (with a sub under it, and
   the quiet bed of pass-by), thrum */
let scrape: GainNode, scrapeBand: BiquadFilterNode, scrapeLp: BiquadFilterNode, scrapeLfo: OscillatorNode, scrapeAm: GainNode, scrapeDepth: GainNode;
let rush: GainNode, rushLp: BiquadFilterNode, sub: GainNode, thrum: GainNode, thrumLfo: OscillatorNode;
/* the mix has two levels. everything goes through the limiter, which makes it even, and then sits at MIX: below the
   top. the landings (deep's wall and lock) have the top to themselves: they go round the limiter on their own paths,
   so they are the loudest thing on the site and the limiter cannot flatten them.
   travelBus: every travel sound goes through it, so it can step aside for a landing.
   mixOut: the limited mix, at MIX, pulled further back for a moment as each landing hits (makeRoom).
   impactIn: a landing's weight. it is driven through a warm saturation, which adds overtones of the low end at 120 to
   300 Hz, where laptop and phone speakers can play them: the depth is heard there too, not only felt on headphones.
   dry: a landing's knock and edge, clean and close.
   dest: where nz() and tone() send: the bus (through the hall), unless heavy() or dryly() says otherwise */
let travelBus: GainNode, mixOut: GainNode, impactIn: GainNode, impactOut: GainNode, dry: GainNode, dryOut: GainNode, dest: AudioNode;
/** the limited mix, below the top. 0.4 is 8 dB under the landings' room (0.5 was 6), so the wall and the lock clash
    stand out further from everything else */
const MIX = 0.4;
/** how loud a landing's weight and its knock are, after the limiter (it no longer sets their level) */
const IMPACT = 1.05, DRY = 2.3;
/** how hard a landing's weight is driven into the saturation: more drive, more overtones a small speaker can play */
const DRIVE = 2.4;
/** how fast the page is moving now, 0..0.9, as the stage last said */
let speedNow = 0;
let soundOn = false;
/* Phones and tablets. Their small speakers cannot play the low thumps this sound is made of, so on them every hit also
   gets a short knock higher up, where a small speaker is strong, the slides sit higher, and the whole mix is turned up.
   Computers keep the sound exactly as it was. */
const small = typeof window !== "undefined" && window.matchMedia("(pointer:coarse)").matches;
const watchers: ((on: boolean) => void)[] = [];

export const isSoundOn = () => soundOn;
export const onSoundChange = (fn: (on: boolean) => void) => { watchers.push(fn); };

function later(fn: () => void, ms: number) { setTimeout(() => { if (soundOn) try { fn(); } catch { /* sound is never worth an error */ } }, ms); }
/** a little different every time, so a run of the same hit never becomes a tune */
const vary = (f: number, by = 0.06) => f * (1 + (Math.random() * 2 - 1) * by);

/** one burst of filtered noise */
function nz(ftype: BiquadFilterType, f0: number, f1: number, Q: number, vol: number, att: number, dur: number) {
  const ac = AC!, t = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = ftype; f.Q.value = Q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + dur + 0.05);
}
function tone(type: OscillatorType, f0: number, f1: number, vol: number, attack: number, dur: number, cutoff?: number) {
  const ac = AC!, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  let out: AudioNode = g;
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur); g.connect(f); out = f; }
  o.connect(g); out.connect(dest); o.start(t); o.stop(t + dur + 0.1);
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
/** low air that swells and settles, under the way in: the six pieces coming in out of the fog. low, so it never hisses */
function gust(vol: number, dur: number, top: number) {
  const ac = AC!, t = ac.currentTime, src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; lp.type = "lowpass"; lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(140, t); lp.frequency.exponentialRampToValueAtTime(top, t + dur * 0.35); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp); lp.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.1);
}
/** deep, the way in: no blocks, only the flight in out of deep space while the camera settles and the six pieces come
    in out of the fog (about two seconds). two streams of low air, a little different, one on each side, so it is wide;
    they swell and open up, then settle as the first view arrives. a low swell of weight under them, rising a little as
    it approaches. all air and sub: it never hisses, never knocks and never plays a note.
    FLY: how long it lasts, how far the air opens (Hz), how loud the air and the weight are */
const FLY = { dur: 2.6, open: 1200, air: 1.6, sub: 0.7 };
function flyIn() {
  const ac = AC!, t = ac.currentTime, dur = FLY.dur, peak = t + dur * 0.4;
  [-1, 1].forEach((side, i) => {
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; lp.type = "lowpass"; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(110, t); lp.frequency.exponentialRampToValueAtTime(FLY.open * (i ? 1.08 : 0.93) * (small ? 1.4 : 1), peak); lp.frequency.exponentialRampToValueAtTime(140, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(FLY.air, peak); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.setValueAtTime(side * 0.75, t); p.pan.linearRampToValueAtTime(side * 0.3, t + dur); g.connect(p); p.connect(bus); } else g.connect(bus);
    src.start(t, Math.random() * 1.2 + i * 0.37); src.stop(t + dur + 0.1);
  });
  const o = ac.createOscillator(), og = ac.createGain();
  o.frequency.setValueAtTime(34, t); o.frequency.linearRampToValueAtTime(44, peak); o.frequency.linearRampToValueAtTime(40, t + dur);
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(FLY.sub, peak); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(og); og.connect(bus); o.start(t); o.stop(t + dur + 0.1);
}

/** what a slide set drags with: the band its friction sits in (start, end), how wide, the judder (start, end, in Hz:
    how often it catches and lets go, slowing as it stops), how deep that judder is, a ceiling that keeps it from
    hissing, a low band for weight (0: none), and its overall level */
interface Grit { f0: number; f1: number; q: number; j0: number; j1: number; depth: number; lp: number; body: number; vol: number }
/** a slide: something heavy dragged over something hard, for `dur` seconds. it starts at full grip with the movement
    (no swell before it) and the judder slows as it comes to rest */
function friction(g: Grit, dur: number, vol: number) {
  const ac = AC!, t = ac.currentTime, up = small ? 1.6 : 1, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), am = ac.createGain(), lfo = ac.createOscillator(), dg = ac.createGain(), lp = ac.createBiquadFilter(), env = ac.createGain();
  src.buffer = noiseBuf; src.loop = true;
  bp.type = "bandpass"; bp.Q.value = g.q; bp.frequency.setValueAtTime(vary(g.f0) * up, t); bp.frequency.exponentialRampToValueAtTime(g.f1 * up, t + dur);
  lfo.type = "sawtooth"; lfo.frequency.setValueAtTime(vary(g.j0, 0.1), t); lfo.frequency.exponentialRampToValueAtTime(g.j1, t + dur); // stick, slip, stick
  am.gain.value = 1 - g.depth / 2; dg.gain.value = g.depth / 2; lfo.connect(dg); dg.connect(am.gain);
  lp.type = "lowpass"; lp.frequency.value = g.lp * up;
  env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(vol, t + 0.012); env.gain.setValueAtTime(vol, t + dur * 0.5); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(am); am.connect(lp); lp.connect(env); env.connect(bus);
  src.start(t, Math.random() * 1.5); lfo.start(t); src.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  if (g.body && !small) { // the weight of it, under the grain
    const b = ac.createBufferSource(), bl = ac.createBiquadFilter(), bg = ac.createGain();
    b.buffer = noiseBuf; b.loop = true; bl.type = "lowpass"; bl.frequency.value = g.body;
    bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(vol * 0.9, t + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.1);
    b.connect(bl); bl.connect(bg); bg.connect(bus); b.start(t, Math.random() * 1.5); b.stop(t + dur * 1.1 + 0.05);
  }
}

/** small speakers only: the same hit, where a phone can play it. one short dull knock, gone in a tenth of a second */
function knock(f0: number, f1: number, vol: number, dur: number) {
  if (!small) return;
  nz("bandpass", f0, f1, 1.3, vol, 0.002, dur); tone("triangle", f0 * 0.45, f0 * 0.2, vol * 0.55, 0.002, dur * 1.7);
}

/* ---- the pieces of each set ---- */

/** wood: a hard knock with a hollow box under it. both are noise, so it has a colour but never a note */
function woodHit(f: number, vol: number) {
  f = vary(f);
  nz("bandpass", f, f * 0.7, 3.4, vol, 0.0015, 0.075);
  nz("bandpass", f * 0.33, f * 0.28, 9, vol * 0.75, 0.002, 0.13);
  tone("sine", f * 0.13, f * 0.06, vol * 0.7, 0.002, 0.16);
}
/** iron: the latch, a bright tick that lands with the hit, never before it */
function latch(vol: number) { nz("bandpass", vary(2600), 1500, 2.2, vol, 0.001, 0.035); }
/** iron: a dull clank, a few detuned partials gone in a tenth of a second, so it reads as metal and not as a bell */
function clank(vol: number) { [vary(397), vary(541), vary(689), vary(853)].forEach((f, i) => tone("triangle", f, f * 0.9, vol * (0.07 - i * 0.012), 0.002, 0.13 - i * 0.02, 1400)); }
/** felt: a padded thump, soft at the front, no click */
function softHit(vol: number) {
  tone("sine", vary(72, 0.04), 38, vol, 0.008, 0.36);
  nz("lowpass", 340, 80, 0.8, vol * 0.55, 0.006, 0.17);
}
/** whatever fn plays skips the hall: heard close, its edge not blurred by the room */
function dryly(fn: () => void) { const was = dest; dest = dry; try { fn(); } finally { dest = was; } }
/** the travel sound steps aside for a hit: down to `to` at once, back over a moment after `hold` seconds */
function duck(to: number, hold: number) {
  const t = AC!.currentTime, g = travelBus.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(to, t, 0.015); g.setTargetAtTime(1, t + hold, 0.3);
}
/** whatever fn plays is a landing's weight: round the limiter, through the warm saturation */
function heavy(fn: () => void) { const was = dest; dest = impactIn; try { fn(); } finally { dest = was; } }
/** the rest of the mix steps back for a landing: down to `to` of its level at once, back over a moment after `hold` */
function makeRoom(to: number, hold: number) {
  const t = AC!.currentTime, g = mixOut.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(MIX * to, t, 0.01); g.setTargetAtTime(MIX, t + hold, 0.35);
}
/** the end page: the lock is deep's first sound, heard as it always was. the mix sits at half its old level since it was
    split (MIX), so for as long as a lock sound rolls away (`until` seconds) it goes back to its old level, then settles.
    with `after`, it waits that long first, so a landing on top of it has the room (the wall's landing, at the lock) */
function asBefore(until: number, after = 0) {
  const t = AC!.currentTime, g = mixOut.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(1, t + after, after ? 0.04 : 0.004); g.setTargetAtTime(MIX, t + until, 0.8);
}
/** deep: a heavy piece landing in the wall (and the way in). the loudest thing on the site, strong and deep and still clear:
    - its weight, round the limiter and driven warm: a long low drop from 64 Hz, a kick that falls from 170 Hz and
      holds above 80, a body under it, and the broad thud of mass meeting mass. the saturation gives the drop overtones
      a laptop can play, so it sounds deep there too;
    - its knock, clean: a stone knock in the low middle, and a hint of crack to place it;
    - the dark hall it rolls away in (the boom, quieter);
    - and the rest of the mix steps back for it, the travel rush most of all.
    falling tones and noise, so never a note */
const LAND = { drop: 0.75, kick: 0.6, body: 0.4, mass: 1, knock: 2.4, crack: 0.3, hall: 0.55 };
/** how hard each moment lands, and how long its drop is: a slab into the wall, the wall whole */
const LAND_AT = { wall: [1.2, 1.4], whole: [1.35, 2.4] } as const;
/** a landing. `room`: how far the rest of the mix steps back for it (0: leave the mix as it is) */
function land(vol: number, len: number, room = 0.4) {
  heavy(() => {
    tone("sine", vary(64, 0.04), 32, vol * LAND.drop, 0.003, len);
    tone("sine", vary(170, 0.04), 85, vol * LAND.kick, 0.001, 0.34);
    tone("triangle", vary(120, 0.04), 62, vol * LAND.body, 0.002, 0.38);
    nz("lowpass", 1500, 140, 0.8, vol * LAND.mass, 0.001, 0.16);
  });
  dryly(() => {
    nz("bandpass", vary(380), 230, 2.2, vol * LAND.knock, 0.0015, 0.12);
    nz("bandpass", vary(2100, 0.08), 1300, 1, vol * LAND.crack, 0.0008, 0.016);
  });
  boom(vol * LAND.hall, len * 1.3);
  if (room > 0) makeRoom(room, 0.25 + len * 0.15);
  duck(0.15, 0.3 + len * 0.2);
}
/** the end page: each clash is deep's first lock sound, hit harder. a copy of the clash's own first half second (the
    same layers as the first sound: for a block its falling sub, thud, body and growl; for the lock closing the big
    close's hit) goes round the limiter and through the warm saturation, so the clash is stronger and a laptop plays it
    too, and the weight's path comes up for that moment. the first sound itself plays as it always did (asBefore()),
    and everything after the first half second is the first sound alone: nothing else in the aftershock.
    ORIGINAL_HIT: how hard the copy is for a block and for the lock closing, how far the top lifts and for how long,
    and how long the first sound waits so the two don't overload together */
const ORIGINAL_HIT = { block: 2, close: 1.7, lift: 1.6, hold: 0.45, room: 0.12 };
function originalHit(close: boolean, vol: number) {
  heavy(() => {
    if (close) { // the big close's own hit (bigClack), its first half second
      tone("sine", 110, 27, vol, 0.004, 0.6);
      tone("triangle", 180, 55, vol * 0.55, 0.003, 0.5);
      tone("sawtooth", 62, 60, vol * 0.28, 0.01, 0.6, 900);
      nz("lowpass", 600, 90, 1, vol * 0.7, 0.002, 0.5);
    } else { // a block's own hit: its boom, growl and thud, its first half second
      tone("sine", vary(68, 0.04), 24, vol, 0.004, 0.6);
      nz("lowpass", 650, 55, 1, vol * 0.7, 0.003, 0.3);
      tone("triangle", 140, 40, vol * 0.3, 0.002, 0.28);
      tone("sawtooth", 50, 28, vol * 0.25, 0.01, 0.6, 400);
    }
  });
  duck(0.25, 0.6);
  const t = AC!.currentTime, g = impactOut.gain, on = IMPACT * (small ? 1.3 : 1);
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(on * ORIGINAL_HIT.lift, t, 0.004); g.setTargetAtTime(on, t + ORIGINAL_HIT.hold, 0.2);
}
/** deep: a long sub drop with weight on it, rolling away in the hall */
function boom(vol: number, dur: number, weight = 1.3) {
  tone("sine", vary(68, 0.04), 21, vol * weight, 0.004, dur);
  nz("lowpass", 650, 55, 1, vol * 0.9, 0.003, dur * 0.22);
  tone("triangle", 140, 40, vol * 0.4, 0.002, 0.28);
}

/** something very heavy landing: a sub drop, a body thump, a crack on top and a short dull clank */
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
function bigClose() {
  bigClack(1.3); knock(760, 380, 1.3, 0.14); tone("sine", 58, 22, 1.4, 0.01, 4.5); tone("sine", 31, 26, 1, 0.4, 6); rumble(0.8, 6, 420); warp(160, 24, 71, 620, 0.45, 0.02, 5.5); sweep(0.7, 5, 3200, 400, 90);
}

/** everything one set needs. the stage and the loader only ever call through the current set */
interface Kit {
  /** the camera reaches a piece */
  arrive(): void;
  /** a slab knocks into its place in the wall */
  tock(): void;
  /** a piece is rammed home into the lock */
  clack(vol: number): void;
  /** the wall is whole. lands the instant it is, no lead-in */
  seal(): void;
  /** the lock closes on the last page */
  finale(): void;
  /** the way in, from the loader: one hit at once, and air while the pieces come in */
  enter(): void;
  /** as the name lands in the first view. without it, the set's wall knock (tock) */
  nameLands?(): void;
  /** how much of the hall it is heard in */
  room: number;
  /** the wind that follows scroll speed: its band and how narrow it is */
  wind: [number, number];
  /** slide sets only: what it drags with. with it, scrolling drags instead of blowing */
  grit?: Grit;
  /** its own travel sound, when the visitor has not chosen one. without it: drag for a slide set, wind otherwise */
  travel?: TravelId;
}

type KnockId = "stone" | "wood" | "iron" | "felt" | "deep";
const K: Record<KnockId, Kit> = {
  stone: {
    arrive() {
      nz("lowpass", 900, 120, 1, 1.2, 0.003, 0.18); tone("sine", 95, 38, 1.3, 0.003, 0.5); knock(900, 500, 0.9, 0.09);
      later(() => { nz("bandpass", 240, 160, 6, 0.9, 0.002, 0.12); tone("triangle", 130, 60, 0.7, 0.002, 0.2); }, 90);
    },
    tock() { nz("bandpass", 210, 150, 7, 1.4, 0.002, 0.1); tone("sine", 98, 52, 1.1, 0.002, 0.28); knock(1000, 620, 1.0, 0.07); },
    clack(vol) { nz("lowpass", 1100, 100, 1, vol, 0.002, 0.22); tone("sine", 105, 34, vol * 1.3, 0.003, 0.8); nz("bandpass", 320, 200, 8, vol * 0.6, 0.002, 0.12); knock(850, 450, vol * 0.95, 0.1); },
    seal() { tone("sine", 80, 30, 1.5, 0.004, 1.2); nz("lowpass", 700, 90, 1, 1.2, 0.003, 0.25); nz("bandpass", 260, 170, 7, 0.7, 0.002, 0.12); knock(800, 420, 1.0, 0.12); },
    finale: bigClose,
    enter() { K.stone.clack(0.7); gust(0.55, 1.6, 520); },
    room: 0.5, wind: [300, 3.2],
  },
  wood: {
    arrive() { woodHit(1150, 1.1); tone("sine", 112, 50, 0.9, 0.003, 0.32); knock(1300, 800, 0.8, 0.07); later(() => woodHit(820, 0.5), 75); },
    tock() { woodHit(1280, 1.15); tone("sine", 120, 62, 0.75, 0.002, 0.2); knock(1400, 900, 0.85, 0.06); },
    clack(vol) { woodHit(960, vol * 1.25); tone("sine", 100, 40, vol * 1.15, 0.003, 0.5); nz("lowpass", 900, 100, 1, vol * 0.6, 0.002, 0.14); knock(1200, 700, vol * 0.9, 0.08); later(() => woodHit(720, vol * 0.45), 48); },
    seal() { woodHit(1020, 1.25); tone("sine", 86, 34, 1.2, 0.004, 0.9); knock(1100, 650, 1.0, 0.09); later(() => woodHit(780, 0.6), 60); later(() => woodHit(660, 0.32), 125); },
    finale() {
      tone("sine", 100, 26, 1.5, 0.004, 1.8); woodHit(820, 1.6); nz("lowpass", 1200, 80, 1, 1.0, 0.003, 0.5); rumble(0.55, 4.5, 360); knock(1000, 520, 1.3, 0.12);
      later(() => woodHit(640, 0.8), 70); later(() => woodHit(560, 0.5), 150); later(() => woodHit(500, 0.3), 260); later(() => woodHit(470, 0.16), 400); // the pieces settle against each other
    },
    enter() { K.wood.clack(0.7); gust(0.45, 1.5, 600); },
    room: 0.3, wind: [380, 2.6],
  },
  iron: {
    arrive() { warp(220, 30, 53, 900, 0.65, 0.004, 0.45); tone("sine", 120, 26, 1.1, 0.004, 1.1); latch(0.5); clank(1); knock(950, 480, 0.9, 0.09); },
    tock() { warp(310, 90, 211, 700, 0.5, 0.002, 0.14); tone("sine", 105, 30, 1.1, 0.003, 0.45); latch(0.45); knock(1050, 600, 0.95, 0.07); },
    clack(vol) { warp(260, 28, 83, 1100, vol * 0.7, 0.003, 0.9); tone("sine", 115, 25, vol * 1.3, 0.004, 1.5); tone("sawtooth", 58, 30, vol * 0.4, 0.01, 1.0, 600); latch(vol * 0.6); clank(vol); knock(850, 420, vol * 0.95, 0.1); },
    seal() { tone("sine", 80, 28, 1.5, 0.004, 1.3); warp(180, 40, 97, 800, 0.6, 0.003, 0.7); latch(0.6); clank(1.1); knock(800, 400, 1.0, 0.12); },
    finale: bigClose,
    enter() { K.iron.clack(0.65); gust(0.5, 1.6, 440); },
    room: 0.55, wind: [260, 4],
  },
  felt: {
    arrive() { softHit(1.15); knock(620, 380, 0.6, 0.08); later(() => softHit(0.38), 115); },
    tock() { softHit(0.95); knock(680, 420, 0.55, 0.07); },
    clack(vol) { softHit(vol * 1.25); tone("sine", 55, 30, vol * 0.6, 0.01, 0.6); knock(600, 360, vol * 0.6, 0.08); },
    seal() { softHit(1.35); tone("sine", 50, 26, 0.9, 0.015, 1.0); knock(560, 340, 0.7, 0.1); },
    finale() { tone("sine", 62, 24, 1.4, 0.012, 3); nz("lowpass", 420, 60, 1, 1.0, 0.008, 0.5); rumble(0.5, 4, 260); softHit(1.4); knock(560, 320, 0.9, 0.12); later(() => softHit(0.5), 140); later(() => softHit(0.22), 330); },
    enter() { K.felt.clack(0.75); gust(0.38, 1.6, 380); },
    room: 0.22, wind: [240, 2],
  },
  deep: {
    arrive() { boom(1.15, 1.8); rumble(0.3, 2.2, 300); knock(800, 420, 0.95, 0.1); },
    /* the wall: each slab that lands is a landing (land(), above), the loudest thing on the site.
       the lock, on the end page: deep's first sound, as it always was, at the level it always had (asBefore()), with
       each clash hit harder by a copy of its own first half second (originalHit()) */
    tock() { land(LAND_AT.wall[0], LAND_AT.wall[1]); knock(900, 520, 0.95, 0.08); },
    clack(vol) { asBefore(2.5, ORIGINAL_HIT.room); originalHit(false, vol * ORIGINAL_HIT.block); boom(vol * 1.2, 2.2); tone("sawtooth", 50, 28, vol * 0.3, 0.01, 1.2, 400); rumble(vol * 0.35, 2.5, 320); knock(760, 380, vol, 0.11); },
    seal() { land(LAND_AT.whole[0], LAND_AT.whole[1]); later(() => land(LAND_AT.whole[0] * 0.45, 0.6), 60); rumble(0.55, 3.5, 300); knock(720, 360, 1.0, 0.13); }, // the last two slabs meet, a hair apart
    finale() { asBefore(6, ORIGINAL_HIT.room); originalHit(true, ORIGINAL_HIT.close); bigClose(); boom(1.1, 3.2); },
    enter() { flyIn(); }, // the way in: only the flight in from space, no blocks
    nameLands() { /* nothing: the flight in settles by itself */ },
    room: 1.1, wind: [220, 3], travel: "rush",
  },
};

/** a slide set: a knock set's hits, plus friction. the camera reaching a piece also drags it the last little way, and
    the way in drags the six pieces in under the first hit */
const slideKit = (base: Kit, grit: Grit, extra?: () => void): Kit => ({
  ...base, grit, travel: "drag",
  arrive() { base.arrive(); friction(grit, 0.24, 0.55 * grit.vol); extra?.(); },
  enter() { base.clack(0.6); friction(grit, 1.1, 0.5 * grit.vol); },
});
/* what each material drags with. the slide sets use it for every drag; the knock sets only when "drag" is the travel */
const GRIT: Record<KnockId, Grit> = {
  /* rough stone on stone: wide, deep judder, catches hard */
  stone: { f0: 430, f1: 230, q: 1.1, j0: 27, j1: 11, depth: 0.85, lp: 1000, body: 130, vol: 1.7 },
  /* hardwood in a tight groove: higher, a quick fine chatter, no weight band */
  wood: { f0: 780, f1: 540, q: 2, j0: 44, j1: 22, depth: 0.7, lp: 1600, body: 0, vol: 1.4 },
  /* a heavy door on a steel rail: a smooth fast roll that rises a little */
  iron: { f0: 230, f1: 310, q: 1.6, j0: 62, j1: 46, depth: 0.3, lp: 900, body: 100, vol: 1.9 },
  /* something padded pulled over cloth: low, slow, soft */
  felt: { f0: 260, f1: 160, q: 1.2, j0: 14, j1: 7, depth: 0.4, lp: 500, body: 80, vol: 1.6 },
  /* a stone slab, very heavy: a slow judder, low, with a lot of weight under it */
  deep: { f0: 210, f1: 120, q: 1.3, j0: 17, j1: 7, depth: 0.6, lp: 700, body: 95, vol: 2.4 },
};
const KITS: Record<SoundId, Kit> = {
  ...K,
  deepslide: slideKit(K.deep, GRIT.deep),
  drawer: slideKit(K.wood, GRIT.wood),
  grind: slideKit(K.stone, GRIT.stone),
  rail: slideKit(K.iron, GRIT.iron, () => warp(140, 90, 31, 120, 0.12, 0.01, 0.3)), // and a faint warped edge
};
/** the material under each set */
const BASE: Record<SoundId, KnockId> = { stone: "stone", wood: "wood", iron: "iron", felt: "felt", deep: "deep", deepslide: "deep", drawer: "wood", grind: "stone", rail: "iron" };

/** how long each kind of slide lasts, and how loud, as a share of the set's own level:
    turn: the about-me piece rolls to its next side; in: a slab glides into the wall; ram: a piece is driven into the
    lock; out: the finished lock is pulled apart; home: one piece is pushed back in */
export type SlideKind = "turn" | "in" | "ram" | "out" | "home";
const SLIDES: Record<SlideKind, [number, number]> = { turn: [0.42, 1], in: [0.3, 0.75], ram: [0.16, 0.8], out: [0.55, 1], home: [0.13, 0.6] };

const KEY = "lock-sound";
const isKit = (id: unknown): id is SoundId => typeof id === "string" && id in KITS;
/** the set the visitor chose last time on this browser, or the default (Deep) */
let kitId: SoundId = (() => { try { const v = localStorage.getItem(KEY); if (isKit(v)) return v; } catch { /* storage is a nicety */ } return DEFAULT_SOUND; })();
const kit = () => KITS[kitId];
export const currentKit = () => kitId;
/** what the travel drags with: the set's own grit, or its material's */
const dragGrit = () => kit().grit ?? GRIT[BASE[kitId]];

const TKEY = "lock-travel";
const isTravel = (id: unknown): id is TravelId => typeof id === "string" && TRAVELS.some((x) => x.id === id);
/** the travel the visitor chose on this browser, or null: the set's own */
let travelPick: TravelId | null = (() => { try { const v = localStorage.getItem(TKEY); if (isTravel(v)) return v; } catch { /* storage is a nicety */ } return null; })();
const travelMode = (): TravelId => travelPick ?? kit().travel ?? "wind";
export const currentTravel = travelMode;
export const chosenTravel = () => travelPick;

/* ---- the events ---- */

export function arrive() { if (soundOn) kit().arrive(); }
export function tock() { if (soundOn) kit().tock(); }
export function clack(vol: number) { if (soundOn) kit().clack(vol); }
export function seal() { if (soundOn) kit().seal(); }
export function finale() { if (soundOn) kit().finale(); }
/** something is dragged. only the slide sets make a sound for it */
export function slide(kind: SlideKind) {
  const g = kit().grit;
  if (soundOn && g) { const [dur, v] = SLIDES[kind]; friction(g, dur, v * g.vol); }
}
/** the moment the visitor enters with sound */
export function entrance() { if (soundOn) kit().enter(); }
/** the name lands in its place in the first view */
export function landing() { if (soundOn) { const k = kit(); if (k.nameLands) k.nameLands(); else k.tock(); } }
/** the travel sound, following how fast the page is moving, amount 0..0.9. only the chosen one is open */
export function travel(amount: number) {
  speedNow = amount;
  if (!soundOn || !AC) return;
  const t = AC.currentTime, m = travelMode(), g = dragGrit(), s = Math.min(1, amount / 0.8), loud = small ? 1.5 : 1;
  /* wind: low air in a band, its pitch drifting by itself */
  whoosh.gain.setTargetAtTime(m === "wind" ? amount * (small ? 1.6 : 1) : 0, t, 0.15);
  /* drag: the material's friction, its judder quickening with the speed */
  scrape.gain.setTargetAtTime(m === "drag" ? amount * g.vol * 0.55 * (small ? 1.4 : 1) : 0, t, 0.12);
  if (m === "drag") scrapeLfo.frequency.setTargetAtTime(g.j1 + (g.j0 - g.j1) * Math.min(1, amount * 1.6), t, 0.1);
  /* rush: air pressure. the ceiling opens with speed, so faster is brighter, and a sub under it carries the weight.
     pass-by keeps a quiet rush under its whooshes */
  const r = m === "rush" ? Math.pow(amount, 1.2) * 0.65 : m === "passby" ? amount * 0.25 : 0;
  rush.gain.setTargetAtTime(r * loud, t, 0.14);
  rushLp.frequency.setTargetAtTime((m === "passby" ? 110 + 380 * s : 90 + 860 * s) * (small ? 1.8 : 1), t, 0.14);
  sub.gain.setTargetAtTime(m === "rush" && !small ? amount * 0.6 : 0, t, 0.2);
  /* thrum: low air pulsed like a heavy rotor, quicker with speed */
  thrum.gain.setTargetAtTime(m === "thrum" ? amount * 1.7 * loud : 0, t, 0.14);
  if (m === "thrum") thrumLfo.frequency.setTargetAtTime(4.5 + 26 * s, t, 0.12);
  /* track: knocks are timed in tick(), below */
}
/** track: one rail joint under the wheels: a short low knock, and the second axle a moment later */
function joint(s: number) {
  const v = 0.2 + 0.45 * Math.min(1, s / 0.7), base = BASE[kitId], gap = 60 + 50 * (1 - Math.min(1, s / 0.8));
  const hit = (vol: number) => {
    nz("bandpass", vary(base === "iron" ? 900 : 640), 420, 2.4, vol * 0.5, 0.002, 0.045);
    tone("sine", vary(80, 0.05), 44, vol * 0.95, 0.002, 0.14);
    if (base === "iron") latch(vol * 0.18);
    knock(950, 560, vol * 0.55, 0.05);
  };
  hit(v); later(() => hit(v * 0.72), gap);
}
let nextJoint = 0;
/** times the track's joints: closer together the faster the page moves, none when it is still. the first one lands
    the moment it starts to move */
function tick() {
  if (!AC || !soundOn || travelMode() !== "track" || document.hidden || speedNow < 0.05) { nextJoint = 0; return; }
  const now = AC.currentTime;
  if (!nextJoint || now >= nextJoint) { joint(speedNow); nextJoint = now + 0.8 - 0.58 * Math.min(1, speedNow / 0.8); }
}
/** pass-by: a block is being flown through, a little to one `side` (-1 left, 1 right), at `speed` (0..0.9). a whoosh
    that swells to the moment you go through it and crosses from its side to the other, with a soft thud as it does */
export function pass(side: number, speed: number) {
  if (!soundOn || !AC || travelMode() !== "passby") return;
  const ac = AC, t = ac.currentTime, s = Math.min(1, speed / 0.6), dur = 1.05 - 0.45 * s, v = (0.35 + 0.5 * s) * (small ? 1.4 : 1), peak = t + dur * 0.4;
  const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf; src.loop = true; lp.type = "lowpass"; lp.Q.value = 1.6;
  lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime((small ? 1800 : 1100) * (0.7 + 0.3 * s), peak); lp.frequency.exponentialRampToValueAtTime(140, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, peak); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp); lp.connect(g);
  if (ac.createStereoPanner) {
    const pan = ac.createStereoPanner(), sd = side < 0 ? -1 : 1;
    pan.pan.setValueAtTime(0.85 * sd, t); pan.pan.linearRampToValueAtTime(-0.6 * sd, t + dur); // from its side, across you as you go through it
    g.connect(pan); pan.connect(bus);
  } else g.connect(bus);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  later(() => { tone("sine", vary(58, 0.05), 30, v * 0.55, 0.004, 0.5); knock(700, 380, v * 0.4, 0.07); }, dur * 400); // it is level with you
}

/** sets the travel sounds to the current set's material and room */
function tuneTexture() {
  if (!AC) return;
  const t = AC.currentTime, k = kit(), g = dragGrit(), up = small ? 1.6 : 1;
  wet.gain.setTargetAtTime(k.room, t, 0.3);
  windBand.frequency.setTargetAtTime(k.wind[0] + (small ? 160 : 0), t, 0.3); windBand.Q.setTargetAtTime(k.wind[1], t, 0.3); // a little higher on small speakers, or the wind is not there at all
  scrapeBand.frequency.setTargetAtTime(Math.sqrt(g.f0 * g.f1) * up, t, 0.2); scrapeBand.Q.setTargetAtTime(g.q, t, 0.2);
  scrapeLp.frequency.setTargetAtTime(g.lp * up, t, 0.2);
  scrapeAm.gain.setTargetAtTime(1 - g.depth / 2, t, 0.2); scrapeDepth.gain.setTargetAtTime(g.depth / 2, t, 0.2);
  travel(speedNow); // and whichever travel is now chosen takes over at the current speed
}
/** chooses the travel sound, or null for the set's own. kept for the next visit unless keep is false (the sound lab) */
export function setTravel(id: TravelId | null, keep = true) {
  travelPick = id;
  if (keep) try { if (id) localStorage.setItem(TKEY, id); else localStorage.removeItem(TKEY); } catch { /* storage is a nicety */ }
  nextJoint = 0;
  tuneTexture();
}
/** switches to another set (the sound lab only). its room and its travel follow. with keep, this browser's site uses
    it from then on; without, it is only tried */
export function setKit(id: SoundId, keep = true) {
  if (!isKit(id)) return;
  kitId = id;
  if (keep) try { localStorage.setItem(KEY, id); } catch { /* storage is a nicety */ }
  tuneTexture();
}

export function setSound(on: boolean) {
  const was = soundOn;
  soundOn = on && !!AC;
  if (AC) {
    if (on && AC.state === "suspended") void AC.resume();
    /* turning on is quick, so the first hit is heard at full strength; turning off fades. louder on small speakers;
       the limiter keeps it clean */
    master.gain.setTargetAtTime(soundOn ? (small ? 2.2 : 1.45) : 0, AC.currentTime, soundOn && !was ? 0.02 : 0.25);
    dryOut.gain.setTargetAtTime(soundOn ? DRY * (small ? 1.4 : 1) : 0, AC.currentTime, soundOn && !was ? 0.02 : 0.25);
    impactOut.gain.setTargetAtTime(soundOn ? IMPACT * (small ? 1.3 : 1) : 0, AC.currentTime, soundOn && !was ? 0.02 : 0.25);
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
  /* everything runs into one bus, then a long dark hall and a limiter, so hits are big without clipping. the limiter
     lifts its output back up, so the biggest hits can still overshoot; a soft ceiling after it rounds those off
     instead of letting them crack */
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 10; comp.attack.value = 0.004; comp.release.value = 0.3;
  const pre = ac.createGain(), ceiling = ac.createWaveShaper(), curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) { const x = (i / 1024 - 1) * 2; curve[i] = Math.tanh(1.1 * x) / Math.tanh(2.2); } // in: the signal halved; out: level, rounding off only past about 0.8
  pre.gain.value = 0.5; ceiling.curve = curve; ceiling.oversample = "2x";
  pre.connect(ceiling); ceiling.connect(ac.destination);
  mixOut = ac.createGain(); mixOut.gain.value = MIX; comp.connect(mixOut); mixOut.connect(pre); // the limited mix, below the top
  master = ac.createGain(); master.gain.value = 0; master.connect(comp);
  bus = ac.createGain(); bus.connect(master); dest = bus;
  /* a landing's weight goes round the limiter, through a warm saturation (a little lopsided, so it adds the second
     overtone as well as the third: an octave and a fifth above the drop, warm rather than buzzy), then to the ceiling */
  const drive = ac.createWaveShaper(), dc = ac.createBiquadFilter(), tame = ac.createBiquadFilter(), shape = new Float32Array(2049), dk = 2.4, bias = 0.12;
  for (let i = 0; i < shape.length; i++) { const x = i / 1024 - 1; shape[i] = (Math.tanh(dk * (x + bias)) - Math.tanh(dk * bias)) / Math.tanh(dk * (1 + bias)); }
  drive.curve = shape; drive.oversample = "4x";
  dc.type = "highpass"; dc.frequency.value = 24; // the lopsided curve leaves a slow offset; this takes it out
  tame.type = "lowpass"; tame.frequency.value = 1400; // the overtones stay warm: nothing fizzy on top
  impactIn = ac.createGain(); impactIn.gain.value = DRIVE; impactOut = ac.createGain(); impactOut.gain.value = 0;
  impactIn.connect(drive); drive.connect(dc); dc.connect(tame); tame.connect(impactOut); impactOut.connect(pre);
  /* a landing's knock and edge go round the limiter too, clean */
  dry = ac.createGain(); dryOut = ac.createGain(); dryOut.gain.value = 0; dry.connect(dryOut); dryOut.connect(pre);
  travelBus = ac.createGain(); travelBus.connect(bus);
  const hall = ac.createConvolver(), ir = ac.createBuffer(2, Math.floor(sr * 4.2), sr);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < d.length; i++) { const e = Math.pow(1 - i / d.length, 2.6); lp += ((Math.random() * 2 - 1) - lp) * 0.22; d[i] = lp * e * 2.2; } }
  hall.buffer = ir; wet = ac.createGain(); wet.gain.value = kit().room; bus.connect(hall); hall.connect(wet); wet.connect(master);
  /* what plays all the time goes through its own quiet channel and fades in slowly, so it sits far behind the events */
  const dbus = ac.createGain(); dbus.gain.setValueAtTime(0.0001, ac.currentTime); dbus.gain.linearRampToValueAtTime(0.22, ac.currentTime + 6); dbus.connect(bus);
  noiseBuf = ac.createBuffer(1, sr * 2, sr); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  /* wind that follows scroll speed: low and wide. its pitch drifts up and down by itself */
  const src = ac.createBufferSource(); windBand = ac.createBiquadFilter(); src.buffer = noiseBuf; src.loop = true; windBand.type = "bandpass";
  const wl = ac.createOscillator(), wg = ac.createGain(); wl.frequency.value = 0.23; wg.gain.value = 190; wl.connect(wg); wg.connect(windBand.frequency); wl.start();
  whoosh = ac.createGain(); whoosh.gain.value = 0; src.connect(windBand); windBand.connect(whoosh); whoosh.connect(travelBus); src.start();
  /* the drag that takes the wind's place in the slide sets: the same friction as a slide, held open while the page moves */
  const s2 = ac.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true;
  scrapeBand = ac.createBiquadFilter(); scrapeBand.type = "bandpass";
  scrapeAm = ac.createGain(); scrapeDepth = ac.createGain(); scrapeLfo = ac.createOscillator(); scrapeLfo.type = "sawtooth"; scrapeLfo.frequency.value = 12;
  scrapeLfo.connect(scrapeDepth); scrapeDepth.connect(scrapeAm.gain);
  scrapeLp = ac.createBiquadFilter(); scrapeLp.type = "lowpass";
  scrape = ac.createGain(); scrape.gain.value = 0;
  s2.connect(scrapeBand); scrapeBand.connect(scrapeAm); scrapeAm.connect(scrapeLp); scrapeLp.connect(scrape); scrape.connect(travelBus); s2.start(ac.currentTime, 0.7); scrapeLfo.start();
  /* rush: air under a ceiling that opens with speed, and a sub for the weight of it */
  const s3 = ac.createBufferSource(); s3.buffer = noiseBuf; s3.loop = true;
  rushLp = ac.createBiquadFilter(); rushLp.type = "lowpass"; rushLp.Q.value = 0.9; rushLp.frequency.value = 120;
  rush = ac.createGain(); rush.gain.value = 0; s3.connect(rushLp); rushLp.connect(rush); rush.connect(travelBus); s3.start(ac.currentTime, 1.1);
  const subLp = ac.createBiquadFilter(); subLp.type = "lowpass"; subLp.frequency.value = 65; subLp.Q.value = 1.4;
  sub = ac.createGain(); sub.gain.value = 0; s3.connect(subLp); subLp.connect(sub); sub.connect(travelBus);
  /* thrum: very low air, pulsed. a sine pulse on the level, so it beats without ever becoming a note */
  const s4 = ac.createBufferSource(); s4.buffer = noiseBuf; s4.loop = true;
  const thLp = ac.createBiquadFilter(); thLp.type = "lowpass"; thLp.frequency.value = 170; thLp.Q.value = 1.1;
  const thAm = ac.createGain(), thDepth = ac.createGain(); thAm.gain.value = 0.55; thDepth.gain.value = 0.45;
  thrumLfo = ac.createOscillator(); thrumLfo.frequency.value = 5; thrumLfo.connect(thDepth); thDepth.connect(thAm.gain);
  thrum = ac.createGain(); thrum.gain.value = 0; s4.connect(thLp); thLp.connect(thAm); thAm.connect(thrum); thrum.connect(travelBus); s4.start(ac.currentTime, 0.3); thrumLfo.start();
  window.setInterval(tick, 25); // the track's joints
  tuneTexture();
  /* the background: only very low air, no tone at all */
  const b = ac.createBufferSource(), l = ac.createBiquadFilter(), g = ac.createGain(); b.buffer = noiseBuf; b.loop = true; l.type = "lowpass"; l.frequency.value = 110; g.gain.value = 0.7; b.connect(l); l.connect(g); g.connect(dbus); b.start();
  /* leaving the tab stops the sound; coming back brings it straight back */
  document.addEventListener("visibilitychange", () => {
    if (!AC) return;
    if (document.hidden) void AC.suspend(); else if (soundOn) void AC.resume();
  });
}
