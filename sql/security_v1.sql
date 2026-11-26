-- Security update (v1). Safe to run many times.
--   users.token_version   bumped on logout, so old session cookies stop working
--   bookings.otp_attempts wrong exit-OTP tries; after 5 the OTP is cancelled and the QR must be scanned again
--   rate_limits           request counters for login / register / booking (shared by all server instances)
--   audit_log             who did what: logins, failed logins, admin changes, QR entry/exit, report exports
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS otp_attempts SMALLINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS rate_limits (
  key          VARCHAR(200) PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hits         INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    INT,
  actor_email VARCHAR(150),
  action      VARCHAR(40) NOT NULL,
  target      VARCHAR(100),
  details     JSONB,
  ip          VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

INSERT INTO app_meta (key, value) VALUES ('security_version', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
