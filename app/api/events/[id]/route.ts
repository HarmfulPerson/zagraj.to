import { invalidJson, notFound, readJson, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { eventIdSchema, updateEventSchema } from "@/lib/event-validation";
import { findDjEvent, updateEvent } from "@/lib/events";

/** GET /api/events/:id. Someone else's event is indistinguishable from a missing one (404). */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = eventIdSchema.safeParse((await ctx.params).id);
  const event = id.success ? await findDjEvent(dj.id, id.data) : null;
  return event ? Response.json({ event }) : notFound();
}

/** PATCH /api/events/:id `{ name, maxRequestsPerGuest }`: edits the DJ's own event. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = eventIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const event = await updateEvent(dj.id, id.data, parsed.data);
  return event ? Response.json({ event }) : notFound();
}
