import type { Layer, SheetLayer } from '~/journey/layers';

/** Writes a layer to its element: how much of it shows and where, and out of reach and of sight at nothing. */
export function applyLayer(el: HTMLElement | null, layer: Layer): void {
  if (!el) return;
  el.style.opacity = layer.opacity.toFixed(3);
  el.style.visibility = layer.opacity > 0.002 ? 'visible' : 'hidden';
  if (layer.y !== undefined) el.style.translate = `0 ${layer.y.toFixed(1)}px`;
}

/** Writes a sheet to its element. */
export function applySheet(el: HTMLElement | null, sheet: SheetLayer): void {
  if (!el) return;
  el.style.visibility = sheet.on ? 'visible' : 'hidden';
  if (!sheet.on) return;
  el.style.transform = `translateY(${sheet.y.toFixed(2)}vh) rotate(${sheet.tilt.toFixed(3)}deg)`;
  el.style.opacity = sheet.opacity.toFixed(3);
  const inner = el.firstElementChild as HTMLElement | null;
  if (inner) inner.style.opacity = sheet.inner.toFixed(3);
}
