import type { Layer, SheetLayer } from '~/journey/layers';

/** Writes a layer to its element: how much of it shows and where, and out of reach and of sight at nothing. */
export function applyLayer(el: HTMLElement | null, layer: Layer): void {
  if (!el) return;
  el.style.opacity = layer.opacity.toFixed(3);
  el.style.visibility = layer.opacity > 0.002 ? 'visible' : 'hidden';
  if (layer.y !== undefined) el.style.translate = `0 ${layer.y.toFixed(1)}px`;
}

/**
 * Writes a sheet to its element, and the same to its giant word over the machine (`word`), which `clip` cuts where the
 * next sheet has slid over it.
 */
export function applySheet(el: HTMLElement | null, sheet: SheetLayer, word: HTMLElement | null = null, clip = 'none'): void {
  for (const target of [el, word]) {
    if (!target) continue;
    target.style.visibility = sheet.on ? 'visible' : 'hidden';
    if (!sheet.on) continue;
    target.style.transform = `translateY(${sheet.y.toFixed(2)}vh) rotate(${sheet.tilt.toFixed(3)}deg)`;
    target.style.opacity = sheet.opacity.toFixed(3);
    const inner = target.firstElementChild as HTMLElement | null;
    if (inner) inner.style.opacity = sheet.inner.toFixed(3);
  }
  if (word && sheet.on) word.style.clipPath = clip;
}

/**
 * How a sheet's word over the machine is cut while `next` slides over the sheet, as a clip-path in the box both share:
 * what lies above the next sheet's top edge shows. That edge goes down `y` vh and turns `tilt` about its middle, 53vw
 * from either side of the 106vw box (journey.css `.j-sheet`). In CSS units, so it holds wherever vh and the window differ.
 */
export function wordClip(next: SheetLayer | undefined): string {
  if (!next?.on) return 'none';
  const rise = (53 * Math.tan((next.tilt * Math.PI) / 180)).toFixed(3);
  const y = next.y.toFixed(2);
  return `polygon(0 0, 100% 0, 100% calc(${y}vh + ${rise}vw), 0 calc(${y}vh - ${rise}vw))`;
}
