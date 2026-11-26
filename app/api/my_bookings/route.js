// GET /api/my_bookings  -> your bookings, newest first. The QR pass is only sent once the booking is paid,
// and it is a signed, expiring pass (SP1.<id>.<expiry>.<signature>), never the raw secret token.
import { query } from "@/lib/db";
import { ok, needCustomer, handle } from "@/lib/server";
import { floorName, typeName } from "@/lib/floors";
import { signQr } from "@/lib/security";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [user, err] = await needCustomer();
  if (err) return err;
  const rows = await query(`
    SELECT b.id, b.vehicle_number, b.start_time, b.end_time, b.amount, b.status, b.payment_status, b.payment_ref,
           b.paid_at, b.qr_token, b.entry_time, b.exit_time, b.created_at,
           s.slot_label, s.floor, s.vehicle_type, l.name AS location_name,
           EXTRACT(EPOCH FROM b.start_time)::bigint AS start_ts, EXTRACT(EPOCH FROM b.end_time)::bigint AS end_ts
    FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN parking_locations l ON l.id = s.location_id
    WHERE b.user_id = $1 ORDER BY b.start_time DESC`, [user.id]);
  // start_ts / end_ts are epoch seconds, so the countdown is right whatever timezone the browser is in
  return ok(rows.map((r) => ({ ...r, floor_name: floorName(r.floor), type_name: typeName(r.vehicle_type),
    qr_token: r.payment_status === "paid" && ["booked", "entered"].includes(r.status) ? signQr(r.id, r.end_ts, r.qr_token) : null })));
});
