// POST /api/login  {email, password}
// Same message and (roughly) the same time whether the email exists or not, so accounts can't be
// discovered. Limits: 5 tries per email and 50 per IP address every 15 minutes
// (a successful login resets the email counter).
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { setSession } from "@/lib/session";
import { ok, fail, readBody, handle } from "@/lib/server";
import { clientIp, rateLimit, clearRateLimit, audit } from "@/lib/security";

// Hash of a random string: compared against when the email is unknown, so both cases cost one bcrypt
const DUMMY_HASH = "$2a$10$oj2B1hPAmt5ysZWIVA2EQu8DBTkBVKlxNa4f6OG4a1h13ATUGfbd6";
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
  await clearRateLimit(`login:email:${email}`);
  await setSession(user);
  await audit(req, user, "login");
  return ok({ id: user.id, name: user.name, role: user.role });
});
