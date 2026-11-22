/* The loader: a boot log, with no box around it. It counts the things this page really has to get ready (the 3D engine,
   three fonts, six pieces, their sides and glow, the space around them, the first drawn frame), prints each one as it
   finishes, and cracks the name a letter at a time, never left to right. At 13 of 13: "Access granted", and the two
   ways in. Nothing else opens the page.

   Entering is one continuous move into the first view, with no cut:
   1. the log folds up into the name, bottom row first, each row breaking into noise as it goes, and the line above the
      name starts rewriting itself into the first view's line ("Six pieces. Not yet a lock.");
   2. the line and the name glide to exactly where the first view has them, the name growing to its size. the dark
      opens around the name as it travels, like an iris, and the six blurred colours behind the log fly out to where
      their six pieces will hang, tightening as they go, while the pieces come in out of the fog there and the camera
      settles (stage.ts, from `handoff.at`). with sound, a flight in from deep space, wide air swelling and settling (no hits);
   3. the first view's own line and name take over in the same spot, and its sentence and the menu fade in. */
import { $, clamp } from "./util";
import { HERO, LOADER } from "./content";
import { handoff } from "./handoff";
import { entrance, landing } from "./audio";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz0123456789#%&$@*+=?";
const noise = () => GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** a CSS cubic-bezier as a function, so a drawn thing can follow an element on that same curve */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  return (x: number) => {
    let lo = 0, hi = 1, t = x;
    for (let k = 0; k < 24; k++) { t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; }
    return at(y1, y2, t);
  };
}
/** the curve the line and the name glide on */
const GLIDE_EASE = "cubic-bezier(.65,0,.2,1)", glideAt = bezier(0.65, 0, 0.2, 1);

export function createLoader(onEnter: (withSound: boolean) => void) {
  const root = document.documentElement, el = $("loader"), nameEl = $("lname"), head = $("lhead"), state = $("lstate"), count = $("lcount");
  const headText = head.querySelector("span")!, bg = el.querySelector<HTMLElement>(".lbg")!, blobWrap = el.querySelector<HTMLElement>(".lblobs")!;
  const rows = Array.from(el.querySelectorAll<HTMLLIElement>(".llog li")), blobs = Array.from(el.querySelectorAll<HTMLElement>(".lblobs i"));
  const TOTAL = rows.length, t0 = performance.now(), calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let done = 0, ready = false, gone = false;

  /* every visit starts at the first view. a reload, a link with a #place in it, or the browser restoring where the
     visitor last was would otherwise open the page halfway down, under the loader. boot.js already tells the browser
     not to restore the scroll position; this makes sure, and is done again on the way in */
  const toTop = () => {
    if (location.hash) { try { history.replaceState(history.state, "", location.pathname + location.search); } catch { /* the address is a nicety */ } }
    window.scrollTo(0, 0);
  };
  toTop();

  /* the name, one cell per letter. each letter has its own step to lock at, spread over the whole load */
  const NAME = HERO.heading, cells: HTMLElement[] = [], lockAt: number[] = [];
  const letters = NAME.split("").map((ch, i) => i).filter((i) => NAME[i] !== " ");
  const shuffled = [...letters].sort((a, b) => Math.sin(a * 7.31 + 1.7) - Math.sin(b * 7.31 + 1.7));
  shuffled.forEach((i, rank) => { lockAt[i] = Math.max(1, Math.round((rank + 1) * (TOTAL - 1) / letters.length)); });
  NAME.split("").forEach((ch, i) => {
    const c = document.createElement("i");
    if (ch === " ") { c.className = "sp"; c.textContent = " "; } else c.textContent = calm ? ch : noise();
    nameEl.appendChild(c); cells.push(c);
  });
  /* the display font draws its letters differently at different sizes (its optical size axis, which the browser sets
     from the font size), and the name here is smaller than the first view's heading. so it takes the heading's optical
     size: scaled up in the glide it is then letter for letter the heading, and nothing changes shape at the handover */
  const heroHeading = document.getElementById("h-hero");
  const matchHeading = () => { if (heroHeading) nameEl.style.fontVariationSettings = '"opsz" ' + parseFloat(getComputedStyle(heroHeading).fontSize); };
  matchHeading();
  const lockLetters = () => cells.forEach((c, i) => { if (NAME[i] !== " " && done >= lockAt[i] && !c.classList.contains("on")) { c.classList.add("on"); c.textContent = NAME[i]; } });
  const scramble = calm ? 0 : window.setInterval(() => cells.forEach((c, i) => { if (NAME[i] !== " " && !c.classList.contains("on")) c.textContent = noise(); }), 70);

  const setCount = () => { count.textContent = String(done).padStart(2, "0") + " / " + TOTAL; };

  /** one more thing is ready: the next row of the log says what, and when */
  function task(label: string) {
    if (done >= TOTAL || gone) return;
    const row = rows[done]; done++;
    row.classList.remove("now"); row.classList.add("ok");
    row.querySelector(".tg")!.textContent = "[ OK ]";
    row.querySelector(".tx")!.textContent = label;
    row.querySelector(".tm")!.textContent = ((performance.now() - t0) / 1000).toFixed(2) + "s";
    if (rows[done]) { rows[done].classList.add("now"); rows[done].querySelector(".tg")!.textContent = "[ .. ]"; }
    const piece = /^Piece (\d) of 6/.exec(label); if (piece) blobs[+piece[1] - 1]?.classList.add("on");
    lockLetters(); setCount();
    if (done >= TOTAL) setTimeout(isReady, 300);
  }
  function isReady() {
    if (ready || gone) return;
    ready = true; clearInterval(scramble);
    nameEl.textContent = NAME; nameEl.classList.add("done"); // one plain line from here on, spaced as the first view's heading
    state.textContent = LOADER.granted;
    rows.forEach((r) => r.classList.remove("now"));
    el.classList.add("ready");
    try { $("withSound").focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
  }
  setTimeout(isReady, 9000); // never leave the page stuck on loading

  /* ---- the way in ---- */
  /** a row turns to noise and shrinks away */
  function dissolve(row: HTMLElement, delay: number) {
    const spans = Array.from(row.querySelectorAll<HTMLElement>(".tg,.tx,.tm"));
    setTimeout(() => {
      const start = performance.now(), base = spans.map((s) => s.textContent || "");
      const step = () => {
        const u = Math.min(1, (performance.now() - start) / 260);
        spans.forEach((s, k) => { const n = Math.round(base[k].length * (1 - u)); let t = ""; for (let j = 0; j < n; j++) t += base[k][j] === " " ? " " : noise(); s.textContent = t; });
        if (u < 1) requestAnimationFrame(step); else row.classList.add("gone");
      };
      requestAnimationFrame(step);
    }, delay);
  }
  /** a row breaks into noise and is pulled up into the name, gathering speed, folding flat as it goes. only its picture
      moves: the row keeps its place in the column, so nothing above it shifts while the name glides */
  function fold(row: HTMLElement, toY: number, delay: number) {
    const r = row.getBoundingClientRect(), dy = toY - (r.top + r.height / 2);
    dissolve(row, delay);
    row.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${(dy * 0.9).toFixed(1)}px) scaleY(.15)`, opacity: 0 }],
      { duration: 360, delay, easing: "cubic-bezier(.55,0,.85,.3)", fill: "forwards" });
  }
  /** the text rewrites itself into another, left to right, through noise */
  function rewrite(span: HTMLElement, to: string, ms: number) {
    const from = span.textContent || "", start = performance.now();
    return new Promise<void>((res) => {
      const step = () => {
        const u = Math.min(1, (performance.now() - start) / ms), len = Math.round(from.length + (to.length - from.length) * u), fixed = Math.floor(to.length * u);
        let t = to.slice(0, fixed);
        for (let j = fixed; j < len; j++) t += to[j] === " " ? " " : noise();
        span.textContent = t;
        if (u < 1) requestAnimationFrame(step); else { span.textContent = to; res(); }
      };
      requestAnimationFrame(step);
    });
  }
  /** the box around an element's text, not around the element */
  const textBox = (n: Element) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
  /** moves `from` onto `to`: same left edge and top of the text and, with `grow`, scaled to the same width. the line
      only moves: it is the same size in both places, and it is still rewriting itself while it travels */
  function glide(from: HTMLElement, to: HTMLElement, ms: number, grow: boolean) {
    const a = textBox(from), b = textBox(to), box = from.getBoundingClientRect(), k = grow && a.width > 0 ? b.width / a.width : 1;
    from.style.transformOrigin = (a.left - box.left) + "px " + (a.top - box.top) + "px";
    from.style.transition = "transform " + ms + "ms " + GLIDE_EASE;
    from.style.transform = "translate(" + (b.left - a.left).toFixed(1) + "px," + (b.top - a.top).toFixed(1) + "px) scale(" + k.toFixed(4) + ")";
  }
  /** the dark opens from the name outwards, with a soft edge, and follows the name as it glides. drawn with a mask on the
      dark layer only, so the blurred colours stay over it while they fly out */
  function iris(from: DOMRect, to: DOMRect, ms: number) {
    const W = window.innerWidth, H = window.innerHeight, feather = Math.max(160, 0.32 * Math.min(W, H));
    const ax = from.left + from.width / 2, ay = from.top + from.height / 2, bx = to.left + to.width / 2, by = to.top + to.height / 2;
    const far = Math.hypot(Math.max(bx, W - bx), Math.max(by, H - by)) + 40, start = performance.now();
    if (!(window.CSS?.supports?.("mask-image", "radial-gradient(#000,transparent)") || window.CSS?.supports?.("-webkit-mask-image", "radial-gradient(#000,transparent)"))) {
      bg.style.transition = "opacity " + ms + "ms ease"; bg.style.opacity = "0"; return; // no masks here: the dark simply fades
    }
    const step = () => {
      const u = Math.min(1, (performance.now() - start) / ms), e = glideAt(u);
      const x = ax + (bx - ax) * e, y = ay + (by - ay) * e, r = -feather + (far + feather) * u * u * (3 - 2 * u); // eases open, and eases out past the corners
      const m = `radial-gradient(circle at ${x.toFixed(1)}px ${y.toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + feather).toFixed(1)}px)`;
      bg.style.maskImage = m; bg.style.webkitMaskImage = m;
      if (u < 1) requestAnimationFrame(step); else bg.style.opacity = "0";
    };
    requestAnimationFrame(step);
  }
  /** the six blurred colours fly to the places their pieces will hang in the first view, shrinking to the size of the
      piece and tightening as they go, and fade there as the piece itself arrives out of the fog. if the scene has not
      said where that is, they simply fly outwards */
  function fling(ms: number) {
    const W = window.innerWidth, H = window.innerHeight;
    blobs.forEach((b, i) => {
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, s = handoff.spots[i];
      const tx = s ? s.x : W / 2 + (x - W / 2) * 1.8, ty = s ? s.y : H / 2 + (y - H / 2) * 1.8;
      const size = Math.max(b.offsetWidth, b.offsetHeight, 1), k = s ? clamp(2.4 * s.r / size, 0.3, 1.6) : 0.6;
      const m = getComputedStyle(b).transform, M = m && m !== "none" ? m : ""; // where its drift had taken it: it leaves from there
      b.style.animation = "none"; b.style.transform = M;
      b.animate([{ transform: `translate(0px,0px) ${M} scale(1)` }, { transform: `translate(${(tx - x).toFixed(1)}px,${(ty - y).toFixed(1)}px) ${M} scale(${k.toFixed(3)})` }],
        { duration: ms, delay: i * 30, easing: "cubic-bezier(.45,0,.15,1)", fill: "forwards" });
    });
    blobWrap.animate([{ filter: "blur(56px)", opacity: 0.42 }, { filter: "blur(34px)", opacity: 0.6, offset: 0.45 }, { filter: "blur(18px)", opacity: 0 }],
      { duration: ms + 200, easing: "ease-in", fill: "forwards" });
  }

  async function enter(withSound: boolean) {
    if (gone) return;
    gone = true;
    onEnter(withSound); // sound starts at once, whatever happens next
    entrance(); // the chosen set's way in: one hit now, and air while the pieces come in. silent without sound
    el.classList.add("leaving");
    toTop(); // the glide lands on the first view, so that is where the page must be
    const heroName = document.getElementById("h-hero"), heroLine = document.querySelector<HTMLElement>(".panel.hero .eyebrow");
    if (calm || !heroName || !heroLine) { // no motion, or no first view to land on: a plain fade
      handoff.at = performance.now(); root.classList.remove("prehero"); el.classList.add("fade", "plain");
      await wait(700); finish(); return;
    }
    matchHeading(); // again, in case the window changed size since the page opened
    const nameBox = textBox(nameEl);
    /* 1. the log folds up into the name, the line starts rewriting itself */
    rows.forEach((r, i) => fold(r, nameBox.bottom, (rows.length - 1 - i) * 20));
    void rewrite(headText, HERO.eyebrow, 460);
    await wait(120);
    /* 2. all at once: the glide, the iris, the colours flying out to the pieces, and in the scene the pieces and the camera */
    const GLIDE = 1100;
    handoff.at = performance.now();
    el.classList.add("fade");
    iris(nameBox, textBox(heroName), 1250);
    fling(1300);
    glide(head, heroLine, GLIDE, false); glide(nameEl, heroName, GLIDE, true);
    await wait(GLIDE + 30);
    /* 3. the first view's own words take over where these landed, and the page can scroll */
    root.classList.remove("prehero", "loading");
    head.style.visibility = nameEl.style.visibility = "hidden";
    landing();
    await wait(560); // the last of the colours and the dark, then the loader is gone
    finish();
  }
  function finish() { root.classList.remove("loading"); el.style.display = "none"; }

  /* the three fonts */
  let fontsLeft = 3, fontsIn: () => void = () => {};
  const fonts = new Promise<void>((res) => { fontsIn = res; });
  ([['800 1em "Bricolage Grotesque"', "A", "Display font loaded"], ['500 1em "IBM Plex Mono"', "A", "Label font loaded"], ['900 1em "Noto Serif SC"', "软件设计机电组合方向我鲁班锁作品", "Chinese font loaded"]] as const).forEach((f) => {
    let fin = false;
    const end = () => { if (fin) return; fin = true; task(f[2]); if (--fontsLeft <= 0) fontsIn(); };
    if (document.fonts?.load) { try { document.fonts.load(f[0], f[1]).then(end, end); } catch { end(); } setTimeout(end, 4000); } else end();
  });

  $("withSound").addEventListener("click", () => void enter(true));
  $("noSound").addEventListener("click", () => void enter(false));
  /* the loader cannot be scrolled, and scrolling does not open the page: the only ways in are the two buttons.
     (the first one has keyboard focus as soon as it appears, so nobody is stuck here) */
  const hold = (e: Event) => { if (!gone) e.preventDefault(); };
  el.addEventListener("wheel", hold, { passive: false }); el.addEventListener("touchmove", hold, { passive: false });
  window.addEventListener("keydown", (e) => { if (!gone && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) e.preventDefault(); });

  return {
    task, fonts,
    /** no WebGL: drop the loader and show the plain page */
    fail() { gone = true; clearInterval(scramble); root.classList.add("nogl"); root.classList.remove("prehero"); finish(); },
  };
}
