// GET /api/locations  -> every location with free/total slot counts right now
import { query } from "@/lib/db";
import { ok, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const rows = await query(`
    SELECT l.id, l.name, l.address, l.latitude, l.longitude, l.price_per_hour,
           COUNT(s.id)::int AS total_slots,
           COUNT(s.id) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
             AND b.start_time < NOW() AND b.end_time > NOW()))::int AS free_slots
    FROM parking_locations l
    LEFT JOIN slots s ON s.location_id = l.id AND s.is_active = TRUE
    GROUP BY l.id ORDER BY l.name`);
  return ok(rows.map((r) => ({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude), price_per_hour: Number(r.price_per_hour) })));
});
