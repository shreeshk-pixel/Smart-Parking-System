// POST /api/pay  {booking_id}  -> mock payment: marks your booking paid and unlocks its QR pass.
// Only your own booking (user_id check), and the amount is the one stored when the booking was made.
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { ok, fail, needCustomer, readBody, handle } from "@/lib/server";
import { signQr } from "@/lib/security";

export const POST = handle(async (req) => {
  const [user, err] = await needCustomer();
  if (err) return err;
  const id = parseInt((await readBody(req)).booking_id) || 0;
  const b = await queryOne(`SELECT *, EXTRACT(EPOCH FROM end_time)::bigint AS end_ts FROM bookings
                            WHERE id = $1 AND user_id = $2`, [id, user.id]);
  if (!b) return fail("booking not found", 404);
  if (b.status !== "booked") return fail("only active bookings can be paid");
  let ref = b.payment_ref;
  if (b.payment_status !== "paid") {
    ref = "MOCK" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const done = await query(`UPDATE bookings SET payment_status = 'paid', payment_ref = $1, paid_at = NOW()
                              WHERE id = $2 AND payment_status = 'pending' RETURNING payment_ref`, [ref, id]);
    if (!done[0]) ref = (await queryOne("SELECT payment_ref FROM bookings WHERE id = $1", [id])).payment_ref;
  }
  return ok({ payment_ref: ref, amount: Number(b.amount), qr_token: signQr(b.id, b.end_ts, b.qr_token) });
});
