// POST /api/book  {slot_id, vehicle_number, start_time, end_time}
// Stops double booking: locks the slot row, then checks for overlapping bookings.
import crypto from "crypto";
import { transaction } from "@/lib/db";
import { ok, fail, needUser, readBody, parseTime, handle } from "@/lib/server";

export const POST = handle(async (req) => {
  const [user, err] = await needUser();
  if (err) return err;
  const b = await readBody(req);
  const slotId = parseInt(b.slot_id);
  const vehicle = String(b.vehicle_number || "").trim().toUpperCase();
  const start = parseTime(b.start_time);
  const end = parseTime(b.end_time);
  if (!slotId || !vehicle) return fail("slot and vehicle number are required");
  if (!start || !end) return fail("bad time format, use YYYY-MM-DD HH:MM");
  if (end <= start) return fail("end time must be after start time");

  return transaction(async (db) => {
    const past = await db.query("SELECT $1::timestamptz < NOW() AS past", [end]);
    if (past.rows[0].past) return fail("that time has already passed");

    // Lock this slot so two people can't book it at the same moment
    const slot = (await db.query(
      `SELECT s.id, l.price_per_hour FROM slots s JOIN parking_locations l ON l.id = s.location_id
       WHERE s.id = $1 AND s.is_active = TRUE FOR UPDATE OF s`, [slotId])).rows[0];
    if (!slot) return fail("slot not found", 404);

    // Overlap rule: existing start < new end AND existing end > new start
    const clash = await db.query(
      `SELECT 1 FROM bookings WHERE slot_id = $1 AND status IN ('booked','entered')
       AND start_time < $2 AND end_time > $3 LIMIT 1`, [slotId, end, start]);
    if (clash.rows.length) return fail("slot already booked for that time", 409);

    const hours = Math.max(1, Math.ceil((new Date(end.replace(" ", "T")) - new Date(start.replace(" ", "T"))) / 3600000));
    const amount = hours * Number(slot.price_per_hour);
    const row = (await db.query(
      `INSERT INTO bookings (user_id, slot_id, vehicle_number, start_time, end_time, amount, status, payment_status, qr_token)
       VALUES ($1, $2, $3, $4, $5, $6, 'booked', 'pending', $7) RETURNING id`,
      [user.id, slotId, vehicle, start, end, amount, crypto.randomBytes(16).toString("hex")])).rows[0];
    return ok({ booking_id: row.id, amount });
  });
});
