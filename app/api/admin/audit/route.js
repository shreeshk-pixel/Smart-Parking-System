// GET /api/admin/audit  (admin only) -> the latest 200 audit_log rows (logins, failed logins, admin changes,
// QR entry/exit, report exports). Emails of other people are masked on screen.
import { query } from "@/lib/db";
import { ok, needAdmin, handle } from "@/lib/server";
import { maskEmail } from "@/lib/security";

export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  const [admin, err] = await needAdmin();
  if (err) return err;
  const rows = await query(`
    SELECT a.id, to_char(a.at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') AS at, a.action, a.target, a.details, a.ip,
           a.actor_email, u.name AS actor_name, u.role AS actor_role
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 200`);
  return ok(rows.map((r) => ({ ...r, actor_email: r.actor_email === admin.email ? r.actor_email : maskEmail(r.actor_email) })));
});
