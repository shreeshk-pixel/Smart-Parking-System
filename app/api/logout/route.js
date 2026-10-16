// POST /api/auth/logout
import { clearSession } from "@/lib/session";
import { ok, handle } from "@/lib/server";

export const POST = handle(async () => {
  await clearSession();
  return ok({ loggedOut: true });
});
