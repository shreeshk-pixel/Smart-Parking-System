// The app's signing secret (SESSION_SECRET). No weak fallback in production: without it the app
// refuses to sign or accept anything. Kept in its own file (no imports) so any module can use it.
export function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return "local-development-only-secret";
}
