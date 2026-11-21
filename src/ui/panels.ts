/* the 2D text layer over the 3D: chapter panels, the menu line, the progress bar */
import { $ } from "../util";

export function createPanels() {
  const panels: Record<string, HTMLElement> = {};
  document.querySelectorAll<HTMLElement>(".panel").forEach((el) => { panels[el.dataset.k || ""] = el; });
  const scrim = $("scrim"), grid = $("grid"), bar = $("bar"), chap = $("chap"), callout = $("callout"), hint = $("hint");
  const last: Record<string, string> = {};
  /* styles are only written when they change, so a still page costs nothing */
  const put = (key: string, el: HTMLElement, prop: "opacity" | "transform", v: string) => { if (last[key] !== v) { last[key] = v; el.style[prop] = v; } };
  return {
    /** a panel fades and rises in. it is never taken out of the page, so screen readers can always read it.
        `sc` scales it about the screen centre (the seam a block sits on), and `journey` (0..1) trades the rise for that
        depth while the camera flies from block to block */
    show(k: string, v: number, sc = 1, journey = 0) {
      const el = panels[k]; if (!el) return;
      if (v < 0.004) { put(k + "o", el, "opacity", "0"); return; }
      put(k + "o", el, "opacity", v.toFixed(3));
      put(k + "t", el, "transform", "translateY(" + ((1 - v) * 26 * (1 - journey)).toFixed(1) + "px)" + (sc !== 1 ? " scale(" + sc.toFixed(4) + ")" : ""));
    },
    hint: (v: number) => put("hint", hint, "opacity", v.toFixed(3)),
    grid: (v: number) => put("grid", grid, "opacity", v.toFixed(3)),
    scrim: (v: number) => put("scrim", scrim, "opacity", v.toFixed(3)),
    bar: (v: number) => put("bar", bar, "transform", "scaleX(" + v.toFixed(4) + ")"),
    callout: (v: number) => put("callout", callout, "opacity", v.toFixed(3)),
    calloutText(s: string) { if (last.ct !== s) { last.ct = s; callout.textContent = s; } },
    chap(s: string) { if (last.ch !== s) { last.ch = s; chap.textContent = s; } },
  };
}
