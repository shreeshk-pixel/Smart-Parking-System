// lib/setup.js - prepares the database on the first request of each server instance.
//   1. schema.sql            creates any missing table (never drops anything)
//   2. migrate_v2_floors.sql upgrades an old v1 database to floors + B/C slot names (idempotent)
//   3. seed.sql              adds the base demo data, only when there are no users yet
//   4. seed_demo_v3.sql      once per database: more customers + ~110 bookings, and new demo passwords
// The SQL lives in sql/ and is copied into lib/setup-sql.js by scripts/build-setup-sql.mjs.
// A Postgres advisory lock makes sure two serverless instances never migrate at the same time.
import { SCHEMA_SQL, MIGRATE_SQL, SEED_SQL, DEMO_SQL } from "./setup-sql";

export const SCHEMA_VERSION = "2";
export const DEMO_VERSION = "3";
let running = null; // shared by parallel requests in the same instance

export function ensureSetup(pool) {
  if (!running) running = doSetup(pool).catch((e) => { running = null; throw e; });
  return running;
}

// True when the schema is v2 and the v3 demo data has been added
async function upToDate(db) {
  // Check the table exists first: querying a missing table would fail and abort the transaction
  const has = await db.query("SELECT to_regclass('app_meta') IS NOT NULL AS ok");
  if (!has.rows[0].ok) return false;
  const { rows } = await db.query("SELECT key, value FROM app_meta WHERE key IN ('schema_version', 'demo_seed_version')");
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return v.schema_version === SCHEMA_VERSION && v.demo_seed_version === DEMO_VERSION;
}

async function doSetup(pool) {
  // Fast path: already up to date -> two small queries per cold start
  if (await upToDate(pool)) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7275001)");
    if (!(await upToDate(client))) {
      await client.query(SCHEMA_SQL);
      await client.query(MIGRATE_SQL);
      const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM users");
      if (rows[0].n === 0) await client.query(SEED_SQL);
      await client.query(DEMO_SQL); // guarded inside by app_meta 'demo_seed_version', so it only ever runs once
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
