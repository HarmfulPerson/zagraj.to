import { invalidJson, noStore, notFound, readJson, requireJsonContentType, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { requestsOpenBodySchema, setRequestsOpen } from "@/lib/dj-board";
import { eventIdSchema } from "@/lib/event-validation";

/**
 * POST /api/events/:id/requests-open `{ requestsOpen: boolean }`: the "Zgłoszenia otwarte" switch.
 * 200 `{ requestsOpen }` · 400 invalid body · 401 no session · 404 unknown event or another DJ's · 415 not JSON.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[id]/requests-open">) {
  return noStore(await respond(request, ctx));
}

async function respond(request: Request, ctx: RouteContext<"/api/events/[id]/requests-open">): Promise<Response> {
  const unsupported = requireJsonContentType(request);
  if (unsupported) return unsupported;

  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = eventIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = requestsOpenBodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const result = await setRequestsOpen(dj.id, id.data, parsed.data.requestsOpen);
  return result ? Response.json(result) : notFound();
}
