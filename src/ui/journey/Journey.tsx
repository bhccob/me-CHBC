import { type JSX, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { projects } from '~/data/projects';
import { installJourneyDebug } from '~/debug/journeyDebug';
import { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';
import { flightLayout, timelineFor } from '~/journey/flight/layout';
import { frameForHash, frameOfChapter, glideTo, noteFrame, takePlace } from '~/journey/jump';
import { layersAt, TAG_NAMES, tagPlace } from '~/journey/layers';
import { type DoorChoice, loadedShare, type LoaderPlan, loaderPlan, SEEN_KEY } from '~/journey/loader/plan';
import { pageFit } from '~/journey/machine/camera';
import { startLoop } from '~/journey/loop';
import { lightWaiting, playBang } from '~/journey/bang';
import { canHold, driftAngles, endWordsAt, ORBIT_PITCH, ORBIT_YAW, touchPlan } from '~/journey/end';
import { Sound } from '~/journey/sound/music';
import { type ChapterId, trackHeightPx, scrollFromFrame } from '~/journey/timeline';
import { applyLayer, applySheet } from './applyLayers';
import { type BandKind, paintBand } from './bands';
import { journeyMode, type JourneyMode } from '~/journey/mode';
import { webglSupport } from '~/scene/webgl';
import { CalmJourney } from './CalmJourney';
import { ChapterRail, updateRail } from './ChapterRail';
import { EndWords } from './EndWords';
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
import { QaText } from './QaText';
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
    const flash = document.getElementById('j-flash');
    const hint = document.getElementById('j-hint');
    const endPage = document.getElementById('j-end');
    const endHub = document.getElementById('j-end-hub');
    const endWord = document.getElementById('j-end-word');
    const endToy = document.getElementById('j-end-toy');
    let risen = false;
    let aimX = 0;
    let aimY = 0;
    let tiltX = 0;
    let tiltY = 0;
    let holding = false;
    // With no cursor: a slow drift, a sideways drag on top of it, and a finger that may yet be scrolling.
    const noCursor = matchMedia('(hover: none)').matches;
    let dragX = 0;
    let dragFrom = 0;
    let finger: { x: number; y: number; plan: 'orbit' | 'scroll' | null } | null = null;
    let holdSoon = 0;
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
    addEventListener('resize', onResize);
    const frames: number[] = [];
    let shown = 0;
    let first: number | null = null;
    let before = 0;
    let lastState: WorldState | null = null;
    const uninstall = installJourneyDebug(() => ({ frame: () => shown, first: () => first, frameTimes: () => frames.slice(), ready: () => canvas.current !== null, quality: () => 0, anchors: () => lastState?.anchors ?? null, sound: () => Sound.report(), flight: () => lastState?.flight ?? null, stops: () => canvas.current?.report() ?? null }));

    // A chapter a link names: there at once, on arrival.
    const arrival = frameForHash(location.hash, timeline, stopIds);
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
        applyLayer(flash, { opacity: layers.flash });
        applyLayer(hint, { opacity: layers.hint });
        const end = endWordsAt(f, timeline.shift);
        // Its opacity alone: hidden, its links could not be reached by a keyboard.
        if (endPage) endPage.style.opacity = String(end.page);
        if (end.rise !== risen) {
          risen = end.rise;
          endPage?.classList.toggle('on', risen);
          document.documentElement.toggleAttribute('data-journey-end', risen);
        }
        if (noCursor && end.page > 0 && !holding) {
          const { yaw, pitch } = driftAngles(now / 1000);
          aimX = yaw / ORBIT_YAW + dragX;
          aimY = -pitch / ORBIT_PITCH;
          canvas.current?.drift(aimX, pitch / ORBIT_PITCH);
        }
        if (end.page > 0) {
          if (endWord) {
            endWord.style.opacity = end.word.opacity.toFixed(3);
            endWord.style.filter = end.word.blur > 0 ? `blur(${end.word.blur.toFixed(1)}px)` : 'none';
            endWord.style.letterSpacing = `${end.word.spacing.toFixed(3)}em`;
          }
          // The words lean a few degrees toward the cursor.
          if (endHub && !reduce.current) {
            tiltX += (aimX - tiltX) * Math.min(1, dt * 5);
            tiltY += (aimY - tiltY) * Math.min(1, dt * 5);
            endHub.style.transform = `translate(-50%, -50%) perspective(1100px) rotateY(${(tiltX * 7).toFixed(2)}deg) rotateX(${(tiltY * -5).toFixed(2)}deg)`;
          }
        }
        // While a project is open over it, the world waits.
        const paused = openedProject() !== null;
        const state = paused ? null : canvas.current?.frame(f, dt, now);
        if (state) showProject(state.flight.project, state.flight.link, state.hover);
        if (state && state.fired > 0 && endToy) endToy.style.opacity = '0';
        else if (paused) cool();
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
      // The light, waiting: a click lets it go.
      if (shown !== null && lightWaiting(shown, timeline.shift) && !target?.closest?.('a, button')) {
        playBang(timeline);
        return;
      }
      const link = target?.closest?.('[data-jump]');
      const chapter = link?.getAttribute('data-jump');
      if (!chapter) return;
      event.preventDefault();
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
      else if (el.closest('#j-end')) glideTo(timeline.last, timeline, reduce.current);
    };
    document.addEventListener('focusin', focused);

    // In a tab nobody is looking at, the sound sleeps.
    const seen = (): void => Sound.watchVisibility(document.hidden);
    document.addEventListener('visibilitychange', seen);

    // The end page: the cursor leans the words; hold anywhere but on a link to start a universe.
    const startHold = (): void => {
      holding = true;
      canvas.current?.hold(true);
      Sound.hold(true);
    };
    const toPage = (event: PointerEvent): [number, number] => [(event.clientX / innerWidth) * 2 - 1, 1 - (event.clientY / innerHeight) * 2];
    const aim = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch') {
        aimX = (event.clientX / innerWidth) * 2 - 1;
        aimY = (event.clientY / innerHeight) * 2 - 1;
        return;
      }
      if (!finger) return;
      if (holding) {
        const [x, y] = toPage(event);
        canvas.current?.pointer(x, y);
        return;
      }
      const dx = event.clientX - finger.x;
      const dy = event.clientY - finger.y;
      if (!finger.plan && Math.hypot(dx, dy) > 10) {
        finger.plan = touchPlan(dx, dy);
        clearTimeout(holdSoon);
      }
      if (finger.plan === 'orbit') dragX = Math.max(-0.6, Math.min(0.6, dragFrom + dx / (innerWidth / 2)));
    };
    const press = (event: PointerEvent): void => {
      if (event.button !== 0 || shown === null || reduce.current || !canHold(shown, timeline)) return;
      if ((event.target as Partial<Pick<Element, 'closest'>> | null)?.closest?.('a, button')) return;
      if (event.pointerType !== 'touch') {
        startHold();
        return;
      }
      // A finger may be about to scroll or to drag: it holds only once it has stayed put a moment.
      finger = { x: event.clientX, y: event.clientY, plan: null };
      dragFrom = dragX;
      const [x, y] = toPage(event);
      holdSoon = window.setTimeout(() => {
        canvas.current?.pointer(x, y);
        startHold();
      }, 220);
    };
    const letGo = (cancelled: boolean): void => {
      clearTimeout(holdSoon);
      const tapped = finger !== null && finger.plan === null && !holding && !cancelled;
      finger = null;
      if (tapped) startHold();
      if (!holding) return;
      holding = false;
      canvas.current?.hold(false, cancelled);
      Sound.hold(false);
    };
    const up = (): void => letGo(false);
    const given = (): void => letGo(true);
    // A long press on the end page is a hold, not a menu.
    const noMenu = (event: Event): void => {
      if (document.documentElement.hasAttribute('data-journey-end') && !(event.target as Partial<Pick<Element, 'closest'>> | null)?.closest?.('a, button')) event.preventDefault();
    };
    addEventListener('contextmenu', noMenu);
    addEventListener('pointermove', aim, { passive: true });
    addEventListener('pointerdown', press);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', given);
    document.addEventListener('click', onClick);

    return () => {
      stop();
      noteFrame(null);
      uninstall();
      removeEventListener('resize', onResize);
      stopResume();
      document.removeEventListener('click', onClick);
      stopHistory();
      cool();
      document.removeEventListener('focusin', focused);
      document.removeEventListener('visibilitychange', seen);
      removeEventListener('pointermove', aim);
      removeEventListener('contextmenu', noMenu);
      clearTimeout(holdSoon);
      document.documentElement.removeAttribute('data-journey-end');
      removeEventListener('pointerdown', press);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', given);
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
      <QaText />
      <EndWords />
      <div id="j-flash" className="j-flash" aria-hidden="true" />
      <p id="j-hint" className="j-hint">
        {t.journey.collapse.hint}
      </p>
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
