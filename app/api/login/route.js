// POST /api/login  {email, password}
// Same message and (roughly) the same time whether the email exists or not, so accounts can't be
// discovered. Limits: 5 tries per email and 50 per IP address every 15 minutes
// (a successful login resets the email counter).
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { setSession } from "@/lib/session";
import { ok, fail, readBody, handle } from "@/lib/server";
import { clientIp, rateLimit, clearRateLimit, audit, BCRYPT_COST } from "@/lib/security";

// Hash of a random string (same cost as real hashes): compared against when the email is unknown, so
// both cases cost one bcrypt and take the same time
const DUMMY_HASH = "$2b$12$c1Ha/nQPVTbHI1GU4Hel3OXU5y/n2zg0grfKYAyrip2xPwo8DD8TC";
const costOf = (hash) => parseInt(String(hash).split("$")[2], 10) || 0;
const WINDOW = 15 * 60;

export const POST = handle(async (req) => {
  const b = await readBody(req);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  const password = String(b.password || "").slice(0, 200);
  const ip = clientIp(req);
  const limited = (await rateLimit(`login:ip:${ip}`, 50, WINDOW)) || (await rateLimit(`login:email:${email}`, 5, WINDOW));
  if (limited) {
    if (limited.firstBlock) await audit(req, { email }, "login_blocked");
    return limited;
  }

  const user = email ? await queryOne("SELECT * FROM users WHERE LOWER(email) = $1", [email]) : null;
  const good = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !good) {
    await audit(req, user ? user : { email }, "login_failed");
    return fail("Wrong email or password.", 401);
  }
  // Older hashes (cost 10) are upgraded to the current cost the next time the user logs in
  if (costOf(user.password_hash) < BCRYPT_COST) {
    const fresh = await bcrypt.hash(password, BCRYPT_COST);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3", [fresh, user.id, user.password_hash]).catch(() => {});
  }
  await clearRateLimit(`login:email:${email}`);
  await setSession(user);
  await audit(req, user, "login");
  // Where this role lives (the login page uses it to redirect and to check ?next=)
  const admin = user.role === "admin";
  return ok({ id: user.id, name: user.name, role: user.role, home: admin ? "/admin" : "/",
              areas: admin ? ["/admin"] : ["/", "/my-bookings"], home_api: admin ? "/api/admin_stats" : "/api/locations" });
});
