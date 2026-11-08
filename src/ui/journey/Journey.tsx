import { type JSX, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { tabStore } from '~/app/tabStore';
import { profile } from '~/data/profile';
import { projects } from '~/data/projects';
import { installJourneyDebug } from '~/debug/journeyDebug';
import { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';
import { flightLayout, timelineFor } from '~/journey/flight/layout';
import { frameForHash, frameOfChapter, glideTo, noteFrame, takePlace } from '~/journey/jump';
import { boxesMeet, keepOnPage, layersAt, PHONE_WIDTH, RAIL_WIDTH, TAG_NAMES, tagPlace, tagsApart } from '~/journey/layers';
import { type DoorChoice, loadedShare, type LoaderPlan, loaderPlan, SEEN_KEY } from '~/journey/loader/plan';
import { pageFit } from '~/journey/machine/camera';
import { startLoop } from '~/journey/loop';
import { softBangAt } from '~/journey/head/report';
import { Sound } from '~/journey/sound/music';
import { endClock, type EndClock, headT } from '~/journey/head/time';
import { type ChapterId, trackHeightPx, scrollFromFrame } from '~/journey/timeline';
import { applyLayer, applySheet, wordClip } from './applyLayers';
import { type BandKind, paintBand } from './bands';
import { journeyMode, type JourneyMode } from '~/journey/mode';
import { webglSupport } from '~/scene/webgl';
import { CalmJourney } from './CalmJourney';
import { ChapterRail, updateRail } from './ChapterRail';
import { closeProject, listenToHistory, openedProject, openProject } from './openProject';
import { type PageRect, ProjectOverlay } from './ProjectOverlay';
import { FieldSheet } from './FieldSheet';
import { FirstView } from './FirstView';
import { InkLoader } from './InkLoader';
import type { CanvasHandle } from './JourneyCanvas';
import type { WorldState } from '~/journey/world/World';
import { createPaper, createSparks } from './paper';
import { PortalWord } from './PortalWord';
import { ProjectLinks } from './ProjectLinks';
import { applyHead, applyReport, forgetHeadSizes, headEls, measureReport, reportEls } from './applyHead';
import { HeadAnswers } from './HeadAnswers';
import { ScanHud } from './ScanHud';
import { ScanReport } from './ScanReport';
import { StackWords } from './StackWords';
import { Story, updateStory } from './Story';

// three.js and R3F load after hydration, in their own chunk; the prerendered page holds the words alone.
const JourneyCanvas = lazy(() => import('./JourneyCanvas'));

/** The home page's journey: live where it can run, calm where it should not, and never a blank page. */
export function Journey(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;
  const [mode, setMode] = useState<JourneyMode>('live');
  useEffect(() => {
    setMode(journeyMode({ webgl: webglSupport(), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, failed: false }));
  }, []);
  const onFailed = useCallback(() => setMode('lite-link'), []);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-journey-calm', mode !== 'live');
    if (mode !== 'live') scrollTo({ top: 0, behavior: 'auto' });
    return () => document.documentElement.removeAttribute('data-journey-calm');
  }, [mode]);
  if (mode !== 'live') return <CalmJourney litePointer={mode === 'lite-link'} />;
  return (
    <>
      <noscript>
        <p className="j-noscript">
          {t.journey.calm.noScript} <a href={i18n.path(PAGES.lite)}>{t.journey.calm.lite}</a>
        </p>
      </noscript>
      <LiveJourney onFailed={onFailed} />
    </>
  );
}

/** One machine, from code to a new universe (spec 2026-11-05-bob-machine-rebuild-design.md). */
function LiveJourney({ onFailed }: { onFailed: () => void }): JSX.Element {
  const { locale, t } = useTranslator();
  const timeline = useMemo(() => timelineFor(flightLayout(projects.byDate())), []);
  const stopIds = useMemo((): string[] => projects.byDate().map((project) => project.id), []);
  const { pathname } = useLocation();
  const homePath = useRef(pathname);
  const canvas = useRef<CanvasHandle | null>(null);
  const [started, setStarted] = useState(false);
  const [plan, setPlan] = useState<LoaderPlan>('full');
  const [ready, setReady] = useState(false);
  const [model, setModel] = useState(0);
  const growTree = useRef<(() => void) | null>(null);
  const reduce = useRef(false);
  const words = useRef(t.journey);
  words.current = t.journey;
  const localeNow = useRef(locale);
  localeNow.current = locale;
  const age = profile.ageOn();

  useEffect(() => {
    reduce.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    setPlan(loaderPlan({ seenThisTab: tabStore.getItem(SEEN_KEY) !== null, reload: navigation?.type === 'reload', reduced: reduce.current }));
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
    const sheetWords = t.journey.sheets.map((_, n) => document.getElementById(`j-sheet-word-${n}`));
    const stack = document.getElementById('j-stack');
    const portal = document.getElementById('j-portal');
    const flash = document.getElementById('j-flash');
    const openLinks = new Map(Array.from(document.querySelectorAll<HTMLElement>('.j-project')).map((el) => [el.dataset.project ?? '', el.querySelector<HTMLElement>('.j-open')]));
    let projectNow: string | null = null;
    let hotNow = false;
    let hoverNow: string | null = null;
    // Only the project you are at shows its link, under its words; the cursor reads whether its screen is under the pointer.
    const showProject = (project: string | null, link: [number, number] | null, hover: string | null): void => {
      if (project !== projectNow) {
        if (projectNow) openLinks.get(projectNow)?.classList.remove('on');
        if (project) openLinks.get(project)?.classList.add('on');
        projectNow = project;
      }
      const open = project ? openLinks.get(project) : null;
      if (open && link) open.style.transform = `translate(${link[0].toFixed(1)}px, ${link[1].toFixed(1)}px)`;
      hoverNow = hover;
      const hot = hover !== null;
      if (hot !== hotNow) {
        document.documentElement.toggleAttribute('data-project-hot', hot);
        hotNow = hot;
      }
    };
    const cool = (): void => {
      hoverNow = null;
      if (!hotNow) return;
      document.documentElement.removeAttribute('data-project-hot');
      hotNow = false;
    };
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
    // Bob's head: the scanner's frame and the six answers, and the ending's own clock from the spit on.
    const headParts = headEls();
    const clock: EndClock = { at: null };
    let jumping = false;
    let firstFrame = true;
    const report = reportEls();
    let rowTops: number[] = [];
    let reportLocale: string | null = null;
    let landingSent = false;
    const measure = (): void => {
      if (!report) return;
      rowTops = measureReport(report);
      // The title's row, "Let's talk.", second to last: its sound is a ping.
      Sound.setReportRows(rowTops, rowTops.length - 2);
      reportLocale = localeNow.current;
      landingSent = false;
    };
    measure();
    // Its rows stand where the page's fonts put them.
    void (document.fonts?.ready ?? Promise.resolve()).then(measure);
    const fitHead = (): void => {
      if (headParts) forgetHeadSizes(headParts);
      measure();
    };
    addEventListener('resize', onResize);
    addEventListener('resize', fitHead);
    const frames: number[] = [];
    let shown = 0;
    let first: number | null = null;
    let before = 0;
    let lastState: WorldState | null = null;
    const uninstall = installJourneyDebug(() => ({ frame: () => shown, first: () => first, frameTimes: () => frames.slice(), ready: () => canvas.current !== null, quality: () => canvas.current?.step() ?? 0, dpr: () => canvas.current?.dpr() ?? 1, anchors: () => lastState?.anchors ?? null, sound: () => Sound.report(), flight: () => lastState?.flight ?? null, stops: () => canvas.current?.report() ?? null }));

    // A chapter a link names: there at once, on arrival.
    const arrival = frameForHash(location.hash, timeline, stopIds);
    if (arrival !== null) scrollTo({ top: scrollFromFrame(arrival, document.documentElement.scrollHeight - innerHeight, timeline), behavior: 'auto' });

    const stop = startLoop({
      timeline,
      reduce: reduce.current,
      onFrame: (f, dt, now) => {
        shown = f;
        // From the spit the ending runs on its own clock; a jump to Contact, or a load there, lands on it finished.
        const tHead = endClock(clock, headT(f, timeline), now / 1000, jumping || firstFrame);
        if (clock.at !== null) jumping = false;
        firstFrame = false;
        Sound.frame(f, dt, tHead);
        const layers = layersAt(f, timeline, innerHeight > innerWidth);
        applyLayer(hero, layers.hero);
        if (hero) hero.style.pointerEvents = layers.hero.opacity < 0.5 ? 'none' : 'auto';
        applyLayer(vert, layers.vert);
        applyLayer(story, layers.story);
        if (story && layers.story.opacity > 0) updateStory(story, layers.age, words.current.story);
        paperEl.style.visibility = layers.paper ? 'visible' : 'hidden';
        if (layers.paper) paper.draw(now);
        sparks.draw(reduce.current ? 0 : layers.sparks, dt, now);
        layers.sheets.forEach((sheet, n) => applySheet(sheets[n], sheet, sheetWords[n], wordClip(layers.sheets[n + 1])));
        applyLayer(stack, { opacity: layers.stack });
        applyLayer(portal, { opacity: layers.portal });
        // While a project is open over it, the world waits.
        const paused = openedProject() !== null;
        const state = paused ? null : canvas.current?.frame(f, dt, now, tHead);
        const headLabels = headParts ? applyHead(headParts, tHead, state?.head ?? null, { head: words.current.head, locale: localeNow.current }, innerWidth <= PHONE_WIDTH) : [];
        // The scan report: measured again in another language, printed by the scan line, the 3D told where it stands.
        if (report) {
          if (reportLocale !== localeNow.current) measure();
          if (!landingSent && canvas.current) {
            canvas.current.setLanding(report.memo.landing[0], report.memo.landing[1]);
            landingSent = true;
          }
          applyReport(report, tHead, rowTops);
        }
        // The soft big bang's faint flash, where the spark lands.
        if (flash) {
          const glow = softBangAt(tHead).flash;
          flash.style.opacity = glow < 0.002 ? '0' : glow.toFixed(3);
          if (glow > 0 && report) {
            flash.style.setProperty('--fx', `${report.memo.landing[0].toFixed(0)}px`);
            flash.style.setProperty('--fy', `${report.memo.landing[1].toFixed(0)}px`);
          }
        }
        if (state) showProject(state.flight.project, state.flight.link, state.hover);
        if (paused) cool();
        tags.forEach((tag) => applyLayer(tag, { opacity: state ? layers.stack : 0 }));
        let tagsOnRail = false;
        if (state && layers.stack > 0.002) {
          const phone = innerWidth <= PHONE_WIDTH;
          // A phone, or a page taller than it is wide: the stack stands in the middle, with no room left of it for the armour.
          const tall = phone || innerWidth < innerHeight;
          const fit = pageFit(f, innerWidth / innerHeight), pageScale = Math.max(innerWidth / 1280, innerHeight / 720);
          const places = TAG_NAMES.map((name) => tagPlace(name, state.anchors[name], fit, pageScale, tall));
          // Their sizes as last drawn, read before anything here moves them.
          const sizes = tags.map((tag) => [tag?.offsetWidth ?? 0, tag?.offsetHeight ?? 0] as const);
          const railBox = rail && innerWidth > RAIL_WIDTH ? rail.getBoundingClientRect() : null;
          // A phone's labels wrap at its edge (journey.css); elsewhere each keeps its words inside the page's 34 px edge.
          const lefts = places.map(([x], n) => (phone ? x : keepOnPage(x, sizes[n][0], innerWidth, 34)));
          // On a tall page the labels stand close, and on a phone they wrap: each keeps clear of the one above it.
          const tops = tall ? tagsApart(places.map(([, y]) => y), sizes.map(([, h]) => h), 10) : places.map(([, y]) => y);
          tags.forEach((tag, n) => {
            if (!tag) return;
            tag.style.left = `${lefts[n].toFixed(1)}px`;
            tag.style.top = `${tops[n].toFixed(1)}px`;
          });
          // On a narrow wide page, as a tablet turned sideways, the labels reach the rail: it keeps only its current word.
          tagsOnRail = railBox !== null && lefts.some((left, n) => boxesMeet({ left, top: tops[n], right: left + sizes[n][0], bottom: tops[n] + sizes[n][1] }, railBox, 12));
        }
        // The labels round his head reach the rail on most pages: it keeps only its current word, as with the stack's.
        if (!tagsOnRail && headLabels.length > 0 && rail && innerWidth > RAIL_WIDTH) {
          const railBox = rail.getBoundingClientRect();
          tagsOnRail = headLabels.some((label) => boxesMeet(label, railBox, 12));
        }
        lastState = state ?? null;
        noteFrame(f);
        first ??= f;
        if (before > 0) frames.push(now - before);
        before = now;
        if (rail) updateRail(rail, f, timeline, tagsOnRail);
        if (bar) bar.style.transform = `scaleX(${(f / timeline.last).toFixed(4)})`;
      },
    });

    // The header's and the rail's links glide along the scroll.
    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Partial<Pick<Element, 'closest'>> | null;
      // A project opens from its link, or from a click on its screen.
      const open = target?.closest?.('.j-open');
      if (open) {
        const id = open.closest<HTMLElement>('.j-project')?.dataset.project;
        if (!id) return;
        event.preventDefault();
        openProject(id, shown ?? 0);
        return;
      }
      if (hoverNow && !target?.closest?.('a, button')) {
        openProject(hoverNow, shown ?? 0);
        return;
      }
      const link = target?.closest?.('[data-jump]');
      const chapter = link?.getAttribute('data-jump');
      if (!chapter) return;
      event.preventDefault();
      jumping = chapter === 'contact';
      const go = (): void => glideTo(frameOfChapter(chapter as ChapterId, timeline), timeline, reduce.current);
      if (openedProject()) closeProject(go);
      else go();
    };
    const stopHistory = listenToHistory(() => shown ?? 0, () => homePath.current);

    // A link reached by the keyboard brings its chapter into place.
    const focused = (event: FocusEvent): void => {
      const el = event.target as HTMLElement | null;
      if (!el?.matches?.(':focus-visible')) return;
      const project = el.closest<HTMLElement>('.j-project')?.dataset.project;
      if (project) glideTo(timeline.reads[stopIds.indexOf(project)], timeline, reduce.current);
      else if (el.closest('#j-end')) {
        jumping = true;
        glideTo(timeline.last, timeline, reduce.current);
      }
    };
    document.addEventListener('focusin', focused);

    // In a tab nobody is looking at, the sound sleeps.
    const seen = (): void => Sound.watchVisibility(document.hidden);
    document.addEventListener('visibilitychange', seen);

    document.addEventListener('click', onClick);

    return () => {
      stop();
      noteFrame(null);
      uninstall();
      removeEventListener('resize', onResize);
      removeEventListener('resize', fitHead);
      stopResume();
      // Off to another page of the site: the machine's hum does not follow; the switch keeps his choice for the way back.
      Sound.sleep();
      document.removeEventListener('click', onClick);
      stopHistory();
      cool();
      document.removeEventListener('focusin', focused);
      document.removeEventListener('visibilitychange', seen);
    };
  }, [timeline, stopIds]);

  // In another language with a project open: the router has moved the page under it, so the address goes back to the project's.
  useEffect(() => {
    homePath.current = pathname;
    const open = openedProject();
    if (open) history.replaceState({ ...(history.state as object | null), journeyProject: open.id }, '', Translator.pathFor(locale, `/projects/${open.id}/`));
  }, [pathname, locale]);

  const screenRect = useCallback((id: string): PageRect | null => canvas.current?.screenRect(id) ?? null, []);
  // If the page's size changed while it was open, you still come back to the same place.
  const closed = useCallback(
    (_id: string, f: number): void => {
      scrollTo({ top: scrollFromFrame(f, document.documentElement.scrollHeight - innerHeight, timeline), behavior: 'auto' });
    },
    [timeline],
  );

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
    setReady(true);
    onFailed();
  }, [onFailed]);

  return (
    <>
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
      <ProjectLinks />
      <ScanHud />
      <HeadAnswers />
      <ScanReport />
      <div id="j-flash" className="j-flash" aria-hidden="true" />
      {started ? (
        <Suspense fallback={null}>
          <JourneyCanvas locale={locale} timeline={timeline} reduce={reduce.current} label={t.journey.hero.machineAlt} onProgress={onProgress} onReady={onReady} onFail={onFail} />
        </Suspense>
      ) : null}
      <InkLoader plan={plan} ready={ready} progress={loadedShare({ scene: started ? 1 : 0, model, warm: ready ? 1 : 0 })} onEnter={onEnter} onLand={onLand} onDone={onLoaderDone} />
    </div>
    <ProjectOverlay rectFor={screenRect} onClosed={closed} />
    </>
  );
}
