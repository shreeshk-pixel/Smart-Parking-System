// POST /api/pay  {booking_id}  -> mock payment: marks the booking paid
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { ok, fail, needUser, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const [user, err] = await needUser();
  if (err) return err;
  const id = parseInt((await readBody(req)).booking_id) || 0;
  const b = await queryOne("SELECT * FROM bookings WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!b) return fail("booking not found", 404);
  if (b.status !== "booked") return fail("only active bookings can be paid");
  if (b.payment_status === "paid") return ok({ payment_ref: b.payment_ref, qr_token: b.qr_token });
  const ref = "MOCK" + crypto.randomBytes(4).toString("hex").toUpperCase();
  await query("UPDATE bookings SET payment_status = 'paid', payment_ref = $1 WHERE id = $2", [ref, id]);
  return ok({ payment_ref: ref, qr_token: b.qr_token });
});
