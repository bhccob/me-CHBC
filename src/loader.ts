/* A real loader. It counts the things this page actually has to get ready: the 3D engine, three fonts, six pieces,
   the slips and glow, the space around them, and the first drawn frame. The number is the share of those that are done,
   and the line under it says which one just finished. At 100% it offers the two ways in, and nothing else opens the page. */
import { $ } from "./util";

const TOTAL = 13;

export function createLoader(onEnter: (withSound: boolean) => void) {
  const root = document.documentElement, el = $("loader"), pct = $("lpct"), line = $("lline"), status = $("lstatus");
  let done = 0, shown = 0, ready = false, gone = false;

  function task(label: string) { done = Math.min(TOTAL, done + 1); if (label && !ready) status.textContent = label; }
  function isReady() {
    if (ready || gone) return;
    ready = true; pct.textContent = "100"; line.style.transform = "scaleX(1)"; el.classList.add("ready");
    try { $("withSound").focus(); } catch { /* focus is a nicety */ }
  }
  function leave() {
    if (gone) return;
    gone = true; root.classList.remove("loading"); el.classList.add("done");
    setTimeout(() => { el.style.display = "none"; }, 1200);
  }
  const tick = setInterval(() => {
    const want = Math.round(done / TOTAL * 100);
    if (shown < want) { shown = Math.min(want, shown + Math.max(1, Math.round((want - shown) * 0.25))); pct.textContent = String(shown); line.style.transform = "scaleX(" + shown / 100 + ")"; }
    if ((done >= TOTAL && shown >= 100) || gone) { clearInterval(tick); setTimeout(isReady, 250); }
  }, 40);
  setTimeout(isReady, 9000); // never leave the page stuck on loading

  /* the three fonts */
  let fontsLeft = 3, fontsIn: () => void = () => {};
  const fonts = new Promise<void>((res) => { fontsIn = res; });
  ([['800 1em "Bricolage Grotesque"', "A", "Display font loaded"], ['500 1em "IBM Plex Mono"', "A", "Label font loaded"], ['900 1em "Noto Serif SC"', "软件开发机电实习方向我鲁班锁作品合", "Chinese font loaded"]] as const).forEach((f) => {
    let fin = false;
    const end = () => { if (fin) return; fin = true; task(f[2]); if (--fontsLeft <= 0) fontsIn(); };
    if (document.fonts?.load) { try { document.fonts.load(f[0], f[1]).then(end, end); } catch { end(); } setTimeout(end, 4000); } else end();
  });

  /* the ways in */
  const enter = (withSound: boolean) => { leave(); onEnter(withSound); }; // the page opens whatever happens next
  $("withSound").addEventListener("click", () => enter(true));
  $("noSound").addEventListener("click", () => enter(false));
  /* the loader cannot be scrolled, and scrolling does not open the page: the only ways in are the two buttons.
     (the first button has keyboard focus as soon as it appears, so nobody is stuck here) */
  const hold = (e: Event) => { if (!gone) e.preventDefault(); };
  el.addEventListener("wheel", hold, { passive: false }); el.addEventListener("touchmove", hold, { passive: false });
  window.addEventListener("keydown", (e) => { if (!gone && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) e.preventDefault(); });

  return {
    task, fonts,
    /** no WebGL: drop the loader and show the plain page */
    fail() { root.classList.add("nogl"); leave(); },
  };
}
