// GET /api/locations  -> every location with free/total slot counts right now, per vehicle type
import { query } from "@/lib/db";
import { ok, needUser, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [, err] = await needUser();
  if (err) return err;
  // "free" = active slot with no booked/entered booking covering this moment
  const rows = await query(`
    WITH s AS (
      SELECT s.*, NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
                              AND b.start_time < NOW() AND b.end_time > NOW()) AS free
      FROM slots s WHERE s.is_active = TRUE)
    SELECT l.id, l.name, l.address, l.latitude, l.longitude, l.price_per_hour,
           COUNT(s.id)::int AS total_slots,
           COUNT(s.id) FILTER (WHERE s.free)::int AS free_slots,
           COUNT(s.id) FILTER (WHERE s.vehicle_type = 'B')::int AS bike_slots,
           COUNT(s.id) FILTER (WHERE s.vehicle_type = 'B' AND s.free)::int AS free_bike,
           COUNT(s.id) FILTER (WHERE s.vehicle_type = 'C')::int AS car_slots,
           COUNT(s.id) FILTER (WHERE s.vehicle_type = 'C' AND s.free)::int AS free_car,
           COUNT(DISTINCT s.floor)::int AS floors
    FROM parking_locations l LEFT JOIN s ON s.location_id = l.id
    GROUP BY l.id ORDER BY l.name`);
  return ok(rows.map((r) => ({ ...r, latitude: Number(r.latitude), longitude: Number(r.longitude), price_per_hour: Number(r.price_per_hour) })));
});
