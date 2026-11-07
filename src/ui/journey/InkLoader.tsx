import { type JSX, useEffect, useRef, useState } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { tabStore } from '~/app/tabStore';
import { createInk } from '~/journey/loader/ink';
import { doorAction, type DoorChoice, type DoorInput, GIVE_UP_MS, INK, inkTarget, type LoaderPlan, SEEN_KEY } from '~/journey/loader/plan';

/** The quick loader's longest wait on a slow load, ms. */
const QUICK_MAX_MS = 1200;

export interface InkLoaderProps {
  plan: LoaderPlan;
  /** The machine has loaded and drawn once. */
  ready: boolean;
  /** How much has really loaded, 0 to 1. */
  progress: number;
  /** He has gone in, one way or the other. */
  onEnter: (choice: DoorChoice) => void;
  /** The page starts to rise. */
  onLand: () => void;
  /** The loader has gone. */
  onDone: () => void;
}

/** The way in: Purple ink on a new tab, a moment's dark on a reload. It is silent; sound starts on the other side of its door. */
export function InkLoader({ plan, ready, progress, onEnter, onLand, onDone }: InkLoaderProps): JSX.Element | null {
  const { t } = useTranslator();
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const textCanvas = useRef<HTMLCanvasElement>(null);
  const goButton = useRef<HTMLButtonElement>(null);
  const [door, setDoor] = useState(false);
  const [gone, setGone] = useState(false);
  const live = useRef({ ready, progress });
  live.current = { ready, progress };
  const enter = useRef<(input: DoorInput) => void>(() => {});

  useEffect(() => {
    if (plan !== 'quick') return undefined;
    const started = performance.now();
    let raf = 0;
    const tick = (): void => {
      if (live.current.ready || performance.now() - started > QUICK_MAX_MS) {
        onLand();
        onDone();
        setGone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plan, onLand, onDone]);

  useEffect(() => {
    if (plan !== 'full' || !glCanvas.current || !textCanvas.current) return undefined;
    const root = document.documentElement;
    const ink = createInk(glCanvas.current, textCanvas.current, () => document.querySelector('.j-han'));
    if (!ink) {
      onLand();
      onDone();
      setGone(true);
      return undefined;
    }
    root.classList.add('j-ld-on');
    let raf = 0;
    let shown = 0;
    let doneAt = 0;
    let landed = false;
    let waiting = false;
    let last = performance.now();
    const started = last;
    enter.current = (input) => {
      if (!waiting || doneAt) return;
      onEnter(doorAction(input));
      setDoor(false);
      tabStore.setItem(SEEN_KEY, '1');
      doneAt = performance.now();
    };
    const finish = (): void => {
      root.classList.remove('j-ld-on');
      root.classList.remove('j-ld-rise');
      setGone(true);
      onDone();
    };
    const tick = (now: number): void => {
      const dt = Math.min(50, now - last);
      last = now;
      const elapsed = now - started;
      const target = inkTarget(elapsed, live.current.ready, elapsed > GIVE_UP_MS, live.current.progress);
      shown += (target - shown) * (1 - Math.exp(-dt / 90));
      if (target >= 1 && shown > 0.995) shown = 1;
      if (shown >= 1 && !waiting && !doneAt) {
        waiting = true;
        setDoor(true);
      }
      const q = doneAt ? now - doneAt : -1;
      if (q >= INK.landAt && !landed) {
        landed = true;
        root.classList.add('j-ld-rise');
        root.classList.remove('j-ld-on');
        onLand();
      }
      ink.draw(shown, q, now);
      if (q >= INK.land) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    // The ink writes in the brush face, which must be here first.
    let cancelled = false;
    void (document.fonts?.load('400 40px "Ma Shan Zheng"', '客家') ?? Promise.resolve()).catch(() => {}).then(() => {
      if (!cancelled) raf = requestAnimationFrame(tick);
    });

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || !waiting || doneAt) return;
      event.preventDefault();
      enter.current('Enter');
    };
    // Scrolling goes in as well, without asking.
    const onWheel = (): void => enter.current('wheel');
    const onTouch = (): void => enter.current('touch');
    addEventListener('keydown', onKey);
    addEventListener('wheel', onWheel, { passive: true });
    addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey);
      removeEventListener('wheel', onWheel);
      removeEventListener('touchmove', onTouch);
      root.classList.remove('j-ld-on', 'j-ld-rise');
      ink.dispose();
    };
  }, [plan, onEnter, onLand, onDone]);

  useEffect(() => {
    if (door) goButton.current?.focus({ preventScroll: true });
  }, [door]);

  if (plan === 'none' || gone) return null;
  return (
    <div id="j-ld" className="j-ld">
      {plan === 'full' ? (
        <>
          <canvas ref={glCanvas} aria-hidden="true" />
          <canvas ref={textCanvas} aria-hidden="true" />
          <div className={door ? 'j-door j-door-on' : 'j-door'}>
            <button ref={goButton} type="button" className="j-door-go" tabIndex={door ? 0 : -1} onClick={() => enter.current('with')}>
              {t.journey.loader.withSound}
            </button>
            <button type="button" className="j-door-without" tabIndex={door ? 0 : -1} onClick={() => enter.current('without')}>
              {t.journey.loader.without}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
