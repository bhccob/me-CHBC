// LAB ONLY (throwaway). Round 72, "The Making of an Unknown". Scroll scrubs one rendered camera move round the automaton
// while it is built; each stop's words show while the camera rests there. The first view drifts a little by itself and
// under the pointer. Opening a project keeps the camera at its artifact and gives the left half to a readable page.
// The pupil hands over to the desk through a circle that opens from the middle of the screen. Lengths in screen heights.

// ---- the projects: one record each; the beat, the opened page and the plain list are all built from these
const PROJECTS = [
  {
    key: 'jontai', title: 'Jontai Energy', kind: 'Website · Concept redesign', year: 2026,
    artifact: 'A dial with a small sun on its arc and a panel that turns to follow it.',
    line: 'A concept redesign for a solar, power and furniture store in Aruba. Its home page is one Aruban day that plays as you scroll.',
    lead: 'A concept redesign of the website for Jontai Energy, a store in Oranjestad, Aruba, for solar, power, lighting and furniture. Its home page is one Aruban day that plays as you scroll.',
    image: { src: 'img/jontai-type.webp', w: 1440, h: 810, alt: 'Jontai Energy redesign: JONTAI in large green letters above “Aruba sunlight, made useful.”, with Explore solar and Visit the store', caption: 'The redesign’s first screen' },
    objective: 'One continuous film of a single day on one plaster wall: scrolling moves the sun, and each product does its work at its hour, from the solar panel catching first light to the generator taking over in a night-time outage.',
    contribution: 'Design and front-end development. A personal project, not client work.',
    tech: ['Next.js', 'React', 'TypeScript', 'GSAP', 'Lenis', 'Blender'],
    implementation: 'The film is rendered in Blender Cycles from a set built in Python, published as image frames and played on one canvas as you scroll, with GSAP ScrollTrigger and Lenis. Visitors who prefer reduced motion, use Save-Data or have no JavaScript get one still per chapter with its words.',
    decisions: 'Every figure traced to a manufacturer’s document, no prices or stock made up, the renders never presented as the real store, and the scroll resting on each product long enough to read it.',
    challenges: null,
    outcome: 'A working concept redesign. It is not published, and jontaienergy.com is not my build.',
    links: [{ label: 'Source on GitHub', href: 'https://github.com/bhccob/Jontai-Energy' }],
  },
  {
    key: 'lumo', title: 'Lumo', kind: 'Android app', year: 2026,
    artifact: 'A frame of rods, every row of beads put in order.',
    line: 'A grocery list for Android. Recipes and typed items merge into one list, sorted in the order of the store’s aisles.',
    lead: 'A grocery list for Android. Recipes and typed items merge into one list, sorted in the order of the store’s aisles, offline and checked off with one hand.',
    image: { src: 'img/lumo.webp', w: 540, h: 1050, alt: 'Lumo’s list for this week: produce, bakery, dairy and meat, each with its items to check off', caption: 'The list, sorted by aisle', tall: true },
    objective: 'One list in the order you walk the store: what you typed and what your recipes need, together.',
    contribution: null,
    tech: ['Expo', 'React Native', 'SQLite'],
    implementation: 'SQLite on the phone is the source of truth, and the list itself is never stored: it is worked out from what was added, each time it is read. Recipes, a pantry and your own stores and aisles came in three phases.',
    decisions: null, challenges: null,
    outcome: 'Released as Lumo 0.3.1, a signed Android download, with its own website.',
    links: [{ label: 'lumogrocery.com', href: 'https://lumogrocery.com' }, { label: 'Download', href: 'https://github.com/bhccob/lumo-app' }],
  },
  {
    key: 'locked', title: 'Locked', kind: 'Android app', year: 2026,
    artifact: 'Graduated plates on a spindle, a lock ring lit at the top.',
    line: 'A gym log for Android. It gives you your next weight from your own history, keeps your streak and earns you a rank.',
    lead: 'A gym log for Android. It gives you your next weight from your own history, keeps your streak and earns you a rank, with weekly leagues and a top 100.',
    image: null,
    objective: 'Make progress visible: the next weight to lift, a streak to keep and a rank to earn.',
    contribution: null,
    tech: ['Expo', 'React Native', 'SQLite', 'Supabase'],
    implementation: 'SQLite on the phone stays the source of truth and backs up to Supabase. For the leagues and the top 100 the server works out every score itself, running a copy of the app’s own scoring code, so a phone cannot send its own score.',
    decisions: 'Fair rankings: a lift above every world record, or a big jump within 30 days, does not count for the top 100.',
    challenges: null,
    outcome: 'Version 0.4.2 is a public Android download, with 911 automated tests. It has run on the emulator; a real week of training with it is next.',
    links: [{ label: 'lockedlifts.com', href: 'https://lockedlifts.com' }, { label: 'Download', href: 'https://github.com/bhccob/locked-app' }],
  },
  {
    key: 'cookies', title: 'Cookies Clicker', kind: 'Browser game · School project', year: 2025,
    artifact: 'A button, and a rising spiral of coins that grow as they go.',
    line: 'A browser game built with a classmate around one loop: click, earn, reinvest, and watch it compound.',
    lead: 'A browser-based incremental game, built as a school project around one satisfying loop: click, earn cookies, reinvest in upgrades and watch production compound.',
    image: { src: 'img/cookies-playing.webp', w: 1440, h: 900, alt: 'Cookies Clicker being played: the cookie counter, the store of producers and the boosts panel', caption: 'Cookies Clicker being played' },
    objective: 'Turn a single action into a progression system, for the school subject Web Game Development.',
    contribution: 'Built with a classmate. My own part: <span class="todo">to write</span>',
    tech: ['HTML', 'CSS', 'JavaScript', 'Bootstrap 5', 'localStorage'],
    implementation: 'Producers share a reusable AutoClicker class, timed boosts and random bonus events keep the loop lively, and progress is saved in the browser with localStorage so players can pick up where they left off.',
    decisions: 'Every click, purchase and boost gives clear feedback, and upgrade costs are paced so progress stays rewarding without becoming trivial.',
    challenges: null,
    outcome: 'A playable browser game, its source public on GitHub.',
    links: [{ label: 'Source on GitHub', href: 'https://github.com/bhccob/Cookies-Clicker' }],
  },
];

(async () => {
  const q = new URLSearchParams(location.search);
  const DIR = '/proof-out/lab/mock/' + (q.get('dir') ?? 'r72');
  const json = (u) => fetch(u).then((r) => r.json());
  const [info, drift, lay] = await Promise.all([json(`${DIR}/seq/frames.json`), json(`${DIR}/drift/drift.json`).catch(() => ({ count: 0 })), json(`${DIR}/layout.json`).catch(() => ({}))]);
  const WORKS = PROJECTS.map((p) => p.key);
  const ORDER = ['origin', 'foundation', 'interaction', 'protection', 'evolution', 'works', ...WORKS.map((k) => `w-${k}`), 'awakening', 'eye', 'desk'];
  const HOLD = { origin: 0.6, foundation: 1.1, interaction: 1.0, protection: 1.2, evolution: 1.2, works: 0.9, awakening: 1.3, eye: 0.6, desk: 1.3 };
  WORKS.forEach((k) => (HOLD[`w-${k}`] = 0.85));
  const MOVE = [1.3, 0.9, 1.0, 1.0, 0.8, 0.6, 0.7, 0.7, 0.7, 1.7, 1.1, 1.5];
  const CHAPTER = { origin: 'origin', foundation: 'foundation', interaction: 'foundation', protection: 'protection', evolution: 'evolution', works: 'works', awakening: 'awakening', eye: 'eye', desk: 'eye' };
  WORKS.forEach((k) => (CHAPTER[`w-${k}`] = 'works'));
  const FOCUS = { origin: 0.55, foundation: 0.64, interaction: 0.64, protection: 0.64, evolution: 0.62, works: 0.56, awakening: 0.5, eye: 0.5, desk: 0.56 };
  WORKS.forEach((k) => (FOCUS[`w-${k}`] = lay[`w-${k}`]?.c?.[0] ?? 0.62));

  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n, w) => String(n).padStart(w, '0');

  // ---- words for each project, from the records
  const N = WORKS.length;
  const esc = (s) => s;   // the records are mine and trusted; they may hold a <span class="todo">
  PROJECTS.forEach((p, i) => {
    const prev = i ? PROJECTS[i - 1] : null, next = PROJECTS[i + 1];
    $(`[data-work="${p.key}"]`).innerHTML = `
      <p class="cat"><b>${pad(i + 1, 2)} / ${pad(N, 2)}</b>${p.kind} · ${p.year}</p>
      <h2>${p.title}</h2>
      <p>${esc(p.line)}</p>
      <p class="meta">${p.artifact}</p>
      <div class="acts"><button type="button" class="openbtn" data-open="${p.key}">Open project</button></div>
      <nav class="step" aria-label="Projects">${prev ? `<a href="#w-${prev.key}" data-go="w-${prev.key}">← ${prev.title}</a>` : `<a href="#works" data-go="works">← The ring</a>`}${next ? `<a href="#w-${next.key}" data-go="w-${next.key}">${next.title} →</a>` : `<a href="#awakening" data-go="awakening">It wakes →</a>`}</nav>`;
  });
  const field = (label, v, html = false) => `<div><dt>${label}</dt><dd${v ? '' : ' class="todo"'}>${v ? (html ? v : esc(v)) : 'To write'}</dd></div>`;
  $('.sheet-body').innerHTML = PROJECTS.map((p) => `
    <article class="project" data-project="${p.key}" hidden>
      <h2 id="sheet-title-${p.key}">${p.title}</h2>
      <p class="cat">${p.kind} · ${p.year}</p>
      <p class="lead">${p.lead}</p>
      ${p.image ? `<figure${p.image.tall ? ' class="tall"' : ''}><img src="${p.image.src}" width="${p.image.w}" height="${p.image.h}" alt="${p.image.alt}" loading="lazy" /><figcaption>${p.image.caption}</figcaption></figure>`
                : `<figure class="empty"><p>Screens to come</p></figure>`}
      <dl>
        ${field('Objective', p.objective)}
        ${field('My part', p.contribution, true)}
        <div><dt>Built with</dt><dd class="chips">${p.tech.map((t) => `<i>${t}</i>`).join('')}</dd></div>
        ${field('How it works', p.implementation)}
        ${field('Decisions', p.decisions)}
        ${field('Challenges', p.challenges)}
        ${field('Outcome', p.outcome)}
        <div><dt>Links</dt><dd>${p.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join(' · ')}</dd></div>
      </dl>
    </article>`).join('');
  $('.list ol').innerHTML = PROJECTS.map((p, i) => `<li><button type="button" data-open="${p.key}"><span>${pad(i + 1, 2)}</span><b>${p.title}</b><i>${p.kind}</i><em>${p.year}</em></button></li>`).join('');

  // ---- the timeline
  const segs = []; let T = 0;
  ORDER.forEach((name, i) => {
    segs.push({ kind: 'hold', i, from: T, len: HOLD[name] }); T += HOLD[name];
    if (i < MOVE.length) { segs.push({ kind: 'move', i, from: T, len: MOVE[i] }); T += MOVE[i]; }
  });
  const startOf = Object.fromEntries(segs.filter((s) => s.kind === 'hold').map((s) => [ORDER[s.i], s.from]));
  document.querySelector('.runway').style.height = `${(T + 1) * 100}vh`;

  const canvas = $('.film'), ctx = canvas.getContext('2d');
  const beats = Object.fromEntries($$('.beat').map((el) => [el.dataset.beat, el]));
  const scrim = $('.scrim'), chapters = $('.chapters'), tags = $$('.tags a');
  const sheet = $('.sheet'), sheetBody = $('.sheet-body'), articles = $$('.project'), pagerB = $('.pager b');
  const list = $('.list');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = matchMedia('(max-aspect-ratio: 1/1)');
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

  // ---- pictures, the first stretch before the rest
  const img = (src, go = true) => { const im = new Image(); im.dataset.src = src; if (go) im.src = src; return im; };
  const MID = Math.max(0, (drift.count - 1) / 2);
  const firstN = info.stops.foundation + 1;
  const drifts = Array.from({ length: drift.count }, (_, i) => img(`${DIR}/drift/d${pad(i, 2)}.jpg`));
  const frames = Array.from({ length: info.count }, (_, i) => img(`${DIR}/seq/f${pad(i, 3)}.jpg`, i < firstN));
  const first = [...new Set([...drifts, ...frames.slice(0, firstN)])];
  const all = [...new Set([...drifts, ...frames])]; let loaded = 0;
  const count = $('.loader b');
  const wait = (im) => im.decode().catch(() => {}).then(() => { count.textContent = Math.round((++loaded / all.length) * 100); });
  await Promise.all(first.map(wait));
  document.body.classList.remove('loading');
  (async () => {
    const rest = frames.slice(firstN).filter((im) => !im.src);
    for (let i = 0; i < rest.length; i += 8) {
      const batch = rest.slice(i, i + 8); batch.forEach((im) => (im.src = im.dataset.src));
      await Promise.all(batch.map(wait));
    }
  })();

  // ---- state
  let cw = 0, ch = 0, dpr = 1, sig = '';
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let open = null, pin = null;
  const held = q.has('p') ? Number(q.get('p')) * T : null;
  const heldDrift = q.has('a') ? Number(q.get('a')) : null;
  let cur = held ?? scrollY / innerHeight;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); cw = innerWidth; ch = innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); sig = '';
    ctx.fillStyle = '#0e0a14'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    place();
  }
  // the frame's cover crop in CSS pixels; on wide screens it never loses more than 6% a side or 10% top and bottom
  function crop(fx) {
    let s = Math.max(cw / 16, ch / 9);
    if (!phone.matches) s = Math.min(s, cw / (0.88 * 16), ch / (0.80 * 9));
    const w = 16 * s, h = 9 * s;
    return { x: w >= cw ? Math.min(0, Math.max(cw - w, cw / 2 - fx * w)) : (cw - w) / 2, y: (ch - h) / 2, w, h };
  }
  function feather(fx) {
    const c = crop(fx), G = '14, 10, 20';
    const band = (x0, y0, x1, y1, w, h, x, y) => {
      const g = ctx.createLinearGradient(x0 * dpr, y0 * dpr, x1 * dpr, y1 * dpr);
      g.addColorStop(0, `rgba(${G}, 1)`); g.addColorStop(1, `rgba(${G}, 0)`);
      ctx.fillStyle = g; ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
    };
    ctx.globalAlpha = 1;
    if (c.h < ch - 1) { const d = c.h * 0.12; band(0, c.y, 0, c.y + d, cw, d + 1, 0, c.y - 1); band(0, c.y + c.h, 0, c.y + c.h - d, cw, d + 1, 0, c.y + c.h - d); }
    if (c.w < cw - 1) { const d = c.w * 0.10; band(c.x, 0, c.x + d, 0, d + 1, ch, c.x - 1, 0); band(c.x + c.w, 0, c.x + c.w - d, 0, d + 1, ch, c.x + c.w - d, 0); }
  }
  function draw(im, alpha, fx) {
    if (!im || !im.complete || !im.naturalWidth || alpha <= 0.001) return false;
    const c = crop(fx); ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(im, c.x * dpr, c.y * dpr, c.w * dpr, c.h * dpr); return true;
  }
  function nearest(list, i) {
    for (let d = 0; d < list.length; d++) for (const j of [i - d, i + d]) if (list[j]?.complete && list[j].naturalWidth) return list[j];
    return null;
  }
  function blend(list, f, fx) {
    const i = Math.floor(clamp(f, 0, list.length - 1)), k = f - i;
    if (!draw(list[i], 1, fx)) draw(nearest(list, i), 1, fx);
    if (k > 0.002 && list[i + 1]) draw(list[i + 1], k, fx);
  }

  // names over the four artifacts, from the render's own coordinates
  function place() {
    if (phone.matches || !lay.works) { tags.forEach((a) => a.removeAttribute('style')); return; }
    const c = crop(FOCUS.works);
    tags.forEach((a) => {
      const p = lay.works[a.dataset.tag].top;
      a.style.setProperty('--x', `${c.x + p[0] * c.w}px`); a.style.setProperty('--y', `${c.y + p[1] * c.h - 4}px`);
    });
  }

  const stopFrame = (i) => info.stops[ORDER[i]];
  const BLACK = info.black, DESK0 = info.desk0;
  function render(u, now) {
    u = clamp(u, 0, T);
    const seg = segs.findLast((s) => u >= s.from) ?? segs[0];
    const t = seg.len ? clamp((u - seg.from) / seg.len) : 0;
    const pres = {}; let f, fx, at = ORDER[seg.i];
    if (seg.kind === 'hold') { pres[at] = 1; f = stopFrame(seg.i); fx = FOCUS[at]; }
    else {
      const a = ORDER[seg.i], b = ORDER[seg.i + 1];
      pres[a] = clamp(1 - t / 0.25); pres[b] = clamp((t - 0.75) / 0.25);
      f = stopFrame(seg.i) + (stopFrame(seg.i + 1) - stopFrame(seg.i)) * t;
      fx = FOCUS[a] + (FOCUS[b] - FOCUS[a]) * t; if (t > 0.5) at = b;
    }
    // the first view drifts slowly round the surface, nudged by the pointer, and settles as the scroll begins
    let d = null;
    if (drifts.length && seg.kind === 'hold' && seg.i === 0) {
      const amount = clamp(1 - u / (HOLD.origin * 0.7));
      const idle = calm ? 0 : Math.sin((now / 1000) * (Math.PI * 2 / 24)) * 0.7;
      const a = heldDrift ?? clamp(idle + (calm ? 0 : mouse.sx * 0.35), -1, 1) * amount;
      d = MID + a * MID;
    }
    // through the pupil: black, then the desk opens from the middle in a widening circle with a gold edge
    const reveal = f > BLACK ? clamp((f - BLACK) / 3.2) : null;
    const s = `${f.toFixed(3)}|${d === null ? '' : d.toFixed(3)}|${fx.toFixed(3)}|${loaded}`;
    if (s !== sig) {
      sig = s; ctx.globalAlpha = 1;
      if (reveal !== null && reveal < 1) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const r = Math.hypot(cw, ch) * 0.5 * (calm ? 1 : reveal * reveal * (3 - 2 * reveal));
        ctx.save(); ctx.beginPath(); ctx.arc((cw / 2) * dpr, (ch / 2) * dpr, Math.max(0.5, r) * dpr, 0, Math.PI * 2); ctx.clip();
        draw(frames[Math.max(DESK0, Math.round(f))] ?? nearest(frames, DESK0), 1, fx); ctx.restore();
        ctx.globalAlpha = 0.85 * (1 - reveal); ctx.strokeStyle = '#c5a45a'; ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc((cw / 2) * dpr, (ch / 2) * dpr, Math.max(0.5, r) * dpr, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (d !== null) blend(drifts, d, fx);
      else blend(frames, f, fx);
      if (!phone.matches && reveal === null) feather(fx);
      ctx.globalAlpha = 1;
    }
    let side = 0, corner = 0;
    for (const [name, el] of Object.entries(beats)) {
      const a = pres[name] ?? 0;
      el.style.opacity = a; el.style.transform = `translateY(${(1 - a) * 14}px)`;
      el.classList.toggle('live', a > 0.01);
      if (el.classList.contains('col')) side = Math.max(side, a);
      if (el.classList.contains('free')) corner = Math.max(corner, a);
    }
    scrim.style.setProperty('--side', open ? 1 : side); scrim.style.setProperty('--corner', open ? 0 : corner);
    chapters.style.setProperty('--progress', (u / T).toFixed(4));
    const chap = CHAPTER[at];
    $$('a', chapters).forEach((a) => { if (a.dataset.ch === chap) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
    motesOn = reveal === null;
  }

  // ---- a project opens where its artifact stands; the page under it holds still until it closes
  let opener = null;
  const stopAt = (name) => startOf[name] + HOLD[name] * 0.5;
  function setOpen(key, from) {
    if (key && from) opener = from;
    const was = open;
    open = key; document.body.classList.toggle('open', !!key);
    if (key) {
      pin = stopAt(`w-${key}`); if (calm || Math.abs(pin - cur) > 2.5) cur = pin;
      document.documentElement.style.overflow = 'hidden';
      sheet.hidden = false;
      articles.forEach((a) => (a.hidden = a.dataset.project !== key));
      sheet.setAttribute('aria-labelledby', `sheet-title-${key}`);
      pagerB.textContent = `${pad(WORKS.indexOf(key) + 1, 2)} / ${pad(N, 2)}`;
      sheetBody.scrollTop = 0;
      requestAnimationFrame(() => sheetBody.focus({ preventScroll: true }));
    } else {
      const back = pin; pin = null;
      document.documentElement.style.overflow = '';
      if (back !== null) scrollTo({ top: back * innerHeight, behavior: 'auto' });
      setTimeout(() => { if (!open) sheet.hidden = true; }, calm ? 0 : 450);
      // back to the open button of the project that was showing (the arrows may have moved on from the one opened)
      setTimeout(() => (document.querySelector(`[data-work="${was}"] .openbtn`) ?? opener)?.focus({ preventScroll: true }), 80);
    }
  }
  const step = (d) => { const i = (WORKS.indexOf(open) + d + N) % N; setOpen(WORKS[i]); };
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => { closeList(); setOpen(b.dataset.open, b); }));
  $('.back').addEventListener('click', () => setOpen(null));
  $('.prev').addEventListener('click', () => step(-1));
  $('.next').addEventListener('click', () => step(1));
  function openList(from) { opener = from; list.hidden = false; $('.list-close').focus(); }
  function closeList() { if (!list.hidden) list.hidden = true; }
  $('[data-list]').addEventListener('click', (e) => openList(e.currentTarget));
  $('.list-close').addEventListener('click', () => { closeList(); opener?.focus(); });
  list.addEventListener('click', (e) => { if (e.target === list) { closeList(); opener?.focus(); } });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!list.hidden) { closeList(); opener?.focus(); } else if (open) setOpen(null); }
    if (open && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
  });
  if (q.has('open')) setOpen(q.get('open'));
  if (q.has('list')) openList(null);

  // ---- a few motes over everything, nearer ones larger and faster; gone once we are behind the eye
  const motes = $('.motes'), mctx = motes.getContext('2d');
  let motesOn = true;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const dust = Array.from({ length: 40 }, (_, i) => ({ x: rnd(), y: rnd(), z: 0.25 + rnd() * 0.75, vx: (rnd() - 0.5) * 0.006, vy: -0.002 - rnd() * 0.005, warm: i % 5 === 2 }));
  let lastY = scrollY, lastT = performance.now();
  function drawDust(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const dy = (scrollY - lastY) / innerHeight; lastY = scrollY;
    if (motes.width !== canvas.width || motes.height !== canvas.height) { motes.width = canvas.width; motes.height = canvas.height; }
    mctx.clearRect(0, 0, motes.width, motes.height);
    if (!motesOn) return;
    for (const p of dust) {
      if (!calm) { p.x += p.vx * dt * p.z; p.y += p.vy * dt * p.z - dy * 0.22 * p.z; }
      p.x = (p.x + 1) % 1; p.y = (p.y + 1) % 1;
      const x = (p.x * cw - mouse.sx * 14 * p.z) * dpr, y = (p.y * ch - mouse.sy * 10 * p.z) * dpr, r = (0.5 + p.z * 1.4) * dpr;
      mctx.globalAlpha = (p.warm ? 0.7 : 0.3) * (0.35 + p.z * 0.65);
      mctx.fillStyle = p.warm ? '#c5a45a' : '#8a5cc5';
      mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
    }
  }

  // ---- run
  size(); addEventListener('resize', size); phone.addEventListener('change', () => { sig = ''; place(); });
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  (function tick(now) {
    const want = pin ?? held ?? scrollY / innerHeight;
    cur += (want - cur) * (calm || held !== null ? 1 : 0.1);
    if (Math.abs(want - cur) < 0.0005) cur = want;
    mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
    render(cur, now ?? performance.now()); drawDust(now ?? performance.now()); requestAnimationFrame(tick);
  })();
  window.__ready = true;
  window.__T = T; window.__startOf = startOf; window.__HOLD = HOLD;

  $$('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); if (open) setOpen(null); closeList();
    scrollTo({ top: (startOf[a.dataset.go] + HOLD[a.dataset.go] * 0.4) * innerHeight, behavior: calm ? 'auto' : 'smooth' });
  }));
})();
