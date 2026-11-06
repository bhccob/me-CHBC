import { type JSX, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { ProjectSheet } from '~/ui/ProjectSheet';
import { closeProject, nothingOpened, openedProject, watchOpened } from './openProject';

/** A place on the page, in CSS pixels. */
export type PageRect = readonly [left: number, top: number, width: number, height: number];

const OPEN_MS = 640;
const CLOSE_MS = 420;
const GROW_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const clipFrom = ([left, top, width, height]: PageRect): string =>
  `inset(${top.toFixed(1)}px ${(innerWidth - left - width).toFixed(1)}px ${(innerHeight - top - height).toFixed(1)}px ${left.toFixed(1)}px round 4px)`;

/** The picture's start: small, where the screen stood. It ends as large as the view, covering it. */
function pictureFrom(image: HTMLImageElement, [left, top, width, height]: PageRect): string {
  const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
  const coverWidth = Math.max(innerWidth, innerHeight * ratio);
  const scale = width / coverWidth;
  const x = left + width / 2 - innerWidth / 2;
  const y = top + height / 2 - innerHeight / 2;
  return `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(4)})`;
}

export interface ProjectOverlayProps {
  /** Where the project's screen stands on the page, if the world can say. */
  rectFor: (id: string) => PageRect | null;
  /** After it has gone: the page is yours again. */
  onClosed: (id: string, f: number) => void;
}

/**
 * The project you opened, over the flight: its screen grows to fill the view and becomes its page. Everything under it goes
 * inert and the page stops scrolling; the same goes the other way when you close it.
 */
export function ProjectOverlay({ rectFor, onClosed }: ProjectOverlayProps): JSX.Element | null {
  const { t } = useTranslator();
  const opened = useSyncExternalStore(watchOpened, openedProject, nothingOpened);
  const [shown, setShown] = useState<{ id: string; f: number; rect: PageRect | null } | null>(null);
  const view = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);

  if (opened && shown?.id !== opened.id) setShown({ id: opened.id, f: opened.f, rect: rectFor(opened.id) });

  // Under it: nothing can be reached, and nothing scrolls.
  useEffect(() => {
    const root = document.documentElement;
    const under = document.querySelector<HTMLElement>('.journey');
    const on = opened !== null;
    root.toggleAttribute('data-project-open', on);
    under?.toggleAttribute('inert', on);
    return () => {
      root.removeAttribute('data-project-open');
      under?.removeAttribute('inert');
    };
  }, [opened]);

  useEffect(() => {
    if (!opened) return undefined;
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeProject();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [opened]);

  const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The screen grows.
  const openedId = opened?.id ?? null;
  useLayoutEffect(() => {
    const el = view.current;
    if (!el || !openedId || shown?.id !== openedId) return;
    // The dialog itself, so that a click does not end with a ring on its way back; Tab goes on from here.
    el.focus({ preventScroll: true });
    const image = picture.current;
    const { rect } = shown;
    if (reduced() || !rect) {
      el.style.clipPath = 'none';
      if (image) image.style.opacity = '0';
      if (body.current) body.current.style.opacity = '1';
      if (back.current) back.current.style.opacity = '1';
      return;
    }
    el.animate([{ clipPath: clipFrom(rect) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: OPEN_MS, easing: GROW_EASE });
    if (image) {
      const grow = (): void => {
        image.animate([{ transform: pictureFrom(image, rect) }, { transform: 'none' }], { duration: OPEN_MS, easing: GROW_EASE });
      };
      if (image.complete) grow();
      else image.addEventListener('load', grow, { once: true });
      image.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: OPEN_MS + 260, easing: 'ease-in', fill: 'forwards' });
    }
    for (const part of [body.current, back.current]) {
      part?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: OPEN_MS + 260, easing: 'ease-out', fill: 'forwards' });
    }
    // Only when a project opens, not on each change of what is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId, shown?.id]);

  // And goes back to where it stood.
  useEffect(() => {
    if (opened || !shown) return undefined;
    const { id, f, rect } = shown;
    document.querySelector<HTMLElement>(`.j-project[data-project="${id}"] .j-open`)?.focus({ preventScroll: true });
    const el = view.current;
    const image = picture.current;
    const done = (): void => {
      setShown(null);
      onClosed(id, f);
    };
    if (reduced() || !rect || !el) {
      done();
      return undefined;
    }
    for (const part of [body.current, back.current]) part?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    if (image) {
      image.getAnimations().forEach((animation) => animation.cancel());
      image.style.opacity = '1';
      image.animate([{ transform: 'none' }, { transform: pictureFrom(image, rect) }], { duration: CLOSE_MS, easing: GROW_EASE, fill: 'forwards' });
    }
    const shrink = el.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: clipFrom(rect) }], { duration: CLOSE_MS, easing: GROW_EASE, fill: 'forwards' });
    shrink.onfinish = done;
    return () => {
      shrink.onfinish = null;
    };
  }, [opened, shown, onClosed]);

  if (!shown) return null;
  const project = projects.byId(shown.id);
  if (!project) return null;
  const { images, screens } = project.flight;
  const main = screens === 'phones' ? images[images.length - 1] : images[0];
  const headingId = `j-open-${shown.id}`;
  return (
    <div ref={view} className="j-open-view" role="dialog" aria-labelledby={headingId} tabIndex={-1}>
      <img ref={picture} className="j-open-picture" src={`/flight/${main}`} alt="" aria-hidden="true" />
      <div ref={body} className="j-open-body">
        <ProjectSheet id={shown.id} headingId={headingId} />
      </div>
      <button ref={back} type="button" className="ps-back" onClick={() => closeProject()}>
        <span aria-hidden="true">←</span> {t.journey.flight.back} <kbd aria-hidden="true">Esc</kbd>
      </button>
    </div>
  );
}
