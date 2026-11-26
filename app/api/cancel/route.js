// POST /api/cancel  {booking_id}  -> only your own unpaid booking
import { query, queryOne } from "@/lib/db";
import { ok, fail, needCustomer, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const [user, err] = await needCustomer();
  if (err) return err;
  const id = parseInt((await readBody(req)).booking_id) || 0;
  const b = await queryOne("SELECT * FROM bookings WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!b) return fail("booking not found", 404);
  if (b.payment_status === "paid") return fail("paid bookings cannot be cancelled");
  if (b.status !== "booked") return fail("booking is already " + b.status);
  // Same conditions inside the UPDATE, so a payment at the same moment can't slip through
  const done = await query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'booked' AND payment_status = 'pending' RETURNING id", [id]);
  if (!done[0]) return fail("booking can no longer be cancelled");
  return ok({ cancelled: true });
});
