-- Smart Parking: upgrade an existing database to v2 (floors LG/G/F1/F2/F3 + B/C slot names).
-- Idempotent: safe to run any number of times, and a no-op on a database that is already v2.
-- Run it after schema.sql. The app runs both automatically on its first request (lib/setup.js).
--
-- What it does to an old (v1) database:
--   1. copies the old slots and bookings tables to slots_v1_backup / bookings_v1_backup (once)
--   2. vehicle_type 'car' / 'bike' becomes 'C' / 'B'
--   3. each old slot (A1, A2, B1 ...) moves to the Ground floor and keeps its number per type,
--      so A3 (car) becomes G-C03 and B2 (bike) becomes G-B02. Slot ids do not change, so every booking is kept.
--   4. the old slot_number column is removed and each lot's ground-floor layout is copied to LG, F1, F2 and F3
--   5. adds bookings.paid_at and the v2 constraints and indexes

CREATE TABLE IF NOT EXISTS app_meta (key VARCHAR(50) PRIMARY KEY, value VARCHAR(100) NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'slots' AND column_name = 'slot_number') THEN
    IF to_regclass('slots_v1_backup') IS NULL THEN
      CREATE TABLE slots_v1_backup AS SELECT * FROM slots;
    END IF;
    IF to_regclass('bookings_v1_backup') IS NULL THEN
      CREATE TABLE bookings_v1_backup AS SELECT * FROM bookings;
    END IF;

    ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_vehicle_type_check;
    ALTER TABLE slots ALTER COLUMN vehicle_type DROP DEFAULT;
    UPDATE slots SET vehicle_type = CASE WHEN lower(trim(vehicle_type)) IN ('bike', 'b') THEN 'B' ELSE 'C' END;
    ALTER TABLE slots ALTER COLUMN vehicle_type TYPE CHAR(1);

    ALTER TABLE slots ADD COLUMN IF NOT EXISTS floor VARCHAR(2);
    ALTER TABLE slots ADD COLUMN IF NOT EXISTS slot_no SMALLINT;
    -- Number slots 1, 2, 3 ... per lot and type, in the order of their old number (A1, A2 ... / B1, B2 ...).
    -- More than 99 of one type in one lot spill over to the next floor so every number stays 2 digits.
    UPDATE slots s
       SET floor   = (ARRAY['G','F1','F2','F3','LG'])[LEAST(5, (n.rn - 1) / 99 + 1)],
           slot_no = (n.rn - 1) % 99 + 1
      FROM (SELECT id, ROW_NUMBER() OVER (
                     PARTITION BY location_id, vehicle_type
                     ORDER BY NULLIF(regexp_replace(slot_number, '[^0-9]', '', 'g'), '')::int NULLS LAST, slot_number, id) AS rn
              FROM slots) n
     WHERE n.id = s.id;

    ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_location_id_slot_number_key;
    ALTER TABLE slots DROP COLUMN slot_number;

    -- Every lot gets all five floors: copy the ground-floor layout to LG, F1, F2 and F3
    INSERT INTO slots (location_id, floor, vehicle_type, slot_no, is_active)
    SELECT s.location_id, f.floor, s.vehicle_type, s.slot_no, s.is_active
      FROM slots s CROSS JOIN (VALUES ('LG'), ('F1'), ('F2'), ('F3')) AS f(floor)
     WHERE s.floor = 'G'
       AND NOT EXISTS (SELECT 1 FROM slots x WHERE x.location_id = s.location_id AND x.floor = f.floor
                         AND x.vehicle_type = s.vehicle_type AND x.slot_no = s.slot_no);
  END IF;
END $$;

-- v2 rules (no-ops when they already exist)
ALTER TABLE slots ALTER COLUMN floor SET DEFAULT 'G';
ALTER TABLE slots ALTER COLUMN floor SET NOT NULL;
ALTER TABLE slots ALTER COLUMN vehicle_type SET DEFAULT 'C';
ALTER TABLE slots ALTER COLUMN slot_no SET NOT NULL;
ALTER TABLE slots ADD COLUMN IF NOT EXISTS slot_label VARCHAR(8)
  GENERATED ALWAYS AS (floor || '-' || vehicle_type || lpad(slot_no::text, 2, '0')) STORED;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'slots'::regclass AND conname = 'chk_slot_floor') THEN
    ALTER TABLE slots ADD CONSTRAINT chk_slot_floor CHECK (floor IN ('LG','G','F1','F2','F3'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'slots'::regclass AND conname = 'chk_slot_type') THEN
    ALTER TABLE slots ADD CONSTRAINT chk_slot_type CHECK (vehicle_type IN ('B','C'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'slots'::regclass AND conname = 'chk_slot_no') THEN
    ALTER TABLE slots ADD CONSTRAINT chk_slot_no CHECK (slot_no BETWEEN 1 AND 99);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'slots'::regclass AND conname = 'uq_slot') THEN
    ALTER TABLE slots ADD CONSTRAINT uq_slot UNIQUE (location_id, floor, vehicle_type, slot_no);
  END IF;
END $$;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_slot_location ON slots (location_id);
CREATE INDEX IF NOT EXISTS idx_booking_start ON bookings (start_time);

INSERT INTO app_meta (key, value) VALUES ('schema_version', '2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
