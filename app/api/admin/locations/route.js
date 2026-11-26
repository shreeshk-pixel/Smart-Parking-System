// /api/admin/locations  (admin only)
// GET  -> all locations with their slot counts
// POST {name, address, latitude, longitude, price_per_hour, car_slots, bike_slots}
//      -> adds a new location and creates car_slots + bike_slots on EACH floor (LG, G, F1, F2, F3),
//         named like G-C01 / F1-B03
import { query, transaction } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";
import { FLOOR_ORDER } from "@/lib/floors";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const [, err] = await needAdmin();
  if (err) return err;
  return ok(await query(`
    SELECT l.id, l.name, l.address, l.latitude, l.longitude, l.price_per_hour, COUNT(s.id)::int AS slots, COUNT(DISTINCT s.floor)::int AS floors
    FROM parking_locations l LEFT JOIN slots s ON s.location_id = l.id
    GROUP BY l.id ORDER BY l.name`));
});

export const POST = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const b = await readBody(req);

  // 1. Read and check the inputs
  const name = String(b.name || "").trim();
  const address = String(b.address || "").trim();
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  const price = b.price_per_hour === undefined || b.price_per_hour === "" ? 20 : Number(b.price_per_hour);
  const cars = parseInt(b.car_slots) || 0;   // car slots per floor
  const bikes = parseInt(b.bike_slots) || 0; // bike slots per floor

  if (!name || !address) return fail("name and address are required");
  if (b.latitude === "" || b.longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return fail("latitude must be -90..90 and longitude -180..180 (click the map or type them)");
  }
  if (!Number.isFinite(price) || price < 0) return fail("price per hour must be a positive number");
  if (cars < 0 || bikes < 0 || cars > 99 || bikes > 99) return fail("slots per floor must be between 0 and 99 for each type");

  // 2. Save the location and its slots together (all or nothing)
  return transaction(async (db) => {
    // Same name (ignoring capital letters) is not allowed
    const dup = await db.query("SELECT 1 FROM parking_locations WHERE LOWER(name) = LOWER($1)", [name]);
    if (dup.rows.length) return fail("A location with that name already exists.", 409);

    const loc = (await db.query(
      `INSERT INTO parking_locations (name, address, latitude, longitude, price_per_hour)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`, [name, address, lat, lng, price])).rows[0];

    // One INSERT for every floor x type x number (generate_series makes the numbers 1..n)
    await db.query(`
      INSERT INTO slots (location_id, floor, vehicle_type, slot_no)
      SELECT $1, f.floor, t.vt, n
        FROM unnest($2::text[]) WITH ORDINALITY AS f(floor, ord)
       CROSS JOIN (VALUES ('B', $3::int), ('C', $4::int)) AS t(vt, cnt)
       CROSS JOIN LATERAL generate_series(1, t.cnt) AS n
       ORDER BY f.ord, t.vt, n`, [loc.id, FLOOR_ORDER, bikes, cars]);
    return ok({ id: loc.id, slots_created: (cars + bikes) * FLOOR_ORDER.length, message: "Location added." });
  });
});
