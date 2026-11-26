// Collects everything the admin report needs for a date range.
// Used by the Reports page (JSON preview) and by the CSV and PDF downloads,
// so the screen, the CSV and the PDF always show the same numbers.
//
// Range rule: a booking is "in range" when its start_time falls between
// `from` 00:00 and `to` 23:59:59 IST (both dates included).
// Revenue = amount of bookings that are paid and not cancelled (same rule as the dashboard).
import { query } from "./db";
import { FLOORS, FLOOR_ORDER, VEHICLE_TYPES, FLOOR_SORT_SQL, floorName, typeName } from "./floors";

const IST_MS = 330 * 60000;
export const istDate = (offsetDays = 0) => new Date(Date.now() + IST_MS + offsetDays * 86400000).toISOString().slice(0, 10);
const istNow = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 19).replace("T", " ");
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: the last 30 days). Returns [from, to, error]
export function rangeFromParams(p) {
  const from = p.get("from") || istDate(-30);
  const to = p.get("to") || istDate(0);
  const valid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
  if (!valid(from) || !valid(to)) return [null, null, "Dates must be in YYYY-MM-DD format."];
  if (from > to) return [null, null, '"From" date must be on or before the "To" date.'];
  return [from, to, null];
}

const bucket = () => ({ bookings: 0, hours: 0, revenue: 0 });
function addTo(obj, key, hours, revenue) {
  obj[key] ||= bucket();
  obj[key].bookings++; obj[key].hours = round2(obj[key].hours + hours); obj[key].revenue = round2(obj[key].revenue + revenue);
}
const INV_KEYS = ["active_slots", "inactive_slots", "bookings", "booked_hours", "occupied_now"];
const invZero = () => ({ active_slots: 0, inactive_slots: 0, bookings: 0, booked_hours: 0, occupied_now: 0 });

export async function buildReport(from, to, generatedBy = "") {
  const start = `${from} 00:00:00+05:30`;
  const nextDay = new Date(Date.parse(to + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  const end = `${nextDay} 00:00:00+05:30`; // exclusive
  const rangeHours = (Date.parse(nextDay + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 3600000;

  // ---- every booking in range, with slot label, floor, type and user ----
  const bookingsP = query(`
    SELECT b.id, b.created_at, u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
           l.name AS location_name, s.slot_label, s.floor, s.vehicle_type, b.vehicle_number,
           b.start_time, b.end_time, ROUND(EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 3600, 2) AS hours,
           b.amount, b.status, b.payment_status, b.payment_ref, b.paid_at, b.entry_time, b.exit_time
    FROM bookings b JOIN users u ON u.id = b.user_id JOIN slots s ON s.id = b.slot_id
    JOIN parking_locations l ON l.id = s.location_id
    WHERE b.start_time >= $1 AND b.start_time < $2
    ORDER BY b.start_time, b.id`, [start, end]);
  const inventoryP = query(`
    SELECT l.name AS location_name, s.floor, s.vehicle_type,
           COUNT(*) FILTER (WHERE s.is_active)::int AS active_slots,
           COUNT(*) FILTER (WHERE NOT s.is_active)::int AS inactive_slots,
           COALESCE(SUM(x.cnt), 0)::int AS bookings,
           ROUND(COALESCE(SUM(x.secs), 0) / 3600, 2) AS booked_hours,
           COUNT(*) FILTER (WHERE s.is_active AND EXISTS (SELECT 1 FROM bookings n WHERE n.slot_id = s.id
               AND n.status IN ('booked','entered') AND n.start_time < NOW() AND n.end_time > NOW()))::int AS occupied_now
    FROM slots s JOIN parking_locations l ON l.id = s.location_id
    LEFT JOIN (SELECT slot_id, COUNT(*) AS cnt,
                      SUM(EXTRACT(EPOCH FROM (LEAST(end_time, $2::timestamptz) - GREATEST(start_time, $1::timestamptz)))) AS secs
               FROM bookings WHERE status <> 'cancelled' AND start_time < $2 AND end_time > $1
               GROUP BY slot_id) x ON x.slot_id = s.id
    GROUP BY l.name, s.floor, s.vehicle_type
    ORDER BY l.name, ${FLOOR_SORT_SQL()}, s.vehicle_type`, [start, end]);
  const userRowsP = query(`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
      (SELECT COUNT(*)::int FROM bookings b WHERE b.user_id = u.id) AS bookings_all_time,
      (SELECT COUNT(*)::int FROM bookings b WHERE b.user_id = u.id AND b.start_time >= $1 AND b.start_time < $2) AS bookings_in_range,
      (SELECT COALESCE(SUM(amount), 0) FROM bookings b WHERE b.user_id = u.id AND b.start_time >= $1 AND b.start_time < $2
          AND b.payment_status = 'paid' AND b.status <> 'cancelled') AS paid_in_range
    FROM users u ORDER BY u.role, u.name`, [start, end]);
  // the three queries above run in parallel
  const [bookings, inventory, userRows] = await Promise.all([bookingsP, inventoryP, userRowsP]);

  const isRevenue = (b) => b.payment_status === "paid" && b.status !== "cancelled";
  const status = { booked: 0, entered: 0, completed: 0, cancelled: 0 };
  let revenue = 0, pending = 0, hours = 0, paidCount = 0;
  const users = new Set();
  const byLoc = {}, byFloor = {}, byType = {}, byDay = {};
  for (const f of FLOOR_ORDER) byFloor[f] = bucket();
  for (const t of Object.keys(VEHICLE_TYPES)) byType[t] = bucket();
  for (const b of bookings) {
    b.floor_name = floorName(b.floor); b.type_name = typeName(b.vehicle_type);
    status[b.status] = (status[b.status] || 0) + 1;
    const rev = isRevenue(b) ? Number(b.amount) : 0;
    if (isRevenue(b)) paidCount++;
    revenue += rev;
    if (b.payment_status === "pending" && b.status === "booked") pending += Number(b.amount);
    const h = b.status !== "cancelled" ? Number(b.hours) : 0;
    hours += h;
    users.add(b.user_id);
    addTo(byLoc, b.location_name, h, rev);
    addTo(byFloor, b.floor, h, rev);
    addTo(byType, b.vehicle_type, h, rev);
    addTo(byDay, String(b.start_time).slice(0, 10), h, rev);
  }
  const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

  // ---- slot inventory + occupancy per location / floor / type ----
  // Booked hours are clipped to the range, so a booking that runs past midnight on the last day
  // only counts the part inside the range. Cancelled bookings don't occupy anything.
  const pct = (a) => (a.active_slots ? round2((100 * a.booked_hours) / (a.active_slots * rangeHours)) : 0);
  const invFloor = {}, invType = {}, invTotal = invZero();
  for (const f of FLOOR_ORDER) invFloor[f] = invZero();
  for (const t of Object.keys(VEHICLE_TYPES)) invType[t] = invZero();
  for (const r of inventory) {
    r.booked_hours = round2(r.booked_hours);
    r.floor_name = floorName(r.floor); r.type_name = typeName(r.vehicle_type);
    r.occupancy_pct = pct(r);
    for (const agg of [invFloor[r.floor], invType[r.vehicle_type], invTotal]) {
      if (!agg) continue;
      for (const k of INV_KEYS) agg[k] = round2(agg[k] + r[k]);
    }
  }
  for (const a of [...Object.values(invFloor), ...Object.values(invType), invTotal]) a.occupancy_pct = pct(a);

  // ---- users (all of them), with their activity in the range ----

  return {
    meta: { from, to, generated_at: istNow(), generated_by: generatedBy, range_hours: rangeHours, timezone: "Asia/Kolkata (IST)" },
    summary: {
      total_bookings: bookings.length, status,
      revenue_paid: round2(revenue), pending_amount: round2(pending), booked_hours: round2(hours),
      unique_customers: users.size, avg_paid_booking: paidCount ? round2(revenue / paidCount) : 0,
      registered_users: userRows.length,
    },
    revenue: { by_location: sortKeys(byLoc), by_floor: byFloor, by_type: byType, by_day: sortKeys(byDay) },
    inventory: { rows: inventory, by_floor: invFloor, by_type: invType, total: invTotal },
    bookings,
    users: userRows,
    floor_names: FLOORS,
    type_names: VEHICLE_TYPES,
  };
}
