// GET /api/admin/report?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv|pdf   (admin only)
// json = on-screen preview, csv / pdf = file download. All three use the same buildReport() numbers.
import { needAdmin, fail, ok, handle } from "@/lib/server";
import { buildReport, rangeFromParams } from "@/lib/report";
import { reportCsv } from "@/lib/reportCsv";
import { reportPdf } from "@/lib/reportPdf";

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
  if (format === "json") return ok(r);
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
