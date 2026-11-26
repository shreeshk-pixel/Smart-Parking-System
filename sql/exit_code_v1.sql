-- Per-booking exit code (v1). Safe to run many times.
--   bookings.exit_code_enc     the booking's 6-digit exit code, AES-256-GCM encrypted by the app
--   bookings.exit_locked_until set for 15 minutes after 5 wrong exit codes
-- Codes for existing active bookings are filled in by the app right after this (lib/exitCode.js, fillExitCodes),
-- because the encryption key comes from SESSION_SECRET and never lives in the database.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS exit_code_enc TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS exit_locked_until TIMESTAMPTZ;
INSERT INTO app_meta (key, value) VALUES ('exit_code_version', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
