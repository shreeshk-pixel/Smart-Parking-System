-- Indexes for the queries the app runs most (map availability, my bookings, admin dashboard, reports).
-- Safe to run any time. The app runs it once per database (app_meta 'index_version').
CREATE INDEX IF NOT EXISTS idx_booking_user        ON bookings (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_booking_active      ON bookings (slot_id, start_time, end_time) WHERE status IN ('booked', 'entered');
CREATE INDEX IF NOT EXISTS idx_booking_created     ON bookings (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_booking_start       ON bookings (start_time);
CREATE INDEX IF NOT EXISTS idx_slot_location_floor ON slots (location_id, floor, vehicle_type) WHERE is_active;
INSERT INTO app_meta (key, value) VALUES ('index_version', '1') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
