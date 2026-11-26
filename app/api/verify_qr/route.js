// POST /api/verify_qr  {qr_token}  (admin)
// The QR holds a signed pass SP1.<bookingId>.<expiry>.<signature>. It is accepted only if the signature
// matches (HMAC over id + expiry + the booking's secret token) and it has not expired.
// booked + paid -> entered (only 15 min before start until end time). A second entry scan is refused.
// entered -> exit requested: the admin then asks the customer for their 6-digit exit code (POST /api/exit_code).
//            The code itself is never sent to the admin. Works after the end time too (shows overstay).
import { query, queryOne } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";
import { floorName } from "@/lib/floors";
import { parseQr, qrValid, audit } from "@/lib/security";
import { fillExitCodes, openExitCode } from "@/lib/exitCode";

export const POST = handle(async (req) => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const pass = parseQr((await readBody(req)).qr_token);
  if (!pass) return fail("invalid QR code", 404);
  const b = await queryOne(`
    SELECT b.*, s.slot_label, s.floor, u.name AS user_name,
           NOW() < b.start_time - interval '15 minutes' AS too_early,
           NOW() > b.end_time AS expired,
           CEIL(GREATEST(0, EXTRACT(EPOCH FROM (b.exit_locked_until - NOW()))) / 60)::int AS locked_minutes,
           GREATEST(0, CEIL(EXTRACT(EPOCH FROM (NOW() - b.end_time)) / 60))::int AS overstay
    FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN users u ON u.id = b.user_id
    WHERE b.id = $1`, [pass.id]);
  if (!b || !qrValid(pass, b.qr_token)) {
    await audit(req, admin, "qr_rejected", pass.id);
    return fail("invalid QR code", 404);
  }
  if (pass.exp < Date.now() / 1000) return fail("this QR pass has expired");
  const info = { booking_id: b.id, user_name: b.user_name, vehicle_number: b.vehicle_number, slot_label: b.slot_label, floor: b.floor, floor_name: floorName(b.floor) };

  if (b.status === "booked") {
    if (b.payment_status !== "paid") return fail("booking is not paid");
    if (b.too_early) return fail("too early: booking starts at " + b.start_time);
    if (b.expired) return fail("booking expired at " + b.end_time);
    // status check in the UPDATE too, so two scans at the same moment can't both "enter"
    const done = await query("UPDATE bookings SET status = 'entered', entry_time = NOW() WHERE id = $1 AND status = 'booked' RETURNING id", [b.id]);
    if (!done[0]) return fail("this pass was already used for entry");
    await audit(req, admin, "qr_entry", b.id);
    return ok({ ...info, action: "entry", status: "entered" });
  }

  if (b.status === "entered") {
    // A booking made before exit codes existed gets one now (the customer sees it on My bookings)
    if (!openExitCode(b.exit_code_enc)) await fillExitCodes(query, b.user_id);
    await audit(req, admin, "qr_exit_scan", b.id);
    return ok({ ...info, action: "exit", status: "entered", needs_exit_code: true,
                overstay_minutes: b.overstay, locked_minutes: b.locked_minutes || 0 });
  }

  return fail("booking is " + b.status);
});
