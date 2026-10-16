// GET /api/admin_stats  (admin) -> dashboard numbers + 10 latest bookings
import { query, queryOne } from "@/lib/db";
import { ok, needAdmin, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [, err] = await needAdmin();
  if (err) return err;
  const n = async (sql) => Number((await queryOne(sql)).n);
  return ok({
    total_slots: await n("SELECT COUNT(*) AS n FROM slots WHERE is_active = TRUE"),
    occupied_now: await n(`SELECT COUNT(DISTINCT slot_id) AS n FROM bookings WHERE status IN ('booked','entered')
                           AND start_time < NOW() AND end_time > NOW()`),
    today_bookings: await n("SELECT COUNT(*) AS n FROM bookings WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date"),
    revenue: await n("SELECT COALESCE(SUM(amount), 0) AS n FROM bookings WHERE payment_status = 'paid' AND status <> 'cancelled'"),
    recent: await query(`
      SELECT b.id, u.name AS user_name, b.vehicle_number, s.slot_number, l.name AS location_name,
             b.start_time, b.end_time, b.status, b.payment_status
      FROM bookings b JOIN users u ON u.id = b.user_id JOIN slots s ON s.id = b.slot_id
      JOIN parking_locations l ON l.id = s.location_id ORDER BY b.created_at DESC LIMIT 10`),
  });
});
