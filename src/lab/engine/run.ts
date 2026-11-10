import { gsap } from 'gsap';
import { WebGLRenderer } from 'three';
import { endClock, type EndClock, headT } from '~/journey/head/time';
import { MAX_DT } from '~/journey/loop';
import { band, clamp } from '~/journey/math';
import { frameFromScroll, scrollFromFrame, type Timeline } from '~/journey/timeline';
import { canvasOpaque } from '~/journey/world/portalWindow';
import { COPY, loaderReading } from '../copy';
import type { BuildContext, ConceptId, Look, World } from '../concepts/types';
import { heroIntro, splitWords, wordsTimeline } from './dom';
import { Stage } from './stage';

/**
 * LAB ONLY (throwaway). Runs one preview: the loader's real percent, the world, the scrubbed timeline, the one loop, and
 * the tunnel and head loading behind the opening. Answers how to stop it.
 */

const CONCEPTS: Record<ConceptId, () => Promise<{ build(ctx: BuildContext): Promise<World> }>> = {
  a: () => import('../concepts/a-chain'),
  b: () => import('../concepts/b-assembly'),
  c: () => import('../concepts/c-blueprint'),
  d: () => import('../concepts/d-scan'),
  e: () => import('../concepts/e-mechanism'),
};

/**
 * Less motion: which still the opening shows for `target`, and how visible the picture is (it fades out and back in
 * where one still gives way to the next). From the seam on, the frames are the site's own.
 */
export function stillAt(target: number, stills: readonly number[]): [number, number] {
  const end = stills[stills.length - 1];
  if (target >= end) return [target, 1];
  let i = 0;
  while (i < stills.length - 2 && target > stills[i + 1]) i++;
  const a = stills[i], b = stills[i + 1];
  const k = clamp((target - a) / (b - a));
  return [k < 0.5 ? a : b, 1 - band(k, 0.3, 0.48, 0.52, 0.7)];
}

export interface RunOptions {
  root: HTMLElement;
  id: ConceptId;
  timeline: Timeline;
  reduce: boolean;
  /** How long the shown frame takes to ease toward the scroll, seconds: the scroll's weight. */
  smooth: number;
  pixelRatio: number;
  /** Aborted when the page leaves (or React's dev mode mounts it twice): the run stops where it is and cleans up. */
  signal: AbortSignal;
}

/** What the page can ask of a running preview (the proof harness reads it as window.__lab). */
export interface LabHandle {
  frame(): number;
  ready(): boolean;
  frameTimes(): number[];
  scrollFor(f: number): number;
}

export async function run(o: RunOptions): Promise<() => void> {
  const { root, id, timeline, reduce } = o;
  const copy = COPY[id];
  const loader = root.querySelector<HTMLElement>('.lab-loader');
  const value = loader?.querySelector('.lab-loader-value');
  const label = loader?.querySelector('.lab-loader-label');
  let shown = 0; // the loader's number, eased toward `share`
  let share = 0;
  const showLoader = (): void => {
    if (!loader) return;
    loader.style.setProperty('--p', shown.toFixed(4));
    const r = loaderReading(copy.loader, shown);
    if (value) value.textContent = `${r.value} ${r.unit}`;
    if (label) label.textContent = r.label;
  };
  let loaderRaf = 0;
  let lastLoader = performance.now();
  const loaderTick = (now: number): void => {
    const dt = Math.min(0.1, (now - lastLoader) / 1000);
    lastLoader = now;
    shown = Math.min(share, shown + Math.max(0.004, (share - shown) * (1 - Math.exp(-dt / 0.18))));
    showLoader();
    loaderRaf = requestAnimationFrame(loaderTick);
  };
  loaderRaf = requestAnimationFrame(loaderTick);

  const marks: [string, number][] = [];
  const mark = (what: string): void => void marks.push([what, Math.round(performance.now())]);
  const aborted = (): boolean => o.signal.aborted;
  const quit = (): (() => void) => {
    cancelAnimationFrame(loaderRaf);
    return () => {};
  };

  // Fonts: the canvas words and the split lines both need them.
  await Promise.all(['800 100px Barlow', '500 20px "IBM Plex Mono"', '500 20px Barlow'].map((font) => document.fonts.load(font)));
  mark('fonts');
  if (aborted()) return quit();
  share = 0.2;
  const module = await CONCEPTS[id]();
  mark('code');
  if (aborted()) return quit();

  const canvas = document.createElement('canvas');
  canvas.className = 'lab-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.prepend(canvas);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, stencil: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(o.pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);

  const world = await module.build({ renderer, reduce, root });
  mark('world');
  const stage = new Stage(renderer, world, timeline, reduce);
  stage.resize(innerWidth, innerHeight);
  const dropAll = (): void => {
    world.dispose();
    stage.dispose();
    renderer.dispose();
    canvas.remove();
  };
  if (aborted()) {
    dropAll();
    return quit();
  }
  share = 0.45;

  const splits = splitWords(root);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  world.timeline(tl);
  wordsTimeline(tl, root, world.beats, splits, reduce);
  tl.seek(0);

  await stage.warm();
  mark('warm');
  if (aborted()) {
    tl.kill();
    splits.revert();
    dropAll();
    return quit();
  }
  share = 0.85;
  const clock: EndClock = { at: null };
  const lamp = { k: 0 };
  let f = 0;
  let target = 0;
  let last = 0;
  let first = true;
  const frames: number[] = [];
  const readout = root.querySelector('.lab-readout');
  let readoutText = '';

  // The hero's entrance runs on time; once the scroll leaves the hero it is finished at once, so the two never both move the name.
  let intro: gsap.core.Timeline | null = null;
  const draw = (now: number, dt: number): void => {
    const tHead = endClock(clock, headT(f, timeline), now / 1000, false);
    let look: Look = { focus: 5, blur: 0, grain: 0, vignette: 0, flash: 0, light: 1 };
    if (intro && intro.progress() < 1 && f > world.beats.heroOut[0] - 2) intro.progress(1);
    if (!canvasOpaque(f)) {
      tl.seek(Math.min(f, 372), false);
      look = world.frame(f, now / 1000, dt, innerWidth, innerHeight, lamp.k);
      const text = world.readout(f);
      if (readout && text !== readoutText) {
        readout.textContent = text;
        readoutText = text;
      }
    }
    stage.render(f, dt, now, tHead, look);
  };

  // The first picture, while the loader still covers it.
  draw(performance.now(), 0);
  share = 1;
  await new Promise<void>((done) => {
    const wait = (): void => (shown >= 0.999 || aborted() ? done() : void setTimeout(wait, 30));
    wait();
  });
  await new Promise((done) => setTimeout(done, 250));
  cancelAnimationFrame(loaderRaf);
  mark('shown');
  if (aborted()) {
    tl.kill();
    splits.revert();
    dropAll();
    return quit();
  }
  console.info('lab: ready', marks.map(([what, at]) => `${what} ${at} ms`).join(' · '));

  // The loader leaves into the world: the lamp comes on, the name rises.
  intro = heroIntro(root, splits, reduce, world.introStyle);
  world.intro?.(intro);
  gsap.to(loader, { autoAlpha: 0, duration: reduce ? 0.3 : 0.7, ease: 'power2.inOut' });
  gsap.to(lamp, { k: 1, duration: reduce ? 0.3 : 1.6, ease: 'power2.inOut', delay: reduce ? 0 : 0.15 });
  intro.play();
  document.documentElement.setAttribute('data-lab-ready', '');

  // Behind the opening: the flight's gates and projects, then the head. It costs one long frame (the reflections and the
  // shaders), so it starts once the name has settled, while the page is still, or as soon as the scroll moves on.
  let tunnelAsked = false;
  const askTunnel = (): void => {
    if (tunnelAsked) return;
    tunnelAsked = true;
    stage.loadTunnel().catch((error: unknown) => console.warn('lab: the tunnel did not load', error));
  };
  const tunnelTimer = setTimeout(askTunnel, reduce ? 300 : 2600);

  const maxScroll = (): number => document.documentElement.scrollHeight - innerHeight;
  const stills = reduce ? [0, ...world.beats.steps.map(([, b, c]) => Math.round((b + c) / 2)), 336] : null;
  let raf = 0;
  const tick = (now: number): void => {
    const dt = first ? 0 : Math.min(MAX_DT, (now - last) / 1000);
    if (!first) frames.push(now - last);
    if (frames.length > 600) frames.shift();
    last = now;
    target = frameFromScroll(scrollY, maxScroll(), timeline);
    if (target > 120) askTunnel();
    if (stills) {
      // Less motion: no flights. The opening holds still pictures and fades through the dark between them.
      const [shown, fade] = stillAt(target, stills);
      f = shown;
      canvas.style.opacity = fade.toFixed(3);
    } else f = first ? target : f + (target - f) * (1 - Math.exp(-dt / o.smooth));
    first = false;
    draw(now, dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onResize = (): void => {
    renderer.setSize(innerWidth, innerHeight, false);
    stage.resize(innerWidth, innerHeight);
  };
  const onPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    const x = (event.clientX / innerWidth) * 2 - 1, y = 1 - (event.clientY / innerHeight) * 2;
    world.pointer?.(x, y);
    stage.tunnel.pointer(x, y);
  };
  addEventListener('resize', onResize);
  addEventListener('pointermove', onPointer, { passive: true });

  const handle: LabHandle = {
    frame: () => f,
    ready: () => true,
    frameTimes: () => frames.slice(),
    scrollFor: (frame) => scrollFromFrame(clamp(frame, 0, timeline.last), maxScroll(), timeline),
  };
  (window as unknown as { __lab?: LabHandle }).__lab = handle;

  return () => {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(loaderRaf);
    clearTimeout(tunnelTimer);
    removeEventListener('resize', onResize);
    removeEventListener('pointermove', onPointer);
    intro?.kill();
    tl.kill();
    splits.revert();
    world.dispose();
    stage.dispose();
    renderer.dispose();
    canvas.remove();
    document.documentElement.removeAttribute('data-lab-ready');
    delete (window as unknown as { __lab?: LabHandle }).__lab;
  };
}
