import { invalidJson, readJson, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { createEventSchema } from "@/lib/event-validation";
import { createEvent, listDjEvents } from "@/lib/events";

/** GET /api/events: the logged-in DJ's events, newest first. */
export async function GET() {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();
  return Response.json({ events: await listDjEvents(dj.id) });
}

/** POST /api/events `{ name, startsAt?, maxRequestsPerGuest? }`: creates a DRAFT event with a unique code. */
export async function POST(request: Request) {
  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const event = await createEvent(dj.id, parsed.data);
  return Response.json({ event }, { status: 201 });
}
