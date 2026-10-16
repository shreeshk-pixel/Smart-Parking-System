// GET /api/slots?location_id=&start=&end=  -> slots with availability for that time (default: now)
import { query } from "@/lib/db";
import { ok, fail, parseTime, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  const p = new URL(req.url).searchParams;
  const loc = parseInt(p.get("location_id"));
  if (!loc) return fail("location_id required");
  let start = p.get("start") ? parseTime(p.get("start")) : "now";
  let end = p.get("end") ? parseTime(p.get("end")) : start;
  if (!start || !end) return fail("bad time format, use YYYY-MM-DD HH:MM");
  // "now" is turned into the current time by Postgres; an empty range checks one instant
  const rows = await query(`
    SELECT s.id, s.slot_number, s.vehicle_type,
      NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
        AND b.start_time < GREATEST($1::timestamptz, $2::timestamptz + interval '1 second')
        AND b.end_time > $2::timestamptz) AS available
    FROM slots s WHERE s.location_id = $3 AND s.is_active = TRUE ORDER BY s.slot_number`,
    [end, start, loc]);
  return ok(rows);
});
