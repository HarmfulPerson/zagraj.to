import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EventStatus } from "@/lib/event-status";
import { compareQueue } from "@/lib/queue-order";
import { findGuestEvent, isEventListFull } from "@/lib/requests";

export { compareQueue };

/** How many recently played tracks guests see in the "Zagrane" section. */
export const PLAYED_LIST_LIMIT = 20;

/** Request statuses a guest may ever see. REJECTED never reaches a guest. */
export type GuestVisibleStatus = "PENDING" | "ACCEPTED" | "PLAYED";

/**
 * One wish-list entry as a guest sees it. Only booleans about the current guest (`votedByMe`, `mine`),
 * never other guests' ids.
 */
export type GuestListItem = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number | null;
  status: GuestVisibleStatus;
  votes: number;
  votedByMe: boolean;
  mine: boolean;
};

export type GuestList = {
  /** `listFull`: the event holds as many tracks as the DJ's plan allows (guests can only like tracks). */
  event: { status: EventStatus; requestsOpen: boolean; listFull: boolean };
  /** PENDING and ACCEPTED, most votes first, then oldest first. */
  queue: GuestListItem[];
  /** The last `PLAYED_LIST_LIMIT` played tracks, most recently played first. */
  played: GuestListItem[];
};

/** A request row as loaded from the database, before it is reduced to what a guest may see. */
export type GuestListRow = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "PLAYED";
  createdByGuestId: string;
  createdAt: Date;
  playedAt: Date | null;
  voteCount: number;
  votedByMe: boolean;
};

function toItem(row: GuestListRow, status: GuestVisibleStatus, guestId: string | null): GuestListItem {
  return {
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    coverUrl: row.coverUrl,
    durationSec: row.durationSec,
    status,
    votes: row.voteCount,
    votedByMe: row.votedByMe,
    mine: guestId !== null && row.createdByGuestId === guestId,
  };
}


/** Played order: most recently played first (a missing `playedAt` falls back to `createdAt`). */
export function comparePlayed(a: GuestListRow, b: GuestListRow): number {
  const at = (row: GuestListRow) => (row.playedAt ?? row.createdAt).getTime();
  return at(b) - at(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
}

/**
 * Splits request rows into the guest's queue and "Zagrane" section: REJECTED rows are dropped,
 * the queue is sorted by votes (then date), played tracks are capped at `PLAYED_LIST_LIMIT`.
 */
export function buildGuestList(rows: readonly GuestListRow[], guestId: string | null): Pick<GuestList, "queue" | "played"> {
  const queue: GuestListRow[] = [];
  const played: GuestListRow[] = [];
  for (const row of rows) {
    if (row.status === "PENDING" || row.status === "ACCEPTED") queue.push(row);
    else if (row.status === "PLAYED") played.push(row);
    // REJECTED: never shown to guests.
  }
  return {
    queue: queue.sort(compareQueue).map((row) => toItem(row, row.status as GuestVisibleStatus, guestId)),
    played: played
      .sort(comparePlayed)
      .slice(0, PLAYED_LIST_LIMIT)
      .map((row) => toItem(row, "PLAYED", guestId)),
  };
}

function rowSelect(guestId: string | null) {
  return {
    id: true,
    trackId: true,
    title: true,
    artist: true,
    coverUrl: true,
    durationSec: true,
    status: true,
    createdByGuestId: true,
    createdAt: true,
    playedAt: true,
    _count: { select: { votes: true } },
    // Only the current guest's own vote (at most one, unique (requestId, guestId)); without a guest id nothing matches.
    votes: { where: { guestId: guestId ?? "" }, select: { id: true }, take: 1 },
  } as const;
}

/** Loads the event's visible requests (never REJECTED) for one guest. */
export async function loadGuestListRows(eventId: string, guestId: string | null, db: PrismaClient = prisma): Promise<GuestListRow[]> {
  const select = rowSelect(guestId);
  const [active, played] = await Promise.all([
    db.request.findMany({ where: { eventId, status: { in: ["PENDING", "ACCEPTED"] } }, select }),
    db.request.findMany({
      where: { eventId, status: "PLAYED" },
      orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
      take: PLAYED_LIST_LIMIT,
      select,
    }),
  ]);
  return [...active, ...played].map(({ _count, votes, ...row }) => ({
    ...row,
    voteCount: _count.votes,
    votedByMe: votes.length > 0,
  }));
}

/**
 * The wish list a guest sees for the event with the given (normalized) code, or `null` for an unknown code.
 * Lists are only filled while the event is LIVE; a DRAFT or CLOSED event returns its status with empty lists.
 */
export async function getGuestList(code: string, guestId: string | null, db: PrismaClient = prisma): Promise<GuestList | null> {
  const event = await findGuestEvent(code, db);
  if (!event) return null;
  if (event.status !== "LIVE") return { event: { status: event.status, requestsOpen: event.requestsOpen, listFull: false }, queue: [], played: [] };
  const [rows, listFull] = await Promise.all([loadGuestListRows(event.id, guestId, db), isEventListFull(event, db)]);
  return { event: { status: event.status, requestsOpen: event.requestsOpen, listFull }, ...buildGuestList(rows, guestId) };
}
