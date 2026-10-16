// Database helper: one Postgres pool + a query() function with $1, $2 placeholders
import pg from "pg";

// Return DATE/TIMESTAMP columns as plain text like "2026-10-16 18:30:00" (no timezone surprises)
pg.types.setTypeParser(1114, (v) => v.slice(0, 19));
// TIMESTAMPTZ -> IST text, whatever timezone the database server uses
pg.types.setTypeParser(1184, (v) => {
  const d = new Date(new Date(v).getTime() + 330 * 60000); // shift UTC by +5:30
  return d.toISOString().slice(0, 19).replace("T", " ");
});
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://postgres:postgres@localhost:5432/smart_parking";
const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

// Reuse one pool across hot reloads / serverless invocations
const pool = globalThis._pgPool || new pg.Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 3,
});
globalThis._pgPool = pool;

// Every connection works in Indian time, so NOW() matches the booking times
pool.on("connect", (client) => client.query("SET TIME ZONE 'Asia/Kolkata'"));

// Create tables + demo data the first time the app runs (see lib/setup.js)
import { ensureSetup as setup } from "./setup";
const ensureSetup = () => setup(pool);

// Run a query and return all rows
export async function query(text, params = []) {
  await ensureSetup();
  const res = await pool.query(text, params);
  return res.rows;
}

// Run a query and return only the first row (or null)
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

// Run several queries inside one transaction (used by booking)
export async function transaction(fn) {
  await ensureSetup();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
