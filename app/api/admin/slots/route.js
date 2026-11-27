// /api/admin/slots  (admin)
// GET ?loc=&floor=&type=                          -> locations, filtered slots, per-floor counts for that lot
// POST {location_id, floor, vehicle_type, slot_no} -> add one slot (blank slot_no = next free number)
// POST {action:'bulk', location_id, floor, vehicle_type, count} -> add several after the highest number
// PUT {id, floor, vehicle_type, slot_no, is_active} -> edit
// DELETE {id} -> delete, or deactivate if it already has bookings (keeps history and reports correct)
import { query, queryOne, transaction } from "@/lib/db";
import { ok, fail, needAdmin, readBody, handle } from "@/lib/server";
import { audited, rateLimit } from "@/lib/security";
import { FLOORS, VEHICLE_TYPES, FLOOR_SORT_SQL, validFloor, validType, slotLabel } from "@/lib/floors";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const [, err] = await needAdmin();
  if (err) return err;
  const p = new URL(req.url).searchParams;
  const locationsP = query("SELECT id, name FROM parking_locations ORDER BY name");
  let loc = parseInt(p.get("loc")) || 0;
  const locations = loc ? null : await locationsP; // only wait first when we need the default lot
  if (!loc) loc = locations[0]?.id || 0;
  const floor = String(p.get("floor") || "").toUpperCase();
  const type = String(p.get("type") || "").toUpperCase();
  const where = ["s.location_id = $1"], args = [loc];
  if (validFloor(floor)) { args.push(floor); where.push(`s.floor = $${args.length}`); }
  if (validType(type)) { args.push(type); where.push(`s.vehicle_type = $${args.length}`); }
  const [allLocations, slots, counts] = await Promise.all([locationsP, query(`SELECT s.*, l.name AS location_name FROM slots s JOIN parking_locations l ON l.id = s.location_id
     WHERE ${where.join(" AND ")} ORDER BY ${FLOOR_SORT_SQL()}, s.vehicle_type, s.slot_no`, args),
    query(`SELECT floor, vehicle_type, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE is_active)::int AS active
     FROM slots WHERE location_id = $1 GROUP BY floor, vehicle_type`, [loc])]);
  return ok({ locations: allLocations, loc, slots, counts, floor_names: FLOORS, type_names: VEHICLE_TYPES });
});

// Reads and checks floor / type / number from the request body; returns [values, error]
function parseSlot(b, needNo) {
  const floor = String(b.floor || "").toUpperCase();
  const type = String(b.vehicle_type || "").toUpperCase();
  if (!validFloor(floor)) return [null, "Pick a floor: LG, G, F1, F2 or F3."];
  if (!validType(type)) return [null, "Pick a vehicle type: B (bike) or C (car)."];
  const raw = String(b.slot_no ?? "").trim();
  if (raw === "" && !needNo) return [{ floor, type, no: null }, null];
  const no = Number(raw);
  if (!Number.isInteger(no) || no < 1 || no > 99) return [null, "Slot number must be a whole number from 1 to 99."];
  return [{ floor, type, no }, null];
}
const duplicate = (e) => e.code === "23505";
const DUP_MSG = "That slot (floor + type + number) already exists at this location.";

async function nextNo(db, loc, floor, type) {
  const r = await db.query("SELECT COALESCE(MAX(slot_no), 0)::int AS m FROM slots WHERE location_id = $1 AND floor = $2 AND vehicle_type = $3", [loc, floor, type]);
  return r.rows[0].m + 1;
}

export const POST = handle(audited("slot_add", async (req) => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const limited = await rateLimit(`admin_write:${admin.id}`, 300, 3600);
  if (limited) return limited;
  const b = await readBody(req);
  const loc = parseInt(b.location_id) || 0;
  if (!loc) return fail("location is required");
  const [v, bad] = parseSlot(b, false);
  if (bad) return fail(bad);
  try {
    return await transaction(async (db) => {
      if (b.action === "bulk") {
        const count = Math.max(1, Math.min(50, parseInt(b.count) || 1));
        let no = await nextNo(db, loc, v.floor, v.type);
        if (no + count - 1 > 99) return fail(`Only ${Math.max(0, 100 - no)} more numbers fit on that floor (max 99).`);
        const labels = [];
        for (let i = 0; i < count; i++, no++) {
          await db.query("INSERT INTO slots (location_id, floor, vehicle_type, slot_no) VALUES ($1, $2, $3, $4)", [loc, v.floor, v.type, no]);
          labels.push(slotLabel(v.floor, v.type, no));
        }
        return ok({ message: `Added ${count} slots: ${labels[0]} to ${labels[labels.length - 1]}.` });
      }
      const no = v.no ?? (await nextNo(db, loc, v.floor, v.type));
      if (no > 99) return fail("That floor already uses number 99 for this type.");
      const row = (await db.query("INSERT INTO slots (location_id, floor, vehicle_type, slot_no) VALUES ($1, $2, $3, $4) RETURNING id, slot_label",
        [loc, v.floor, v.type, no])).rows[0];
      return ok({ id: row.id, message: `Slot ${row.slot_label} added.` });
    });
  } catch (e) {
    if (duplicate(e)) return fail(DUP_MSG, 409);
    if (e.code === "23503") return fail("location not found", 404);
    throw e;
  }
}));

export const PUT = handle(audited("slot_edit", async (req) => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const limited = await rateLimit(`admin_write:${admin.id}`, 300, 3600);
  if (limited) return limited;
  const b = await readBody(req);
  const [v, bad] = parseSlot(b, true);
  if (bad) return fail(bad);
  const active = b.is_active === true || b.is_active === "true" || b.is_active === "on";
  try {
    const rows = await query("UPDATE slots SET floor = $1, vehicle_type = $2, slot_no = $3, is_active = $4 WHERE id = $5 RETURNING slot_label",
      [v.floor, v.type, v.no, active, parseInt(b.id) || 0]);
    if (!rows.length) return fail("slot not found", 404);
    return ok({ message: `Slot ${rows[0].slot_label} saved.` });
  } catch (e) {
    if (duplicate(e)) return fail(DUP_MSG, 409);
    throw e;
  }
}));

export const DELETE = handle(audited("slot_delete", async (req) => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const limited = await rateLimit(`admin_write:${admin.id}`, 300, 3600);
  if (limited) return limited;
  const id = parseInt((await readBody(req)).id) || 0;
  const used = await queryOne("SELECT COUNT(*)::int AS n FROM bookings WHERE slot_id = $1", [id]);
  if (used.n > 0) {
    await query("UPDATE slots SET is_active = FALSE WHERE id = $1", [id]);
    return ok({ message: "Slot has bookings, so it was deactivated instead of deleted." });
  }
  const rows = await query("DELETE FROM slots WHERE id = $1 RETURNING slot_label", [id]);
  if (!rows.length) return fail("slot not found", 404);
  return ok({ message: `Slot ${rows[0].slot_label} deleted.` });
}));
