// POST /api/register  {name, email, phone, password}
// Always answers the same way for a new or an already-registered email (no account discovery),
// and spends the same bcrypt time in both cases. Limit: 5 sign-ups per IP address per hour.
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { ok, readBody, handle } from "@/lib/server";
import { NAME, EMAIL, PHONE, PASSWORD, check, clientIp, rateLimit, audit, BCRYPT_COST } from "@/lib/security";

const Register = z.object({ name: NAME, email: EMAIL, phone: PHONE, password: PASSWORD });

export const POST = handle(async (req) => {
  // Any attempt counts (30/hour per IP, even invalid ones); valid sign-ups are limited to 5/hour per IP below
  const tries = await rateLimit(`register_try:ip:${clientIp(req)}`, 30, 3600);
  if (tries) return tries;
  const raw = await readBody(req);
  const [b, bad] = check(Register, { name: String(raw.name ?? ""), email: String(raw.email ?? ""),
    phone: String(raw.phone ?? ""), password: String(raw.password ?? "") });
  if (bad) return bad;
  const limited = await rateLimit(`register:ip:${clientIp(req)}`, 5, 3600);
  if (limited) return limited;

  const hash = await bcrypt.hash(b.password, BCRYPT_COST);
  const rows = await query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     SELECT $1::text, $2::text, $3::text, $4::text, 'user' WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = $2::text)
     ON CONFLICT DO NOTHING RETURNING id`, [b.name, b.email, b.phone, hash]);
  if (rows[0]) await audit(req, { id: rows[0].id, email: b.email }, "register");
  return ok({ registered: true, message: "Account ready. Please log in. (If you already had an account with this email, use your existing password.)" });
});
