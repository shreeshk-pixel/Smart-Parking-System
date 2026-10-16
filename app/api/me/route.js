// GET /api/me  -> the logged-in user, or null
import { getSession } from "@/lib/session";
import { ok, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async () => ok(await getSession()));
