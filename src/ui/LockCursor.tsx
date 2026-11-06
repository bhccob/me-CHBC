import { type JSX, useEffect, useRef } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { cornerStiffness, cursorOn, HOVERABLE, lockTarget, PINCH, springStep } from '~/journey/cursor/lock';
import '~/styles/cursor.css';

const GOLD = '230,184,74';
const PALE = '255,232,170';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** How long the ring of corners takes to go out on letting go, s. */
const LET_GO_S = 0.34;

declare global {
  interface Window {
    __lockCursor?: { corners(): [number, number][]; on(): boolean };
  }
}

/**
 * The cursor on a mouse: four gold corners and a small dot at the true position, so clicking stays exact. It sits above
 * everything and never takes a click. Over a link or button the corners close around it; over a project, a window says OPEN.
 */
export function LockCursor(): JSX.Element {
  const { t } = useTranslator();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const openWord = useRef(t.journey.cursor.open);
  openWord.current = t.journey.cursor.open;

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canvas || !cursorOn(matchMedia('(pointer: fine)').matches, matchMedia('(hover: hover)').matches, reduced)) return undefined;
    const g = canvas.getContext('2d');
    if (!g) return undefined;
    const root = document.documentElement;
    root.classList.add('has-lock-cursor');
    const spring = (x = 0): { x: number; v: number } => ({ x, v: 0 });
    const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => ({ sx, sy, x: spring(-200), y: spring(-200) }));
    const cLen = spring(6), cFill = spring(0), cL = spring(0);
    const pings: { t: number }[] = [];
    let cw = 0, ch = 0, cd = 1, px = -200, py = -200, seen = 0, vis = false, last = performance.now(), downT = 0;
    let dotH = 0, lpx = -200, lpy = -200, vx = 0, vy = 0, probed = 0, raf = 0;
    let hoverEl: Element | null = null;
    const closestHover = (el: EventTarget | Element | null): Element | null => (el as Partial<Pick<Element, 'closest'>> | null)?.closest?.(HOVERABLE) ?? null;

    const onMove = (e: PointerEvent): void => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      px = e.clientX;
      py = e.clientY;
      if (!vis) {
        vis = true;
        lpx = px;
        lpy = py;
        for (const k of corners) {
          k.x.x = px + k.sx * 13;
          k.y.x = py + k.sy * 13;
          k.x.v = k.y.v = 0;
        }
      }
    };
    const onLeave = (): void => {
      vis = false;
    };
    const onOver = (e: PointerEvent): void => {
      hoverEl = closestHover(e.target);
    };
    const onDown = (e: PointerEvent): void => {
      if (e.pointerType === 'mouse') downT = 1;
    };
    const onUp = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse') return;
      downT = 0;
      pings.push({ t: 0 });
    };
    addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('mouseleave', onLeave);
    addEventListener('pointerover', onOver, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });
    if (new URLSearchParams(location.search).has('proof')) window.__lockCursor = { corners: () => corners.map((k) => [k.x.x, k.y.x]), on: () => vis };

    const frame = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const d = Math.min(1.5, devicePixelRatio || 1), w = Math.round(innerWidth * d), h = Math.round(innerHeight * d);
      if (w !== cw || h !== ch || d !== cd) {
        cw = w;
        ch = h;
        cd = d;
        canvas.width = w;
        canvas.height = h;
      }
      g.setTransform(d, 0, 0, d, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      seen += ((vis ? 1 : 0) - seen) * (1 - Math.exp(-dt / 0.12));
      if (seen > 0.01) {
        // How the true pointer is moving, and what it is over; things move under a still mouse as the page scrolls.
        const kv = 1 - Math.exp(-dt / 0.05), sd = Math.max(0.004, dt);
        vx += ((px - lpx) / sd - vx) * kv;
        vy += ((py - lpy) / sd - vy) * kv;
        lpx = px;
        lpy = py;
        const speed = Math.hypot(vx, vy), dirX = speed > 24 ? vx / speed : 0, dirY = speed > 24 ? vy / speed : 0;
        if (now - probed > 120) {
          probed = now;
          hoverEl = closestHover(document.elementFromPoint(px, py));
        }
        const big = root.hasAttribute('data-project-hot');
        const target = lockTarget({ px, py, screen: big, rect: hoverEl && !big ? hoverEl.getBoundingClientRect() : null });
        const pinch = downT * PINCH, motion = Math.min(1, speed / 900);
        for (const k of corners) {
          const K = cornerStiffness(k.sx, k.sy, dirX, dirY, motion, target.locked);
          springStep(k.x, target.cx + k.sx * (target.hw - pinch), K, 0.74, dt);
          springStep(k.y, target.cy + k.sy * (target.hh - pinch), K, 0.74, dt);
        }
        const L0 = springStep(cLen, target.len, 300, 0.7, dt);
        const F = Math.min(1, Math.max(0, springStep(cFill, downT ? 1 : target.locked || big ? 0.42 : 0, 300, 0.8, dt)));
        const L = Math.min(1, Math.max(0, springStep(cL, big ? 1 : 0, 260, 0.9, dt)));
        g.globalAlpha = seen;
        if (F > 0.01 || L > 0.01) {
          g.beginPath();
          corners.forEach((k, i) => (i ? g.lineTo(k.x.x, k.y.x) : g.moveTo(k.x.x, k.y.x)));
          g.closePath();
          if (L > 0.01) {
            g.fillStyle = `rgba(7,6,11,${0.72 * L})`;
            g.fill();
          }
          if (F > 0.01) {
            g.fillStyle = `rgba(${GOLD},${0.16 * F})`;
            g.fill();
          }
        }
        g.lineWidth = 1.7;
        g.lineCap = 'square';
        g.strokeStyle = `rgba(${GOLD},.98)`;
        g.beginPath();
        for (const k of corners) {
          g.moveTo(k.x.x - k.sx * L0, k.y.x);
          g.lineTo(k.x.x, k.y.x);
          g.lineTo(k.x.x, k.y.x - k.sy * L0);
        }
        g.stroke();
        g.lineCap = 'butt';
        if (L > 0.02) {
          g.font = `500 11px ${MONO}`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = `rgba(${PALE},${L * seen})`;
          g.fillText(openWord.current, (corners[0].x.x + corners[2].x.x) / 2, (corners[0].y.x + corners[2].y.x) / 2 + 0.5);
        }
        // Letting go: the corners answer by springing outward and fading.
        for (let i = pings.length - 1; i >= 0; i--) {
          const p = pings[i];
          p.t += dt;
          if (p.t > LET_GO_S) {
            pings.splice(i, 1);
            continue;
          }
          const q = p.t / LET_GO_S, e = 1 - Math.pow(1 - q, 3);
          g.lineWidth = 1.5;
          g.strokeStyle = `rgba(${GOLD},${0.9 * (1 - q) * (1 - q)})`;
          g.beginPath();
          for (const k of corners) {
            const x0 = k.x.x + k.sx * e * 14, y0 = k.y.x + k.sy * e * 14;
            g.moveTo(x0 - k.sx * 7, y0);
            g.lineTo(x0, y0);
            g.lineTo(x0, y0 - k.sy * 7);
          }
          g.stroke();
        }
        // The true point, with no delay; it gets out of the way of words, and steps aside for OPEN.
        if (L < 0.98) {
          g.globalAlpha = seen * (1 - L);
          dotH += ((hoverEl && !big ? 1 : 0) - dotH) * (1 - Math.exp(-dt / 0.07));
          g.fillStyle = '#fff0c4';
          g.beginPath();
          g.arc(px, py, 2.4 - dotH * 1.1, 0, Math.PI * 2);
          g.fill();
          g.lineWidth = 0.8;
          g.strokeStyle = 'rgba(7,6,11,.6)';
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove('has-lock-cursor');
      removeEventListener('pointermove', onMove);
      root.removeEventListener('mouseleave', onLeave);
      removeEventListener('pointerover', onOver);
      removeEventListener('pointerdown', onDown);
      removeEventListener('pointerup', onUp);
      delete window.__lockCursor;
    };
  }, []);

  return <canvas ref={canvasRef} className="lock-cursor" aria-hidden="true" />;
}
