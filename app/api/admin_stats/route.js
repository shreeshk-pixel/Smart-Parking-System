// GET /api/admin_stats  (admin) -> dashboard numbers, live occupancy per floor and type, 10 latest bookings
import { query, queryOne } from "@/lib/db";
import { ok, needAdmin, handle } from "@/lib/server";
import { FLOORS, floorSummary } from "@/lib/floors";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [, err] = await needAdmin();
  if (err) return err;
  const n = async (sql) => Number((await queryOne(sql)).n);
  const slots = await query(`
    SELECT s.floor, s.vehicle_type,
      NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
                  AND b.start_time < NOW() AND b.end_time > NOW()) AS available
    FROM slots s WHERE s.is_active = TRUE`);
  return ok({
    total_slots: slots.length,
    occupied_now: await n(`SELECT COUNT(DISTINCT b.slot_id) AS n FROM bookings b JOIN slots s ON s.id = b.slot_id
                           WHERE s.is_active = TRUE AND b.status IN ('booked','entered') AND b.start_time < NOW() AND b.end_time > NOW()`),
    today_bookings: await n("SELECT COUNT(*) AS n FROM bookings WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date"),
    revenue: await n("SELECT COALESCE(SUM(amount), 0) AS n FROM bookings WHERE payment_status = 'paid' AND status <> 'cancelled'"),
    floors: floorSummary(slots),
    floor_names: FLOORS,
    recent: await query(`
      SELECT b.id, u.name AS user_name, b.vehicle_number, s.slot_label, s.floor, s.vehicle_type, l.name AS location_name,
             b.start_time, b.end_time, b.amount, b.status, b.payment_status
      FROM bookings b JOIN users u ON u.id = b.user_id JOIN slots s ON s.id = b.slot_id
      JOIN parking_locations l ON l.id = s.location_id ORDER BY b.created_at DESC, b.id DESC LIMIT 10`),
  });
});
