// Per-booking exit code: a random 6-digit number made when the booking is created.
// - Only the customer sees it (My bookings / ticket, after payment). The gate admin types what the customer
//   tells them; admin APIs, reports and CSV never contain it.
// - Stored ENCRYPTED in bookings.exit_code_enc (AES-256-GCM, key derived from SESSION_SECRET), so even someone
//   reading the database can't see the codes. Checked with a constant-time compare.
// - 5 wrong tries lock the exit for that booking for 15 minutes (see app/api/exit_code).
import crypto from "crypto";
import { secret } from "./secret";

const key = () => crypto.createHmac("sha256", secret()).update("exit-code-v1").digest(); // 32 bytes

export const newExitCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

export function sealExitCode(code) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(code, "utf8"), c.final()]);
  return "v1." + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

// Returns the 6-digit code, or null if missing / tampered / encrypted with an old secret
export function openExitCode(enc) {
  try {
    if (!enc || !enc.startsWith("v1.")) return null;
    const raw = Buffer.from(enc.slice(3), "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const code = Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
    return /^\d{6}$/.test(code) ? code : null;
  } catch { return null; }
}

export function exitCodeMatches(enc, typed) {
  const code = openExitCode(enc);
  const t = String(typed || "").replace(/\s/g, "");
  if (!code || !/^\d{6}$/.test(t)) return false;
  return crypto.timingSafeEqual(Buffer.from(code), Buffer.from(t));
}

// Gives every active booking (booked / entered) without a readable code a new one. Idempotent.
// `run` is a query function (pool client or the app's query helper); optional extra WHERE for one user.
export async function fillExitCodes(run, userId = null) {
  const params = userId ? [userId] : [];
  const rows = await run(`SELECT id, exit_code_enc FROM bookings WHERE status IN ('booked', 'entered')${userId ? " AND user_id = $1" : ""}`, params);
  const need = rows.filter((r) => !openExitCode(r.exit_code_enc));
  if (!need.length) return 0;
  await run(`UPDATE bookings b SET exit_code_enc = v.enc FROM unnest($1::int[], $2::text[]) AS v(id, enc)
             WHERE b.id = v.id`, [need.map((r) => r.id), need.map(() => sealExitCode(newExitCode()))]);
  return need.length;
}
