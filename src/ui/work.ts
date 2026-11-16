/* selected work: the rows are already in the page (written at build time). a row opens a full-screen page about its
   project, over the site. the page can step to the next project, and the browser's Back button closes it */
import { pageHtml, pageCount } from "../markup";
import { PROJECTS } from "../content";
import { $ } from "../util";

export function initWork() {
  const rows = $("rows"), pop = $("pop"), body = $("popBody"), backB = $("popX"), nextB = $("popNext"), count = $("popN"), root = document.documentElement;
  let opener: HTMLElement | null = null, hideT = 0, cur = 0, open = false, inHistory = false;
  nextB.hidden = PROJECTS.length < 2;

  function fill(n: number) {
    cur = n;
    body.innerHTML = pageHtml(n);
    count.textContent = pageCount(n);
    pop.scrollTop = 0;
  }
  function show(n: number) {
    fill(n);
    if (open) return;
    open = true;
    clearTimeout(hideT);
    pop.hidden = false; root.classList.add("popopen");
    requestAnimationFrame(() => pop.classList.add("on"));
    backB.focus();
  }
  function hide() {
    if (!open) return;
    open = false;
    pop.classList.remove("on"); root.classList.remove("popopen");
    hideT = window.setTimeout(() => { pop.hidden = true; body.innerHTML = ""; }, 500); // emptied, so a video stops playing
    opener?.focus?.();
  }
  /* opening adds one step to the browser's history, so its Back button (or a phone's back swipe) closes the page
     instead of leaving the site */
  function openPage(n: number) {
    opener = document.activeElement as HTMLElement | null;
    show(n);
    try { history.pushState({ lockProject: n }, ""); inHistory = true; } catch { inHistory = false; }
  }
  function closePage() {
    if (!open) return;
    if (inHistory) history.back(); else hide(); // going back fires "popstate" below, which hides the page
  }
  function nextPage() {
    const focusInBody = body.contains(document.activeElement);
    fill((cur + 1) % PROJECTS.length);
    if (inHistory) { try { history.replaceState({ lockProject: cur }, ""); } catch { /* history is a nicety */ } }
    if (focusInBody) nextB.focus(); // the button that was pressed has just been replaced
  }
  window.addEventListener("popstate", (e) => {
    const n = (e.state as { lockProject?: number } | null)?.lockProject;
    if (typeof n === "number" && PROJECTS[n]) { inHistory = true; show(n); } // Forward again: back into the project
    else { inHistory = false; hide(); }
  });

  rows.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-p]");
    if (b) openPage(parseInt(b.dataset.p || "0", 10));
  });
  backB.addEventListener("click", closePage);
  nextB.addEventListener("click", nextPage);
  body.addEventListener("click", (e) => { if ((e.target as Element).closest("#popNext2")) nextPage(); });
  window.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { closePage(); return; }
    if (e.key !== "Tab") return;
    /* Tab stays inside the page */
    const stops = Array.from(pop.querySelectorAll<HTMLElement>("button,a[href],video[controls]")).filter((el) => !el.hidden);
    const at = stops.indexOf(document.activeElement as HTMLElement);
    if (at < 0 || (e.shiftKey && at === 0) || (!e.shiftKey && at === stops.length - 1)) { e.preventDefault(); stops[e.shiftKey ? stops.length - 1 : 0].focus(); }
  });
}
