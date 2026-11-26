// GET /api/admin/report?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv|pdf   (admin only)
// json = on-screen preview, csv / pdf = file download. All three use the same buildReport() numbers.
// The on-screen preview masks emails and phone numbers; the full contact details are only in the
// downloaded files, and every download is written to the audit log.
import { needAdmin, fail, ok, handle } from "@/lib/server";
import { buildReport, rangeFromParams } from "@/lib/report";
import { reportCsv } from "@/lib/reportCsv";
import { reportPdf } from "@/lib/reportPdf";
import { maskEmail, maskPhone, audit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const [user, err] = await needAdmin();
  if (err) return err;
  const p = new URL(req.url).searchParams;
  const [from, to, bad] = rangeFromParams(p);
  if (bad) return fail(bad);
  const format = p.get("format") || "json";
  if (!["json", "csv", "pdf"].includes(format)) return fail("format must be json, csv or pdf");

  const r = await buildReport(from, to, user.name);
  if (format === "json") {
    for (const b of r.bookings) { b.user_email = maskEmail(b.user_email); b.user_phone = maskPhone(b.user_phone); }
    for (const u of r.users) { u.email = maskEmail(u.email); u.phone = maskPhone(u.phone); }
    return ok(r);
  }
  await audit(req, user, "report_export", format, { from, to });
  const name = `smart-parking-report_${from}_to_${to}.${format}`;
  const body = format === "csv" ? reportCsv(r) : reportPdf(r);
  return new Response(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
});
