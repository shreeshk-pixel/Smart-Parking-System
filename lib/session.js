// Login session stored in a signed cookie (HMAC-SHA256), so users can't fake it.
// The same signature is checked in middleware.js (with Web Crypto, because middleware runs on the Edge).
// Every API also re-reads the user from the database (getSession): this gives the CURRENT role, and a
// session is dead as soon as the user logs out, because logout bumps users.token_version ("tv").
import crypto from "crypto";
import { cookies } from "next/headers";
import { queryOne } from "./db";

export const COOKIE = "sp_session";
export const USER_COOKIE = "sp_user";
export const SESSION_HOURS = 24;
const MAX_AGE = SESSION_HOURS * 3600;
// Sessions signed before this moment are rejected (the demo admin password was public until then).
// Keep in sync with middleware.js.
export const SESSIONS_VALID_AFTER = Date.parse("2026-11-26T15:30:00Z") / 1000;

// No weak fallback in production: without SESSION_SECRET the app refuses to sign or accept sessions.
export function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "local-development-only-secret";
}

function sign(text) {
  return crypto.createHmac("sha256", secret()).update(text).digest("base64url");
}

const cookieOpts = (httpOnly) => ({ httpOnly, sameSite: "lax", path: "/", maxAge: MAX_AGE, secure: process.env.NODE_ENV === "production" });

// Save the user in the cookie after login
export async function setSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role,
                    tv: user.token_version || 0, iat: now, exp: now + MAX_AGE };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, data + "." + sign(data), cookieOpts(true));
  // Display-only copy (name / email / role) the browser can read to draw the sidebar without asking
  // the server. It grants nothing: every page and API still checks the signed cookie above.
  const pub = Buffer.from(JSON.stringify({ name: user.name, email: user.email, role: user.role })).toString("base64url");
  jar.set(USER_COOKIE, pub, cookieOpts(false));
}

// Signature + expiry only (no database). Returns the cookie payload or null.
export async function readSignedCookie() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || value.length > 2000) return null;
  const [data, sig, extra] = value.split(".");
  if (!data || !sig || extra !== undefined) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    const now = Date.now() / 1000;
    if (!p.exp || p.exp < now) return null;
    if (!p.iat || p.iat < SESSIONS_VALID_AFTER) return null;
    return p;
  } catch { return null; }
}

// The logged-in user (fresh from the database), or null if missing, tampered, expired or logged out
export async function getSession() {
  const p = await readSignedCookie();
  if (!p || !Number.isInteger(p.id)) return null;
  const u = await queryOne("SELECT id, name, email, role, token_version FROM users WHERE id = $1", [p.id]);
  if (!u || u.token_version !== (p.tv || 0)) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function clearSession() {
  const jar = await cookies();
  for (const name of [COOKIE, USER_COOKIE]) jar.set(name, "", { ...cookieOpts(name === COOKIE), maxAge: 0 });
}
