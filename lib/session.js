// Login session stored in a signed cookie (HMAC-SHA256), so users can't fake it.
// The same signature is checked in middleware.js (with Web Crypto, because middleware runs on the Edge).
import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "change-this-secret";
export const COOKIE = "sp_session";
const WEEK = 60 * 60 * 24 * 7;

function sign(text) {
  return crypto.createHmac("sha256", SECRET).update(text).digest("base64url");
}

// Save the user in the cookie after login
export async function setSession(user) {
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + WEEK };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  (await cookies()).set(COOKIE, data + "." + sign(data), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: WEEK,
    secure: process.env.NODE_ENV === "production",
  });
}

// Read the logged-in user, or null if missing, tampered or expired
export async function getSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || !value.includes(".")) return null;
  const [data, sig] = value.split(".");
  const expected = sign(data);
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(Buffer.from(data, "base64url").toString());
    if (user.exp && user.exp < Date.now() / 1000) return null;
    return user;
  } catch { return null; }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
