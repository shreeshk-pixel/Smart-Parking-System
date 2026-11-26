// Floors and vehicle types used across the app (v2 naming).
// Label format: FLOOR-TYPE + 2-digit number, e.g. LG-B03, G-C05, F1-B12, F2-C08.
export const FLOORS = { LG: "Lower Ground", G: "Ground", F1: "Floor 1", F2: "Floor 2", F3: "Floor 3" };
export const FLOOR_ORDER = ["LG", "G", "F1", "F2", "F3"];
export const VEHICLE_TYPES = { B: "Bike", C: "Car" }; // B = any two-wheeler, C = any four-wheeler

export const floorName = (f) => FLOORS[f] || f;
export const typeName = (t) => VEHICLE_TYPES[t] || t;
export const validFloor = (f) => Object.prototype.hasOwnProperty.call(FLOORS, f);
export const validType = (t) => Object.prototype.hasOwnProperty.call(VEHICLE_TYPES, t);
// Same rule as the slot_label column in the database
export const slotLabel = (floor, type, no) => `${floor}-${type}${String(parseInt(no, 10)).padStart(2, "0")}`;

// SQL expression that sorts floors in building order (LG, G, F1, F2, F3) instead of A-Z
export const FLOOR_SORT_SQL = (col = "s.floor") => `array_position(ARRAY['LG','G','F1','F2','F3']::text[], ${col}::text)`;

// Counts of slots per floor and type, plus how many are free.
// Returns { LG: { B: {total, free}, C: {total, free} }, G: {...}, ... } for every floor.
export function floorSummary(slots) {
  const out = {};
  for (const f of FLOOR_ORDER) out[f] = { B: { total: 0, free: 0 }, C: { total: 0, free: 0 } };
  for (const s of slots) {
    const c = out[s.floor]?.[s.vehicle_type];
    if (!c) continue;
    c.total++;
    if (s.available) c.free++;
  }
  return out;
}
