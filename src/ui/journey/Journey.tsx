import { type JSX, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { installJourneyDebug } from '~/debug/journeyDebug';
import { useTranslator } from '~/i18n/useTranslator';
import { frameForHash, frameOfChapter, glideTo, noteFrame, takePlace } from '~/journey/jump';
import { startLoop } from '~/journey/loop';
import { buildTimeline, type ChapterId, trackHeightPx, scrollFromFrame } from '~/journey/timeline';
import { ChapterRail, updateRail } from './ChapterRail';
import type { CanvasHandle } from './JourneyCanvas';

// three.js and R3F load after hydration, in their own chunk; the prerendered page holds the words alone.
const JourneyCanvas = lazy(() => import('./JourneyCanvas'));

/** The home page's journey: one machine, from code to a new universe (spec 2026-11-05-bob-machine-rebuild-design.md). */
export function Journey(): JSX.Element {
  const { locale, t } = useTranslator();
  const timeline = useMemo(() => buildTimeline(), []);
  const canvas = useRef<CanvasHandle | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStarted(true);
    const rail = document.getElementById('j-rail');
    const bar = document.getElementById('j-bar');
    const frames: number[] = [];
    let shown = 0;
    let first: number | null = null;
    let before = 0;
    const uninstall = installJourneyDebug(() => ({ frame: () => shown, first: () => first, frameTimes: () => frames.slice(), ready: () => canvas.current !== null, quality: () => 0 }));

    // A chapter a link names: there at once, on arrival.
    const arrival = frameForHash(location.hash, timeline);
    if (arrival !== null) scrollTo({ top: scrollFromFrame(arrival, document.documentElement.scrollHeight - innerHeight, timeline), behavior: 'auto' });

    const stop = startLoop({
      timeline,
      reduce: reduce.current,
      onFrame: (f, _dt, now) => {
        shown = f;
        noteFrame(f);
        first ??= f;
        if (before > 0) frames.push(now - before);
        before = now;
        if (rail) updateRail(rail, f, timeline);
        if (bar) bar.style.transform = `scaleX(${(f / timeline.last).toFixed(4)})`;
        canvas.current?.frame(f, now);
      },
    });

    // The header's and the rail's links glide along the scroll.
    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Partial<Pick<Element, 'closest'>> | null)?.closest?.('[data-jump]');
      const chapter = link?.getAttribute('data-jump');
      if (!chapter) return;
      event.preventDefault();
      glideTo(frameOfChapter(chapter as ChapterId, timeline), timeline, reduce.current);
    };
    document.addEventListener('click', onClick);

    return () => {
      stop();
      noteFrame(null);
      uninstall();
      document.removeEventListener('click', onClick);
    };
  }, [timeline]);

  // The language link keeps the page but the router scrolls it to the top: back to the place it kept, after that.
  useEffect(() => {
    const place = takePlace();
    if (place !== null) scrollTo({ top: scrollFromFrame(place, document.documentElement.scrollHeight - innerHeight, timeline), behavior: 'auto' });
  }, [locale, timeline]);

  const onReady = useCallback((handle: CanvasHandle) => {
    canvas.current = handle;
  }, []);
  const onFail = useCallback((error: unknown) => {
    console.error('the journey could not start', error);
    setFailed(true);
  }, []);

  return (
    <div className="journey" style={{ height: `calc(${trackHeightPx(timeline)}px + 100vh)` }}>
      <div id="j-bar" className="j-bar" />
      <ChapterRail timeline={timeline} labels={t.journey.rail} />
      {started && !failed ? (
        <Suspense fallback={null}>
          <JourneyCanvas locale={locale} timeline={timeline} reduce={reduce.current} onReady={onReady} onFail={onFail} />
        </Suspense>
      ) : null}
    </div>
  );
}
