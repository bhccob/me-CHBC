/* /api/contact: sends one email through Resend (https://resend.com). Runs on Vercel, never in the browser.
   The API key and the address it sends to are environment variables (see .env.example), so they are not in the code.

   GET  hands the page a signed ticket with the time on it.
   POST sends the message. It is refused unless all of this holds:
   - it comes from one of the site's own pages (the browser says so, and scripts on other sites cannot fake it);
   - it carries a ticket this function signed at least two seconds and at most two hours ago, so a robot cannot
     simply fire messages at the address: it has to load the page's ticket first and wait like a person;
   - the hidden field only robots fill in is empty;
   - this visitor has not sent more than a few messages in the last ten minutes.
   Everything a visitor typed is cut to a sensible length and escaped before it goes into the email. */
import { createHmac, timingSafeEqual } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000; // per visitor: at most MAX messages in ten minutes
const MAX = 4;
/* kept in memory: it resets when Vercel restarts the function, which is enough to stop a burst */
const seen = new Map<string, number[]>(), asked = new Map<string, number[]>();
const MAX_TICKETS = 30; // tickets per visitor in ten minutes
const MIN_AGE = 2000, MAX_AGE = 2 * 60 * 60 * 1000; // how old a ticket must be, and may be, in milliseconds

/* tickets are signed with a secret only the server knows. the email key doubles as that secret, so there is no second
   secret to manage; set CONTACT_SECRET to use a separate one */
const secret = () => process.env.CONTACT_SECRET || process.env.RESEND_API_KEY || "local-development-only";
const sign = (ts: string) => createHmac("sha256", secret()).update("contact:" + ts).digest("hex").slice(0, 40);
const newTicket = () => { const ts = String(Date.now()); return ts + "." + sign(ts); };
/** how old a ticket is in milliseconds, or -1 if this function did not sign it */
function ticketAge(ticket: string, now: number) {
  const [ts, sig] = ticket.split(".");
  if (!ts || !sig || !/^\d{12,15}$/.test(ts)) return -1;
  const want = sign(ts);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return -1;
  return now - Number(ts);
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function tooMany(book: Map<string, number[]>, max: number, ip: string, now: number) {
  const hits = (book.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) { book.set(ip, hits); return true; }
  hits.push(now); book.set(ip, hits);
  if (book.size > 5000) for (const [k, v] of book) if (!v.some((t) => now - t < WINDOW_MS)) book.delete(k);
  return false;
}
const visitor = (request: Request) => (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
/** did one of this site's own pages make the request? browsers add these headers themselves; a page cannot change them */
function fromThisSite(request: Request, needOrigin: boolean) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin) return !needOrigin;
  try { return new URL(origin).host === host; } catch { return false; }
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email Bob receives, in the site's own look: ink, bone and gold. Everything a visitor typed is escaped.
    Tables and inline styles only, because that is what mail apps understand. */
function emailHtml(name: string, email: string, message: string, reason: string, when: Date) {
  const INK = "#0a0912", CARD = "#14121f", LINE = "#2a2738", BONE = "#efe8d6", DIM = "#8d88a3", GOLD = "#e0b85a";
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif", mono = "'IBM Plex Mono',Consolas,Menlo,'Courier New',monospace";
  const first = name.split(/\s+/)[0] || name;
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(when);
  const reply = `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent("Re: your message")}`;
  const body = esc(message).replace(/\r?\n/g, "<br>");
  const label = `font-family:${mono};font-size:11px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:${DIM};`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>New message from ${esc(name)}</title></head>`
    + `<body style="margin:0;padding:0;background:${INK};">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(message.slice(0, 120))}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};"><tr><td align="center" style="padding:36px 16px;">`
    + `<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${CARD};border:1px solid ${LINE};border-top:3px solid ${GOLD};">`
    + `<tr><td style="padding:28px 32px 0;${label}"><span style="font-family:'Songti SC','Noto Serif SC',SimSun,Georgia,serif;font-size:22px;font-weight:bold;letter-spacing:0;color:${GOLD};vertical-align:middle;">\u9c81\u73ed\u9501</span><span style="vertical-align:middle;">&nbsp;&nbsp;&nbsp;New message &middot; Portfolio</span></td></tr>`
    + `<tr><td style="padding:22px 32px 0;font-family:${sans};font-size:34px;line-height:1.08;font-weight:800;letter-spacing:-1px;color:${BONE};">${esc(name)}</td></tr>`
    + `<tr><td style="padding:8px 32px 0;font-family:${sans};font-size:15px;line-height:1.4;"><a href="${esc(reply)}" style="color:${GOLD};text-decoration:underline;">${esc(email)}</a></td></tr>`
    + (reason ? `<tr><td style="padding:16px 32px 0;"><span style="display:inline-block;border:1px solid ${GOLD};border-radius:2px;padding:7px 11px;font-family:${mono};font-size:11px;line-height:1;letter-spacing:2px;text-transform:uppercase;color:${GOLD};">${esc(reason)}</span></td></tr>` : "")
    + `<tr><td style="padding:26px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`
    + `<tr><td style="padding:20px 32px 0;${label}">Message</td></tr>`
    + `<tr><td style="padding:10px 32px 0;font-family:${sans};font-size:17px;line-height:1.6;color:${BONE};word-break:break-word;">${body}</td></tr>`
    + `<tr><td style="padding:30px 32px 0;"><a href="${esc(reply)}" style="display:inline-block;background:${BONE};color:${INK};font-family:${mono};font-size:12px;font-weight:bold;line-height:1;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:16px 22px;border-radius:2px;">Reply to ${esc(first)} &rarr;</a></td></tr>`
    + `<tr><td style="padding:28px 32px 30px;${label}">${esc(date)} &middot; sent from your portfolio</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

async function send(request: Request): Promise<Response> {
  /* only the site's own pages may post here, and only as JSON */
  if (!fromThisSite(request, true)) return json(403, { ok: false, error: "origin" });
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return json(415, { ok: false, error: "type" });

  let data: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 10000) return json(413, { ok: false, error: "too-large" });
    data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object") throw new Error("not an object");
  } catch { return json(400, { ok: false, error: "invalid" }); }

  if (text(data.website, 200)) return json(200, { ok: true }); // the hidden field was filled in: a robot. it is told "sent" and nothing is sent

  const age = ticketAge(text(data.t, 80), Date.now());
  if (age < MIN_AGE || age > MAX_AGE) return json(400, { ok: false, error: "ticket" }); // no ticket, a forged one, too fresh or too old

  const name = text(data.name, 80).replace(/[\r\n\t]+/g, " "), email = text(data.email, 120), message = text(data.message, 2000);
  const reason = text(data.reason, 60).replace(/[\r\n\t]+/g, " "); // why they are writing: optional
  if (!name || !message || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return json(400, { ok: false, error: "invalid" });

  if (tooMany(seen, MAX, visitor(request), Date.now())) return json(429, { ok: false, error: "too-many" });

  /* local testing without a key: pretend it was sent. never on the live site */
  if (process.env.CONTACT_DRY_RUN === "1" && process.env.VERCEL_ENV !== "production") {
    console.log("[contact] dry run, nothing sent:", { name, email, reason, characters: message.length });
    return json(200, { ok: true, dryRun: true });
  }

  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_TO, from = process.env.CONTACT_FROM || "bhccob <onboarding@resend.dev>";
  if (!key || !to) { console.error("[contact] RESEND_API_KEY or CONTACT_TO is not set"); return json(503, { ok: false, error: "not-configured" }); }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from, to: [to], reply_to: email,
        subject: `New message from ${name}${reason ? `: ${reason}` : ""}`,
        html: emailHtml(name, email, message, reason, new Date()),
        text: `${message}\n\nFrom: ${name} <${email}>${reason ? `\nReason: ${reason}` : ""}\nSent from your portfolio.`, // for mail apps that show no HTML
      }),
    });
    if (!r.ok) { console.error("[contact] Resend refused:", r.status, await r.text()); return json(502, { ok: false, error: "send" }); }
  } catch (err) { console.error("[contact] Resend unreachable:", err); return json(502, { ok: false, error: "send" }); }
  return json(200, { ok: true });
}

/* Vercel's handler for a file in /api: every request to /api/contact comes through here */
export default {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === "POST") return send(request);
    if (request.method === "GET") { /* the page asks for its ticket when the form opens */
      if (!fromThisSite(request, false)) return json(403, { ok: false, error: "origin" });
      if (tooMany(asked, MAX_TICKETS, visitor(request), Date.now())) return json(429, { ok: false, error: "too-many" });
      return json(200, { ok: true, t: newTicket() });
    }
    return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
  },
};
