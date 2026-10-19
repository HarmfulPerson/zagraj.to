import { invalidJson, notFound, planRequired, readJson, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { eventIdSchema, eventStatusActionSchema } from "@/lib/event-validation";
import { changeEventStatus } from "@/lib/events";
import { PLAN_MESSAGES } from "@/lib/plans";

/**
 * POST /api/events/:id/status `{ action: "start" | "close" }`: DRAFT → LIVE or LIVE → CLOSED.
 * 200 `{ event }` · 403 `PLAN_LIMIT` (Free: monthly start limit reached; `message`, `upgradeUrl`) · 404 · 409 invalid transition.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[id]/status">) {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = eventIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = eventStatusActionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const result = await changeEventStatus(dj.id, id.data, parsed.data.action);
  if (result.ok) return Response.json({ event: result.event });
  if (result.reason === "NOT_FOUND") return notFound();
  if (result.reason === "PLAN_LIMIT") return planRequired(PLAN_MESSAGES.startLimit(result.limit), "PLAN_LIMIT");
  return Response.json({ error: "INVALID_TRANSITION", status: result.status }, { status: 409 });
}
