// /api/admin/locations  (admin only)
// GET  -> all locations with their slot counts
// POST {name, address, latitude, longitude, price_per_hour, car_slots, bike_slots}
//      -> adds a new location and (optionally) creates its slots: cars A1..An, bikes B1..Bn
import { query, transaction } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const [, err] = await needAdmin();
  if (err) return err;
  return ok(await query(`
    SELECT l.id, l.name, l.address, l.latitude, l.longitude, l.price_per_hour, COUNT(s.id)::int AS slots
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
  const cars = parseInt(b.car_slots) || 0;   // how many car slots to create
  const bikes = parseInt(b.bike_slots) || 0; // how many bike slots to create

  if (!name || !address) return fail("name and address are required");
  if (b.latitude === "" || b.longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return fail("latitude must be -90..90 and longitude -180..180 (click the map or type them)");
  }
  if (!Number.isFinite(price) || price < 0) return fail("price per hour must be a positive number");
  if (cars < 0 || bikes < 0 || cars + bikes > 100) return fail("slots must be between 0 and 100");

  // 2. Save the location and its slots together (all or nothing)
  return transaction(async (db) => {
    // Same name (ignoring capital letters) is not allowed
    const dup = await db.query("SELECT 1 FROM parking_locations WHERE LOWER(name) = LOWER($1)", [name]);
    if (dup.rows.length) return fail("A location with that name already exists.", 409);

    const loc = (await db.query(
      `INSERT INTO parking_locations (name, address, latitude, longitude, price_per_hour)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`, [name, address, lat, lng, price])).rows[0];

    for (let i = 1; i <= cars; i++) {
      await db.query("INSERT INTO slots (location_id, slot_number, vehicle_type) VALUES ($1, $2, 'car')", [loc.id, "A" + i]);
    }
    for (let i = 1; i <= bikes; i++) {
      await db.query("INSERT INTO slots (location_id, slot_number, vehicle_type) VALUES ($1, $2, 'bike')", [loc.id, "B" + i]);
    }
    return ok({ id: loc.id, slots_created: cars + bikes, message: "Location added." });
  });
});
