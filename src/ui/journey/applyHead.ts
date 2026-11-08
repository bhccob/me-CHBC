import type { Dictionary } from '~/i18n/en';
import type { Locale } from '~/i18n/Translator';
import type { Box } from '~/journey/layers';
import { pressureAt } from '~/journey/head/cues';
import { cardEntry, frameOpacity, glowOpacity, headingOpacity, hudOpacity, labelOpacity, layoutLabels, mapOpacity, readingAt, readoutOpacity, rulerOpacity, shadeOpacity, sliceNumber, statusWords } from '~/journey/head/hud';
import { readoutAt } from '~/journey/head/readout';
import { headOutline, OUTLINE_BOX } from '~/journey/head/shape';
import { answerShown, dwellWeights, NQ, THOUGHTS } from '~/journey/head/thoughts';
import { clamp } from '~/journey/math';
import type { HeadAnchors } from '~/journey/world/head/HeadScene';

/**
 * The scanner's frame and the six answers, placed and filled each frame from the head's `t` and where the 3D says its parts
 * stand (spec 2026-11-08 "Into my head", sections 5.2 to 5.7 and 6). Only what changed is written to the page.
 */

export interface HeadWords {
  head: Dictionary['journey']['head'];
  locale: Locale;
}

export interface HeadEls {
  root: HTMLElement;
  glow: HTMLElement;
  shade: HTMLElement;
  intro: HTMLElement;
  readout: HTMLElement;
  status: HTMLElement;
  region: HTMLElement;
  doing: HTMLElement;
  meter: HTMLElement;
  ruler: HTMLElement;
  rulerMark: HTMLElement;
  rulerText: HTMLElement;
  map: HTMLElement;
  mapCanvas: HTMLCanvasElement;
  corners: HTMLElement[];
  labels: HTMLElement[];
  leads: SVGPathElement[];
  dots: SVGCircleElement[];
  cards: HTMLElement[];
  /** Sizes as last measured, and the side map's outline, drawn once. */
  memo: { labels: [number, number][] | null; cards: number[] | null; ruler: [number, number] | null; words: HeadWords['head'] | null; mapBase: HTMLCanvasElement | null };
}

/** The frame's and the answers' elements, or none if the page has no head part. */
export function headEls(doc: Document = document): HeadEls | null {
  const root = doc.getElementById('j-hud');
  const answers = doc.getElementById('j-qa');
  if (!root || !answers) return null;
  const one = <T extends Element>(selector: string): T => root.querySelector<T>(selector)!;
  const all = <T extends Element>(selector: string, from: ParentNode = root): T[] => Array.from(from.querySelectorAll<T>(selector));
  return {
    root,
    glow: one('.j-hud-glow'),
    shade: one('.j-hud-shade'),
    intro: one('.j-hud-intro'),
    readout: one('.j-hud-readout'),
    status: one('.j-hud-status'),
    region: one('.j-hud-region'),
    doing: one('.j-hud-doing'),
    meter: one('.j-hud-meter i'),
    ruler: one('.j-hud-ruler'),
    rulerMark: one('.j-hud-ruler i'),
    rulerText: one('.j-hud-ruler span'),
    map: one('.j-hud-map'),
    mapCanvas: one('.j-hud-map canvas'),
    corners: all('.j-hud-corner'),
    labels: all('.j-hud-label'),
    leads: all('.j-hud-leads path'),
    dots: all('.j-hud-leads circle'),
    cards: all('.j-answer', answers),
    memo: { labels: null, cards: null, ruler: null, words: null, mapBase: null },
  };
}

/** The page's size changed: what was measured is measured again. */
export function forgetHeadSizes(els: HeadEls): void {
  els.memo.labels = null;
  els.memo.cards = null;
  els.memo.ruler = null;
}

const written = new WeakMap<Element, Map<string, string>>();

/** Writes a style only when it changed: most of these stand still most frames. */
function put(el: Element, property: string, value: string): void {
  let seen = written.get(el);
  if (!seen) written.set(el, (seen = new Map()));
  if (seen.get(property) === value) return;
  seen.set(property, value);
  (el as HTMLElement).style.setProperty(property, value);
}

function attr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function text(el: Element, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

const fade = (el: Element, opacity: number): void => put(el, 'opacity', opacity < 0.002 ? '0' : opacity.toFixed(3));

/** Where a phone's answer stands: its middle in the shade's dark band, below the thought it answers. */
const PHONE_CARD_Y = 0.56;

/**
 * Places and fills the frame and the answers for the head's `t`; `anchors` is null when the 3D does not say where. Answers
 * the boxes of the labels that show, so the page can keep the chapter rail clear of them.
 */
export function applyHead(els: HeadEls, t: number, anchors: HeadAnchors | null, words: HeadWords, phone: boolean): Box[] {
  const shownLabels: Box[] = [];
  const { memo } = els;
  if (memo.words !== words.head) {
    // Other words, other sizes.
    forgetHeadSizes(els);
    memo.words = words.head;
  }
  const on = t > 0;
  put(els.root, 'visibility', on ? 'visible' : 'hidden');
  fade(els.glow, glowOpacity(t));
  if (!on) {
    for (const card of els.cards) fade(card, 0);
    return shownLabels;
  }
  const width = innerWidth, height = innerHeight;
  const hud = hudOpacity(t);
  const reading = readingAt(t);
  fade(els.shade, shadeOpacity(t));
  fade(els.intro, headingOpacity(t));

  // The read-out: what the scanner is doing, in words.
  const shown = anchors ? readoutOpacity(t, reading) : 0;
  fade(els.readout, shown);
  if (shown > 0) {
    const weights = dwellWeights(t);
    const readout = readoutAt(t, weights, pressureAt(t), anchors?.act ?? []);
    text(els.status, statusWords(readout, words.head.status, words.locale));
    text(els.region, readout.region ? words.head.regions[readout.region] : '—');
    text(els.doing, readout.doing ? words.head.doings[readout.doing] : '—');
    put(els.meter, 'transform', `scaleX(${clamp(readout.meter).toFixed(3)})`);
  }

  // The corners round the head while it is seen whole.
  const framed = anchors ? frameOpacity(t) : 0;
  for (const corner of els.corners) fade(corner, framed);
  if (anchors && framed > 0.002) {
    const box = anchors.headBox;
    const x0 = clamp(box.left - 30, 16, width - 60), x1 = clamp(box.right + 30, 60, width - 16);
    const y0 = clamp(box.top - 26, 50, height - 60), y1 = clamp(box.bottom + 26, 80, height - 16);
    [[x0, y0], [x1 - 22, y0], [x0, y1 - 22], [x1 - 22, y1 - 22]].forEach(([x, y], i) => put(els.corners[i], 'transform', `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`));
  }

  // The ruler, and the slice the scan is at, where it crosses the ruler.
  const ruled = anchors && !phone ? rulerOpacity(t) : 0;
  fade(els.ruler, ruled);
  if (anchors && ruled > 0.002) {
    if (!memo.ruler) {
      const r = els.ruler.getBoundingClientRect();
      memo.ruler = [r.top, r.bottom];
    }
    const [top, bottom] = memo.ruler;
    const y = anchors.scan.y;
    const across = anchors.scan.on > 0.05 && y > top && y < bottom;
    const at = `translateY(${(y - top).toFixed(1)}px)`;
    put(els.rulerMark, 'transform', at);
    put(els.rulerText, 'transform', `${at} translateY(-50%)`);
    // The slice gives way to the heading, which stands over the ruler's side while things pour in.
    const mark = across ? Math.min(1, anchors.scan.on * 1.5) * (1 - headingOpacity(t)) : 0;
    fade(els.rulerMark, mark);
    fade(els.rulerText, mark);
    text(els.rulerText, words.head.ruler.replace('{n}', String(sliceNumber(anchors.scan.head))));
  }

  // The six labels, beside the head, each with its leader to its region.
  const alphas = THOUGHTS.slice(0, NQ).map((_, k) => (anchors ? hud * labelOpacity(t, k) : 0));
  if (anchors && alphas.some((a) => a > 0.002)) {
    memo.labels ??= els.labels.map((label) => [label.offsetWidth, label.offsetHeight]);
    const sizes = memo.labels;
    const places = layoutLabels(anchors.labels, anchors.headBox, width, sizes.map(([, h]) => h), sizes.map(([w]) => w));
    places.forEach((place, k) => {
      const label = els.labels[k], [w] = sizes[k], [px, py] = anchors.labels[k];
      label.classList.toggle('left', place.side < 0);
      put(label, 'transform', `translate3d(${place.x.toFixed(1)}px, ${place.top.toFixed(1)}px, 0)`);
      const ex = place.side < 0 ? place.x + w + 8 : place.x - 8;
      attr(els.leads[k], 'd', `M${ex.toFixed(1)} ${place.y.toFixed(1)} L${(place.side < 0 ? ex + 24 : ex - 24).toFixed(1)} ${place.y.toFixed(1)} L${px.toFixed(1)} ${py.toFixed(1)}`);
      attr(els.dots[k], 'cx', px.toFixed(1));
      attr(els.dots[k], 'cy', py.toFixed(1));
      for (const el of [label, els.leads[k], els.dots[k]]) fade(el, alphas[k]);
      if (alphas[k] > 0.1) shownLabels.push({ left: place.x, top: place.top, right: place.x + w, bottom: place.top + sizes[k][1] });
    });
  } else for (const el of [...els.labels, ...els.leads, ...els.dots]) fade(el, 0);

  // The side map, once you are inside.
  const mapped = anchors ? mapOpacity(t, reading) : 0;
  fade(els.map, mapped);
  if (anchors && mapped > 0.002) drawMap(els, anchors, t);

  // The answers: one at a time, beside its thought, coming into focus.
  memo.cards ??= els.cards.map((card) => card.offsetHeight);
  els.cards.forEach((card, i) => {
    const a = anchors && anchors.cardsInFront[i] ? answerShown(t, i) : 0;
    fade(card, a);
    if (!anchors || a <= 0.002) return;
    const [x, y] = anchors.cards[i];
    const middle = phone ? height * PHONE_CARD_Y : y;
    const { scale, blur } = cardEntry(a);
    put(card, 'transform', `translate3d(${x.toFixed(1)}px, ${(middle - memo.cards![i] / 2).toFixed(1)}px, 0) scale(${scale.toFixed(4)})`);
    put(card, 'filter', blur > 0 ? `blur(${blur.toFixed(2)}px)` : 'none');
  });
  return shownLabels;
}

/** The side view: his profile and brain drawn once, then the six thoughts, the one you are at, and you (mock `drawMini`). */
function drawMap(els: HeadEls, anchors: HeadAnchors, t: number): void {
  const canvas = els.mapCanvas, ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const { z0, z1, y0, y1 } = OUTLINE_BOX;
  const sc = Math.min(W / (z1 - z0), H / (y1 - y0)) * 0.92;
  const ox = W / 2 - ((z0 + z1) / 2) * sc, oy = H / 2 + ((y0 + y1) / 2) * sc;
  if (!els.memo.mapBase) {
    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    const x = base.getContext('2d');
    if (!x) return;
    x.strokeStyle = 'rgba(242,239,232,0.06)';
    x.lineWidth = 1;
    x.beginPath();
    for (let g = -1; g <= 1.001; g += 0.25) {
      x.moveTo(ox + g * sc, 0);
      x.lineTo(ox + g * sc, H);
      x.moveTo(0, oy - g * sc);
      x.lineTo(W, oy - g * sc);
    }
    x.stroke();
    const { head, brain } = headOutline();
    for (const [segs, style, lineWidth] of [[head, 'rgba(242,239,232,0.62)', 2], [brain, 'rgba(230,184,74,0.6)', 1.6]] as const) {
      x.strokeStyle = style;
      x.lineWidth = lineWidth;
      x.beginPath();
      for (const [a, b] of segs) {
        x.moveTo(ox + a[0] * sc, oy - a[1] * sc);
        x.lineTo(ox + b[0] * sc, oy - b[1] * sc);
      }
      x.stroke();
    }
    els.memo.mapBase = base;
  }
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(els.memo.mapBase, 0, 0);
  const weights = dwellWeights(t);
  let active = -1, most = 0;
  weights.forEach((w, k) => {
    if (w > most) [active, most] = [k, w];
  });
  if (most <= 0.2) active = -1;
  THOUGHTS.forEach((thought, k) => {
    const lit = k === active;
    ctx.fillStyle = lit ? '#ffd27a' : 'rgba(230,184,74,0.55)';
    ctx.beginPath();
    ctx.arc(ox + thought.c[2] * sc, oy - thought.c[1] * sc, lit ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  const [cz, cy] = anchors.you, [dz, dy] = anchors.youDir;
  const px = clamp(ox + cz * sc, 10, W - 10), py = clamp(oy - cy * sc, 10, H - 10);
  ctx.strokeStyle = '#fff1d0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + dz * 22, py - dy * 22);
  ctx.stroke();
  ctx.fillStyle = '#fff1d0';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
}
