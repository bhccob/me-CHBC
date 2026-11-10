import { type JSX, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { scrollFromFrame, trackHeightPx } from '~/journey/timeline';
import { webglSupport } from '~/scene/webgl';
import { COPY, type LabCopy } from './copy';
import type { ConceptId } from './concepts/types';
import { labTimeline } from './timeline';

/**
 * LAB ONLY (throwaway, LAB=1 dev servers only). One preview of the new opening: the page's words as real text, the
 * canvas under them, and the scroll track. The engine loads after hydration. `?smooth=0.2` gives the scroll more
 * weight, `?dpr=2` draws at a pixel ratio of 2, `?webgl=off` shows the fallback.
 */
export function LabPage({ id }: { id: string }): JSX.Element {
  const copy: LabCopy | undefined = COPY[id as ConceptId];
  const root = useRef<HTMLDivElement>(null);
  const timeline = useMemo(labTimeline, []);
  const [mode, setMode] = useState<'live' | 'still' | 'no-webgl'>('live');

  useEffect(() => {
    if (!copy || !root.current) return;
    const params = new URLSearchParams(location.search);
    if (params.get('webgl') === 'off' || webglSupport() !== 'ok') {
      setMode('no-webgl');
      return;
    }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smooth = Math.min(1, Math.max(0.02, Number(params.get('smooth') ?? 0.13)));
    const pixelRatio = Math.min(devicePixelRatio, Math.max(0.5, Math.min(2, Number(params.get('dpr') ?? 1.5))));
    let stop: (() => void) | null = null;
    const leave = new AbortController();
    const el = root.current;
    import('./engine/run')
      .then(({ run }) => run({ root: el, id: copy.id, timeline, reduce, smooth, pixelRatio, signal: leave.signal }))
      .then((s) => {
        if (leave.signal.aborted) s();
        else stop = s;
      })
      .catch((error: unknown) => {
        console.error('lab: the preview could not start', error);
        if (!leave.signal.aborted) setMode('no-webgl');
      });
    return () => {
      leave.abort();
      stop?.();
    };
  }, [copy, timeline]);

  if (!copy) {
    return (
      <div className="lab lab-index">
        <h1 className="lab-name">Lab</h1>
        <p className="lab-line">Previews: {Object.keys(COPY).map((key) => <a key={key} href={`/lab/${key}/`}>{key} </a>)}</p>
      </div>
    );
  }

  const skip = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: scrollFromFrame(timeline.head[0], max, timeline), behavior: reduce ? 'auto' : 'smooth' });
    document.getElementById('lab-brain')?.focus({ preventScroll: true });
  };

  if (mode === 'no-webgl') {
    return (
      <div className="lab lab-flat" data-lab={copy.id}>
        <p className="lab-flat-note">This preview needs WebGL. Here is the text of the opening.</p>
        <h1 className="lab-name">
          <span>Bob</span> <span>Chung</span>
        </h1>
        <p className="lab-line">{copy.line}</p>
        <ol className="lab-flat-steps">
          {copy.steps.map((step) => (
            <li key={step.n}>
              <span className="lab-step-n">{step.n}</span>
              <h2>{step.title}</h2>
              <p>{step.line}</p>
            </li>
          ))}
        </ol>
        <p className="lab-mark-flat">BC-2006</p>
      </div>
    );
  }

  return (
    <div ref={root} className="lab" data-lab={copy.id} style={{ height: `calc(${trackHeightPx(timeline)}px + 100vh)` }}>
      <a className="lab-skip" href="#lab-brain" onClick={skip}>
        Skip to the brain
      </a>
      <div className="lab-bars" aria-hidden="true">
        <i className="lab-bar lab-bar-top" />
        <i className="lab-bar lab-bar-bottom" />
      </div>
      <section className="lab-hero" aria-label="Bob Chung">
        <h1 className="lab-name">
          <span className="lab-name-line">Bob</span> <span className="lab-name-line">Chung</span>
        </h1>
        <p className="lab-line">{copy.line}</p>
      </section>
      <p className="lab-cue" aria-hidden="true">
        <span>Scroll</span>
        <i />
      </p>
      <p className="lab-mark">
        <i aria-hidden="true" />
        BC-2006
      </p>
      <p className="lab-readout" aria-hidden="true" />
      <ol className="lab-steps">
        {copy.steps.map((step, n) => (
          <li key={step.n} className="lab-step" data-step={n}>
            <span className="lab-step-n">{step.n}</span>
            <h2 className="lab-step-title">{step.title}</h2>
            <p className="lab-step-line">{step.line}</p>
          </li>
        ))}
      </ol>
      <div className="lab-pins" aria-hidden="true" />
      <i className="lab-pen" aria-hidden="true" />
      <p className="lab-screen-name" aria-hidden="true">
        Bob Chung
      </p>
      <h2 id="lab-brain" className="lab-brain" tabIndex={-1}>
        The brain
      </h2>
      <p className="lab-tag" aria-hidden="true">
        Lab {copy.id.toUpperCase()} · {copy.name} · greybox
      </p>
      <div className={`lab-loader lab-loader-${copy.loader}`} role="status" aria-label="Loading">
        <div className="lab-loader-inner">
          <i className="lab-loader-gauge" aria-hidden="true" />
          <p className="lab-loader-value">0</p>
          <p className="lab-loader-label" />
        </div>
      </div>
    </div>
  );
}
