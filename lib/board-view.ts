import type { BoardItem, DjBoard } from "@/lib/dj-board";
import { compareQueue } from "@/lib/queue-order";
import type { RequestStatus } from "@/lib/request-status";

/** Client-safe helpers of the DJ's live board (no database access). */

/** "Otwórz w Spotify": a Spotify search for the track (no Spotify login in the MVP, see SPEC). */
export function spotifySearchUrl(artist: string, title: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`;
}

/** How long ago a request was added: "przed chwilą", "5 min temu", "2 godz. temu", "1 godz. 15 min temu". */
export function formatAgo(createdAt: string | Date, now: number): string {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 1) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 || hours >= 3 ? `${hours} godz. temu` : `${hours} godz. ${rest} min temu`;
}

const sortable = (item: BoardItem) => ({ id: item.id, voteCount: item.votes, createdAt: new Date(item.createdAt) });

/** Board column order (same as the guest queue): most votes first, then the request that waited longer. */
export function compareBoardItems(a: BoardItem, b: BoardItem): number {
  return compareQueue(sortable(a), sortable(b));
}

/**
 * The board with one request moved to `to`, as the server will store it ("Zagrane" stamps `playedAt`, other targets
 * clear it). Used for the optimistic update of a board action; an unknown id leaves the board unchanged.
 */
export function moveBoardItem(board: DjBoard, id: string, to: RequestStatus, now: Date): DjBoard {
  const item = Object.values(board.columns)
    .flat()
    .find((candidate) => candidate.id === id);
  if (!item) return board;
  const moved: BoardItem = { ...item, status: to, playedAt: to === "PLAYED" ? now.toISOString() : null };
  const without = (items: BoardItem[]) => items.filter((candidate) => candidate.id !== id);
  return {
    ...board,
    columns: {
      PENDING: without(board.columns.PENDING),
      ACCEPTED: without(board.columns.ACCEPTED),
      PLAYED: without(board.columns.PLAYED),
      REJECTED: without(board.columns.REJECTED),
      [to]: [...without(board.columns[to]), moved].sort(compareBoardItems),
    },
  };
}

/** Every request id on the board. */
export function boardIds(board: DjBoard): string[] {
  return Object.values(board.columns).flatMap((items) => items.map((item) => item.id));
}

/**
 * Ids the DJ has not seen yet: on the board now but not in `seen`. Without anything remembered (`seen` is null,
 * the board was never opened on this device) nothing counts as new, so a first visit is not one big highlight.
 */
export function unseenIds(ids: readonly string[], seen: ReadonlySet<string> | null): string[] {
  if (seen === null) return [];
  return ids.filter((id) => !seen.has(id));
}
