import { z } from "zod";

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EventStatus } from "@/lib/event-status";
import { findDjEvent } from "@/lib/events";
import { compareQueue } from "@/lib/queue-order";
import { planRequestStatusChange, REQUEST_STATUSES, type RequestStatus } from "@/lib/request-status";

/** One request on the DJ's live board. Dates are ISO strings, so the same shape comes from the page and the API. */
export type BoardItem = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number | null;
  status: RequestStatus;
  votes: number;
  createdAt: string;
  playedAt: string | null;
};

export type BoardColumns = Record<RequestStatus, BoardItem[]>;

export type DjBoard = {
  event: { id: string; status: EventStatus; requestsOpen: boolean };
  /** Every request of the event (REJECTED included) by status; each column most votes first, then oldest first. */
  columns: BoardColumns;
};

/** A request row as loaded for the board, before grouping. */
export type BoardRow = Omit<BoardItem, "votes" | "createdAt" | "playedAt"> & {
  voteCount: number;
  createdAt: Date;
  playedAt: Date | null;
};

function toItem({ voteCount, createdAt, playedAt, ...row }: BoardRow): BoardItem {
  return { ...row, votes: voteCount, createdAt: createdAt.toISOString(), playedAt: playedAt?.toISOString() ?? null };
}

/** Groups rows into the four status columns, each sorted like the guest queue (votes, then waiting time). */
export function buildBoardColumns(rows: readonly BoardRow[]): BoardColumns {
  const columns = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, [] as BoardRow[]])) as Record<RequestStatus, BoardRow[]>;
  for (const row of rows) columns[row.status].push(row);
  return Object.fromEntries(
    REQUEST_STATUSES.map((status) => [status, columns[status].sort(compareQueue).map(toItem)]),
  ) as BoardColumns;
}

const boardRowSelect = {
  id: true,
  trackId: true,
  title: true,
  artist: true,
  coverUrl: true,
  durationSec: true,
  status: true,
  createdAt: true,
  playedAt: true,
  // Vote counts come from one aggregate subquery in the same SQL statement, not a query per request.
  _count: { select: { votes: true } },
} as const;

/** All requests of an event for the board, in a single query. Callers must have checked ownership. */
export async function loadBoardRows(eventId: string, db: PrismaClient = prisma): Promise<BoardRow[]> {
  const rows = await db.request.findMany({ where: { eventId }, select: boardRowSelect });
  return rows.map(({ _count, ...row }) => ({ ...row, voteCount: _count.votes }));
}

/** The DJ's live board for their own event, or null when the event does not exist or belongs to someone else. */
export async function getDjBoard(djId: string, eventId: string, db: PrismaClient = prisma): Promise<DjBoard | null> {
  const event = await findDjEvent(djId, eventId, db);
  if (!event) return null;
  return {
    event: { id: event.id, status: event.status, requestsOpen: event.requestsOpen },
    columns: buildBoardColumns(await loadBoardRows(event.id, db)),
  };
}

/** Body of `POST /api/requests/:id/status`. */
export const requestStatusBodySchema = z.object({
  status: z.enum(REQUEST_STATUSES, { error: "Nieznany status." }),
});

/** Body of `POST /api/events/:id/requests-open`. */
export const requestsOpenBodySchema = z.object({
  requestsOpen: z.boolean({ error: "Podaj, czy zgłoszenia mają być otwarte." }),
});

export type RequestStatusResult =
  | { ok: true; item: BoardItem }
  /** Unknown request, or one in another DJ's event: indistinguishable. */
  | { ok: false; reason: "NOT_FOUND" }
  /** The board only changes while the party is on. */
  | { ok: false; reason: "EVENT_NOT_LIVE"; eventStatus: EventStatus }
  | { ok: false; reason: "INVALID_TRANSITION"; status: RequestStatus };

/**
 * The DJ moves a request of their own LIVE event to `to` (see `REQUEST_STATUS_TRANSITIONS`).
 * "Zagrane" stamps `playedAt`, any other target clears it. The update is conditional on the status that was validated,
 * so two devices acting at once cannot both apply a change from the same starting point.
 */
export async function changeRequestStatus(
  djId: string,
  requestId: string,
  to: RequestStatus,
  db: PrismaClient = prisma,
  now: () => Date = () => new Date(),
): Promise<RequestStatusResult> {
  const where = { id: requestId, event: { djId } };
  const request = await db.request.findFirst({ where, select: { status: true, event: { select: { status: true } } } });
  if (!request) return { ok: false, reason: "NOT_FOUND" };
  if (request.event.status !== "LIVE") return { ok: false, reason: "EVENT_NOT_LIVE", eventStatus: request.event.status };

  const change = planRequestStatusChange(request.status, to, now());
  if (!change.ok) return { ok: false, reason: "INVALID_TRANSITION", status: request.status };

  const { count } = await db.request.updateMany({ where: { id: requestId, status: request.status }, data: change.data });
  const current = await db.request.findFirst({ where, select: boardRowSelect });
  if (!current) return { ok: false, reason: "NOT_FOUND" };
  if (count === 0) return { ok: false, reason: "INVALID_TRANSITION", status: current.status };
  const { _count, ...row } = current;
  return { ok: true, item: toItem({ ...row, voteCount: _count.votes }) };
}

/** Opens or closes new requests ("Zgłoszenia otwarte") on the DJ's own event. Null when it is not theirs. */
export async function setRequestsOpen(
  djId: string,
  eventId: string,
  requestsOpen: boolean,
  db: PrismaClient = prisma,
): Promise<{ requestsOpen: boolean } | null> {
  const { count } = await db.event.updateMany({ where: { id: eventId, djId }, data: { requestsOpen } });
  return count === 0 ? null : { requestsOpen };
}

/** Polish texts of the board API. */
export const BOARD_MESSAGES = {
  eventNotLive: "Tablicę można zmieniać tylko w trakcie wydarzenia.",
  invalidTransition: "Ten utwór ma już inny status. Tablica została odświeżona.",
} as const;
