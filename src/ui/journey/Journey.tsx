import { type JSX, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { installJourneyDebug } from '~/debug/journeyDebug';
import { useTranslator } from '~/i18n/useTranslator';
import { startLoop } from '~/journey/loop';
import { buildTimeline, trackHeightPx } from '~/journey/timeline';
import type { CanvasHandle } from './JourneyCanvas';

// three.js and R3F load after hydration, in their own chunk; the prerendered page holds the words alone.
const JourneyCanvas = lazy(() => import('./JourneyCanvas'));

/** The home page's journey: one machine, from code to a new universe (spec 2026-11-05-bob-machine-rebuild-design.md). */
export function Journey(): JSX.Element {
  const { locale } = useTranslator();
  const timeline = useMemo(() => buildTimeline(), []);
  const canvas = useRef<CanvasHandle | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStarted(true);
    const frames: number[] = [];
    let shown = 0;
    let before = 0;
    const uninstall = installJourneyDebug(() => ({ frame: () => shown, frameTimes: () => frames.slice(), ready: () => canvas.current !== null, quality: () => 0 }));
    const stop = startLoop({
      timeline,
      reduce: reduce.current,
      onFrame: (f, dt, now) => {
        shown = f;
        if (before > 0) frames.push(now - before);
        before = now;
        canvas.current?.frame(f, now);
      },
    });
    return () => {
      stop();
      uninstall();
    };
  }, [timeline]);

  const onReady = useCallback((handle: CanvasHandle) => {
    canvas.current = handle;
  }, []);
  const onFail = useCallback((error: unknown) => {
    console.error('the journey could not start', error);
    setFailed(true);
  }, []);

  return (
    <div className="journey" style={{ height: `calc(${trackHeightPx(timeline)}px + 100vh)` }}>
      {started && !failed ? (
        <Suspense fallback={null}>
          <JourneyCanvas locale={locale} timeline={timeline} reduce={reduce.current} onReady={onReady} onFail={onFail} />
        </Suspense>
      ) : null}
    </div>
  );
}
