/* builds the 3D scene and runs the render loop: one continuous camera move from piece to piece, then the wall, then the lock */
import * as THREE from "three";
import { PIECES, END, FORM } from "../content";
import { clamp, ss, lerp, step, $ } from "../util";
import { ORDER, START, DUR, CH, HERO_END, ME_STOPS, ME_TURNS, readScroll, type Scroll } from "../timeline";
import { arrive, seal, wind, clack, isSoundOn } from "../audio";
import { createPanels } from "../ui/panels";
import { createRig, CAM_Z, PI } from "./rig";
import { buildPieces, ME } from "./pieces";
import { buildEnvironment } from "./environment";
import { DRAW } from "./faces";
import { makeFrame, type Pose } from "./frame";
import { wallMetrics, placeInWall } from "./wall";
import { ending, placeInLock, burst, initDrag } from "./ending";
import { form, initForm, updateForm } from "./form";
import { handoff } from "../handoff";

export interface StageHooks {
  /** one more thing is ready: moves the loader's number */
  task(label: string): void;
  /** resolves once the three fonts are in, so the words on the pieces can be redrawn with them */
  fonts: Promise<void>;
}

/** throws if WebGL is not available */
export function startStage(hooks: StageHooks) {
  const rig = createRig($<HTMLCanvasElement>("gl"));
  const { renderer, scene, camera, view } = rig;
  const { pieces, meSides, aura, drawNames } = buildPieces(rig, hooks.task);
  hooks.task("Sides and glow built");
  const env = buildEnvironment(rig);
  hooks.task("Space built");
  const ui = createPanels();
  const workEl = $("work"), endEl = $("end"), bigBack = $("bigBack"), endText = $("endText");

  /* where each piece floats. FIELD: a trail leading away into the fog, each piece far beyond the one before, so you only
     ever see the one you have reached. HEROPOS: around the camera in the first view, Me nearest */
  const FIELD: THREE.Vector3[] = [];
  [[0, 0, 0], [9, 3, -26], [0, -3, -52], [-9, 2.5, -78], [0, -2.5, -104], [9, 3, -130]].forEach((a, c) => { FIELD[ORDER[c]] = new THREE.Vector3(a[0], a[1], a[2]); });
  const HEROPOS = [[5.2, -2.4, 6], [-6.5, -3.2, 2], [7.5, 3.4, -2], [-3, 5, -6], [3.2, -5.2, -10], [-5.5, 2.2, 10]].map((a) => new THREE.Vector3(a[0], a[1], a[2]));

  const tiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.52, 0, 0.18)), spinQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const presQ = new THREE.Quaternion(), eul = new THREE.Euler(), orbQ = new THREE.Quaternion(), tq = new THREE.Quaternion();
  const farV = new THREE.Vector3(), lockPos = new THREE.Vector3(), vA = new THREE.Vector3(), vP = new THREE.Vector3(), vK = new THREE.Vector3(), vL = new THREE.Vector3(), home = new THREE.Vector3(), focusV = new THREE.Vector3();
  const zoom = [0, 0, 0, 0, 0, 0], slide = [0, 0, 0, 0, 0, 0], done = [0, 0, 0, 0, 0, 0];
  /* the words on the last page: LET'S TALK, or THANK YOU after a message has been sent */
  const bigWords = bigBack.querySelectorAll("span"), endLead = endText.querySelector<HTMLElement>(".lead")!, endEyebrow = endText.querySelector<HTMLElement>(".eyebrow span")!;
  let thanksShown = false, prevFt = 0, footLive = true;
  function setEndWords(thanks: boolean) {
    const w = thanks ? FORM.thanks : END.big;
    bigWords[0].textContent = w[0]; bigWords[1].textContent = w[1];
    bigBack.setAttribute("aria-label", thanks ? FORM.thanksLabel : "Let's talk"); bigBack.classList.toggle("thanks", thanks);
    endLead.textContent = thanks ? FORM.sentLead : END.lead; endEyebrow.textContent = thanks ? FORM.sentEyebrow : END.eyebrow;
  }
  const P: Pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), sc: 1, glow: 1, vis: true };
  const F = makeFrame();
  const S = {} as Scroll;
  const fragOut = { x: 0, y: 0, z: 0, k: 0, spin: 0 };
  /** how fast the camera catches up with the scroll, per frame at 60 fps. the prototype used 0.085, which felt loose.
      the turns of the about-me piece follow a little closer still, so each turn keeps up with its short glide */
  const FOLLOW = 0.22, FOLLOW_TURNS = 0.32;

  /* the flight from block to block, from the last side of the about-me piece to Directions. the blocks stand still, one
     behind the other, SPACING apart, and a virtual camera flies straight forward through them. blocks, floor and
     fragments are drawn relative to it, so the real camera and all the layout around it stay as they are */
  const SPACING = 70;
  /** where the journey starts (as scroll progress): the last side of the about-me piece. the floor and the fragments drift
      with the scroll until here, as they always have; from here on only the flying camera moves them */
  const FLIGHT_P = START[0] + DUR[0] * ME_STOPS[3];
  /* each block comes in from its own side, a little turned, and drifts a little off-centre as it is passed:
     [in x, in y, tilt x, tilt y, tilt z, out x, out y], by station (About me, the four studies, Directions) */
  const DIR = [
    [0, 0, 0, 0, 0, -0.6, 0.5],
    [0.9, 0.35, 0.1, -0.3, 0.06, 0.7, -0.4], // software: from upper right
    [-0.4, -0.6, -0.12, 0.25, -0.05, -0.8, 0.3], // design: from lower left
    [-0.9, 0.3, 0.08, 0.3, 0.05, 0.5, 0.6], // mechatronics: from the left
    [0.45, -0.55, -0.1, -0.25, -0.06, -0.6, -0.5], // the combination: from lower right
    [0.85, 0.4, 0.1, -0.28, 0.05, 0, 0], // directions: from upper right
  ];
  const jPos = new THREE.Vector3(), jQ = new THREE.Quaternion(), jE = new THREE.Euler(), dirQ = new THREE.Quaternion();
  /* a block dissolves as the camera passes through it. only then are its materials see-through: at full strength they
     are opaque, exactly as before, so the fog still shows a far block as a solid block */
  const fadeMats = pieces.map((pc, i) => [...new Set<THREE.Material>([pc.cap, pc.band, pc.face, ...(i === ME ? [...meSides.mats, aura.sparks[0].material as THREE.Material] : [])])]);
  const faded = [false, false, false, false, false, false], fadeOf = [1, 1, 1, 1, 1, 1];
  function setFade(i: number, f: number) {
    const on = f < 0.999;
    if (on !== faded[i]) { faded[i] = on; for (const m of fadeMats[i]) { m.transparent = on; m.opacity = 1; m.needsUpdate = true; } }
    if (on) for (const m of fadeMats[i]) m.opacity = f;
  }
  /* see-through and opaque need different shaders. both are built for every piece on the first frame, so the first
     flight through a block never stalls */
  let warm = false;
  function warmUp() {
    warm = true;
    const me = pieces[ME].mesh, was = me.material, all = new Set<THREE.Material>();
    for (const ms of fadeMats) for (const m of ms) all.add(m);
    for (const see of [true, false]) {
      all.forEach((m) => { m.transparent = see; m.needsUpdate = true; });
      for (const mats of [meSides.mats, meSides.plain]) { me.material = mats; renderer.compile(scene, camera); }
    }
    me.material = was;
  }
  /** the camera is only flying past a piece when it trails the scroll by more than this (as a share of the whole
      journey). a step to a piece trails by about 0.01 when the piece fills the view, a jump across the page by 0.035 or more */
  const PASSING = 0.028;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduce = motion.matches;
  motion.addEventListener?.("change", () => { reduce = motion.matches; });

  let p = 0, mx = 0, my = 0, smx = 0, smy = 0, meName = 1, lastName = 1, arriveArmed = true, prevDc = 0, lastT = -1, frameNo = 0, counted = false, sidesOn = false;
  /* the Me piece turns about its own long axis, a quarter turn per stop */
  const LONG = new THREE.Vector3(1, 0, 0), turnQ = new THREE.Quaternion();
  /** the Me piece no longer opens into slips: it turns instead. kept at 0 so the glow and size behave as before the slips opened */
  const meOpen = 0;
  let bbOp = "", bbTr = "", ftOp = "", inWork = false;
  window.addEventListener("pointermove", (e) => { mx = e.clientX / window.innerWidth * 2 - 1; my = e.clientY / window.innerHeight * 2 - 1; });

  /* is the pointer on the lock? */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), meshes = pieces.map((pc) => pc.mesh);
  const hitTest = (e: MouseEvent) => {
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight * 2 - 1)); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(meshes, false); return h.length ? meshes.indexOf(h[0].object as THREE.Mesh) : -1;
  };
  /* the same, with the spot on the piece: used by the form's dropdown, whose lines are drawn on a face */
  const hitFace = (e: MouseEvent) => {
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight * 2 - 1)); ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(meshes, false)[0];
    return h ? { i: meshes.indexOf(h.object as THREE.Mesh), front: h.face?.materialIndex === 4, u: h.uv?.x ?? 0, v: h.uv?.y ?? 0 } : null;
  };
  initForm({ pieces, hitFace, isLive: () => ending.live, toEnd: () => { if (S.A < 0.97) window.scrollTo(0, document.documentElement.scrollHeight); } });
  initDrag(hitTest);

  const redrawFaces = (time: number) => { for (let j = 0; j < 6; j++) { DRAW[j](pieces[j].ctx, time, pieces[j].col, meName); pieces[j].tex.needsUpdate = true; } lastName = meName; };
  void hooks.fonts.then(() => { drawNames(); if (!form.open) lastName = -1; });

  /* resizing or turning the phone keeps you at the same place in the story */
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    const o = { ...S }, w = window.innerWidth;
    if (form.open || o.vh === undefined || (w === lastW && Math.abs(window.innerHeight - o.vh) < 160)) return; // a phone's address bar sliding away is not a resize
    lastW = w;
    requestAnimationFrame(() => {
      const wt = workEl.offsetTop, et = endEl.offsetTop, vh = window.innerHeight;
      const ny = o.y < o.workTop ? o.y / Math.max(1, o.workTop) * wt : o.y >= o.endTop - o.vh ? et + (o.y - o.endTop) / o.vh * vh : wt + (o.y - o.workTop);
      window.scrollTo(0, ny);
    });
  });

  /* if frames come slowly, drop the sharpness one step at a time */
  let slowSum = 0, slowN = 0, tuning = true;

  function frame(ms: number) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = -1; return; } // nothing is drawn while the tab is hidden
    const time = ms / 1000, dt = lastT < 0 ? 1 / 60 : Math.min(0.1, time - lastT);
    lastT = time; frameNo++;
    if (tuning && frameNo > 90 && dt < 0.1) {
      slowSum += dt; slowN++;
      if (slowN >= 90) { if (slowSum / slowN > 1 / 42) tuning = rig.lowerQuality(); else if (frameNo > 900) tuning = false; slowSum = slowN = 0; }
    }

    readScroll(workEl, endEl, S);
    const vh = S.vh, y = S.y, target = S.target;
    let dc = S.dc, dop = S.dop, ep = S.ep, A = S.A;
    /* the camera follows the scroll closely: it catches up in well under a tenth of a second, so the page feels
       direct. the steps (src/ui/steps.ts) already ease the scroll, so little smoothing is needed here */
    const meT = (p - START[0]) / DUR[0];
    p = reduce || F.first ? target : p + (target - p) * step(meT > 0.2 && meT < 0.82 ? FOLLOW_TURNS : FOLLOW, dt);
    if (!warm) warmUp();
    if (!counted) { counted = true; hooks.task("First frame drawn"); }
    if (form.open) { A = 1; dc = 1; dop = 1; ep = 1; } // the page cannot move under the form
    ending.live = (A > 0.97 && ending.finalT > 0) || form.open;
    const wide = view.wide, halfW = view.halfW, halfH = view.halfH;
    F.time = time; F.tt = reduce ? 0 : time; F.reduce = reduce; F.dc = dc; F.dop = dop; F.ep = ep; F.A = A; F.wide = wide; F.halfW = halfW; F.halfH = halfH;
    updateForm(F, dt, () => redrawFaces(time));
    const ft = F.ft, tt = F.tt;
    smx += (mx - smx) * step(0.06, dt); smy += (my - smy) * step(0.06, dt);
    F.smx = smx; F.smy = smy;

    /* one continuous camera move along the trail: it reaches a piece, pushes in, eases back a little, then travels on
       through the fog until the next piece appears. you never see the six together until they come back for the wall
       and, at the very end, the lock */
    let i: number, t: number, active = -1, activeAmt = 0, meTurn = 0, meLive = false, curT = 0.5, curC = 0;
    const hero = p < HERO_END, h = ss(0.006, HERO_END, p); // h: 0 = among the pieces, 1 = pulled back
    const textOn = 1 - ss(0, 0.15, dc); // chapter text never sits on top of the wall or the pages after it
    /* the journey, u: -1 before the about-me chapter (and below 0 until its last side), 0 at its last side, c at block
       c's stop (1 software … 5 Directions), 5.5 once the chapters are over. it is 0.5 where two chapters meet */
    let u = p < START[0] ? -1 : 5.5;
    for (let c = 0; c < 6; c++) if (p >= START[c] && p < START[c] + DUR[c]) { const tc = (p - START[c]) / DUR[c]; u = c ? c - 0.5 + tc : (tc - ME_STOPS[3]) / (2 * (1 - ME_STOPS[3])); }
    /* journey: how much the flight places the blocks (the rest of the way, today's poses). the camera stops at Directions */
    const onWay = dop < 1 ? 1 : 0, journey = ss(0, 0.14, u) * onWay, uc = clamp(u, 0, 5);
    /* the fog opens on the way, so the next block shows far back as a block, and stays open while the wall assembles */
    const fogOpen = ss(0, 0.2, u) * (1 - ss(0.6, 1, dc)) * onWay;
    for (let c = 0; c < 6; c++) {
      i = ORDER[c]; t = clamp((p - START[c]) / DUR[c], 0, 1);
      const live = p >= START[c] && p < START[c] + DUR[c], me = i === ME;
      const up = me ? ss(0.03, 0.12, t) : ss(0.04, 0.3, t), down = me ? ss(0.91, 0.95, t) : ss(0.7, 0.84, t), go = me ? ss(0.95, 1, t) : ss(0.84, 1, t);
      const zc = lerp(lerp(0.45, 1, up), 0.45, down);
      zoom[i] = live ? zc : 0;
      slide[i] = (me ? ss(0, 0.1, t) : ss(0, 0.25, t)) * (1 - (me ? ss(0.91, 0.96, t) : ss(0.74, 0.9, t))); // how far it has turned its face to you
      done[i] = me ? ss(0.9, 0.95, t) : ss(0.7, 0.9, t);
      if (me) {
        /* the Me chapter: the piece arrives by 0.12, the name is built 0.13 to 0.29, then the piece turns a quarter at a
           time (ME_TURNS) to show its other three sides. the last turn brings the name back round as the camera leaves */
        meName = clamp((t - 0.13) / 0.16, 0, 1);
        meTurn = ME_TURNS.reduce((a, w) => a + ss(w[0], w[1], t), 0);
        meLive = live;
        /* as the camera leaves the piece, its title grows and fades, without dropping */
        ui.show("p" + i, ss(0.18, 0.23, t) * (1 - ss(0.86, 0.9, t)) * (1 - ss(0.818, 0.87, t)) * textOn, 1 + 0.22 * ss(0.814, 0.88, t), ss(0.8, 0.814, t));
      } else {
        /* on the flight a title comes up a little small while its block is still ahead, and grows and fades as the camera
           flies past it. Directions is not flown through: its title only fades. two titles are never on screen together */
        const x = u - c, op = ss(-0.27, -0.1, x) * (1 - ss(0.04, 0.16, x)) * textOn;
        const sc = x < 0 ? 1 - 0.1 * ss(0.08, 0.27, -x) : c < 5 ? 1 + 0.22 * ss(0.03, 0.16, x) : 1;
        ui.show("p" + i, lerp(ss(0.34, 0.44, t) * (1 - ss(0.62, 0.72, t)) * textOn, op, journey), lerp(1, sc, journey), journey);
      }
      if (live) {
        active = i; activeAmt = zc; curT = t; curC = c;
        focusV.copy(FIELD[i]); if (c < 5) focusV.lerp(FIELD[ORDER[c + 1]], go); // the point the camera is looking at
      }
    }
    if (hero) { active = ORDER[0]; activeAmt = 0.45 * h; focusV.copy(FIELD[active]); } // leaving the first view, the camera is already heading for the first piece
    if (active < 0 && !hero) { active = ORDER[5]; activeAmt = 0.45; focusV.copy(FIELD[active]); } // after the last chapter the camera stays with the sixth piece
    const close = ss(0.5, 1, activeAmt); // 1 when a piece fills the view
    F.active = active;

    /* text */
    ui.show("hero", 1 - ss(0.008, 0.03, p));
    ui.hint(1 - ss(0.004, 0.02, p));
    ui.grid(close * 0.4 + ep * 0.2); ui.scrim(0); // the chapter words are behind the 3D now, and need no dark band over it
    ui.bar(S.maxY > 0 ? clamp(y / S.maxY, 0, 1) : 0);
    ui.callout(0); // the chapter number now sits in the eyebrow above each title, where the callout used to be
    if (ep > 0.5) ui.chap("Contact");
    else if (dop > 0) ui.chap("Selected work");
    else if (dc > 0.5) ui.chap("Six pieces");
    else if (active >= 0 && activeAmt > 0.5) { ui.calloutText("Piece 0" + CH[active] + " · 6 × 2 × 2"); ui.chap("0" + CH[active] + " / 06 · " + PIECES[active].name); }
    else if (p < HERO_END) ui.chap("The Lock");
    /* the work list is a page of text to read: on a phone the sound switch steps aside there (styles.css) */
    if (inWork !== (dop >= 1 && ep < 0.6)) { inWork = !inWork; document.documentElement.classList.toggle("inwork", inWork); }

    /* the six pieces are loose: each has its own spot in the field and tumbles on its own.
       lockQ is only used on the last page, where they finally come together */
    const since = time - ending.finalT, kick = ending.finalT > 0 ? 3.2 * (reduce ? 1 : 1 - Math.exp(-since * 1.4)) : 0; // the finished lock spins up, then settles
    spinQ.setFromAxisAngle(UP, tt * 0.12 + p * 2 + kick);
    F.lockQ.copy(tiltQ).multiply(spinQ);
    if (A > 0.5) { eul.set(ending.userPitch, ending.userYaw, 0); orbQ.setFromEuler(eul); F.lockQ.premultiply(orbQ); } // the visitor's own turn of the lock
    eul.set(0.1 + smy * 0.14, -0.2 + smx * 0.24, 0); presQ.setFromEuler(eul);

    /* camera push, done by moving and scaling the whole field around the piece being shown */
    const fullScale = wide ? Math.min(1, halfW / 9.5) : Math.min(1, halfW / 4.4), baseScale = fullScale * 0.75;
    /* a piece is never parked square in front of you. it sits off to one side, at an angle, smaller than the screen, and
       keeps drifting and turning the whole time you are with it, as if you were flying past. the Me piece is held a
       little straighter and larger so its lines stay readable */
    const isMeNow = active === ME, side = curC % 2 ? -1 : 1, loose = isMeNow ? 0.4 : 1, pass = curT - 0.5;
    const presScale = (wide ? Math.min(1.8, halfW * 0.155) : halfW * 0.26) * (isMeNow ? 1.18 + (wide ? 0.34 : 0.06) * meOpen : 1); // the about-me piece gets a good deal bigger while its slips are open
    eul.set(0.16 * side * loose, side * (-0.44 + 0.66 * curT) * loose, 0.08 * side * loose); tq.setFromEuler(eul); tq.premultiply(presQ);
    if (wide) home.set(0, 0.4, 0); else home.set(0, 1.6, 0);
    const lockScale = lerp(baseScale, presScale, activeAmt);
    lockPos.copy(home);
    if (active >= 0) {
      vL.copy(focusV);
      vP.copy(vL).multiplyScalar(baseScale).add(home); // where it floats when the camera is back
      /* on the seam between the two lines of the chapter title, a little off-centre, still drifting as you pass */
      if (wide) vK.set((halfW * 0.07 * side - pass * 2.6 * side) * loose, ((curC % 3) - 1) * 0.12 * loose + pass * 0.5, 0); else vK.set(-pass * 1.1 * side * loose, pass * 0.4, 0);
      vP.lerp(vK, activeAmt); // where it should be now: off-centre and still moving
      lockPos.copy(vP).addScaledVector(vL, -lockScale);
    }
    /* the lock is built large in the middle, then settles on the seam between LET'S and TALK. the words are bright and
       sit behind it. nothing is drawn across the lock */
    const settle = ss(0.82, 1, A), reveal = ss(0.8, 0.9, A);
    F.fullScale = fullScale; F.lockScale = lockScale; F.endScale = fullScale * lerp(1.25, 0.96, settle);
    F.endPos.set(0, 0.10 * halfH, 0);
    /* the big words and the foot are only touched when they change, and not at all while they cannot be seen */
    const bbO = (reveal * (1 - ft)).toFixed(3);
    if (bbO !== bbOp) { bbOp = bbO; bigBack.style.opacity = bbO; }
    if (bbO !== "0.000") {
      const bbT = "translate(" + (-smx * 12).toFixed(1) + "px,calc(-50% + " + (smy * 7).toFixed(1) + "px)) scale(" + lerp(1.14, 1, reveal).toFixed(4) + ")";
      if (bbT !== bbTr) { bbTr = bbT; bigBack.style.transform = bbT; }
    }
    const footOn = ss(0.9, 1, A) * (1 - ft), ftO = footOn.toFixed(3);
    if (ftO !== ftOp) { ftOp = ftO; endText.style.opacity = ftO; }
    if (footLive !== footOn > 0.5) { footLive = footOn > 0.5; endText.style.pointerEvents = footLive ? "" : "none"; } // its button and links cannot be pressed while they are out of sight
    /* a message was sent: the six pieces close back into the lock with a knock, and the page behind it says THANK YOU.
       the words are only ever swapped while they are out of sight. they go back to LET'S TALK when the visitor
       leaves the page or opens the form again */
    if (form.thanks && !form.open && A < 0.5) form.thanks = false;
    if (form.thanks !== thanksShown && (reveal * (1 - ft) < 0.35 || (form.thanks && !form.open))) { thanksShown = form.thanks; setEndWords(thanksShown); }
    if (thanksShown && form.thanks && prevFt > 0.06 && ft <= 0.06) { clack(0.75); ending.shakeT = time; ending.shakeAmp = 0.4; }
    prevFt = ft;
    wallMetrics(F, S.workTop, y, vh);
    const kx = wide ? 1 : 0.42;
    /* the Me piece shows its written sides only during its own chapter. in the wall and the lock it has its name bands again */
    const wantSides = meLive && dc <= 0 && !form.open;
    if (wantSides !== sidesOn) { sidesOn = wantSides; pieces[ME].mesh.material = sidesOn ? meSides.mats : meSides.plain; }

    for (i = 0; i < 6; i++) {
      const pc = pieces[i], face = slide[i], still = 1 - ss(0.4, 0.9, zoom[i]);
      /* its own spot, drifting a little, tumbling slowly */
      vA.copy(FIELD[i]);
      vA.x += Math.sin(tt * 0.3 + i * 1.7) * 0.35 * still; vA.y += Math.cos(tt * 0.25 + i * 2.3) * 0.35 * still;
      P.pos.copy(vA).multiplyScalar(lockScale).add(lockPos);
      eul.set(tt * 0.08 + i * 1.3, tt * 0.06 + i * 2.1, i * 0.7); P.quat.setFromEuler(eul);
      P.sc = lockScale; P.vis = true;
      if (face > 0) P.quat.slerp(i === active ? tq : presQ, face); // turns most of the way towards you, never quite square
      if (i === ME && meTurn % 4 > 0) { turnQ.setFromAxisAngle(LONG, (meTurn % 4) * Math.PI / 2); P.quat.multiply(turnQ); } // the Me piece rolls to its next side
      if (hero) { /* first view: the pieces hang all around the camera. on the first scroll they scatter, each to its place far down the trail */
        vK.set(HEROPOS[i].x * kx + Math.sin(tt * 0.2 + i) * 0.4, HEROPOS[i].y + Math.cos(tt * 0.17 + i * 2) * 0.4, HEROPOS[i].z);
        /* until the visitor enters they wait deep in the fog, out of sight. on entering they come in to their places,
           each a little after the one before, as the loader's blurred colours fade (handoff.ts) */
        const ic = handoff.at < 0 ? 0 : reduce ? 1 : clamp((ms - handoff.at) / 1000 / 1.7 - i * 0.05, 0, 1), ie = 1 - Math.pow(1 - ic, 3);
        if (ie < 1) { farV.set(vK.x * 1.7, vK.y * 1.7, vK.z - 38); vK.lerpVectors(farV, vK, ie); }
        P.pos.lerpVectors(vK, P.pos, h); P.sc = lerp(1.3 * fullScale, P.sc, h);
      }
      /* the flight. each block stands at its station in its reading pose, SPACING behind the one before; the camera
         flies to it. once the wall starts, only Directions is still placed this way (the wall takes it from there) */
      const c = CH[i] - 1;
      let fade = 1;
      if (journey > 0 && (dc <= 0 || c === 5)) {
        const x = u - c, s = c ? clamp(x + 0.5, 0, 1) : Math.min(1, ME_STOPS[3] + Math.max(0, x) * 2 * (1 - ME_STOPS[3]));
        const sd = c % 2 ? -1 : 1, H = c ? 1 : 0.4, fp = s - 0.5, D = DIR[c], g = wide ? 1 : 0.45;
        if (wide) jPos.set((halfW * 0.07 * sd - fp * 2.6 * sd) * H, ((c % 3) - 1) * 0.12 * H + fp * 0.5, 0); else jPos.set(-fp * 1.1 * sd * H, fp * 0.4, 0);
        jPos.z = SPACING * (uc - c); // its place in the world (z = -SPACING * c), seen from the camera at CAM_Z - SPACING * uc
        jE.set(0.16 * sd * H, sd * (-0.44 + 0.66 * s) * H, 0.08 * sd * H); jQ.setFromEuler(jE).premultiply(presQ);
        if (c === 0 && meTurn % 4 > 0) jQ.multiply(turnQ); // the about-me piece keeps its turn
        const dd = CAM_Z - jPos.z; // how far it is from the camera: CAM_Z at its own stop
        if (dd > CAM_Z) { // still ahead: off to its own side, on a straight line into its place, slightly turned
          const k = (dd - CAM_Z) * 0.2 * g, kk = Math.min(1, (dd - CAM_Z) / SPACING);
          jPos.x += D[0] * k; jPos.y += D[1] * k; jE.set(D[2] * kk, D[3] * kk, D[4] * kk); jQ.premultiply(dirQ.setFromEuler(jE));
        } else { const k = (CAM_Z - dd) * 0.12 * g; jPos.x += D[5] * k; jPos.y += D[6] * k; } // being passed: a little off-centre
        const jSc = (wide ? Math.min(1.8, halfW * 0.155) : halfW * 0.26) * (c ? 1 : 1.18);
        P.pos.lerp(jPos, journey); P.quat.slerp(jQ, journey); P.sc = lerp(P.sc, jSc, journey);
        /* full strength until the camera is 13 units from it, gone at 3.5, before the camera reaches its front face */
        fade = lerp(1, ss(3.5, 13, dd), journey);
        if (journey > 0.5 && (jPos.z > CAM_Z - 3.5 || jPos.z < -72)) P.vis = false; // flown through, or too deep in the fog to be more than a dark shape
      }
      if (c < 5 && u >= 5.05 && u < 5.5 && dc <= 0) P.vis = false; // at Directions, the blocks already passed are gone until the wall calls them
      else if (c < 5 && journey > 0 && dc > 0) fade = ss(0, 0.12, dc); // and when it does, they come in out of the open fog instead of appearing at once
      fadeOf[i] = fade; setFade(i, fade);
      P.glow = 0.5 + 0.7 * ss(0.5, 1, zoom[i]) + 0.3 * done[i]; // a piece you have met stays brighter
      const focus = i === active || dc > 0 ? 1 : 1 - 0.65 * close; // the others fall back while one is shown
      P.glow *= focus; pc.band.emissiveIntensity = pc.cap.emissiveIntensity = 0.75 * focus; pc.edges.opacity = 0.85 * focus * fade;
      if (pc.outline) pc.outline.opacity = 0.45 * fade;
      if (dop >= 1) {
        placeInLock(i, pc, P, F);
        /* the finished lock lights up under the pointer, to show it can be pressed (a press takes it apart) */
        if (ending.hover && ending.live && !form.open && ft < 0.02) { P.glow *= 1.35; pc.band.emissiveIntensity = pc.cap.emissiveIntensity = 1.05; pc.edges.opacity = 1; }
      }
      else if (dc > 0) placeInWall(i, P, F);
      pc.mesh.visible = P.vis;
      pc.mesh.position.copy(P.pos); pc.mesh.quaternion.copy(P.quat); pc.mesh.scale.setScalar(P.sc);
      pc.face.emissiveIntensity = P.glow * 1.15; // the drawn face is the brightest side
      if (i === ME) for (const k of [2, 3, 5]) (meSides.mats[k] as THREE.MeshStandardMaterial).emissiveIntensity = pc.face.emissiveIntensity; // its written sides are as bright as the front
    }

    /* the aura follows the Me piece. it fades while the piece is part of the flat wall, and flares when the lock closes */
    const m5 = pieces[ME].mesh, auraOn = m5.visible, meFade = fadeOf[ME];
    const wallAmt = dop < 1 ? ss(0.3, 0.9, dc) : 0, flare = ending.finalT > 0 && since < 6 ? Math.exp(-since * 1.3) : 0, pulse = reduce ? 0 : Math.sin(time * 1.6);
    /* the group itself stays in the scene while the piece is hidden, with its light at no strength: a light that comes and
       goes makes every material rebuild its shader, which would stall the camera the first time it flies past the piece */
    for (const sh of aura.shells) sh.visible = auraOn;
    for (const sp of aura.sparks) sp.visible = auraOn && wallAmt < 0.5;
    if (aura.light) aura.light.intensity = 0;
    if (auraOn) {
      aura.group.position.copy(m5.position); aura.group.quaternion.copy(m5.quaternion); aura.group.scale.copy(m5.scale);
      const ga = (1 + 0.2 * pulse + 1.2 * flare + 0.4 * meOpen) * (1 - wallAmt) * (1 - ft) * meFade; // and it dissolves with the piece
      for (i = 0; i < aura.shells.length; i++) { const sh = aura.shells[i]; sh.material.opacity = 0.085 * ga; sh.scale.set(5.2, 5.2 * (1 + 0.4 * meOpen), 1); sh.position.y = 0.12 * meOpen; } // the light swells as the slips open
      if (aura.light) aura.light.intensity = (1.7 + 0.3 * pulse + 3.5 * flare + 1.4 * meOpen) * (1 - wallAmt) * PI * meFade;
      for (i = 0; i < 3; i++) { const sa = tt * 0.9 + i * 2.094; aura.sparks[i].position.set(Math.cos(sa) * 4.1, Math.sin(sa) * 1.9 * (1 + 0.6 * meOpen), Math.sin(sa + 1) * 1.6); }
    }
    /* a face is only redrawn when it is the one on screen and it has changed */
    if (ft <= 0.02) {
      if (active >= 0 && activeAmt > 0.5 && !reduce && dc <= 0) {
        if (!rig.lite || (frameNo & 1)) { const a = pieces[active]; DRAW[active](a.ctx, time, a.col, meName); a.tex.needsUpdate = true; lastName = meName; }
      } else if (Math.abs(meName - lastName) > 0.002) { lastName = meName; DRAW[ME](pieces[ME].ctx, time, pieces[ME].col, meName); pieces[ME].tex.needsUpdate = true; }
    }

    /* the space around it: the floor and the floating blocks that stream past as you scroll.
       hidden while the work list is on screen, back for the last page */
    const envAmt = Math.max(1 - dc, dop >= 1 ? ss(0.1, 0.6, ep) : 0) * (1 - 0.5 * ft), flow = p * 170 + tt * 0.5;
    /* on the flight the floor and the fragments stream past at the camera's own speed */
    const drift = Math.min(p, FLIGHT_P) * 170 + tt * 0.5, fly = SPACING * uc;
    env.group.visible = envAmt > 0.01;
    if (env.group.visible) {
      env.floor.material.opacity = (0.3 + 0.5 * flare) * envAmt * (dc > 0 ? 1 : 1 - 0.85 * close); // the floor steps back while a chapter title is read over it
      env.floor.position.z = (drift * 0.6 + fly) % 2.5; // 2.5 is one cell of the grid, so it runs on seamlessly
      const settled = reduce ? 30 : since; // reduced motion: the blocks are simply there, already still
      for (i = 0; i < env.frags.length; i++) {
        const fg = env.frags[i];
        let fx = fg.x, fy = fg.y, fz = ((fg.z + drift + fly) % 90 + 90) % 90 - 70, fk = envAmt * ss(-70, -56, fz), spin = 0; // they come in out of the far end of their run, so none pops in
        /* on the last page the fragments are hidden. when the final piece is rammed home and the lock shakes, they
           burst out of it in every direction, slow down as if there were no gravity, and stay floating around it */
        if (dop >= 1) {
          fk = 0;
          if (ending.finalT > 0 && since >= 0) { burst(i, settled, F.endPos, fragOut); fx = fragOut.x; fy = fragOut.y; fz = fragOut.z; fk = fragOut.k; spin = fragOut.spin; }
        }
        if (ft > 0 && fz > -3) fz = lerp(fz, -3 - (i % 5) * 0.8, ft); // while the form is open the blocks float behind it, never across the writing
        fg.mesh.position.set(fx, fy, fz); fg.mesh.rotation.set(fg.rx + flow * 0.01 * fg.sp + spin, fg.ry + flow * 0.013 * fg.sp + spin * 0.7, 0);
        fg.mesh.scale.set(fg.s * 3 * fk, fg.s * fk, fg.s * fk); fg.mesh.visible = fk > 0.001;
      }
    }
    /* the moment the lock closes, every bar brightens for an instant. no shockwave, no beams, no flash */
    const surge = ending.finalT > 0 && since >= 0 && since < 3 ? 0.35 * Math.exp(-since * 2.2) : 0;
    if (surge > 0) for (i = 0; i < 6; i++) { const pb = pieces[i]; pb.band.emissiveIntensity = pb.cap.emissiveIntensity = 0.75 + 2.4 * surge; pb.face.emissiveIntensity += 1.6 * surge; pb.edges.opacity = Math.min(1, 0.85 + surge); }

    /* sound that follows what is on screen */
    if (isSoundOn()) {
      wind(Math.min(0.9, Math.abs(target - p) * 230 * (FOLLOW / 0.085))); // the same wind for the same scroll speed as before
      if (dc >= 1 && prevDc < 1) seal();
    }
    /* the arrival knock lands the moment the piece fills the view: not on the way in, and not after the camera has
       drifted to rest behind it (that is a third of a second later, and sounds late). a piece that is only flown
       past makes no knock. it is ready again once the camera has pulled well back from a piece */
    if (arriveArmed && close >= 0.95 && Math.abs(target - p) < PASSING) { arriveArmed = false; if (isSoundOn() && active >= 0 && dc <= 0) arrive(); }
    else if (close < 0.5) arriveArmed = true;
    prevDc = dc; F.first = false;

    /* hold the camera on the centre line while it passes through the wall */
    const steady = (1 - 0.7 * ft) * (hero ? 1.6 - 0.6 * h : 1) * (dop > 0 && dop < 1 ? 0 : 1 - dc * (dop < 1 ? 1 : 0));
    const sh = reduce || time - ending.shakeT > 1.2 ? 0 : ending.shakeAmp * Math.exp(-(time - ending.shakeT) * 7);
    camera.position.set(smx * 1.5 * steady + Math.sin(time * 71) * sh, -smy * 1.0 * steady + Math.cos(time * 83) * sh, CAM_Z); camera.lookAt(0, 0, 0);
    env.dust.rotation.y = p * 1.2 + tt * 0.01; env.dust.position.y = p * 6;
    const fog = scene.fog as THREE.Fog; fog.near = lerp(22, 26, fogOpen); fog.far = lerp(48, 100, fogOpen);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
