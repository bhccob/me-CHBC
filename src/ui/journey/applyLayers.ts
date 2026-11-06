import type { Layer } from '~/journey/layers';

/** Writes a layer to its element: how much of it shows and where, and out of reach and of sight at nothing. */
export function applyLayer(el: HTMLElement | null, layer: Layer): void {
  if (!el) return;
  el.style.opacity = layer.opacity.toFixed(3);
  el.style.visibility = layer.opacity > 0.002 ? 'visible' : 'hidden';
  if (layer.y !== undefined) el.style.translate = `0 ${layer.y.toFixed(1)}px`;
}
