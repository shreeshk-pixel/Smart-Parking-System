// GET /api/my_bookings  -> your bookings (QR token only once paid)
import { query } from "@/lib/db";
import { ok, needUser, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [user, err] = await needUser();
  if (err) return err;
  const rows = await query(`
    SELECT b.id, b.vehicle_number, b.start_time, b.end_time, b.amount, b.status, b.payment_status,
           b.payment_ref, b.qr_token, b.entry_time, b.exit_time, s.slot_number, l.name AS location_name
    FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN parking_locations l ON l.id = s.location_id
    WHERE b.user_id = $1 ORDER BY b.start_time DESC`, [user.id]);
  return ok(rows.map((r) => ({ ...r, amount: Number(r.amount), qr_token: r.payment_status === "paid" ? r.qr_token : null })));
});
