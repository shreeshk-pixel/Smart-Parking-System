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

export async function needAdmin() {
  const user = await getSession();
  if (!user) return [null, fail("login required", 401)];
  if (user.role !== "admin") return [null, fail("admin only", 403)];
  return [user, null];
}

// Read JSON body or form data
export async function readBody(req) {
  const type = req.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) return await req.json();
    return Object.fromEntries(await req.formData());
  } catch {
    return {};
  }
}

// Accept "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM" (typed in IST); return "YYYY-MM-DD HH:MM:00+05:30" or null
export function parseTime(text) {
  const s = String(text || "").trim().replace("T", " ");
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(:\d{2})?$/);
  return m ? `${m[1]} ${m[2]}:${m[3]}:00+05:30` : null;
}

// Wrap a handler so unexpected errors come back as JSON
export function handle(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      console.error(e);
      return fail("server error", 500);
    }
  };
}
