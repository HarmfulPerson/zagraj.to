import { noStore, notFound, planRequired, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { loadBoardRows } from "@/lib/dj-board";
import { eventIdSchema } from "@/lib/event-validation";
import { findDjEvent } from "@/lib/events";
import {
  contentDisposition,
  EXPORT_CONTENT_TYPES,
  formatCsv,
  formatExportDay,
  formatTxt,
  parseExportQuery,
  selectExportRows,
} from "@/lib/export";
import { canExport, PLAN_MESSAGES } from "@/lib/plans";

/**
 * GET /api/events/:id/export?format=csv|txt[&status=PENDING&status=PLAYED…]: the DJ's wish list as a file.
 * `status` repeated or comma-separated; default all except REJECTED. Both formats in queue order (votes, then oldest).
 * 200 file (`Content-Disposition: attachment`) · 400 invalid query · 401 no session · 403 `PLAN_REQUIRED` (Free plan)
 * · 404 unknown or another DJ's event.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/events/[id]/export">) {
  const dj = await getCurrentDj();
  if (!dj) return noStore(unauthorized());

  const id = eventIdSchema.safeParse((await ctx.params).id);
  const event = id.success ? await findDjEvent(dj.id, id.data) : null;
  if (!event) return noStore(notFound());
  if (!canExport(dj)) return noStore(planRequired(`${PLAN_MESSAGES.exportLocked}.`));

  const query = parseExportQuery(new URL(request.url).searchParams);
  if (!query.success) return noStore(validationError(query.error));
  const { format, status } = query.data;

  const rows = selectExportRows(await loadBoardRows(event.id), status);
  // Event dates are stored as midnight UTC (see lib/event-validation.ts); without one, the day the event was created.
  const day = event.startsAt ? event.startsAt.toISOString().slice(0, 10) : formatExportDay(event.createdAt);
  const body = format === "csv" ? formatCsv(rows) : formatTxt(rows);

  return noStore(
    new Response(body, {
      headers: {
        "content-type": EXPORT_CONTENT_TYPES[format],
        "content-disposition": contentDisposition(event.name, day, format),
        "x-content-type-options": "nosniff",
      },
    }),
  );
}
