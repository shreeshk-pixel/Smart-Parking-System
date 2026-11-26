// Login is required for everything.
// Guests can only open /login and /register (and the login/register APIs). Every other page
// redirects to /login, and every other API answers 401 JSON. Normal users are kept out of /admin.
// Static files (/_next, /assets, the icon) never reach this code, see `config.matcher` below.
import { NextResponse } from "next/server";

const COOKIE = "sp_session";
const PUBLIC_PAGES = ["/login", "/register"];
const PUBLIC_APIS = ["/api/login", "/api/register"];

const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const bytesToB64url = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Same check as lib/session.js, written with Web Crypto because middleware runs on the Edge runtime
async function readSession(req) {
  const value = req.cookies.get(COOKIE)?.value;
  if (!value || !value.includes(".")) return null;
  const [data, sig] = value.split(".");
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env.SESSION_SECRET || "change-this-secret"),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = bytesToB64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
    if (expected !== sig) return null;
    const user = JSON.parse(new TextDecoder().decode(b64urlToBytes(data)));
    if (user.exp && user.exp < Date.now() / 1000) return null;
    return user;
  } catch { return null; }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const user = await readSession(req);
  const isApi = pathname.startsWith("/api/");

  if (!user) {
    if (PUBLIC_PAGES.includes(pathname) || PUBLIC_APIS.includes(pathname)) return NextResponse.next();
    if (isApi) return NextResponse.json({ ok: false, error: "login required" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged in: the login and register pages just send you into the app
  if (PUBLIC_PAGES.includes(pathname)) return NextResponse.redirect(new URL(user.role === "admin" ? "/admin" : "/", req.url));
  // Admin pages are for admins only (admin APIs also check this themselves and answer 403)
  if (pathname.startsWith("/admin") && user.role !== "admin") return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|assets/|icon.svg|favicon.ico|robots.txt).*)"],
};
