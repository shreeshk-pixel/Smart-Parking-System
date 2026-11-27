// POST /api/exit_code  {booking_id, code}  (admin)  -> completes the booking
// The customer tells / shows the admin the 6-digit exit code from their own ticket. The code was made when
// the booking was created and is only ever shown to the customer. 5 wrong codes lock this booking's exit for
// 15 minutes (re-scanning the QR does NOT reset the count, so a copied QR alone can't be used to guess).
import { query, queryOne } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";
import { audit, rateLimit } from "@/lib/security";
import { exitCodeMatches } from "@/lib/exitCode";

const MAX_TRIES = 5;
const LOCK = "interval '15 minutes'";

export const POST = handle(async (req) => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const limited = await rateLimit(`exitcode:admin:${admin.id}`, 60, 900);
  if (limited) return limited;
  const body = await readBody(req);
  const id = parseInt(body.booking_id) || 0;
  const code = String(body.code ?? "").replace(/\s/g, "");
  const b = await queryOne(`SELECT id, exit_code_enc, CEIL(GREATEST(0, EXTRACT(EPOCH FROM (exit_locked_until - NOW()))) / 60)::int AS locked
                            FROM bookings WHERE id = $1 AND status = 'entered'`, [id]);
  if (!b) return fail("this booking is not parked here, scan the QR first");
  if (b.locked > 0) return fail(`too many wrong codes: exit locked for ${b.locked} more min`, 429);

  // Count the try first (atomically), so parallel guesses can't get more than MAX_TRIES
  const t = (await query(`UPDATE bookings SET otp_attempts = CASE WHEN exit_locked_until IS NOT NULL AND exit_locked_until <= NOW() THEN 1 ELSE otp_attempts + 1 END,
                                             exit_locked_until = NULL
                          WHERE id = $1 RETURNING otp_attempts`, [id]))[0];
  if (!exitCodeMatches(b.exit_code_enc, code)) {
    const left = MAX_TRIES - t.otp_attempts;
    await audit(req, admin, "exit_code_wrong", id);
    if (left <= 0) {
      await query(`UPDATE bookings SET exit_locked_until = NOW() + ${LOCK}, otp_attempts = 0 WHERE id = $1`, [id]);
      await audit(req, admin, "exit_locked", id);
      return fail("wrong exit code, 5 wrong tries: exit locked for 15 min", 429);
    }
    return fail(`wrong exit code (${left} ${left === 1 ? "try" : "tries"} left)`);
  }
  await query("UPDATE bookings SET status = 'completed', exit_time = NOW(), otp_attempts = 0, exit_locked_until = NULL WHERE id = $1", [id]);
  await audit(req, admin, "exit_completed", id);
  return ok({ booking_id: id, status: "completed" });
});
