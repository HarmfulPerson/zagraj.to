import { noStore, notFound, unauthorized } from "@/lib/api-responses";
import { getCurrentDj } from "@/lib/auth";
import { getDjBoard } from "@/lib/dj-board";
import { eventIdSchema } from "@/lib/event-validation";

/**
 * GET /api/events/:id/board: the DJ's live board (polled every 3 s while the event is LIVE).
 * 200 `{ event: { id, status, requestsOpen }, columns: { PENDING, ACCEPTED, PLAYED, REJECTED } }`, each column by votes.
 * 401 no session · 404 unknown event or another DJ's (indistinguishable).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[id]/board">) {
  const dj = await getCurrentDj();
  if (!dj) return noStore(unauthorized());

  const id = eventIdSchema.safeParse((await ctx.params).id);
  const board = id.success ? await getDjBoard(dj.id, id.data) : null;
  return noStore(board ? Response.json(board) : notFound());
}
