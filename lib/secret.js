// The app's signing secret (SESSION_SECRET): signs sessions and QR passes and derives the exit-code key.
// Server-only (never NEXT_PUBLIC_). Production fails closed: no secret, or one shorter than 32 characters,
// and the app refuses to sign or accept anything (nobody can log in) instead of using a guessable default.
// Kept in its own file (no imports) so any module can use it.
export function secret() {
  const s = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!s) throw new Error("SESSION_SECRET is not set");
    if (s.length < 32) throw new Error("SESSION_SECRET is too short (use at least 32 random characters)");
    return s;
  }
  return s || "local-development-only-secret";
}
