import { NextResponse } from "next/server";

import { invalidJson, readJson, requireJsonContentType, validationError } from "@/lib/api-responses";
import { isValidEventCode, normalizeEventCode } from "@/lib/event-code";
import { GUEST_ID_COOKIE_NAME, generateGuestId, guestIdCookieOptions, readGuestId } from "@/lib/guest";
import { getGuestList } from "@/lib/guest-list";
import { addRequest, addRequestBodySchema, type AddRequestResult, GUEST_MESSAGES } from "@/lib/requests";

/**
 * GET /api/events/:code/requests: the wish list as the guest sees it (polled every 3 s by the guest page).
 * The segment is named `[id]` because it shares the folder with the DJ routes; here it holds the event code.
 *
 * 200 `{ event: { status, requestsOpen }, queue, played }`: `queue` holds PENDING and ACCEPTED requests by votes
 * (then date), `played` the last 20 PLAYED; REJECTED never appears. Each item has `votes`, `votedByMe` and `mine`
 * for the guest from the `guestId` cookie (both false without one). Lists are empty unless the event is LIVE.
 * 404 unknown code.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/events/[id]/requests">) {
  const code = normalizeEventCode((await ctx.params).id);
  const list = isValidEventCode(code) ? await getGuestList(code, readGuestId(request)) : null;
  if (!list) return NextResponse.json({ error: "NOT_FOUND", message: GUEST_MESSAGES.notFound }, { status: 404 });
  return NextResponse.json(list, { headers: { "cache-control": "private, no-store" } });
}

/**
 * POST /api/events/:code/requests `{ track: { id, title, artist, coverUrl?, durationSec? } }`: a guest adds a track.
 * The segment is named `[id]` because it shares the folder with the DJ routes; here it holds the event code.
 *
 * 201 new request (+ the guest's vote) · 200 vote on a track already on the list (or already voted)
 * 400 invalid body · 403 event not LIVE or requests closed · 404 unknown code
 * 409 the DJ rejected this track (`TRACK_UNAVAILABLE`, neutral message) or it was already played (`ALREADY_PLAYED`); no vote either way
 * 409 `LIST_FULL`: the event holds as many tracks as the DJ's plan allows (Free: 100); votes on listed tracks still work · 415 not `application/json` · 429 guest's request limit reached.
 * A guest without a valid `guestId` cookie gets a fresh one with the response.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[id]/requests">) {
  const unsupported = requireJsonContentType(request);
  if (unsupported) return unsupported;

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
    case "TRACK_UNAVAILABLE":
      return [{ error: "TRACK_UNAVAILABLE", message: GUEST_MESSAGES.trackUnavailable }, 409];
    case "ALREADY_PLAYED":
      return [{ error: "ALREADY_PLAYED", message: GUEST_MESSAGES.alreadyPlayed }, 409];
    case "LIST_FULL":
      return [{ error: "LIST_FULL", message: GUEST_MESSAGES.listFull }, 409];
    case "LIMIT_REACHED":
      return [{ error: "REQUEST_LIMIT", maxRequests: result.maxRequests, message: GUEST_MESSAGES.limitReached(result.maxRequests) }, 429];
  }
}
