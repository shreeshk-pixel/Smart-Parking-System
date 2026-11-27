// Security helpers shared by the API routes:
//   clientIp       - who is calling (Vercel sets x-forwarded-for / x-real-ip itself, clients can't spoof it there)
//   rateLimit      - counts requests per key in the database (serverless functions have no shared memory)
//   audit          - writes a row to audit_log for logins and every admin action
//   maskEmail      - "priya.deshpande@example.com" -> "pr***@example.com" for on-screen lists
//   signQr/readQr  - QR passes are HMAC-signed and expire, so a QR can't be guessed or forged
//   schemas        - zod rules for every form (length, format, allowed characters)
import crypto from "crypto";
import { z } from "zod";
import { query } from "./db";
import { secret } from "./session";
import { fail } from "./server";

export function clientIp(req) {
  const h = req.headers;
  return (h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "local").trim().slice(0, 64);
}

// Fixed window counter. One upsert per call. Returns a 429 response when over the limit, else null.
export async function rateLimit(key, max, windowSec) {
  const rows = await query(`
    INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, NOW(), 1)
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => $2) THEN 1 ELSE rate_limits.hits + 1 END,
      window_start = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => $2) THEN NOW() ELSE rate_limits.window_start END
    RETURNING hits, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2) - NOW())))::int AS retry`,
    [key.slice(0, 200), windowSec]);
  if (Math.random() < 0.01) query("DELETE FROM rate_limits WHERE window_start < NOW() - interval '1 day'").catch(() => {});
  if (rows[0].hits <= max) return null;
  const res = fail("Too many attempts. Please wait a few minutes and try again.", 429);
  res.headers.set("Retry-After", String(Math.max(1, rows[0].retry)));
  res.firstBlock = rows[0].hits === max + 1; // lets callers log a block once, not on every blocked request
  return res;
}
export const clearRateLimit = (key) => query("DELETE FROM rate_limits WHERE key = $1", [key]).catch(() => {});

// Never throws: a failed audit write must not break the action itself
export async function audit(req, actor, action, target = null, details = null) {
  try {
    await query("INSERT INTO audit_log (actor_id, actor_email, action, target, details, ip) VALUES ($1, $2, $3, $4, $5, $6)",
      [actor?.id || null, actor?.email ? String(actor.email).slice(0, 150) : null, action,
       target === null ? null : String(target).slice(0, 100), details ? JSON.stringify(details) : null, req ? clientIp(req) : null]);
  } catch (e) { console.error("audit failed", e?.message); }
}

export function maskEmail(e) {
  const s = String(e || "");
  const at = s.indexOf("@");
  if (at < 1) return s ? "***" : s;
  return s.slice(0, Math.min(2, at)) + "***" + s.slice(at);
}
export const maskPhone = (p) => (p ? String(p).replace(/\d(?=\d{2})/g, "•") : p);

// ---------- QR passes ----------
// Format: SP1.<bookingId>.<expiresEpoch>.<signature>. The signature covers the id, the expiry and the
// booking's random qr_token (never shown), so changing any part, or guessing, gives an invalid pass.
const qrKey = () => crypto.createHmac("sha256", secret()).update("qr-pass-v1").digest();
const qrSig = (id, exp, token) => crypto.createHmac("sha256", qrKey()).update(`${id}.${exp}.${token}`).digest("base64url");
export function signQr(id, endTs, token) {
  const exp = Number(endTs) + 24 * 3600; // valid until a day after the booking ends (exit after an overstay)
  return `SP1.${id}.${exp}.${qrSig(id, exp, token)}`;
}
// Returns {id, exp} if the format is right (signature is checked later against the stored token), else null
export function parseQr(text) {
  const m = /^SP1\.(\d{1,10})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(String(text || "").trim());
  return m ? { id: Number(m[1]), exp: Number(m[2]), sig: m[3] } : null;
}
export function qrValid(p, token) {
  if (!p || !token) return false;
  const want = Buffer.from(qrSig(p.id, p.exp, token));
  const got = Buffer.from(p.sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

// bcrypt work factor for new and upgraded password hashes (login re-hashes older, cheaper ones)
export const BCRYPT_COST = 12;

// ---------- input rules ----------
const noTags = (s) => !/[<>]/.test(s);
export const NAME = z.string().trim().min(2, "Name must be at least 2 characters.").max(60, "Name is too long.")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Name can only contain letters, spaces, dots, apostrophes and hyphens.");
export const EMAIL = z.string().trim().toLowerCase().max(120, "Email is too long.").email("Enter a valid email.");
export const PHONE = z.string().trim().max(20).regex(/^(\+?\d[\d -]{6,16}\d)?$/, "Enter a valid phone number.").optional().default("");
const COMMON = new Set(["password1", "password123", "parking123", "qwerty123", "12345678a", "abc12345", "letmein1", "welcome1", "admin123"]);
export const PASSWORD = z.string().min(8, "Password must be at least 8 characters.").max(72, "Password must be at most 72 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must contain at least one letter and one number.")
  .refine((p) => !COMMON.has(p.toLowerCase()), "That password is too common, pick another one.");
// Indian-style plates like KA22AB1234, KA 22 N 7319, MH-12-DE-1433 (spaces and hyphens removed)
export const VEHICLE = z.string().transform((s) => s.toUpperCase().replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{4,12}$/, "Vehicle number should be 4-12 letters and digits, like KA22AB1234."));
export const PLACE_NAME = z.string().trim().min(3, "Name must be at least 3 characters.").max(80, "Name is too long.")
  .refine(noTags, "Name can't contain < or >.").refine((s) => !/^[=+\-@]/.test(s), "Name can't start with = + - or @.");
export const ADDRESS = z.string().trim().min(3, "Address must be at least 3 characters.").max(160, "Address is too long.")
  .refine(noTags, "Address can't contain < or >.");

// Parse with a schema; returns [data, null] or [null, 400 response with the first message]
export function check(schema, value) {
  const r = schema.safeParse(value);
  if (r.success) return [r.data, null];
  return [null, fail(r.error.issues[0]?.message || "invalid input")];
}

// Wraps an admin write handler: when it succeeds, the action and its input are written to audit_log.
export function audited(action, fn) {
  return async (req, ctx) => {
    let input = null;
    try { input = await req.clone().json(); } catch {}
    const res = await fn(req, ctx);
    if (res && res.status < 300) {
      const { getSession } = await import("./session");
      const who = await getSession().catch(() => null);
      if (input) delete input.password;
      await audit(req, who, action, input?.id ?? input?.location_id ?? null, input);
    }
    return res;
  };
}
