import { type JSX, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { profile } from '~/data/profile';
import { installJourneyDebug } from '~/debug/journeyDebug';
import { useTranslator } from '~/i18n/useTranslator';
import { frameForHash, frameOfChapter, glideTo, noteFrame, takePlace } from '~/journey/jump';
import { layersAt, TAG_NAMES, tagPlace } from '~/journey/layers';
import { type DoorChoice, loadedShare, type LoaderPlan, loaderPlan, SEEN_KEY } from '~/journey/loader/plan';
import { pageFit } from '~/journey/machine/camera';
import { startLoop } from '~/journey/loop';
import { Sound } from '~/journey/sound/music';
import { buildTimeline, type ChapterId, trackHeightPx, scrollFromFrame } from '~/journey/timeline';
import { applyLayer, applySheet } from './applyLayers';
import { type BandKind, paintBand } from './bands';
import { ChapterRail, updateRail } from './ChapterRail';
import { FieldSheet } from './FieldSheet';
import { FirstView } from './FirstView';
import { InkLoader } from './InkLoader';
import type { CanvasHandle } from './JourneyCanvas';
import type { WorldState } from '~/journey/world/World';
import { createPaper, createSparks } from './paper';
import { PortalWord } from './PortalWord';
import { StackWords } from './StackWords';
import { Story, updateStory } from './Story';

// three.js and R3F load after hydration, in their own chunk; the prerendered page holds the words alone.
const JourneyCanvas = lazy(() => import('./JourneyCanvas'));

/** The home page's journey: one machine, from code to a new universe (spec 2026-11-05-bob-machine-rebuild-design.md). */
export function Journey(): JSX.Element {
  const { locale, t } = useTranslator();
  const timeline = useMemo(() => buildTimeline(), []);
  const canvas = useRef<CanvasHandle | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [plan, setPlan] = useState<LoaderPlan>('full');
  const [ready, setReady] = useState(false);
  const [model, setModel] = useState(0);
  const growTree = useRef<(() => void) | null>(null);
  const reduce = useRef(false);
  const words = useRef(t.journey);
  words.current = t.journey;
  const age = profile.ageOn();

  useEffect(() => {
    reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    setPlan(loaderPlan({ seenThisTab: sessionStorage.getItem(SEEN_KEY) !== null, reload: navigation?.type === 'reload', reduced: reduce.current }));
    setStarted(true);
    const rail = document.getElementById('j-rail');
    const bar = document.getElementById('j-bar');
    const hero = document.getElementById('j-hero');
    const vert = document.getElementById('j-vert');
    const story = document.getElementById('j-story');
    const paperEl = document.getElementById('j-paper') as HTMLCanvasElement;
    const sparksEl = document.getElementById('j-sparks') as HTMLCanvasElement;
    const paper = createPaper(paperEl, reduce.current);
    const sparks = createSparks(sparksEl);
    sparks.fit();
    growTree.current = () => paper.grow(performance.now());
    const sheets = t.journey.sheets.map((_, n) => document.getElementById(`j-sheet-${n}`));
    const stack = document.getElementById('j-stack');
    const portal = document.getElementById('j-portal');
    const tags = TAG_NAMES.map((name) => document.querySelector<HTMLElement>(`[data-tag="${name}"]`));
    const paintBands = (): void => {
      for (const band of document.querySelectorAll<HTMLCanvasElement>('.j-band')) paintBand(band, band.dataset.kind as BandKind);
    };
    // The art uses the page's fonts, and is not needed for the first moments.
    const painting = (document.fonts?.ready ?? Promise.resolve()).then(paintBands);
    void painting;
    // After a reload he had sound on: it comes back with the next click or key.
    const stopResume = Sound.resumeIfWanted();
    Sound.setShift(timeline.shift);
    const onResize = (): void => {
      paper.fit();
      sparks.fit();
      paintBands();
    };
    addEventListener('resize', onResize);
    const frames: number[] = [];
    let shown = 0;
    let first: number | null = null;
    let before = 0;
    let lastState: WorldState | null = null;
    const uninstall = installJourneyDebug(() => ({ frame: () => shown, first: () => first, frameTimes: () => frames.slice(), ready: () => canvas.current !== null, quality: () => 0, anchors: () => lastState?.anchors ?? null, sound: () => Sound.report() }));

    // A chapter a link names: there at once, on arrival.
    const arrival = frameForHash(location.hash, timeline);
    if (arrival !== null) scrollTo({ top: scrollFromFrame(arrival, document.documentElement.scrollHeight - innerHeight, timeline), behavior: 'auto' });

    const stop = startLoop({
      timeline,
      reduce: reduce.current,
      onFrame: (f, dt, now) => {
        shown = f;
        Sound.frame(f, dt);
        const layers = layersAt(f, timeline, innerHeight > innerWidth);
        applyLayer(hero, layers.hero);
        if (hero) hero.style.pointerEvents = layers.hero.opacity < 0.5 ? 'none' : 'auto';
        applyLayer(vert, layers.vert);
        applyLayer(story, layers.story);
        if (story && layers.story.opacity > 0) updateStory(story, layers.age, words.current.story);
        paperEl.style.visibility = layers.paper ? 'visible' : 'hidden';
        if (layers.paper) paper.draw(now);
        sparks.draw(reduce.current ? 0 : layers.sparks, dt, now);
        layers.sheets.forEach((sheet, n) => applySheet(sheets[n], sheet));
        applyLayer(stack, { opacity: layers.stack });
        applyLayer(portal, { opacity: layers.portal });
        const state = canvas.current?.frame(f, dt, now);
        tags.forEach((tag, n) => {
          if (!tag) return;
          applyLayer(tag, { opacity: state ? layers.stack : 0 });
          if (!state || layers.stack <= 0.002) return;
          const name = TAG_NAMES[n];
          const [x, y] = tagPlace(name, state.anchors[name], pageFit(f, innerWidth / innerHeight), Math.max(innerWidth / 1280, innerHeight / 720));
          tag.style.left = `${x.toFixed(1)}px`;
          tag.style.top = `${y.toFixed(1)}px`;
        });
        lastState = state ?? null;
        noteFrame(f);
        first ??= f;
        if (before > 0) frames.push(now - before);
        before = now;
        if (rail) updateRail(rail, f, timeline);
        if (bar) bar.style.transform = `scaleX(${(f / timeline.last).toFixed(4)})`;
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
      removeEventListener('resize', onResize);
      stopResume();
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
    setReady(true);
  }, []);
  const onProgress = useCallback((share: number) => setModel(share), []);
  const onEnter = useCallback((choice: DoorChoice) => Sound.enter(choice === 'with-sound'), []);
  const onLand = useCallback(() => {
    growTree.current?.();
    Sound.land();
  }, []);
  const onLoaderDone = useCallback(() => {}, []);
  const onFail = useCallback((error: unknown) => {
    console.error('the journey could not start', error);
    setFailed(true);
    setReady(true);
  }, []);

  return (
    <div className="journey" style={{ height: `calc(${trackHeightPx(timeline)}px + 100vh)` }}>
      <canvas id="j-paper" className="j-paper" role="img" aria-label={t.journey.hero.treeAlt} />
      <div id="j-bar" className="j-bar" />
      <ChapterRail timeline={timeline} labels={t.journey.rail} />
      <FirstView age={age} />
      <Story age={age} />
      {t.journey.sheets.map((sheet, n) => (
        <FieldSheet key={n} sheet={sheet} n={n} />
      ))}
      <canvas id="j-sparks" className="j-sparks" aria-hidden="true" />
      <StackWords />
      <PortalWord />
      {started && !failed ? (
        <Suspense fallback={null}>
          <JourneyCanvas locale={locale} timeline={timeline} reduce={reduce.current} label={t.journey.hero.machineAlt} onProgress={onProgress} onReady={onReady} onFail={onFail} />
        </Suspense>
      ) : null}
      <InkLoader plan={plan} ready={ready} progress={loadedShare({ scene: started ? 1 : 0, model, warm: ready ? 1 : 0 })} onEnter={onEnter} onLand={onLand} onDone={onLoaderDone} />
    </div>
  );
}
