// POST /api/verify_qr  {qr_token}  (admin)
// booked + paid -> entered (only 15 min before start until end time)
// entered -> new 6-digit exit OTP (works even after end time, shows overstay)
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const token = String((await readBody(req)).qr_token || "").trim();
  const b = await queryOne(`
    SELECT b.*, s.slot_number, u.name AS user_name,
           NOW() < b.start_time - interval '15 minutes' AS too_early,
           NOW() > b.end_time AS expired,
           GREATEST(0, CEIL(EXTRACT(EPOCH FROM (NOW() - b.end_time)) / 60))::int AS overstay
    FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN users u ON u.id = b.user_id
    WHERE b.qr_token = $1`, [token]);
  if (!b) return fail("invalid QR code", 404);
  const info = { booking_id: b.id, user_name: b.user_name, vehicle_number: b.vehicle_number, slot_number: b.slot_number };

  if (b.status === "booked") {
    if (b.payment_status !== "paid") return fail("booking is not paid");
    if (b.too_early) return fail("too early: booking starts at " + b.start_time);
    if (b.expired) return fail("booking expired at " + b.end_time);
    await query("UPDATE bookings SET status = 'entered', entry_time = NOW() WHERE id = $1", [b.id]);
    return ok({ ...info, action: "entry", status: "entered" });
  }

  if (b.status === "entered") {
    const otp = String(crypto.randomInt(100000, 1000000));
    await query("UPDATE bookings SET exit_otp_hash = $1, otp_expires_at = NOW() + interval '10 minutes' WHERE id = $2",
      [await bcrypt.hash(otp, 10), b.id]);
    // Demo only: the OTP is returned so it can be shown (in real life it would be sent by SMS)
    return ok({ ...info, action: "exit", status: "entered", otp, overstay_minutes: b.overstay });
  }

  return fail("booking is " + b.status);
});
