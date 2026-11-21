/* the journey moves in steps. the first view, each side of the Me piece, each block and the wall are stops. one turn
   of the wheel, one swipe or one key carries you to the next stop and no further, so nobody flies past a block by
   accident, and every arrival takes the same time, so the knock can land with it. below the wall (the work list and
   the last page) the page scrolls freely, as any page does.
   the page itself still scrolls: a step is only the scroll position being moved for you */
import { START, DUR, ME_STOPS, HOLD } from "../timeline";
import { clamp, $ } from "../util";

/** the wall stands whole from 1.4 to 1 screens above the work list. its stop is just inside that */
const WALL_UP = 1.22;
/** after landing, the page rests this long before the next step can start (ms) */
const DWELL = 90;
/** a step that lands on a block holds it this long before the next push counts (ms), so a fast scroller cannot fly
    past it: a study block a full second, a side of the about-me piece only a moment, so the turns flow */
const HOLD_BLOCK = 1000, HOLD_SIDE = 350;
/** one step of the flight from block to block, from the last about-me side to Directions (ms, for one block's distance) */
const FLY = 620;
/** Directions to the wall and back: the other five fly in and the wall assembles around Directions (ms) */
const ASSEMBLE = 1700;
/** the longest glide between two sides of the about-me piece (ms) */
const TURN = 430;

const root = document.documentElement;
const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
let work: HTMLElement;

/* the loader, the message form and a project page each hold the page still themselves */
const blocked = () => root.classList.contains("loading") || root.classList.contains("formopen") || root.classList.contains("popopen") || root.classList.contains("nogl");

/** every stop, as a scroll position, top to bottom: the top, the four about-me sides (1-4), the five study blocks (5-9),
    the wall (10), and the top of the work list (11), where free scrolling begins */
function stops(): number[] {
  const vh = window.innerHeight, workTop = work.offsetTop, span = Math.max(1, workTop - (2 + HOLD) * vh);
  const out = [0];
  for (const m of ME_STOPS) out.push(span * (START[0] + DUR[0] * m)); // the name, then one stop per side of the Me piece
  for (let c = 1; c < 6; c++) out.push(span * (START[c] + DUR[c] * 0.5));
  out.push(workTop - WALL_UP * vh, workTop);
  return out;
}
const below = (st: number[], y: number) => { let v = st[0]; for (const s of st) if (s < y - 2) v = s; return v; };
const above = (st: number[], y: number) => { for (const s of st) if (s > y + 2) return s; return st[st.length - 1]; };
const nearest = (st: number[], y: number) => st.reduce((a, s) => (Math.abs(s - y) < Math.abs(a - y) ? s : a), st[0]);

/* ---- the glide: the page is carried to a place, quick off the mark and easing into the stop ---- */
let gliding = false, gFrom = 0, gTo = 0, gT0 = 0, gDur = 0, gSet = 0, gDir = 0, gHold = 0, gInOut = false, landedAt = 0, raf = 0;
/* a second push that comes while the page is already more than half way: it is not dropped, it starts the moment
   the page lands. only one is remembered, so a spin of the wheel still moves one stop */
let queued = 0;
/* while a block holds, the wheel, the keys and a finger cannot move the page (the scrollbar and the menu still can) */
let holdUntil = 0;
const holding = () => performance.now() < holdUntil;
/** how long a landing on `to` holds: only the about-me sides and the five blocks hold */
function holdAt(st: number[], to: number) {
  const k = st.findIndex((s) => Math.abs(s - to) < 2);
  return k >= 5 && k <= 9 ? HOLD_BLOCK : k >= 1 && k <= 4 ? HOLD_SIDE : 0;
}

function stopGlide() { queued = 0; if (gliding) { gliding = false; cancelAnimationFrame(raf); } }
const halfWay = () => gliding && performance.now() - gT0 > gDur * 0.5;
function tick(now: number) {
  if (!gliding) return;
  /* something else moved the page (the scrollbar, the browser): let go at once, and tidy up when it has stopped */
  if (now - gT0 > 220 && Math.abs(window.scrollY - gSet) > 8) { gliding = false; settleSoon(); return; }
  const u = clamp((now - gT0) / gDur, 0, 1);
  /* the flight between blocks is gentle at both ends: one smooth start, one smooth stop. everything else is quick off
     the mark and eases into the stop */
  gSet = gFrom + (gTo - gFrom) * (gInOut ? 0.5 * u + 0.25 - 0.25 * Math.cos(Math.PI * u) : 1 - Math.pow(1 - u, 2.6));
  window.scrollTo(0, gSet);
  if (u < 1) { raf = requestAnimationFrame(tick); return; }
  gliding = false; landedAt = now;
  if (gHold) { holdUntil = now + gHold; queued = 0; return; } // the block has its moment: a push made on the way is dropped
  if (queued) { const d = queued; queued = 0; stepFrom(d, stops()); }
}
/** carry the page to `to`. the time depends on the stretch: a short glide between two about-me sides, a level flight
    of about 0.6 s from block to block, 1.7 s for the wall to assemble, and otherwise by distance (at most 1.3 s).
    `hold`: a landing on a block holds it (the menu's jumps do not) */
export function glideTo(to: number, hold = true) {
  stopGlide(); holdUntil = 0;
  const from = window.scrollY, vh = Math.max(1, window.innerHeight);
  to = clamp(to, 0, Math.max(0, root.scrollHeight - window.innerHeight));
  if (Math.abs(to - from) < 1) return;
  const st = stops();
  /* only a step to another stop holds. falling back to the stop the page was already at does not */
  gHold = hold && nearest(st, from) !== nearest(st, to) ? holdAt(st, to) : 0;
  if (calm.matches) { window.scrollTo(0, to); landedAt = performance.now(); if (gHold) holdUntil = landedAt + gHold; return; }
  gFrom = gSet = from; gTo = to; gDir = Math.sign(to - from); gT0 = performance.now();
  const lo = Math.min(from, to), hi = Math.max(from, to), dist = hi - lo, inside = (a: number, b: number) => lo >= st[a] - 2 && hi <= st[b] + 2;
  gInOut = false;
  gDur = Math.min(1300, 220 + 430 * Math.pow(dist / vh, 0.6));
  if (inside(4, 9)) { gInOut = true; gDur = FLY * Math.min(1.2, 0.5 + 0.5 * dist / Math.max(1, st[6] - st[5])); }
  else if (inside(9, 10)) { gInOut = true; gDur = ASSEMBLE; }
  else if (inside(1, 4)) gDur = Math.min(gDur, TURN);
  gliding = true; raf = requestAnimationFrame(tick);
}
/** one step up (-1) or down (1) from where the page is now */
function stepFrom(dir: number, st: number[]) { glideTo(dir > 0 ? above(st, window.scrollY) : below(st, window.scrollY)); }

/* ---- tidying up: however the page got between two stops, it does not stay there ---- */
let settleT = 0, fingers = 0, dragging = false, runFrom = 0, prevY = 0, lastScroll = 0;
function settleSoon() { clearTimeout(settleT); settleT = window.setTimeout(settle, 150); }
function settle() {
  if (gliding || dragging || fingers > 0 || blocked()) return;
  const st = stops(), y = window.scrollY, end = st[st.length - 1];
  if (y >= end - 1) return;
  const near = nearest(st, y), off = Math.abs(near - y);
  if (off <= 3) return;
  /* just past a stop: back to it. otherwise on to the next stop in the direction the page was moving */
  const lo = below(st, y), hi = above(st, y), moved = y - runFrom;
  glideTo(off > 0.15 * (hi - lo) && Math.abs(moved) > 0.04 * window.innerHeight ? (moved > 0 ? hi : lo) : near);
}

export function initSteps() {
  work = $("work");
  prevY = runFrom = window.scrollY;

  /* is this a place where the page moves in steps? the top of the work list counts when the visitor is heading back up */
  const inSteps = (st: number[], dir: number) => { const y = window.scrollY, end = st[st.length - 1]; return y < end - 1 || (y <= end + 1 && dir < 0); };

  /* ---- wheel and trackpad ---- */
  let wT = 0, wDir = 0, wAbs = 0;
  window.addEventListener("wheel", (e) => {
    if (blocked() || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1), dir = Math.sign(dy);
    if (!dir) return;
    const st = stops();
    if (!inSteps(st, dir)) { stopGlide(); return; } // free scrolling: the visitor has the page
    e.preventDefault();
    /* a trackpad keeps sending smaller and smaller movements for a second after the fingers have left. those are the
       tail of the last push, not a new one: a new push comes after a pause, turns round, or is clearly stronger.
       a mouse wheel sends large clicks that do not fade, and each one counts */
    const now = performance.now(), abs = Math.abs(dy), fresh = now - wT > 180 || dir !== wDir || abs > wAbs * 1.4 + 4 || (abs >= 50 && abs >= wAbs - 1);
    wT = now; wDir = dir; wAbs = abs; // kept up to date through a hold too, so a trackpad's tail is still the old push when the hold ends
    if (holding() || !fresh) return;
    if (gliding) { if (dir !== gDir) stepFrom(dir, st); else if (halfWay()) queued = dir; return; } // on the way: turning back is done at once, a second push forward waits for the landing
    if (now - landedAt < DWELL) return;
    stepFrom(dir, st);
  }, { passive: false });

  /* ---- keys ---- */
  window.addEventListener("keydown", (e) => {
    if (blocked() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const el = e.target as HTMLElement | null, tag = el?.tagName || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
    let dir = 0;
    if (e.key === "ArrowDown" || e.key === "PageDown") dir = 1;
    else if (e.key === "ArrowUp" || e.key === "PageUp") dir = -1;
    else if (e.key === " " && tag !== "BUTTON" && tag !== "A") dir = e.shiftKey ? -1 : 1;
    if (!dir) return;
    const st = stops();
    if (!inSteps(st, dir)) { stopGlide(); return; }
    e.preventDefault();
    if (holding()) return;
    if (gliding && dir === gDir) { if (halfWay() && !e.repeat) queued = dir; return; }
    if (!gliding && performance.now() - landedAt < DWELL) return;
    stepFrom(dir, st);
  });

  /* ---- a finger: the page follows it, as far as the next stop and no further. letting go carries it the rest of the way ---- */
  let tOn = false, tY0 = 0, tScroll0 = 0, tLo = 0, tHi = 0, tHome = 0, tLastY = 0, tLastT = 0, tVel = 0;
  window.addEventListener("touchstart", (e) => {
    fingers = e.touches.length; tOn = false; dragging = false;
    if (blocked() || fingers !== 1) return;
    const st = stops(), y = window.scrollY;
    if (y >= st[st.length - 1] - 1) return; // the work list and the last page scroll the usual way
    stopGlide(); // the finger catches the page
    tOn = true; tY0 = tLastY = e.touches[0].clientY; tScroll0 = y; tLastT = performance.now(); tVel = 0;
    tLo = below(st, y); tHi = above(st, y); tHome = nearest(st, y);
    if (Math.abs(tHome - y) > 2) tHome = -1; // caught between two stops: there is no stop to fall back to
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!tOn || e.touches.length !== 1) return;
    if (!e.cancelable) { tOn = dragging = false; return; } // the browser is already scrolling by itself: leave it to it, and tidy up afterwards
    e.preventDefault();
    const cy = e.touches[0].clientY, now = performance.now(), d = tY0 - cy;
    if (now > tLastT) tVel = tVel * 0.4 + (tLastY - cy) / (now - tLastT) * 0.6;
    tLastY = cy; tLastT = now;
    if (holding() && !dragging) { tY0 = cy; return; } // the block holds: a drag that goes on past the hold starts from here, with no jump
    if (!dragging && Math.abs(d) < 8) return;
    dragging = true;
    window.scrollTo(0, clamp(tScroll0 + d * 1.25, tLo, tHi));
  }, { passive: false });
  const lift = (e: TouchEvent) => {
    fingers = e.touches.length;
    if (!tOn) { if (!fingers) settleSoon(); return; }
    tOn = false;
    if (!dragging) { settleSoon(); return; } // a tap. if it caught the page on the way, the page goes on to a stop
    dragging = false;
    const moved = window.scrollY - tScroll0, v = performance.now() - tLastT < 120 ? tVel : 0; // px per ms, down the page
    let to = tHome >= 0 ? tHome : Math.abs(tLo - window.scrollY) < Math.abs(tHi - window.scrollY) ? tLo : tHi;
    if (Math.abs(v) > 0.3) to = v > 0 ? tHi : tLo; // a flick
    else if (Math.abs(moved) > 0.07 * window.innerHeight) to = moved > 0 ? tHi : tLo; // a slow pull, far enough
    glideTo(to);
  };
  window.addEventListener("touchend", lift, { passive: true });
  window.addEventListener("touchcancel", lift, { passive: true });

  /* ---- anything else that moves the page (the scrollbar, a swipe that began in the work list) ---- */
  window.addEventListener("scroll", () => {
    const y = window.scrollY, now = performance.now();
    if (gliding || dragging) { prevY = runFrom = y; lastScroll = now; return; }
    if (now - lastScroll > 200) runFrom = prevY; // a new movement starts here
    lastScroll = now; prevY = y;
    settleSoon();
  }, { passive: true });
}
