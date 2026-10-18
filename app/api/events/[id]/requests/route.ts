import { NextResponse } from "next/server";

import { invalidJson, readJson, validationError } from "@/lib/api-responses";
import { isValidEventCode, normalizeEventCode } from "@/lib/event-code";
import { GUEST_ID_COOKIE_NAME, generateGuestId, guestIdCookieOptions, readGuestId } from "@/lib/guest";
import { addRequest, addRequestBodySchema, type AddRequestResult, GUEST_MESSAGES } from "@/lib/requests";

/**
 * POST /api/events/:code/requests `{ track: { id, title, artist, coverUrl?, durationSec? } }`: a guest adds a track.
 * The segment is named `[id]` because it shares the folder with the DJ routes; here it holds the event code.
 *
 * 201 new request (+ the guest's vote) · 200 vote on a track already on the list (or already voted)
 * 400 invalid body · 403 event not LIVE or requests closed · 404 unknown code · 429 guest's request limit reached.
 * A guest without a valid `guestId` cookie gets a fresh one with the response.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[id]/requests">) {
  const existingGuestId = readGuestId(request);
  const guestId = existingGuestId ?? generateGuestId();
  const respond = (body: unknown, status: number) => {
    const response = NextResponse.json(body, { status });
    if (!existingGuestId) response.cookies.set(GUEST_ID_COOKIE_NAME, guestId, guestIdCookieOptions());
    return response;
  };

  const code = normalizeEventCode((await ctx.params).id);
  if (!isValidEventCode(code)) return respond({ error: "NOT_FOUND", message: GUEST_MESSAGES.notFound }, 404);

  const body = await readJson(request);
  if (body === undefined) return invalidJson();
  const parsed = addRequestBodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const result = await addRequest({ code, guestId, track: parsed.data.track });
  return respond(...toResponse(result));
}

function toResponse(result: AddRequestResult): [unknown, number] {
  if (result.ok) {
    const { outcome, request, usedRequests, maxRequests } = result;
    return [{ outcome, request, usedRequests, maxRequests }, outcome === "CREATED" ? 201 : 200];
  }
  switch (result.reason) {
    case "NOT_FOUND":
      return [{ error: "NOT_FOUND", message: GUEST_MESSAGES.notFound }, 404];
    case "EVENT_NOT_LIVE":
      return [
        { error: "EVENT_NOT_LIVE", status: result.status, message: result.status === "DRAFT" ? GUEST_MESSAGES.notStarted : GUEST_MESSAGES.closed },
        403,
      ];
    case "REQUESTS_CLOSED":
      return [{ error: "REQUESTS_CLOSED", message: GUEST_MESSAGES.requestsClosed }, 403];
    case "LIMIT_REACHED":
      return [{ error: "REQUEST_LIMIT", maxRequests: result.maxRequests, message: GUEST_MESSAGES.limitReached(result.maxRequests) }, 429];
  }
}
