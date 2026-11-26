// GET /api/slots?location_id=&start=&end=[&floor=LG|G|F1|F2|F3][&type=B|C]
// -> { slots: [...with available], floors: per-floor counts for the whole lot, floor_names, type_names }
import { query } from "@/lib/db";
import { ok, fail, needUser, parseTime, handle } from "@/lib/server";
import { FLOORS, VEHICLE_TYPES, FLOOR_SORT_SQL, floorSummary, validFloor, validType } from "@/lib/floors";

export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  const [, err] = await needUser();
  if (err) return err;
  const p = new URL(req.url).searchParams;
  const loc = parseInt(p.get("location_id"));
  if (!loc) return fail("location_id required");
  const start = p.get("start") ? parseTime(p.get("start")) : "now";
  const end = p.get("end") ? parseTime(p.get("end")) : start;
  if (!start || !end) return fail("bad time format, use YYYY-MM-DD HH:MM");
  const floor = String(p.get("floor") || "").toUpperCase();
  const type = String(p.get("type") || "").toUpperCase();
  if (floor && !validFloor(floor)) return fail("floor must be one of " + Object.keys(FLOORS).join(", "));
  if (type && !validType(type)) return fail("type must be B (bike) or C (car)");

  // "now" is turned into the current time by Postgres; an empty range checks one instant
  const all = await query(`
    SELECT s.id, s.floor, s.vehicle_type, s.slot_no, s.slot_label,
      NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
        AND b.start_time < GREATEST($1::timestamptz, $2::timestamptz + interval '1 second')
        AND b.end_time > $2::timestamptz) AS available
    FROM slots s WHERE s.location_id = $3 AND s.is_active = TRUE
    ORDER BY ${FLOOR_SORT_SQL()}, s.vehicle_type, s.slot_no`, [end, start, loc]);
  // Counts always cover the whole lot, so the floor tabs can show numbers for every floor
  const slots = all.filter((s) => (!floor || s.floor === floor) && (!type || s.vehicle_type === type));
  return ok({ slots, floors: floorSummary(all), floor_names: FLOORS, type_names: VEHICLE_TYPES });
});
