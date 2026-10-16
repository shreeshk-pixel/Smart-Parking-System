// Login session stored in a signed cookie (HMAC), so users can't fake it
import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SESSION_SECRET || "change-this-secret";
const COOKIE = "sp_session";

function sign(text) {
  return crypto.createHmac("sha256", SECRET).update(text).digest("base64url");
}

// Save the user in the cookie after login
export async function setSession(user) {
  const data = Buffer.from(JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role })).toString("base64url");
  (await cookies()).set(COOKIE, data + "." + sign(data), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
}

// Read the logged-in user, or null if missing/tampered
export async function getSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value || !value.includes(".")) return null;
  const [data, sig] = value.split(".");
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(data, "base64url").toString()); } catch { return null; }
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
