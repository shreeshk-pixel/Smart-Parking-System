// Database helper: one Postgres pool per server instance + query() with $1, $2 placeholders.
//
// Speed / reliability notes (Vercel serverless):
//  - The pool lives at module level (globalThis), so warm requests reuse open connections instead of
//    paying a new TCP + TLS + auth handshake every time.
//  - attachDatabasePool() lets Vercel close idle connections before the instance is suspended, so a
//    request never gets handed a dead socket after a pause (that used to hang until the OS timed out).
//  - Every wait has a limit (connect 8 s, query 15 s): something slow fails fast instead of spinning.
//  - One automatic retry when a pooled connection turns out to be broken.
import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

// Return DATE/TIMESTAMP columns as plain text like "2026-10-16 18:30:00" (no timezone surprises)
pg.types.setTypeParser(1114, (v) => v.slice(0, 19));
// TIMESTAMPTZ -> IST text, whatever timezone the database server uses
pg.types.setTypeParser(1184, (v) => {
  const d = new Date(new Date(v).getTime() + 330 * 60000); // shift UTC by +5:30
  return d.toISOString().slice(0, 19).replace("T", " ");
});
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number
pg.types.setTypeParser(20, (v) => parseInt(v, 10));  // BIGINT (COUNT, EXTRACT) -> number

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://postgres:postgres@localhost:5432/smart_parking";
const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

function makePool() {
  const p = new pg.Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,                         // small: free-tier databases allow few connections
    idleTimeoutMillis: 5000,        // close idle connections quickly
    connectionTimeoutMillis: 8000,  // never wait forever for a connection
    query_timeout: 15000,           // client-side limit per query
    statement_timeout: 15000,       // server-side limit per query
    keepAlive: true,
  });
  // Every connection works in Indian time, so NOW() matches the booking times
  p.on("connect", (client) => { client.query("SET TIME ZONE 'Asia/Kolkata'").catch(() => {}); });
  p.on("error", () => {}); // an idle client died: the pool drops it; don't crash the instance
  if (!isLocal) { try { attachDatabasePool(p); } catch {} }
  return p;
}
export const pool = globalThis._pgPool || (globalThis._pgPool = makePool());

// Create / upgrade tables + demo data once per server instance (see lib/setup.js)
import { ensureSetup as setup } from "./setup";
const ensureSetup = () => setup(pool);

const RETRYABLE = /Connection terminated|ECONNRESET|EPIPE|timeout exceeded when trying to connect|Client has encountered a connection error|Connection terminated unexpectedly/i;

// Run a query and return all rows
export async function query(text, params = []) {
  await ensureSetup();
  try {
    return (await pool.query(text, params)).rows;
  } catch (e) {
    if (!RETRYABLE.test(String(e?.message))) throw e;
    return (await pool.query(text, params)).rows; // one retry on a fresh connection
  }
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
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    broken = RETRYABLE.test(String(e?.message));
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release(broken ? true : undefined); // destroy a broken connection instead of reusing it
  }
}
