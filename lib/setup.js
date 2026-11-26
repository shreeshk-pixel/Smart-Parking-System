// lib/setup.js - prepares the database the first time a server instance needs it.
//   1. schema.sql            creates any missing table (never drops anything)
//   2. migrate_v2_floors.sql upgrades an old v1 database to floors + B/C slot names (idempotent)
//   3. seed.sql              adds the base demo data, only when there are no users yet
//   4. seed_demo_v3.sql      once per database: more customers + ~110 bookings, and new demo passwords
//   5. perf_indexes.sql      once per database: indexes for the common queries
// The SQL lives in sql/ and is copied into lib/setup-sql.js by scripts/build-setup-sql.mjs.
//
// Cost on a database that is already up to date: ONE small query per server instance (not per request).
// After that a module-level flag skips the check completely. A Postgres advisory lock makes sure two
// serverless instances never migrate at the same time, and a time limit makes sure a stuck check can't
// hold requests forever (it fails, and the next request simply tries again).
import { SCHEMA_SQL, MIGRATE_SQL, SEED_SQL, DEMO_SQL, INDEX_SQL } from "./setup-sql";

export const WANT = { schema_version: "2", demo_seed_version: "3", index_version: "1" };
let ready = false;
let running = null; // shared by parallel requests in the same instance

export function ensureSetup(pool) {
  if (ready) return Promise.resolve();
  if (!running) {
    running = withTimeout(doSetup(pool), 25000)
      .then(() => { ready = true; })
      .catch((e) => { running = null; throw e; });
  }
  return running;
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("database setup timed out")), ms); })])
    .finally(() => clearTimeout(t));
}

const isCurrent = (rows) => {
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.entries(WANT).every(([k, want]) => v[k] === want);
};
const META_SQL = "SELECT key, value FROM app_meta WHERE key IN ('schema_version', 'demo_seed_version', 'index_version')";

async function doSetup(pool) {
  // Fast path: one query. A missing app_meta table (brand-new database) just means "not set up".
  try {
    if (isCurrent((await pool.query(META_SQL)).rows)) return;
  } catch (e) {
    if (e.code !== "42P01") throw e; // 42P01 = table does not exist
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7275001)");
    // Inside a transaction a failing query aborts everything, so check the table exists first
    const has = (await client.query("SELECT to_regclass('app_meta') IS NOT NULL AS ok")).rows[0].ok;
    if (!has || !isCurrent((await client.query(META_SQL)).rows)) {
      await client.query(SCHEMA_SQL);
      await client.query(MIGRATE_SQL);
      const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM users");
      if (rows[0].n === 0) await client.query(SEED_SQL);
      await client.query(DEMO_SQL);  // guarded inside by app_meta 'demo_seed_version', so it only ever runs once
      await client.query(INDEX_SQL); // CREATE INDEX IF NOT EXISTS ...
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
