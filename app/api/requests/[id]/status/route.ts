import { invalidJson, noStore, notFound, readJson, requireJsonContentType, unauthorized, validationError } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { BOARD_MESSAGES, changeRequestStatus, requestStatusBodySchema } from "@/lib/dj-board";
import { requestIdSchema } from "@/lib/votes";

/**
 * POST /api/requests/:id/status `{ status: "PENDING" | "ACCEPTED" | "REJECTED" | "PLAYED" }`: a board action
 * ("Akceptuj", "Odrzuć", "Zagrane", "Cofnij do nowych") on a request of the DJ's own LIVE event.
 *
 * 200 `{ item }` · 400 invalid body · 401 no session · 404 unknown request or another DJ's (indistinguishable)
 * 409 `INVALID_TRANSITION` (with the current `status`) or `EVENT_NOT_LIVE` · 415 not `application/json`.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/status">) {
  return noStore(await respond(request, ctx));
}

async function respond(request: Request, ctx: RouteContext<"/api/requests/[id]/status">): Promise<Response> {
  const unsupported = requireJsonContentType(request);
  if (unsupported) return unsupported;

  const dj = await getCurrentDj();
  if (!dj) return unauthorized();

  const id = requestIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = requestStatusBodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const result = await changeRequestStatus(dj.id, id.data, parsed.data.status);
  if (result.ok) return Response.json({ item: result.item });
  switch (result.reason) {
    case "NOT_FOUND":
      return notFound();
    case "EVENT_NOT_LIVE":
      return Response.json(
        { error: "EVENT_NOT_LIVE", status: result.eventStatus, message: BOARD_MESSAGES.eventNotLive },
        { status: 409 },
      );
    case "INVALID_TRANSITION":
      return Response.json(
        { error: "INVALID_TRANSITION", status: result.status, message: BOARD_MESSAGES.invalidTransition },
        { status: 409 },
      );
  }
}
