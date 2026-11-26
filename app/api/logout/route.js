// POST /api/logout -> ends the session everywhere: bumping token_version makes every cookie
// issued before now invalid, even a copy someone else might have.
import { query } from "@/lib/db";
import { clearSession, readSignedCookie } from "@/lib/session";
import { audit } from "@/lib/security";
import { ok, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const p = await readSignedCookie();
  if (p && Number.isInteger(p.id)) {
    await query("UPDATE users SET token_version = token_version + 1 WHERE id = $1 AND token_version = $2", [p.id, p.tv || 0]);
    await audit(req, p, "logout");
  }
  await clearSession();
  return ok({ loggedOut: true });
});
