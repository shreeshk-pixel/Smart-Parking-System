// POST /api/exit_otp  {booking_id, otp}  (admin)  -> completes the booking
// 5 wrong tries cancel the OTP (the QR must be scanned again for a new one), so it can't be guessed.
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";
import { audit } from "@/lib/security";

const MAX_TRIES = 5;

export const POST = handle(async (req) => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const body = await readBody(req);
  const id = parseInt(body.booking_id) || 0;
  const otp = String(body.otp || "").trim();
  const b = await queryOne(
    "SELECT *, otp_expires_at < NOW() AS otp_expired FROM bookings WHERE id = $1 AND status = 'entered'", [id]);
  if (!b || !b.exit_otp_hash) return fail("no exit pending for this booking, scan the QR again");
  if (b.otp_expired) return fail("OTP expired, scan the QR again");
  // Count the try first (atomically), so parallel guesses can't get more than MAX_TRIES
  const t = await query("UPDATE bookings SET otp_attempts = otp_attempts + 1 WHERE id = $1 AND exit_otp_hash IS NOT NULL RETURNING otp_attempts", [id]);
  if (!t[0] || t[0].otp_attempts > MAX_TRIES) {
    await query("UPDATE bookings SET exit_otp_hash = NULL WHERE id = $1", [id]);
    return fail("too many wrong OTPs, scan the QR again for a new one", 429);
  }
  if (!/^\d{6}$/.test(otp) || !(await bcrypt.compare(otp, b.exit_otp_hash))) {
    const left = MAX_TRIES - t[0].otp_attempts;
    if (left <= 0) await query("UPDATE bookings SET exit_otp_hash = NULL WHERE id = $1", [id]);
    await audit(req, admin, "exit_otp_wrong", id);
    return fail(left > 0 ? `wrong OTP (${left} ${left === 1 ? "try" : "tries"} left)` : "wrong OTP, too many tries: scan the QR again for a new one");
  }
  await query("UPDATE bookings SET status = 'completed', exit_time = NOW(), exit_otp_hash = NULL, otp_attempts = 0 WHERE id = $1", [id]);
  await audit(req, admin, "exit_completed", id);
  return ok({ booking_id: id, status: "completed" });
});
