// POST /api/exit_otp  {booking_id, otp}  (admin)  -> completes the booking
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const body = await readBody(req);
  const id = parseInt(body.booking_id) || 0;
  const b = await queryOne(
    "SELECT *, otp_expires_at < NOW() AS otp_expired FROM bookings WHERE id = $1 AND status = 'entered'", [id]);
  if (!b || !b.exit_otp_hash) return fail("no exit pending for this booking");
  if (b.otp_expired) return fail("OTP expired, scan the QR again");
  if (!(await bcrypt.compare(String(body.otp || "").trim(), b.exit_otp_hash))) return fail("wrong OTP");
  await query("UPDATE bookings SET status = 'completed', exit_time = NOW(), exit_otp_hash = NULL WHERE id = $1", [id]);
  return ok({ booking_id: id, status: "completed" });
});
