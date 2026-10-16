// POST /api/cancel  {booking_id}  -> only your own unpaid booking
import { query, queryOne } from "@/lib/db";
import { ok, fail, needUser, readBody, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const [user, err] = await needUser();
  if (err) return err;
  const id = parseInt((await readBody(req)).booking_id) || 0;
  const b = await queryOne("SELECT * FROM bookings WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!b) return fail("booking not found", 404);
  if (b.payment_status === "paid") return fail("paid bookings cannot be cancelled");
  if (b.status !== "booked") return fail("booking is already " + b.status);
  await query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);
  return ok({ cancelled: true });
});
