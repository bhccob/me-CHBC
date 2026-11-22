/* the sound lab (sounds.html, dev server only): every set, every moment on the site, side by side, so sets can be
   compared and tuned by ear. each button plays what the site plays at that moment, with the same timing between the
   parts (a slab drags, then knocks; a piece is rammed, then seats). nothing here is part of the site.
   two parts: travel (what you hear between the pieces, tried over any set's hits), and the sets themselves */
import { SOUNDS, SOUND_KINDS, TRAVELS, type SoundId, type TravelId } from "./content";
import { initSound, setSound, setKit, currentKit, setTravel, chosenTravel, isSoundOn, onSoundChange, arrive, tock, clack, seal, finale, slide, entrance, landing, travel, pass } from "./audio";

const $ = (id: string) => document.getElementById(id)!;
const table = $("lab"), trips = $("trips"), hitsRow = $("hits"), now = $("now"), state = $("state"), speed = $("speed") as HTMLInputElement;
/* what the site uses on this browser (changed only by the Use buttons), and what the lab played last */
let siteKit = currentKit(), siteTravel = chosenTravel();
let hits: SoundId = siteKit, playingKit: SoundId = siteKit, playingTravel: TravelId | null = siteTravel;
let timers: number[] = [], moveT = 0;
const nameOf = (id: SoundId) => SOUNDS.find((s) => s.id === id)!.name;
const travelName = (id: TravelId | null) => id ? TRAVELS.find((t) => t.id === id)!.name : "the set's own";

/** stops whatever is scheduled: a tour, a flight, the speed slider */
function stopAll() {
  timers.forEach(clearTimeout); timers = [];
  clearInterval(moveT); moveT = 0;
  speed.value = "0"; travel(0);
  document.querySelectorAll(".playing").forEach((b) => b.classList.remove("playing"));
}
const at = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
/** the camera speeds up and slows down again over `ms`, as a step or a jump moves it. `passes`: when blocks are flown
    through (as a share of the way) and on which side. `land`: the arrival at the end */
function move(ms: number, peak: number, passes: [number, number][] = [], land = false) {
  clearInterval(moveT);
  const t0 = performance.now(), env = (u: number) => peak * Math.pow(Math.sin(Math.PI * u), 1.5);
  passes.forEach(([u, side]) => at(ms * u, () => pass(side, env(u))));
  if (land) at(ms + 40, arrive);
  moveT = window.setInterval(() => {
    const u = (performance.now() - t0) / ms;
    if (u >= 1) { clearInterval(moveT); moveT = 0; travel(0); return; }
    travel(env(u));
  }, 30);
}
/** one step to the next piece: one block flown through, then the arrival */
const hop = () => move(1300, 0.55, [[0.42, 1]], true);
/** a jump across the page: four blocks flown through, then the arrival */
const fly = () => move(3000, 0.9, [[0.22, 1], [0.38, -1], [0.54, 1], [0.7, -1]], true);

/* the moments, in the order a visit meets them */
const MOMENTS: { label: string; note: string; slideOnly?: boolean; play(): void }[] = [
  { label: "Way in", note: "enter, and the name lands", play() { entrance(); at(1250, landing); } },
  { label: "Arrive", note: "the camera reaches a piece", play: arrive },
  { label: "Turn", note: "the about-me piece rolls a side", slideOnly: true, play() { slide("turn"); } },
  { label: "Travel", note: "a step to the next piece", play: hop },
  { label: "Wall", note: "a slab drags in, knocks", play() { slide("in"); at(300, tock); } },
  { label: "Wall whole", note: "the last slab lands", play: seal },
  { label: "Into lock", note: "a piece rammed home", play() { slide("ram"); at(160, () => clack(0.75)); } },
  { label: "Lock closes", note: "the last piece, Me", play() { slide("ram"); at(160, finale); } },
  { label: "Apart", note: "a press pulls it open", play() { clack(0.35); slide("out"); } },
  { label: "Back in", note: "the next press, one by one", play() { for (let k = 0; k < 6; k++) { at(k * 85, () => slide("home")); at(k * 85 + 150, () => clack(k === 5 ? 0.85 : 0.5)); } } },
];
/** a whole visit in about twelve seconds */
function tour() {
  entrance(); at(1250, landing);
  at(2600, arrive); at(3500, () => slide("turn"));
  at(4300, hop); at(6000, fly);
  [0, 1, 2].forEach((k) => { at(9500 + k * 450, () => slide("in")); at(9800 + k * 450, tock); });
  at(11150, seal);
  at(12300, () => slide("ram")); at(12460, () => clack(0.75));
  at(12900, () => slide("ram")); at(13060, () => clack(0.75));
  at(13650, () => slide("ram")); at(13810, finale);
}

function play(kitId: SoundId, travelId: TravelId | null, btn: HTMLElement, fn: () => void, what: string) {
  stopAll();
  initSound(); setKit(kitId, false); setTravel(travelId, false); setSound(true);
  playingKit = kitId; playingTravel = travelId;
  btn.classList.add("playing"); at(400, () => btn.classList.remove("playing"));
  now.textContent = "Playing: " + nameOf(kitId) + " hits, " + travelName(travelId) + " travel · " + what;
  try { fn(); } catch { /* a sound is never worth an error */ }
}

/* ---- travel: which hits to hear it with, then one row per travel sound ---- */
hitsRow.innerHTML = SOUND_KINDS.map((g) => `<span class="hk">${g.name}</span>` + SOUNDS.filter((s) => s.kind === g.id).map((s) => `<button type="button" data-hits="${s.id}" aria-pressed="false">${s.name}</button>`).join("")).join("");
const markHits = () => hitsRow.querySelectorAll<HTMLElement>("[data-hits]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.hits === hits)));
markHits();
hitsRow.addEventListener("click", (e) => { const b = (e.target as Element).closest<HTMLElement>("[data-hits]"); if (b) { hits = b.dataset.hits as SoundId; markHits(); } });
trips.innerHTML = "<tbody>" + TRAVELS.map((t) => `<tr data-travel="${t.id}"><td class="name"><b>${t.name}</b><span>${t.line}</span></td>`
  + `<td><button type="button" class="tour" data-trip="hop" data-t="${t.id}">Step ▸</button></td>`
  + `<td><button type="button" data-trip="fly" data-t="${t.id}">Jump ▸</button></td>`
  + `<td><button type="button" class="use" data-use-travel="${t.id}">Use</button></td></tr>`).join("") + "</tbody>";
const markTravel = () => trips.querySelectorAll<HTMLElement>("tr[data-travel]").forEach((r) => r.classList.toggle("cur", r.dataset.travel === siteTravel));
markTravel();
trips.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button"); if (!b) return;
  if (b.dataset.useTravel) { siteTravel = b.dataset.useTravel as TravelId; setTravel(siteTravel); markTravel(); now.textContent = travelName(siteTravel) + " is now the site's travel sound on this browser."; return; }
  const id = b.dataset.t as TravelId, trip = b.dataset.trip;
  play(hits, id, b, trip === "fly" ? fly : hop, trip === "fly" ? "a jump across the page" : "a step to the next piece");
});
$("ownTravel").addEventListener("click", () => { siteTravel = null; setTravel(null); markTravel(); now.textContent = "The site uses each set's own travel sound again (rush for Deep, drag for the slide sets, wind for the rest)."; });

/* ---- the sets: one row per set, grouped by kind. they play with the site's travel ---- */
let h = "<thead><tr><th>Set</th><th></th>" + MOMENTS.map((m) => `<th>${m.label}<small>${m.note}</small></th>`).join("") + "<th></th></tr></thead><tbody>";
for (const g of SOUND_KINDS) {
  h += `<tr class="kind"><td colspan="${MOMENTS.length + 3}">${g.name}</td></tr>`;
  for (const s of SOUNDS.filter((x) => x.kind === g.id)) {
    h += `<tr data-row="${s.id}"><td class="name"><b>${s.name}</b><span>${s.line}</span></td>`
      + `<td><button type="button" class="tour" data-set="${s.id}" data-m="tour" data-what="the whole visit">Tour ▸</button></td>`
      + MOMENTS.map((m, k) => m.slideOnly && s.kind !== "slide"
        ? `<td><button type="button" disabled title="Knock sets make no sound here" style="opacity:.25">${m.label}</button></td>`
        : `<td><button type="button" data-set="${s.id}" data-m="${k}" data-what="${m.label.toLowerCase()}">${m.label}</button></td>`).join("")
      + `<td><button type="button" class="use" data-use="${s.id}">Use</button></td></tr>`;
  }
}
table.innerHTML = h + "</tbody>";
const markChosen = () => table.querySelectorAll<HTMLElement>("tr[data-row]").forEach((r) => r.classList.toggle("cur", r.dataset.row === siteKit));
markChosen();
table.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button"); if (!b || b.disabled) return;
  if (b.dataset.use) { siteKit = b.dataset.use as SoundId; setKit(siteKit); markChosen(); now.textContent = nameOf(siteKit) + " is now the site's sound on this browser."; return; }
  const id = b.dataset.set as SoundId, m = b.dataset.m!;
  play(id, siteTravel, b, m === "tour" ? tour : MOMENTS[+m].play, b.dataset.what || "");
});

$("stop").addEventListener("click", () => { stopAll(); now.textContent = ""; });
/* the slider holds the travel speed where it is, with what was played last, to hear the travel sound on its own */
speed.addEventListener("input", () => {
  if (!isSoundOn()) { initSound(); setKit(playingKit, false); setTravel(playingTravel, false); setSound(true); }
  clearInterval(moveT); moveT = 0;
  travel(+speed.value);
  now.textContent = "Travel speed " + (+speed.value).toFixed(2) + " · " + travelName(playingTravel) + " travel, " + nameOf(playingKit) + " hits";
});
onSoundChange((on) => { state.classList.toggle("on", on); state.innerHTML = on ? "Sound <b>on</b>" : "Sound <b>off</b> · press anything"; });
