/* Turns content.ts into HTML. Used twice: by the build (vite.config.ts), so the text is real HTML in the page
   even with no JavaScript or no WebGL, and by the browser for the project page. No DOM in here. */
import { PIECES, ME_SIDES, PROJECTS, CONTACT, SITE, LOADER, HERO, WORK, END, FORM, type PieceId, type Project } from "./content.ts";
import { ORDER, CH } from "./timeline.ts";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const two = (n: number) => String(n).padStart(2, "0");
const pieceIndex = (id: PieceId) => PIECES.findIndex((p) => p.id === id);
const cn = (s: string) => `<b lang="zh-Hans">${esc(s)}</b>`;

export function chips(w: Project) {
  return w.uses.map((id) => { const p = PIECES[pieceIndex(id)]; return `<i style="--c:${p.color}">${esc(p.short)}</i>`; }).join("");
}

/** one side of the Me piece, as words: for screen readers and the plain page */
const sideText = (s: (typeof ME_SIDES)[number]) => s.stats ? s.stats.map((x) => x[0] + " (" + x[1].toLowerCase() + ")").join(", ") : [s.big, s.small].filter(Boolean).join(". ");

/* each chapter: a huge title in two lines with the piece floating on the seam between them, and one short line under
   it. the title sits behind the 3D (the layer is under the canvas), so the piece crosses in front of the letters */
function panels() {
  let h = "";
  for (let c = 0; c < 6; c++) { // in the order you meet them, so the plain page reads in the same order as the 3D one
    const i = ORDER[c], p = PIECES[i], num = `${two(CH[i])} / 06`, me = p.id === "me";
    h += `<section class="panel chap${me ? " me" : ""}" data-k="p${i}" style="--c:${p.color}" aria-labelledby="h-${p.id}">`
      + `<h2 class="sr" id="h-${p.id}">${esc(p.name)}</h2>`
      + `<div class="t-up"><div class="eyebrow">${cn(p.cn)}<span>${num}</span><span class="st">${esc(p.role)}</span></div>`
      + `<div class="ttl" aria-hidden="true">${esc(p.title[0])}</div></div>`
      + `<div class="t-down"><div class="ttl c" aria-hidden="true">${esc(p.title[1])}</div>`
      + (p.desc ? `<p class="${me ? "turn" : "desc"}"${me ? ' aria-hidden="true"' : ""}>${esc(p.desc)}</p>` : "")
      + (p.tools ? `<p class="tools">${esc(p.tools)}</p>` : "")
      + (me ? `<dl class="me-all">${ME_SIDES.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(sideText(s))}</dd></div>`).join("")}</dl>` : "")
      + "</div></section>";
  }
  return h;
}

function rows() {
  return PROJECTS.map((w, n) =>
    `<li><button type="button" class="row" data-p="${n}" aria-haspopup="dialog">`
    + `<span class="n">${two(n + 1)} · ${esc(w.kind)}</span><span class="rname">${esc(w.name)}</span>`
    + `<span class="rtext"><span class="rdesc">${esc(w.desc)}</span><span class="chips">${chips(w)}</span></span>`
    + `<span class="more-b">Open<span aria-hidden="true"> →</span></span></button></li>`).join("");
}

/** the inside of the full-screen page for project n */
export function pageHtml(n: number) {
  const w = PROJECTS[n], next = PROJECTS[(n + 1) % PROJECTS.length], bare = w.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `<div class="phero" style="--b:${esc(w.brand)}">${w.picture ? `<img src="${esc(w.picture)}" alt="Picture of ${esc(w.name)}" decoding="async">` : "<span>Picture</span>"}</div>`
    + `<div class="pwrap"><div class="pmain"><h2 id="popT">${esc(w.name)}</h2><div class="pright"><p class="lead">${esc(w.desc)}</p>`
    + `<dl class="pmeta"><div><dt>Type</dt><dd>${esc(w.kind)}</dd></div><div><dt>Role</dt><dd>${esc(w.role)}</dd></div>`
    + `<div><dt>Built from</dt><dd><span class="chips">${chips(w)}</span></dd></div>`
    + `<div><dt>Link</dt><dd>${w.url ? `<a class="ptext" href="${esc(w.url)}" target="_blank" rel="noopener">${esc(bare)} ↗</a>` : '<span class="soon">Coming soon</span>'}</dd></div></dl>`
    + "</div></div>"
    + (w.video ? `<div class="pvideo"><video src="${esc(w.video)}" controls muted loop playsinline preload="metadata" aria-label="Preview video of ${esc(w.name)}"></video></div>` : "") // no video yet: no empty box
    + `<footer class="pend">${w.url ? `<a class="plink" href="${esc(w.url)}" target="_blank" rel="noopener">Visit ${esc(w.link)} →</a>` : ""}`
    + (PROJECTS.length > 1 ? `<button type="button" class="pnext" id="popNext2"><small>Next project</small><span>${esc(next.name)} →</span></button>` : "") + "</footer></div>";
}
/** "01 / 03" */
export const pageCount = (n: number) => `${two(n + 1)} / ${two(PROJECTS.length)}`;

function links() {
  const mail = CONTACT.email.trim(), gh = CONTACT.github.trim().replace(/^@/, ""), ig = CONTACT.instagram.trim().replace(/^@/, "");
  const a = (label: string, href: string) => href
    ? `<a href="${esc(href)}"${href.startsWith("mailto:") ? "" : ' target="_blank" rel="noopener me"'}>${label}</a>`
    : ""; // no address: no link
  return a("GitHub", gh ? `https://github.com/${gh}` : "") + a("Instagram", ig ? `https://www.instagram.com/${ig}/` : "") + a("Email", mail ? `mailto:${mail}` : "");
}

/* the loader's log has one row per thing the page gets ready (13: see the task() calls). loader.ts counts the rows */
const LOADER_ROWS = 13;
function loaderRows() {
  let h = "";
  for (let k = 0; k < LOADER_ROWS; k++) h += `<li${k ? "" : ' class="now"'}><span class="tg">${k ? "[&nbsp;&nbsp;&nbsp;&nbsp;]" : "[ .. ]"}</span><span class="tx"></span><span class="ld"></span><span class="tm"></span></li>`;
  return h;
}
/* behind the log: the six pieces as soft blurred colours, each lit when the site has built it */
const BLOBS: [string, string, string, string, string, string, string][] = [
  ["14%", "12%", "30%", "11%", "-14deg", "40px", "30px"], ["62%", "8%", "9%", "30%", "10deg", "-30px", "40px"], ["6%", "58%", "26%", "10%", "8deg", "50px", "-30px"],
  ["34%", "76%", "24%", "9%", "-6deg", "-40px", "-20px"], ["80%", "46%", "8%", "28%", "-10deg", "-30px", "30px"], ["58%", "64%", "32%", "12%", "6deg", "30px", "-40px"],
];
const loaderBlobs = () => PIECES.map((p, i) => { const b = BLOBS[i]; return `<i style="--c:${p.id === "me" ? "#f2cf7a" : p.color};left:${b[0]};top:${b[1]};width:${b[2]};height:${b[3]};--r:${b[4]};--dx:${b[5]};--dy:${b[6]}"></i>`; }).join("");

/** fills the {{tokens}} in index.html */
export function renderHtml(html: string) {
  const map: Record<string, string> = {
    title: esc(SITE.title), description: esc(SITE.description), url: SITE.url, handle: esc(SITE.handle), name: esc(SITE.name),
    "loader.cn": cn(LOADER.cn), "loader.eyebrow": esc(LOADER.eyebrow), "loader.version": esc(LOADER.version), "loader.denied": esc(LOADER.denied), "loader.total": String(LOADER_ROWS),
    "loader.withSound": esc(LOADER.withSound), "loader.noSound": esc(LOADER.noSound), "loader.note": esc(LOADER.note), "loader.rows": loaderRows(), "loader.blobs": loaderBlobs(),    "hero.cn": cn(HERO.cn), "hero.eyebrow": esc(HERO.eyebrow), "hero.heading": esc(HERO.heading), "hero.lead": esc(HERO.lead),
    panels: panels(),
    "work.cn": cn(WORK.cn), "work.eyebrow": esc(WORK.eyebrow), "work.count": String(PROJECTS.length), "work.heading": esc(WORK.heading), "work.lead": esc(WORK.lead), "work.more": esc(WORK.more),
    rows: rows(),
    "end.cn": cn(END.cn), "end.eyebrow": esc(END.eyebrow), "end.big": END.big.map((s, k) => `<span${k ? ' class="r"' : ""}>${esc(s)}</span>`).join(""), "end.label": esc(END.big.join(" ").toLowerCase().replace(/^./, (ch) => ch.toUpperCase())),
    "end.lead": esc(END.lead), links: links(),
    "form.back": esc(FORM.back), "form.open": esc(FORM.open),
    "form.reasons": FORM.reasons.map((r) => `<option>${esc(r)}</option>`).join(""),
  };
  return html.replace(/\{\{([\w.]+)\}\}/g, (m, k: string) => (k in map ? map[k] : m));
}
