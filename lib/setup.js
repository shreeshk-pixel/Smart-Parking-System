// lib/setup.js - prepares the database on the first request of each server instance.
//   1. schema.sql            creates any missing table (never drops anything)
//   2. migrate_v2_floors.sql upgrades an old v1 database to floors + B/C slot names (idempotent)
//   3. seed.sql              adds demo data, only when there are no users yet
// The SQL lives in sql/ and is copied into lib/setup-sql.js by scripts/build-setup-sql.mjs.
// A Postgres advisory lock makes sure two serverless instances never migrate at the same time.
import { SCHEMA_SQL, MIGRATE_SQL, SEED_SQL } from "./setup-sql";

export const SCHEMA_VERSION = "2";
let running = null; // shared by parallel requests in the same instance

export function ensureSetup(pool) {
  if (!running) running = doSetup(pool).catch((e) => { running = null; throw e; });
  return running;
}

async function currentVersion(db) {
  // Check the table exists first: querying a missing table would fail and abort the transaction
  const has = await db.query("SELECT to_regclass('app_meta') IS NOT NULL AS ok");
  if (!has.rows[0].ok) return null;
  const { rows } = await db.query("SELECT value FROM app_meta WHERE key = 'schema_version'");
  return rows[0]?.value || null;
}

async function doSetup(pool) {
  // Fast path: already on v2 and seeded -> one small query per cold start
  if ((await currentVersion(pool)) === SCHEMA_VERSION) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7275001)");
    if ((await currentVersion(client)) !== SCHEMA_VERSION) {
      await client.query(SCHEMA_SQL);
      await client.query(MIGRATE_SQL);
      const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM users");
      if (rows[0].n === 0) await client.query(SEED_SQL);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
