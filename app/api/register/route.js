// POST /api/auth/register  {name, email, phone, password}
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { ok, fail, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const b = await readBody(req);
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim();
  const phone = String(b.phone || "").trim();
  const password = String(b.password || "");
  if (!name || !email.includes("@") || password.length < 6) {
    return fail("Enter a name, a valid email and a password of at least 6 characters.");
  }
  if (await queryOne("SELECT id FROM users WHERE email = $1", [email])) {
    return fail("That email is already registered.", 409);
  }
  const hash = await bcrypt.hash(password, 10);
  await query("INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'user')",
    [name, email, phone, hash]);
  return ok({ registered: true });
});
