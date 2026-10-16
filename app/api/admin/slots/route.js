// /api/admin/slots  (admin)
// GET -> all slots + locations
// POST {location_id, slot_number, vehicle_type} -> add
// PUT {id, slot_number, vehicle_type, is_active} -> edit
// DELETE {id} -> delete, or deactivate if it already has bookings
import { query, queryOne } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const [, err] = await needAdmin();
  if (err) return err;
  return ok({
    locations: await query("SELECT id, name FROM parking_locations ORDER BY name"),
    slots: await query(`SELECT s.*, l.name AS location_name FROM slots s
                        JOIN parking_locations l ON l.id = s.location_id ORDER BY l.name, s.slot_number`),
  });
});

const vtype = (v) => (v === "bike" ? "bike" : "car");
const duplicate = (e) => e.code === "23505"; // unique slot_number per location

export const POST = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const b = await readBody(req);
  const num = String(b.slot_number || "").trim().toUpperCase();
  if (!parseInt(b.location_id) || !num) return fail("location and slot number are required");
  try {
    const row = await queryOne("INSERT INTO slots (location_id, slot_number, vehicle_type, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id",
      [parseInt(b.location_id), num, vtype(b.vehicle_type)]);
    return ok({ id: row.id, message: "Slot added." });
  } catch (e) {
    if (duplicate(e)) return fail("That slot number already exists at this location.", 409);
    throw e;
  }
});

export const PUT = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const b = await readBody(req);
  const num = String(b.slot_number || "").trim().toUpperCase();
  if (!num) return fail("slot number is required");
  try {
    const rows = await query("UPDATE slots SET slot_number = $1, vehicle_type = $2, is_active = $3 WHERE id = $4 RETURNING id",
      [num, vtype(b.vehicle_type), b.is_active === true || b.is_active === "true" || b.is_active === "on", parseInt(b.id) || 0]);
    if (!rows.length) return fail("slot not found", 404);
    return ok({ message: "Slot updated." });
  } catch (e) {
    if (duplicate(e)) return fail("That slot number already exists at this location.", 409);
    throw e;
  }
});

export const DELETE = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const id = parseInt((await readBody(req)).id) || 0;
  const used = await queryOne("SELECT COUNT(*)::int AS n FROM bookings WHERE slot_id = $1", [id]);
  if (used.n > 0) {
    await query("UPDATE slots SET is_active = FALSE WHERE id = $1", [id]);
    return ok({ message: "Slot has bookings, so it was deactivated instead of deleted." });
  }
  const rows = await query("DELETE FROM slots WHERE id = $1 RETURNING id", [id]);
  if (!rows.length) return fail("slot not found", 404);
  return ok({ message: "Slot deleted." });
});
