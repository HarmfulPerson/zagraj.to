import { NextResponse } from "next/server";

import { requireJsonContentType } from "@/lib/api-responses";
import { readGuestId } from "@/lib/guest";
import { GUEST_MESSAGES } from "@/lib/requests";
import { castVote, removeVote, requestIdSchema, type VoteResult } from "@/lib/votes";

/**
 * POST /api/requests/:id/vote likes a request, DELETE takes the like back. The guest is the `guestId` cookie.
 * Both are idempotent and answer 200 `{ votes, votedByMe }` (never other guests' ids).
 *
 * 401 no valid guest cookie · 403 event not LIVE (voting works while requests are closed, not after the party)
 * 404 unknown or REJECTED request (indistinguishable) · 409 already played · 415 not `application/json`.
 */
export function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/vote">) {
  return handle(request, ctx, castVote);
}

export function DELETE(request: Request, ctx: RouteContext<"/api/requests/[id]/vote">) {
  return handle(request, ctx, removeVote);
}

/** Vote answers are per guest, like the list itself: never stored by a browser or a proxy. */
const NO_STORE = { "cache-control": "private, no-store" } as const;

async function handle(
  request: Request,
  ctx: RouteContext<"/api/requests/[id]/vote">,
  action: (requestId: string, guestId: string) => Promise<VoteResult>,
): Promise<Response> {
  const response = await respond(request, ctx, action);
  for (const [name, value] of Object.entries(NO_STORE)) response.headers.set(name, value);
  return response;
}

async function respond(
  request: Request,
  ctx: RouteContext<"/api/requests/[id]/vote">,
  action: (requestId: string, guestId: string) => Promise<VoteResult>,
): Promise<Response> {
  const unsupported = requireJsonContentType(request);
  if (unsupported) return unsupported;

  const guestId = readGuestId(request);
  if (!guestId) return NextResponse.json({ error: "NO_GUEST", message: GUEST_MESSAGES.noGuest }, { status: 401 });

  const id = requestIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();

  const result = await action(id.data, guestId);
  if (result.ok) return NextResponse.json({ votes: result.votes, votedByMe: result.votedByMe });
  switch (result.reason) {
    case "NOT_FOUND":
      return notFound();
    case "EVENT_NOT_LIVE":
      return NextResponse.json(
        {
          error: "EVENT_NOT_LIVE",
          status: result.status,
          message: result.status === "DRAFT" ? GUEST_MESSAGES.notStarted : GUEST_MESSAGES.closed,
        },
        { status: 403 },
      );
    case "ALREADY_PLAYED":
      return NextResponse.json({ error: "ALREADY_PLAYED", message: GUEST_MESSAGES.alreadyPlayed }, { status: 409 });
  }
}

function notFound() {
  return NextResponse.json({ error: "NOT_FOUND", message: GUEST_MESSAGES.requestGone }, { status: 404 });
}
