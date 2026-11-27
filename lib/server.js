// Small helpers shared by every API route
import { NextResponse } from "next/server";
import { getSession } from "./session";

export function ok(data, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Returns [user, null] or [null, errorResponse]
export async function needUser() {
  const user = await getSession();
  if (!user) return [null, fail("login required", 401)];
  return [user, null];
}

// Parking customers only: admins manage the system and can't book, pay or cancel
export async function needCustomer() {
  const user = await getSession();
  if (!user) return [null, fail("login required", 401)];
  if (user.role === "admin") return [null, fail("admins can't book parking", 403)];
  return [user, null];
}

export async function needAdmin() {
  const user = await getSession();
  if (!user) return [null, fail("login required", 401)];
  if (user.role !== "admin") return [null, fail("not found", 404)]; // non-admins can't tell admin APIs exist
  return [user, null];
}

// An error with an HTTP status; handle() turns it into a JSON error response
export class HttpError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Read a JSON body (max 20 KB). Form posts are NOT accepted (415): a cross-site HTML form can only send
// form data, never JSON, so this is one of the CSRF defences (middleware.js also checks the Origin).
// Bigger bodies get 413; broken JSON gets 400.
export const MAX_BODY = 20000;
export async function readBody(req) {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) throw new HttpError("send JSON (Content-Type: application/json)", 415);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) throw new HttpError("request body too large", 413);
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError("request body too large", 413);
  let v;
  try { v = JSON.parse(text || "{}"); } catch { throw new HttpError("invalid JSON", 400); }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new HttpError("invalid JSON", 400);
  return v;
}

// Accept "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM" (typed in IST); return "YYYY-MM-DD HH:MM:00+05:30" or null
export function parseTime(text) {
  const s = String(text || "").trim().replace("T", " ");
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(:\d{2})?$/);
  return m ? `${m[1]} ${m[2]}:${m[3]}:00+05:30` : null;
}

// Wrap a handler so unexpected errors come back as JSON. Adds a Server-Timing header
// (time spent in the function, visible in the browser's network panel) and marks
// responses as private/no-store so nothing user-specific is cached.
export function handle(fn) {
  return async (req, ctx) => {
    const t0 = performance.now();
    let res;
    try {
      res = await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) { res = fail(e.message, e.status); } else {
      console.error(e);
      res = fail(String(e?.message || "").includes("timed out") || String(e?.message || "").includes("timeout")
        ? "the database is slow to respond, please try again" : "server error", 500);
      }
    }
    try {
      res.headers.set("Server-Timing", `app;dur=${(performance.now() - t0).toFixed(1)}`);
      if (!res.headers.get("Cache-Control")) res.headers.set("Cache-Control", "private, no-store");
    } catch {}
    return res;
  };
}
