import { invalidJson, notFound, planRequired, readJson, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { eventIdSchema, updateEventSchema } from "@/lib/event-validation";
import { findDjEvent, updateEvent } from "@/lib/events";
import { PLAN_MESSAGES } from "@/lib/plans";

/** GET /api/events/:id. Someone else's event is indistinguishable from a missing one (404). */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = eventIdSchema.safeParse((await ctx.params).id);
  const event = id.success ? await findDjEvent(dj.id, id.data) : null;
  return event ? Response.json({ event }) : notFound();
}

/**
 * PATCH /api/events/:id `{ name, maxRequestsPerGuest, posterText? }`: edits the DJ's own event.
 * `posterText` (max 80 characters, blank clears it) is Pro only: 403 `PLAN_REQUIRED` for a Free DJ sending a text.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = eventIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const result = await updateEvent(dj.id, id.data, parsed.data);
  if (result.ok) return Response.json({ event: result.event });
  return result.reason === "PLAN_REQUIRED" ? planRequired(PLAN_MESSAGES.posterTextLocked) : notFound();
}
