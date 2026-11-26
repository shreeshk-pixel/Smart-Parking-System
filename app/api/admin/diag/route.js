// GET /api/admin/diag  (admin only) -> where the function runs, where the database is, and how long
// a database round trip takes from here. Used to check that the function region matches the database.
import dns from "dns/promises";
import { pool } from "@/lib/db";
import { ok, needAdmin, handle } from "@/lib/server";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [, err] = await needAdmin();
  if (err) return err;
  const url = new URL(process.env.DATABASE_URL || process.env.POSTGRES_URL || "postgres://localhost/x");
  const host = url.hostname;
  let ip = null; try { ip = (await dns.lookup(host)).address; } catch {}
  const t = async (fn) => { const a = performance.now(); await fn(); return +(performance.now() - a).toFixed(1); };
  // A brand-new connection (TCP + TLS + login) vs. queries on a pooled connection
  const pg = (await import("pg")).default;
  const fresh = new pg.Client({ connectionString: url.toString(), ssl: host === "localhost" || host === "127.0.0.1" ? false : { rejectUnauthorized: false } });
  const connect_ms = await t(() => fresh.connect());
  await fresh.end().catch(() => {});
  const pooled = [];
  for (let i = 0; i < 3; i++) pooled.push(await t(() => pool.query("SELECT 1")));
  const ver = (await pool.query("SELECT version() AS v, current_setting('TimeZone') AS tz")).rows[0];
  return ok({
    function_region: process.env.VERCEL_REGION || "local",
    db_host: host.replace(/^[^.]+/, "***"), db_ip: ip, db_port: url.port,
    new_connection_ms: connect_ms, select1_ms: pooled,
    pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    db_version: ver.v.split(" ").slice(0, 2).join(" "), db_timezone: ver.tz,
  });
});
