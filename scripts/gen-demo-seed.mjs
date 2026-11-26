// Generates the v3 demo data: sql/seed_demo_v3.sql (PostgreSQL, used by the app's auto setup).
//   node scripts/gen-demo-seed.mjs                 -> writes sql/seed_demo_v3.sql
//   node scripts/gen-demo-seed.mjs --mysql out.sql -> MySQL/MariaDB version (for the PHP edition)
// Deterministic (fixed random seed). Times are relative to the moment the SQL runs, so the data
// always looks "current": ~45 days of history, a few bookings active right now, and the next few days.
// Status is worked out when the SQL runs: past -> completed, now -> entered, future -> booked.
// Passwords are stored only as bcrypt hashes; the plain passwords are kept privately.
import fs from "fs";

const HASH = {
  pg:    { admin: "$2a$10$/T8e0ZwaBf.TvlPjJd5QWeEfk35dYs/hvav.ES005Sfl3sPZtaOwq", user: "$2a$10$BB1LljVlGZanZeSG.Z5g.eyf3CLfIeH4dUx0NmnS2jGcS.f3.1tim" },
  mysql: { admin: "$2y$10$2MaBZ3eHcH5y3wOUDg3eJuZibHLNDut8mHwMevirVQ0YGA0nuVFM6", user: "$2y$10$ehe5esEqNX3cz3VTWQ27TuCXOsnZXuq2nN09VsfV8KgWgQv9R0qAC" },
};

// name, email, phone, car plate, bike plate, joined (days ago)
const USERS = [
  ["Rahul Patil", "rahul@example.com", "9000000001", "KA22AB1234", "KA22EF1111", 0],
  ["Sneha Kulkarni", "sneha@example.com", "9000000002", "KA22CD5678", "KA22GH2222", 0],
  ["Arjun Desai", "arjun@example.com", "9000000003", "KA22EJ4321", "KA22EK7788", 0],
  ["Priya Deshpande", "priya.deshpande@example.com", "9845012345", "KA22MA4410", "KA22HB2051", 58],
  ["Vikram Joshi", "vikram.joshi@example.com", "9886023456", "KA22N7319", "KA22EQ8842", 57],
  ["Ananya Hegde", "ananya.hegde@example.com", "9741034567", "KA22P2268", "KA22ER1907", 55],
  ["Rohan Kulkarni", "rohan.kulkarni@example.com", "9902045678", "KA23M5521", "KA23EH3316", 54],
  ["Kavya Patil", "kavya.patil@example.com", "9663056789", "KA22Z9034", "KA22EW6620", 52],
  ["Siddharth Naik", "siddharth.naik@example.com", "9844067890", "KA22MB7782", "KA22EY0458", 50],
  ["Meera Shetty", "meera.shetty@example.com", "9880078901", "KA22MC1195", "KA22HC5583", 49],
  ["Aditya Gokak", "aditya.gokak@example.com", "9731089012", "KA49M3307", "KA49E2271", 47],
  ["Pooja Angadi", "pooja.angadi@example.com", "9900090123", "KA22MD6640", "KA22HD9912", 46],
  ["Karthik Rao", "karthik.rao@example.com", "9611001234", "KA25MN4471", "KA25ES3380", 46],
  ["Neha Bhat", "neha.bhat@example.com", "9845112233", "KA22ME2209", "KA22HE7745", 45],
  ["Manjunath Hiremath", "manjunath.hiremath@example.com", "9886223344", "KA24N8816", "KA24EF1539", 45],
];

// Lot name, weight, bikes per floor, cars per floor (the smallest layout used anywhere, so every slot exists)
const LOTS = [
  ["Central Bus Stand Parking", 4, 4, 4],
  ["Belagavi Railway Station Parking", 4, 5, 5],
  ["KLS GIT Campus Parking", 2, 3, 3],
  ["Khade Bazar Parking", 3, 6, 4],
];
const FLOORS = ["LG", "G", "F1", "F2", "F3"];

let seed = 20261126;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const wpick = (a, w) => { let r = rnd() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < a.length; i++) { r -= w[i]; if (r < 0) return a[i]; } return a[a.length - 1]; };

const used = new Map();     // slot key -> [[from, to]] in hours (day*24 + hour)
const userBusy = new Map(); // email -> [[from, to]]
const reserved = new Set(); // slots kept for the "active right now" rows
const clash = (list, a, b) => (list || []).some(([x, y]) => a < y + 0.5 && b > x - 0.5);
const rows = [];

// 1. A few bookings active right now (start N hours before the current hour): kind 'N'
const nowRows = [
  [0, "Central Bus Stand Parking", "F2", "C", 1, 1, 3, "entered"],
  [3, "Belagavi Railway Station Parking", "F3", "C", 2, 2, 5, "entered"],
  [5, "Khade Bazar Parking", "F2", "B", 3, 1, 2, "entered"],
  [7, "KLS GIT Campus Parking", "F3", "B", 1, 0, 3, "waiting"],
  [9, "Belagavi Railway Station Parking", "F2", "B", 4, 1, 4, "entered"],
  [11, "Central Bus Stand Parking", "F3", "C", 3, 0, 2, "entered"],
];
for (const [u, loc, fl, vt, no, back, hrs, flag] of nowRows) {
  const user = USERS[u];
  reserved.add(`${loc}|${fl}|${vt}|${no}`);
  rows.push({ email: user[1], loc, fl, vt, no, veh: vt === "C" ? user[3] : user[4], kind: "N", d: 0, h: back, hrs, flag });
}

// 2. History (last 45 days) and the next 4 days: kind 'D' (day offset + start hour, IST)
function addDay(d, flagFor) {
  for (let tries = 0; tries < 60; tries++) {
    const user = pick(USERS);
    if (d < -(45 - 0) || (user[5] && -d > user[5] - 1)) continue;
    const [loc, , bikes, cars] = wpick(LOTS, LOTS.map((l) => l[1]));
    const vt = rnd() < 0.45 ? "B" : "C";
    const fl = wpick(FLOORS, [3, 4, 3, 2, 1]);
    const no = 1 + Math.floor(rnd() * (vt === "B" ? bikes : cars));
    const key = `${loc}|${fl}|${vt}|${no}`;
    if (reserved.has(key)) continue;
    const hrs = vt === "B" ? wpick([1, 2, 3, 4], [3, 4, 2, 1]) : wpick([1, 2, 3, 4, 5, 6, 8], [2, 4, 3, 2, 1, 1, loc.startsWith("Belagavi Railway") ? 1 : 0]);
    const h = wpick([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], [1, 3, 4, 4, 3, 2, 2, 2, 2, 3, 4, 4, 3, 2]) + (rnd() < 0.3 ? 0.5 : 0);
    if (h + hrs > 23) continue;
    const a = d * 24 + h, b = a + hrs;
    if (clash(used.get(key), a, b) || clash(userBusy.get(user[1]), a, b)) continue;
    used.set(key, [...(used.get(key) || []), [a, b]]);
    userBusy.set(user[1], [...(userBusy.get(user[1]) || []), [a, b]]);
    rows.push({ email: user[1], loc, fl, vt, no, veh: vt === "C" ? user[3] : user[4], kind: "D", d, h, hrs, flag: flagFor() });
    return;
  }
}
for (let d = -45; d <= -1; d++) {
  const dow = (new Date(Date.UTC(2026, 10, 26 + d)).getUTCDay());
  const n = (dow === 0 || dow === 6 ? 2 : 1) + (rnd() < 0.55 ? 1 : 0) + (d > -10 ? 1 : 0);
  for (let i = 0; i < n; i++) addDay(d, () => (rnd() < 0.12 ? "cancel" : ""));
}
for (let d = 1; d <= 4; d++) {
  const n = d <= 2 ? 5 : 3;
  for (let i = 0; i < n; i++) addDay(d, () => { const r = rnd(); return r < 0.12 ? "cancel" : r < 0.55 ? "unpaid" : "paid"; });
}
rows.forEach((r, i) => (r.n = i + 1));

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const mysql = process.argv.includes("--mysql");
const H = mysql ? HASH.mysql : HASH.pg;
const valueRows = rows.map((r) => `(${r.n}, ${q(r.email)}, ${q(r.loc)}, ${q(r.fl)}, ${q(r.vt)}, ${r.no}, ${q(r.veh)}, ${q(r.kind)}, ${r.d}, ${r.h}, ${r.hrs}, ${q(r.flag)})`);
const newUsers = USERS.filter((u) => u[5]);
const stats = { users: newUsers.length, bookings: rows.length, now: rows.filter((r) => r.kind === "N").length,
  future: rows.filter((r) => r.d > 0).length, cancelled: rows.filter((r) => r.flag === "cancel").length };

const header = `-- Demo data v3 (generated by scripts/gen-demo-seed.mjs, do not edit by hand).
-- ${stats.users} more customer accounts and ${stats.bookings} bookings across every lot, floor and B/C type:
-- ~45 days of history (completed / cancelled), ${stats.now} active right now (entry scanned), and the next 4 days
-- (paid and unpaid). It also replaces the old public demo passwords (the new ones are kept privately).
-- Runs once: guarded by app_meta 'demo_seed_version'. Never deletes anything, never touches other bookings,
-- and skips any booking that would overlap an existing one on the same slot.
`;

let sql;
if (!mysql) {
  sql = header + `
-- 1. New passwords for the demo accounts (the old ones were published)
UPDATE users SET password_hash = ${q(H.admin)} WHERE email = 'admin@parking.com'
   AND NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'demo_seed_version');
UPDATE users SET password_hash = ${q(H.user)} WHERE email IN (${USERS.slice(0, 3).map((u) => q(u[1])).join(", ")})
   AND NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'demo_seed_version');

-- 2. Customer accounts
INSERT INTO users (name, email, phone, password_hash, role, created_at)
SELECT v.name, v.email, v.phone, ${q(H.user)}, 'user', NOW() - v.days * interval '1 day'
  FROM (VALUES
${newUsers.map((u) => `    (${q(u[0])}, ${q(u[1])}, ${q(u[2])}, ${u[5]})`).join(",\n")}
  ) AS v(name, email, phone, days)
 WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'demo_seed_version')
ON CONFLICT (email) DO NOTHING;

-- 3. Bookings
WITH v(n, email, loc, fl, vt, no, veh, kind, d, h, hrs, flag) AS (VALUES
${valueRows.join(",\n")}
), t AS (
  SELECT v.*, CASE WHEN v.kind = 'N' THEN date_trunc('hour', NOW()) - v.h * interval '1 hour' + interval '10 minutes'
                   ELSE (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + v.d * interval '1 day' + v.h * interval '1 hour') AT TIME ZONE 'Asia/Kolkata'
              END AS st
    FROM v
), s AS (
  SELECT t.*, t.st + t.hrs * interval '1 hour' AS en,
         LEAST(t.st - (1 + t.n % 30) * interval '1 hour', NOW() - (2 + t.n % 70) * interval '1 hour') AS cr,
         CASE WHEN t.flag = 'cancel' THEN 'cancelled'
              WHEN t.st + t.hrs * interval '1 hour' <= NOW() THEN 'completed'
              WHEN t.st <= NOW() AND t.flag <> 'waiting' THEN 'entered'
              ELSE 'booked' END AS status
    FROM t
)
INSERT INTO bookings (user_id, slot_id, vehicle_number, start_time, end_time, amount, status, payment_status, payment_ref,
                      paid_at, qr_token, entry_time, exit_time, created_at)
SELECT u.id, sl.id, s.veh, s.st, s.en, s.hrs * l.price_per_hour, s.status,
       CASE WHEN s.status = 'cancelled' OR (s.status = 'booked' AND s.flag = 'unpaid') THEN 'pending' ELSE 'paid' END,
       CASE WHEN s.status = 'cancelled' OR (s.status = 'booked' AND s.flag = 'unpaid') THEN NULL ELSE 'MOCK' || upper(substr(md5('demo3-pay-' || s.n), 1, 8)) END,
       CASE WHEN s.status = 'cancelled' OR (s.status = 'booked' AND s.flag = 'unpaid') THEN NULL ELSE LEAST(s.cr + (5 + s.n % 40) * interval '1 minute', NOW()) END,
       md5('demo3-' || s.n),
       CASE WHEN s.status IN ('entered', 'completed') THEN s.st + (2 + s.n % 12) * interval '1 minute' END,
       CASE WHEN s.status = 'completed' THEN s.en - (3 + s.n % 20) * interval '1 minute' END,
       s.cr
  FROM s
  JOIN users u ON u.email = s.email
  JOIN parking_locations l ON l.name = s.loc
  JOIN slots sl ON sl.location_id = l.id AND sl.floor = s.fl AND sl.vehicle_type = s.vt AND sl.slot_no = s.no
 WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'demo_seed_version')
   AND (s.status = 'cancelled' OR NOT EXISTS (
         SELECT 1 FROM bookings b WHERE b.slot_id = sl.id AND b.status IN ('booked', 'entered', 'completed')
            AND b.start_time < s.en AND b.end_time > s.st))
 ORDER BY s.st;

INSERT INTO app_meta (key, value) VALUES ('demo_seed_version', '3') ON CONFLICT (key) DO NOTHING;
`;
} else {
  sql = header + `-- MySQL / MariaDB version for the PHP edition. Import it after parking.sql (or on an existing database).

CREATE TABLE IF NOT EXISTS app_meta (k VARCHAR(50) PRIMARY KEY, v VARCHAR(100) NOT NULL);
SET @done := (SELECT COUNT(*) FROM app_meta WHERE k = 'demo_seed_version');

-- 1. New passwords for the demo accounts (the old ones were published)
UPDATE users SET password_hash = ${q(H.admin)} WHERE email = 'admin@parking.com' AND @done = 0;
UPDATE users SET password_hash = ${q(H.user)} WHERE email IN (${USERS.slice(0, 3).map((u) => q(u[1])).join(", ")}) AND @done = 0;

-- 2. Customer accounts
INSERT IGNORE INTO users (name, email, phone, password_hash, role, created_at)
SELECT v.name, v.email, v.phone, ${q(H.user)}, 'user', NOW() - INTERVAL v.days DAY FROM (
${newUsers.map((u, i) => `  ${i ? "UNION ALL " : ""}SELECT ${q(u[0])} AS name, ${q(u[1])} AS email, ${q(u[2])} AS phone, ${u[5]} AS days`).join("\n")}
) v WHERE @done = 0;

-- 3. Bookings
DROP TEMPORARY TABLE IF EXISTS demo_v;
CREATE TEMPORARY TABLE demo_v (n INT, email VARCHAR(150), loc VARCHAR(100), fl VARCHAR(2), vt CHAR(1), no INT, veh VARCHAR(20),
  kind CHAR(1), d INT, h DECIMAL(4,1), hrs INT, flag VARCHAR(10), st DATETIME NULL, en DATETIME NULL, cr DATETIME NULL, status VARCHAR(10) NULL);
INSERT INTO demo_v (n, email, loc, fl, vt, no, veh, kind, d, h, hrs, flag) VALUES
${valueRows.join(",\n")};
UPDATE demo_v SET st = CASE WHEN kind = 'N' THEN DATE_FORMAT(NOW(), '%Y-%m-%d %H:10:00') - INTERVAL h HOUR
                            ELSE TIMESTAMP(CURDATE()) + INTERVAL d DAY + INTERVAL ROUND(h * 60) MINUTE END;
UPDATE demo_v SET en = st + INTERVAL hrs HOUR, cr = LEAST(st - INTERVAL (1 + n % 30) HOUR, NOW() - INTERVAL (2 + n % 70) HOUR);
UPDATE demo_v SET status = CASE WHEN flag = 'cancel' THEN 'cancelled' WHEN en <= NOW() THEN 'completed'
                                WHEN st <= NOW() AND flag <> 'waiting' THEN 'entered' ELSE 'booked' END;

INSERT INTO bookings (user_id, slot_id, vehicle_number, start_time, end_time, amount, status, payment_status, payment_ref,
                      qr_token, entry_time, exit_time, created_at)
SELECT u.id, sl.id, s.veh, s.st, s.en, s.hrs * l.price_per_hour, s.status,
       IF(s.status = 'cancelled' OR (s.status = 'booked' AND s.flag = 'unpaid'), 'pending', 'paid'),
       IF(s.status = 'cancelled' OR (s.status = 'booked' AND s.flag = 'unpaid'), NULL, CONCAT('MOCK', UPPER(LEFT(MD5(CONCAT('demo3-pay-', s.n)), 8)))),
       MD5(CONCAT('demo3-', s.n)),
       IF(s.status IN ('entered', 'completed'), s.st + INTERVAL (2 + s.n % 12) MINUTE, NULL),
       IF(s.status = 'completed', s.en - INTERVAL (3 + s.n % 20) MINUTE, NULL),
       s.cr
  FROM demo_v s
  JOIN users u ON u.email = s.email
  JOIN parking_locations l ON l.name = s.loc
  JOIN slots sl ON sl.location_id = l.id AND sl.floor = s.fl AND sl.vehicle_type = s.vt AND sl.slot_no = s.no
 WHERE @done = 0
   AND (s.status = 'cancelled' OR NOT EXISTS (
         SELECT 1 FROM bookings b WHERE b.slot_id = sl.id AND b.status IN ('booked', 'entered', 'completed')
            AND b.start_time < s.en AND b.end_time > s.st))
 ORDER BY s.st;
DROP TEMPORARY TABLE IF EXISTS demo_v;

INSERT IGNORE INTO app_meta (k, v) VALUES ('demo_seed_version', '3');
`;
}
const out = mysql ? process.argv[process.argv.indexOf("--mysql") + 1] : new URL("../sql/seed_demo_v3.sql", import.meta.url);
fs.writeFileSync(out, sql);
console.log(JSON.stringify(stats));
