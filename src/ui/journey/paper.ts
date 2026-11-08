import { ease, ramp, seeded } from '~/journey/math';

/**
 * The page under everything on the first view, drawn in code: dark mist, a far hill and a sea line, and an Aruban tree that
 * reaches in from the top right corner, its branches turning into gold circuit traces with small lit blossoms. It grows on
 * load. A few sparks drift in front. From the mock's `paintBase`, `buildTree`, `drawPaper`.
 */

export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  gold: boolean;
  d: number;
}

/** How long the tree takes to grow, ms. */
const GROW_MS = 2600;

/** Where the tree may grow: under the menu (TOP_HIGH of the height) and no lower than TOP_LOW, in from the right REACH of the width. */
const TOP_HIGH = 0.1;
const TOP_LOW = 0.3;
const TOP_LOW_PHONE = 0.24;
const REACH = 0.5;
const REACH_PHONE = 0.7;
/** How thick the tree is drawn, against how it grows. */
const THIN = 0.6;

export function mist(c: CanvasRenderingContext2D, w: number, h: number, r: () => number, tints: readonly string[], n: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = (0.12 + r() * 0.34) * Math.max(w, h), tint = tints[Math.floor(r() * tints.length)];
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.save();
    c.translate(x, y);
    c.scale(1, 0.34 + r() * 0.4);
    c.translate(-x, -y);
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    c.restore();
  }
}

export function grain(c: CanvasRenderingContext2D, w: number, h: number, r: () => number, a: number): void {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = '#fff';
  const n = Math.min(26000, (w * h) / 60);
  for (let i = 0; i < n; i++) c.fillRect(r() * w, r() * h, 1, 1);
  c.restore();
}

/**
 * The tree, kept to the top of the sky so the city below keeps the eye: it reaches in from the top right corner, under the
 * menu, its wood turning to gold traces after two forks, every branch's end lit. A branch stops where it would go lower than
 * TOP_LOW of the page or further in than REACH of its width.
 */
export function buildTree(w: number, h: number): { segs: Segment[]; tips: [number, number][] } {
  const r = seeded(4711), segs: Segment[] = [], tips: [number, number][] = [], S = Math.min(w, h * 1.7) / 1280;
  const wide = w > h;
  const high = h * TOP_HIGH, low = h * (wide ? TOP_LOW : TOP_LOW_PHONE), inner = w * (1 - (wide ? REACH : REACH_PHONE));
  function branch(x: number, y: number, ang: number, len: number, wid: number, depth: number): void {
    if (depth > 6 || wid < 0.6) {
      tips.push([x, y]);
      return;
    }
    const gold = depth >= 2;
    let cx = x, cy = y, a = ang;
    const steps = gold ? 2 : 5;
    for (let i = 0; i < steps; i++) {
      // Traces turn in 45 degree steps; the wood leans west with the trade wind.
      if (gold) a = Math.round((a + (r() - 0.5) * 1.3) / (Math.PI / 4)) * (Math.PI / 4);
      else a += (r() - 0.5) * 0.3 + (Math.PI - a) * 0.06;
      const l = (len / steps) * (0.8 + r() * 0.4);
      let nx = cx + Math.cos(a) * l, ny = cy + Math.sin(a) * l;
      // Under the menu, never up into it: it runs level there instead.
      if (ny < high) {
        ny = high;
        a = Math.PI;
      }
      // At its edge the branch ends where it is.
      const t = Math.min(1, ny > low ? (low - cy) / (ny - cy) : 1, nx < inner ? (inner - cx) / (nx - cx) : 1);
      if (t < 1) {
        nx = cx + (nx - cx) * t;
        ny = cy + (ny - cy) * t;
        segs.push({ x0: cx, y0: cy, x1: nx, y1: ny, w: wid * (1 - (i / steps) * 0.28), gold, d: depth });
        tips.push([nx, ny]);
        return;
      }
      segs.push({ x0: cx, y0: cy, x1: nx, y1: ny, w: wid * (1 - (i / steps) * 0.28), gold, d: depth });
      cx = nx;
      cy = ny;
    }
    const kids = depth < 2 ? 2 : r() < 0.62 ? 2 : 1;
    for (let k = 0; k < kids; k++) {
      const turn = kids === 1 ? (r() - 0.5) * 0.4 : (k === 0 ? -1 : 1) * (0.25 + r() * 0.4);
      branch(cx, cy, a + turn, len * (0.7 + r() * 0.14), wid * 0.62, depth + 1);
    }
  }
  branch(w * 1.02, h * 0.13, Math.PI * 0.985, 190 * S, 11 * S, 0);
  segs.sort((p, q) => p.d - q.d);
  // Drawn thinner than it grows, so that it keeps every fork.
  return { segs: segs.map((s) => ({ ...s, w: s.w * THIN })), tips };
}

/** The page's ground, as tokens.css has it (--night): the one place script code takes it from. */
export const GROUND = '#130724';

function paintBase(w: number, h: number): HTMLCanvasElement {
  const r = seeded(90210);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = GROUND;
  x.fillRect(0, 0, w, h);
  mist(x, w, h, r, ['rgba(70,50,130,.15)', 'rgba(40,36,90,.16)', 'rgba(110,90,170,.07)'], 26);
  // A far hill and the sea line, on the left, in ink.
  const hy = h * 0.74, hx = w * 0.36;
  x.fillStyle = 'rgba(92,80,140,.12)';
  x.beginPath();
  x.moveTo(hx - w * 0.22, hy);
  x.quadraticCurveTo(hx - w * 0.05, hy - h * 0.06, hx - w * 0.015, hy - h * 0.2);
  x.quadraticCurveTo(hx, hy - h * 0.235, hx + w * 0.018, hy - h * 0.195);
  x.quadraticCurveTo(hx + w * 0.07, hy - h * 0.04, hx + w * 0.24, hy);
  x.closePath();
  x.fill();
  x.fillStyle = 'rgba(92,80,140,.07)';
  x.beginPath();
  x.moveTo(hx + w * 0.02, hy);
  x.quadraticCurveTo(hx + w * 0.2, hy - h * 0.1, hx + w * 0.46, hy);
  x.closePath();
  x.fill();
  const sea = x.createLinearGradient(0, hy, 0, h);
  sea.addColorStop(0, 'rgba(120,105,180,.13)');
  sea.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = sea;
  x.fillRect(0, hy, w, h - hy);
  x.strokeStyle = 'rgba(190,175,235,.12)';
  x.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const y = hy + Math.pow(r(), 1.8) * (h - hy), lx = r() * w, ll = 30 + r() * 180;
    x.globalAlpha = 0.3 + r() * 0.5;
    x.beginPath();
    x.moveTo(lx, y);
    x.lineTo(lx + ll, y);
    x.stroke();
  }
  x.globalAlpha = 1;
  grain(x, w, h, r, 0.022);
  return c;
}

function drawSegment(x: CanvasRenderingContext2D, s: Segment): void {
  x.beginPath();
  x.moveTo(s.x0, s.y0);
  x.lineTo(s.x1, s.y1);
  if (s.gold) {
    x.strokeStyle = 'rgba(230,184,74,.72)';
    x.lineCap = 'square';
    x.lineWidth = Math.max(1, s.w);
  } else {
    x.strokeStyle = 'rgba(58,50,84,.96)';
    x.lineCap = 'round';
    x.lineWidth = s.w;
  }
  x.stroke();
  if (!s.gold) {
    x.strokeStyle = 'rgba(160,145,205,.16)';
    x.lineWidth = Math.max(1, s.w * 0.22);
    x.stroke();
  }
}

export interface Paper {
  /** Draws the page at this time, ms. */
  draw(now: number): void;
  /** Paints it again at the window's size, keeping how far the tree has grown. */
  fit(): void;
  /** Starts the tree growing, as the visitor arrives. */
  grow(now: number): void;
}

export function createPaper(canvas: HTMLCanvasElement, reduce: boolean): Paper {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  let base: HTMLCanvasElement | null = null;
  let segs: Segment[] = [];
  let tips: [number, number][] = [];
  let started: number | null = null;
  // Once the tree is grown it goes into the base, so that only its blossoms are drawn again.
  let baked = false;

  const fit = (): void => {
    const d = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * d);
    canvas.height = Math.round(innerHeight * d);
    base = paintBase(canvas.width, canvas.height);
    const tree = buildTree(canvas.width, canvas.height);
    segs = tree.segs;
    tips = tree.tips;
    baked = false;
  };

  return {
    fit,
    grow(now) {
      started = now;
    },
    draw(now) {
      if (!base) fit();
      const q = reduce ? 1 : started === null ? 0 : Math.min(1, (now - started) / GROW_MS);
      if (q >= 1 && !baked && base) {
        const x = base.getContext('2d') as CanvasRenderingContext2D;
        for (const s of segs) drawSegment(x, s);
        baked = true;
      }
      ctx.drawImage(base as HTMLCanvasElement, 0, 0);
      if (!baked) {
        const n = Math.floor(segs.length * (1 - Math.pow(1 - q, 2.2)));
        for (let i = 0; i < n; i++) drawSegment(ctx, segs[i]);
      }
      if (q <= 0.55) return;
      const bq = ease(q, 0.55, 1);
      tips.forEach(([x, y], i) => {
        const on = ramp(bq * tips.length, i, i + 6);
        if (on <= 0) return;
        const pulse = reduce ? 1 : 0.78 + 0.22 * Math.sin(now / 900 + i * 1.7);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 10 * on);
        g.addColorStop(0, `rgba(255,214,120,${0.32 * pulse})`);
        g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 18, y - 18, 36, 36);
        ctx.fillStyle = '#fff0c4';
        ctx.beginPath();
        ctx.arc(x, y, 1.5 * on * Math.max(1, canvas.width / 1600), 0, 7);
        ctx.fill();
      });
    },
  };
}

export interface Sparks {
  draw(level: number, dt: number, now: number): void;
  fit(): void;
}

/** The sparks that drift in front of the first view, like petals. */
export function createSparks(canvas: HTMLCanvasElement): Sparks {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const r = seeded(1234);
  const motes = Array.from({ length: 34 }, () => ({ x: 0.3 + r() * 0.72, y: r(), v: 0.012 + r() * 0.03, d: 0.3 + r() * 0.7, ph: r() * 6.28, s: 0.7 + r() * 1.5 }));
  let clean = false;
  return {
    fit() {
      const d = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(innerWidth * d);
      canvas.height = Math.round(innerHeight * d);
    },
    draw(level, dt, now) {
      if (level <= 0) {
        if (!clean) ctx.clearRect(0, 0, canvas.width, canvas.height);
        clean = true;
        return;
      }
      clean = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height, d = W / innerWidth;
      for (const m of motes) {
        m.y += m.v * dt;
        m.x -= m.v * dt * 0.7;
        if (m.y > 1.03) {
          m.y = -0.03;
          m.x = 0.3 + r() * 0.72;
        }
        if (m.x < 0) m.x = 1;
        const X = (m.x + Math.sin(now / 1800 + m.ph) * 0.006) * W, Y = m.y * H;
        ctx.globalAlpha = level * m.d * (0.55 + 0.45 * Math.sin(now / 700 + m.ph));
        ctx.fillStyle = '#f5cf73';
        ctx.save();
        ctx.translate(X, Y);
        ctx.rotate(now / 1300 + m.ph);
        ctx.fillRect(-m.s * d, -m.s * d * 0.5, m.s * 2 * d, m.s * d);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}
