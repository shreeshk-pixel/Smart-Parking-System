-- Smart Parking: PostgreSQL tables (safe to run every time, never drops anything).
-- Times are TIMESTAMPTZ; compare with NOW(), display in Asia/Kolkata.

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

CREATE TABLE IF NOT EXISTS slots (
  id           SERIAL PRIMARY KEY,
  location_id  INT NOT NULL REFERENCES parking_locations(id) ON DELETE CASCADE,
  slot_number  VARCHAR(10) NOT NULL,
  vehicle_type VARCHAR(10) NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car','bike')),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,            -- admin can disable a slot
  UNIQUE (location_id, slot_number)
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
