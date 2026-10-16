// POST /api/auth/login  {email, password}
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { setSession } from "@/lib/session";
import { ok, fail, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const { email = "", password = "" } = await readBody(req);
  const user = await queryOne("SELECT * FROM users WHERE email = $1", [String(email).trim()]);
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    return fail("Wrong email or password.", 401);
  }
  await setSession(user);
  return ok({ id: user.id, name: user.name, role: user.role });
});
