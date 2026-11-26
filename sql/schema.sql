-- Smart Parking: PostgreSQL tables, v2 (floors + B/C slot names).
-- Safe to run every time: it never drops anything. On an old v1 database, run migrate_v2_floors.sql after it
-- (the app does both automatically on its first request, see lib/setup.js).
-- Times are TIMESTAMPTZ; compare with NOW(), display in Asia/Kolkata.

CREATE TABLE IF NOT EXISTS app_meta (
  key   VARCHAR(50) PRIMARY KEY,
  value VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,                 -- bcryptjs hash
  role          VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parking_locations (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  address        VARCHAR(255),
  latitude       NUMERIC(10,7) NOT NULL,
  longitude      NUMERIC(10,7) NOT NULL,
  price_per_hour NUMERIC(8,2)  NOT NULL DEFAULT 20.00,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- A slot = lot + floor + vehicle type + number. The label (e.g. F1-B12) is a generated column
-- built from those three, so it can never disagree with them.
--   floor:        LG = lower ground, G = ground, F1 / F2 / F3 = floors 1-3
--   vehicle_type: B = bike (any two-wheeler), C = car (any four-wheeler)
CREATE TABLE IF NOT EXISTS slots (
  id           SERIAL PRIMARY KEY,
  location_id  INT NOT NULL REFERENCES parking_locations(id) ON DELETE CASCADE,
  floor        VARCHAR(2) NOT NULL DEFAULT 'G' CONSTRAINT chk_slot_floor CHECK (floor IN ('LG','G','F1','F2','F3')),
  vehicle_type CHAR(1)    NOT NULL DEFAULT 'C' CONSTRAINT chk_slot_type CHECK (vehicle_type IN ('B','C')),
  slot_no      SMALLINT   NOT NULL CONSTRAINT chk_slot_no CHECK (slot_no BETWEEN 1 AND 99),
  slot_label   VARCHAR(8) GENERATED ALWAYS AS (floor || '-' || vehicle_type || lpad(slot_no::text, 2, '0')) STORED,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,            -- admin can disable a slot
  CONSTRAINT uq_slot UNIQUE (location_id, floor, vehicle_type, slot_no)
);

CREATE TABLE IF NOT EXISTS bookings (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id        INT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  vehicle_number VARCHAR(20) NOT NULL,
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  amount         NUMERIC(8,2) NOT NULL DEFAULT 0,
  status         VARCHAR(10) NOT NULL DEFAULT 'booked'
                 CHECK (status IN ('booked','cancelled','entered','completed')),
  payment_status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  payment_ref    VARCHAR(100),
  paid_at        TIMESTAMPTZ,
  qr_token       VARCHAR(64) UNIQUE,
  exit_otp_hash  VARCHAR(255),
  otp_expires_at TIMESTAMPTZ,
  entry_time     TIMESTAMPTZ,
  exit_time      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_slot_time ON bookings (slot_id, start_time, end_time);
-- Overlap check (in the API): a slot is taken if a row exists with
-- slot_id = $1 AND status IN ('booked','entered') AND start_time < $newEnd AND end_time > $newStart
