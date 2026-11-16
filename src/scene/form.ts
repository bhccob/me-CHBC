/* the message form, drawn on the six pieces of the open lock. the real inputs are out of sight and only catch the typing.
   the pieces, in the order you met them: title, name, email, message, reason (a dropdown), send */
import * as THREE from "three";
import { FORM } from "../content";
import { CH } from "../timeline";
import { ss, lerp, step, $ } from "../util";
import { CN, CNFONT, DFONT, FW, FH, fitFont } from "./faces";
import type { PieceRig } from "./pieces";
import type { Frame, Pose } from "./frame";

type Kind = "" | "busy" | "ok" | "error";
/** where on a piece the pointer is: which piece, whether it is the drawn face, and the spot on that face (0..1, from the bottom left) */
export interface FaceHit { i: number; front: boolean; u: number; v: number }
/** thanks: a message has just been sent. the lock closes again and the page says thank you (see stage.ts) */
export const form = { open: false, thanks: false };

let pieces: PieceRig[] = [];
let hitFace: (e: MouseEvent) => FaceHit | null = () => null;
let isLive: () => boolean = () => false;
let toEnd: () => void = () => {};

let formT = 0, openedAt = 0, focusSlot = -1, blinkOn = true, formShift = 0, formS = 1, formBase = 0, shown = false, sending = false, byKey = false;
let listOpen = false, isWide = true;
let status = "", kind: Kind = "";
/* the ticket the server wants back with a message: fetched when the form opens, good for two hours */
let ticket = "", ticketAt = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getTicket() {
  try { const r = await fetch("/api/contact", { headers: { accept: "application/json" } }); if (r.ok) { ticket = String((await r.json()).t || ""); ticketAt = Date.now(); } } catch { /* tried again when sending */ }
}
const ticketStale = () => !ticket || Date.now() - ticketAt > 90 * 60 * 1000;
const dirty = [1, 1, 1, 1, 1, 1];
const formQ = new THREE.Quaternion(), eul = new THREE.Euler(), vK = new THREE.Vector3();
let fName: HTMLInputElement, fMail: HTMLInputElement, fText: HTMLTextAreaElement, fWhy: HTMLSelectElement, fSite: HTMLInputElement, bSend: HTMLButtonElement, mBack: HTMLButtonElement, mOpen: HTMLButtonElement, live: HTMLElement;

const REASONS = FORM.reasons, LIST_PAD = 20, ROW_H = (FH - LIST_PAD * 2) / REASONS.length;
const INK = "#0c0b15", BONE = "#efe8d6", DIM = "#8d88a3";

const markAll = () => { for (let k = 0; k < 6; k++) dirty[k] = 1; };
const markSlot = (sl: number) => { for (let k = 0; k < 6; k++) if (CH[k] - 1 === sl) dirty[k] = 1; };
function say(text: string, k: Kind) { status = text; kind = k; live.textContent = text; markSlot(0); }
function setTab(on: boolean) { [fName, fMail, fText, fWhy, bSend].forEach((el) => { el.tabIndex = on ? 0 : -1; }); }
/** the reason that is chosen: 0.. in FORM.reasons, or -1 for none yet */
const reasonAt = () => fWhy.selectedIndex - 1;
function setReason(k: number) { fWhy.selectedIndex = k + 1; if (kind === "ok" || kind === "error") say("", ""); markSlot(4); }
function closeList() { if (listOpen) { listOpen = false; markSlot(4); } }
const quiet = { preventScroll: true };

function openForm(fromKeyboard = false) {
  if (form.open) return;
  toEnd();
  form.open = true; form.thanks = false; byKey = fromKeyboard; openedAt = performance.now();
  if (kind !== "busy") say("", "");
  markAll(); mBack.hidden = false; setTab(true);
  document.documentElement.classList.add("formopen");
  if (ticketStale()) void getTicket();
  if (fromKeyboard) fName.focus(quiet);
}
function closeForm() {
  if (!form.open) return;
  form.open = false; listOpen = false; setTab(false);
  document.documentElement.classList.remove("formopen");
  try { (document.activeElement as HTMLElement | null)?.blur(); } catch { /* nothing had focus */ }
  if (byKey) mOpen.focus(quiet);
}

async function sendForm() {
  if (sending) return;
  const n = fName.value.trim(), m = fMail.value.trim(), t = fText.value.trim(), why = reasonAt() >= 0 ? REASONS[reasonAt()] : "";
  closeList();
  /* pressing the SEND piece puts the keyboard away, so the title piece with the answer on it is back in view */
  if (document.activeElement === fName || document.activeElement === fMail || document.activeElement === fText) (document.activeElement as HTMLElement).blur();
  if (!n || !t || m.indexOf("@") < 1) { say(FORM.invalid, "error"); return; }
  sending = true; say(FORM.sending, "busy");
  try {
    const post = async () => {
      if (ticketStale()) await getTicket();
      if (Date.now() - ticketAt < 2200) await wait(2200 - (Date.now() - ticketAt)); // the server wants the ticket to be two seconds old
      return fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n, email: m, message: t, reason: why, website: fSite.value, t: ticket }) });
    };
    let r = await post();
    if (r.status === 400 && (await r.clone().json().catch(() => ({}))).error === "ticket") { ticket = ""; r = await post(); } // the ticket had run out: one more try with a new one
    if (r.ok) {
      fName.value = fMail.value = fText.value = ""; fWhy.selectedIndex = 0; markAll(); say(FORM.sent, "ok");
      /* a beat to read "sent" on the title piece, then the six pieces close back into the lock */
      form.thanks = true;
      setTimeout(() => { if (form.open && form.thanks) closeForm(); }, 1100);
    }
    else say(r.status === 429 ? FORM.tooMany : r.status === 400 ? FORM.invalid : FORM.error, "error");
  } catch { say(FORM.error, "error"); }
  sending = false;
}

export function initForm(deps: { pieces: PieceRig[]; hitFace: (e: MouseEvent) => FaceHit | null; isLive: () => boolean; toEnd: () => void }) {
  pieces = deps.pieces; hitFace = deps.hitFace; isLive = deps.isLive; toEnd = deps.toEnd;
  fName = $("mName"); fMail = $("mMail"); fText = $("mText"); fWhy = $("mWhy"); fSite = $("mSite"); bSend = $("mSend"); mBack = $("mClose"); mOpen = $("mOpen"); live = $("mStatus");
  /* while it is the form, pressing a piece does what that piece is for */
  window.addEventListener("click", (e) => {
    if (!form.open || !isLive() || performance.now() - openedAt < 450 || e.target === mBack) return;
    const hit = hitFace(e); if (!hit) { closeList(); return; }
    const slot = CH[hit.i] - 1;
    if (slot !== 4) closeList();
    if (slot === 1) fName.focus(quiet); else if (slot === 2) fMail.focus(quiet); else if (slot === 3) fText.focus(quiet); else if (slot === 5) void sendForm();
    else if (slot === 4) {
      if (!isWide) setReason((reasonAt() + 1) % REASONS.length); // a phone: each tap moves on to the next reason
      else { /* a wider screen: the face opens into the list, and a press on a line picks it */
        if (listOpen && hit.front) { const row = Math.floor(((1 - hit.v) * FH - LIST_PAD) / ROW_H); if (row >= 0 && row < REASONS.length) setReason(row); }
        listOpen = !listOpen; markSlot(4);
        fWhy.focus(quiet); // so the arrow keys change it too
      }
    }
  });
  mBack.addEventListener("click", closeForm);
  mOpen.addEventListener("click", () => openForm(true));
  window.addEventListener("keydown", (e) => {
    if (!form.open) return;
    if (e.key === "Escape") { if (listOpen) closeList(); else closeForm(); return; }
    if (e.key !== "Tab") return;
    /* Tab stays inside the form: name, email, message, reason, send, back */
    const order: HTMLElement[] = [fName, fMail, fText, fWhy, bSend, mBack], at = order.indexOf(document.activeElement as HTMLElement);
    e.preventDefault(); closeList();
    order[at < 0 ? (e.shiftKey ? order.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + order.length) % order.length].focus(quiet);
  });
  $("msgForm").addEventListener("submit", (e) => { e.preventDefault(); void sendForm(); });
  [fName, fMail, fText].forEach((el, k) => {
    el.addEventListener("input", () => { if (kind === "ok" || kind === "error") say("", ""); markSlot(k + 1); });
    el.addEventListener("focus", () => { focusSlot = k + 1; blinkOn = true; markAll(); });
    el.addEventListener("blur", () => { focusSlot = -1; markAll(); });
  });
  fWhy.addEventListener("change", () => { if (kind === "ok" || kind === "error") say("", ""); markSlot(4); });
  fWhy.addEventListener("focus", () => { focusSlot = 4; markAll(); });
  fWhy.addEventListener("blur", () => { focusSlot = -1; markAll(); });
  bSend.addEventListener("focus", () => { focusSlot = 5; markAll(); });
  bSend.addEventListener("blur", () => { focusSlot = -1; markAll(); });
  fName.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); fMail.focus(quiet); } });
  fMail.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); fText.focus(quiet); } });
  /* only the piece being typed on is redrawn for the caret */
  setInterval(() => { if (form.open && focusSlot >= 1 && focusSlot <= 3) { blinkOn = !blinkOn; markSlot(focusSlot); } }, 520);
}

function wrapLines(c: CanvasRenderingContext2D, txt: string, maxW: number) {
  const out: string[] = [];
  txt.split("\n").forEach((pg) => {
    let line = "";
    pg.split(" ").forEach((w) => { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function tail(c: CanvasRenderingContext2D, txt: string, maxW: number) { while (txt.length > 1 && c.measureText(txt).width > maxW) txt = txt.slice(1); return txt; }

/* what each piece shows while the lock is the form. the piece keeps its colour, its frame and its Chinese name on the left */
function drawForm(i: number) {
  const pc = pieces[i], c = pc.ctx, col = pc.ecol, slot = CH[i] - 1, foc = slot === focusSlot, caret = foc && blinkOn;
  let X0 = 300, MW = 850;
  c.globalAlpha = 1; c.textAlign = "left"; c.textBaseline = "middle";
  if (slot === 5) { /* the whole piece is the send button */
    c.fillStyle = col; c.fillRect(0, 0, FW, FH); c.fillStyle = INK; c.font = "900 104px " + CNFONT; c.fillText(CN[i], 44, 205);
    c.font = "800 200px " + DFONT; c.fillText(FORM.send, X0 + 30, 212);
    if (foc) { c.strokeStyle = INK; c.lineWidth = 14; c.strokeRect(22, 22, FW - 44, FH - 44); } // keyboard focus: a dark frame inside the edge
    return;
  }
  if (slot === 4 && listOpen && isWide) { /* the reason piece, open: the whole face is the list, the chosen line filled in */
    c.fillStyle = INK; c.fillRect(0, 0, FW, FH); c.strokeStyle = col; c.lineWidth = 14; c.strokeRect(12, 12, FW - 24, FH - 24);
    const at = reasonAt();
    REASONS.forEach((r, k) => {
      const y = LIST_PAD + k * ROW_H;
      if (k === at) { c.fillStyle = col; c.fillRect(20, y, FW - 40, ROW_H); }
      else if (k > 0 && k - 1 !== at) { c.globalAlpha = 0.3; c.fillStyle = col; c.fillRect(56, y, FW - 112, 2); c.globalAlpha = 1; }
      c.fillStyle = k === at ? INK : BONE; fitFont(c, r, 800, 46, DFONT, FW - 140); c.fillText(r, 56, y + ROW_H / 2 + 2);
    });
    return;
  }
  c.fillStyle = INK; c.fillRect(0, 0, FW, FH); c.strokeStyle = col; c.lineWidth = foc ? 14 : 5; c.strokeRect(12, 12, FW - 24, FH - 24);
  /* once a piece is being written on, its Chinese name steps aside and the writing gets the whole face */
  const typed = slot === 1 ? fName.value : slot === 2 ? fMail.value : slot === 3 ? fText.value : slot === 4 && reasonAt() >= 0 ? REASONS[reasonAt()] : "", clear = slot > 0 && (foc || typed.length > 0);
  if (clear) { X0 = 70; MW = 1070; }
  else { c.fillStyle = col; c.font = "900 104px " + CNFONT; c.fillText(CN[i], 44, 205); c.globalAlpha = 0.6; c.fillRect(X0 - 34, 60, 4, 280); c.globalAlpha = 1; }
  if (slot === 0) {
    c.fillStyle = BONE; c.font = "800 92px " + DFONT; c.fillText(FORM.title[0], X0, 130); c.fillText(FORM.title[1], X0, 224);
    c.fillStyle = kind === "error" ? "#ff6a55" : kind === "ok" ? "#5fd6ab" : col; c.font = "500 27px monospace";
    wrapLines(c, status || FORM.hint, MW).slice(0, 2).forEach((l, n) => { c.fillText(l, X0, 306 + n * 36); });
  } else if (slot === 1 || slot === 2) {
    const el = slot === 1 ? fName : fMail; c.fillStyle = col; c.font = "500 32px monospace"; c.fillText(slot === 1 ? FORM.name : FORM.email, X0, 96);
    c.fillStyle = BONE; c.font = "800 96px " + DFONT; const v = tail(c, el.value, MW - 30); c.fillText(v, X0, 230);
    if (caret) c.fillRect(X0 + c.measureText(v).width + 8, 178, 8, 104);
    c.globalAlpha = 0.4; c.fillRect(X0, 300, MW, 4); c.globalAlpha = 1;
  } else if (slot === 3) { /* the message: four lines on one piece. a longer message keeps its last four lines in view */
    c.fillStyle = col; c.font = "500 32px monospace"; c.fillText(FORM.message, X0, 72);
    c.fillStyle = BONE; c.font = "800 56px " + DFONT;
    let lines = wrapLines(c, fText.value, MW);
    if (lines.length > 4) lines = lines.slice(lines.length - 4);
    lines.forEach((ln, n) => { c.fillText(ln, X0, 150 + n * 68); });
    const last = lines.length - 1;
    if (caret) c.fillRect(X0 + c.measureText(lines[last]).width + 8, 150 + last * 68 - 30, 7, 60);
  } else { /* the reason, closed: what is chosen, with an arrow that says there is more */
    c.fillStyle = col; c.font = "500 32px monospace"; c.fillText(FORM.reason, X0, 96);
    c.fillStyle = typed ? BONE : DIM; fitFont(c, typed || FORM.reasonNone, 800, 84, DFONT, MW - 110); c.fillText(typed || FORM.reasonNone, X0, 226);
    c.fillStyle = col; c.beginPath(); c.moveTo(X0 + MW - 64, 204); c.lineTo(X0 + MW, 204); c.lineTo(X0 + MW - 32, 250); c.closePath(); c.fill();
    c.globalAlpha = 0.4; c.fillRect(X0, 300, MW, 4); c.globalAlpha = 1;
    c.fillStyle = DIM; c.font = "500 24px monospace"; c.fillText(isWide ? FORM.reasonHint : FORM.reasonHintPhone, X0, 344);
  }
}

/** once per frame: eases the form open or shut, and writes it onto the faces while it is open.
    restore() puts the study drawings back when it has closed */
export function updateForm(F: Frame, dt: number, restore: () => void) {
  formT += ((form.open ? 1 : 0) - formT) * (F.reduce ? 1 : step(0.1, dt));
  const ft = ss(0, 1, formT); F.ft = ft;
  if (isWide !== F.wide) { isWide = F.wide; listOpen = false; markSlot(4); }
  mBack.style.opacity = ft.toFixed(3);
  if (!form.open && formT < 0.02 && !mBack.hidden) mBack.hidden = true;
  /* the pieces stay clear of the "Back to the lock" button: `top` is the highest a piece may reach, just under it */
  const vh = window.innerHeight, top = F.halfH * (1 - 2 * (Math.min(96, Math.max(58, vh * 0.1)) + 58) / vh);
  if (F.wide) { formS = Math.min(F.halfW * 0.135, F.halfH * 0.19, (top - 0.15) / 3.34); formBase = 0; }
  else { /* phones get one column of six pieces, fitted between the button and the bottom of the screen */
    const bottom = -F.halfH * 0.9;
    formS = Math.min(F.halfW * 0.29, F.halfH * 0.135, (top - bottom) / 13.5); formBase = Math.min(0, (top + bottom) / 2);
  }
  /* on a phone the piece you are typing on moves up, clear of the keyboard */
  const wantShift = !F.wide && focusSlot >= 1 && focusSlot <= 3 ? F.halfH * 0.4 - (2.5 - focusSlot) * 2.3 * formS - formBase : 0;
  formShift += (wantShift - formShift) * step(0.15, dt);
  if (ft > 0.02) {
    if (!shown) { markAll(); shown = true; }
    for (let i = 0; i < 6; i++) if (dirty[i]) { dirty[i] = 0; drawForm(i); pieces[i].tex.needsUpdate = true; }
  } else if (shown) { restore(); shown = false; }
}

/** the lock comes apart into its six blocks, still solid and still turning with the mouse. they hang in two columns with
    gaps between them and at slightly different depths, each one showing its part of the form */
export function formPose(i: number, pc: PieceRig, P: Pose, F: Frame) {
  const ft = F.ft, fslot = CH[i] - 1, fside = fslot < 3 ? -1 : 1, frow = fslot % 3;
  if (F.wide) {
    eul.set(0.1 + F.smy * 0.1, -0.26 + F.smx * 0.16, 0); formQ.setFromEuler(eul);
    vK.set(fside * 3.22 * formS, (1 - frow) * 2.34 * formS, ((fslot + frow) % 2 ? 0.55 : -0.35) * formS).applyQuaternion(formQ); vK.y += 0.15;
  } else {
    eul.set(0.05, -0.12, 0); formQ.setFromEuler(eul);
    vK.set(0, (2.5 - fslot) * 2.3 * formS, (fslot % 2 ? 0.3 : -0.2) * formS).applyQuaternion(formQ); vK.y += formBase + formShift;
  }
  P.pos.lerp(vK, ft); P.quat.slerp(formQ, ft); P.sc = lerp(P.sc, formS, ft);
  P.glow = lerp(P.glow, fslot === 5 ? 1.3 + (F.reduce ? 0 : 0.22 * Math.sin(performance.now() * 0.003)) : 0.95, ft);
  if (fslot === 5) pc.band.emissiveIntensity = pc.cap.emissiveIntensity = lerp(0.75, 1.5, ft); // the SEND piece glows
}
