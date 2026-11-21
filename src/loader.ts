/* The loader: a boot log, with no box around it. It counts the things this page really has to get ready (the 3D engine,
   three fonts, six pieces, their sides and glow, the space around them, the first drawn frame), prints each one as it
   finishes, and cracks the name a letter at a time, never left to right. At 13 of 13: "Access granted", and the two
   ways in. Nothing else opens the page.

   Entering is one continuous move into the first view, with no cut:
   1. the log dissolves into noise, bottom row first, and the line above the name rewrites itself into the first view's
      line ("Six pieces. Not yet a lock.");
   2. that line and the name glide to exactly where the first view has them, the name growing to its size, while the
      dark behind them fades and the six pieces come in out of the fog (stage.ts, from `handoff.at`);
   3. the first view's own line and name take over in the same spot, and its sentence and the menu fade in. */
import { $ } from "./util";
import { HERO, LOADER } from "./content";
import { handoff } from "./handoff";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz0123456789#%&$@*+=?";
const noise = () => GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createLoader(onEnter: (withSound: boolean) => void) {
  const root = document.documentElement, el = $("loader"), nameEl = $("lname"), head = $("lhead"), state = $("lstate"), count = $("lcount");
  const headText = head.querySelector("span")!;
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
    if (ch === " ") { c.className = "sp"; c.textContent = " "; } else c.textContent = calm ? ch : noise();
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
  /** moves `from` onto `to`: same left edge and top of the text, scaled to the same width */
  function glide(from: HTMLElement, to: HTMLElement, ms: number) {
    const text = (n: Element) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect(); };
    const a = text(from), b = text(to), box = from.getBoundingClientRect(), k = a.width > 0 ? b.width / a.width : 1;
    from.style.transformOrigin = (a.left - box.left) + "px " + (a.top - box.top) + "px";
    from.style.transition = "transform " + ms + "ms cubic-bezier(.65,0,.2,1)";
    from.style.transform = "translate(" + (b.left - a.left).toFixed(1) + "px," + (b.top - a.top).toFixed(1) + "px) scale(" + k.toFixed(4) + ")";
  }

  async function enter(withSound: boolean) {
    if (gone) return;
    gone = true;
    onEnter(withSound); // sound starts at once, whatever happens next
    el.classList.add("leaving");
    toTop(); // the glide lands on the first view, so that is where the page must be
    const heroName = document.getElementById("h-hero"), heroLine = document.querySelector<HTMLElement>(".panel.hero .eyebrow");
    if (calm || !heroName || !heroLine) { // no motion, or no first view to land on: a plain fade
      handoff.at = performance.now(); root.classList.remove("prehero"); el.classList.add("fade", "plain");
      await wait(700); finish(); return;
    }
    /* 1. the log dissolves, the line rewrites itself */
    rows.forEach((r, i) => dissolve(r, (rows.length - 1 - i) * 22));
    await rewrite(headText, HERO.eyebrow, 420);
    /* 2. the glide, while the dark lifts and the pieces come in */
    handoff.at = performance.now();
    el.classList.add("fade");
    matchHeading(); // again, in case the window changed size since the page opened
    glide(head, heroLine, 1050); glide(nameEl, heroName, 1050);
    await wait(1080);
    /* 3. the first view's own words take over where these landed */
    root.classList.remove("prehero");
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
