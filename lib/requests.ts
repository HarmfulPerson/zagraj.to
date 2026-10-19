import { z } from "zod";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { Plan } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type { EventStatus } from "@/lib/event-status";
import { canAddRequest, PLAN_MESSAGES } from "@/lib/plans";

export const TRACK_ID_MAX_LENGTH = 32;
export const TRACK_TEXT_MAX_LENGTH = 200;
export const TRACK_COVER_URL_MAX_LENGTH = 500;
export const TRACK_MAX_DURATION_SEC = 6 * 60 * 60;

/** Cover images are only accepted from Deezer's own hosts, so guests cannot inject arbitrary images. */
const COVER_HOST_PATTERN = /(^|\.)(dzcdn\.net|deezer\.com)$/;

function isAllowedCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && COVER_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * A track posted by a guest (a search result from `/api/search`). The client is not trusted:
 * texts are trimmed and length-limited, a cover outside Deezer's hosts or a bogus duration is dropped (null).
 */
export const trackInputSchema = z.object({
  id: z
    .string({ error: "Brak identyfikatora utworu." })
    .trim()
    .regex(/^[A-Za-z0-9_-]+$/, { error: "Nieprawidłowy identyfikator utworu." })
    .max(TRACK_ID_MAX_LENGTH, { error: "Nieprawidłowy identyfikator utworu." }),
  title: z
    .string({ error: "Brak tytułu utworu." })
    .trim()
    .min(1, { error: "Brak tytułu utworu." })
    .max(TRACK_TEXT_MAX_LENGTH, { error: "Tytuł utworu jest za długi." }),
  artist: z
    .string({ error: "Brak wykonawcy." })
    .trim()
    .min(1, { error: "Brak wykonawcy." })
    .max(TRACK_TEXT_MAX_LENGTH, { error: "Nazwa wykonawcy jest za długa." }),
  coverUrl: z
    .string()
    .max(TRACK_COVER_URL_MAX_LENGTH)
    .refine(isAllowedCoverUrl)
    .nullish()
    .catch(null)
    .transform((value) => value ?? null),
  durationSec: z
    .number()
    .int()
    .min(0)
    .max(TRACK_MAX_DURATION_SEC)
    .nullish()
    .catch(null)
    .transform((value) => value ?? null),
});

export type TrackInput = z.infer<typeof trackInputSchema>;

/** Body of `POST /api/events/[code]/requests`. */
export const addRequestBodySchema = z.object({
  track: trackInputSchema,
});

const guestRequestSelect = {
  id: true,
  trackId: true,
  title: true,
  artist: true,
  coverUrl: true,
  durationSec: true,
  _count: { select: { votes: true } },
} as const;

type GuestRequestRow = Prisma.RequestGetPayload<{ select: typeof guestRequestSelect }>;

/** A request as shown to guests. */
export type GuestRequest = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number | null;
  voteCount: number;
};

function toGuestRequest(row: GuestRequestRow): GuestRequest {
  const { id, trackId, title, artist, coverUrl, durationSec, _count } = row;
  return { id, trackId, title, artist, coverUrl, durationSec, voteCount: _count.votes };
}

/**
 * - `CREATED`: the track was new; a PENDING request and the guest's vote were created.
 * - `VOTED`: the track was already on the list; the guest's vote was added.
 * - `ALREADY_VOTED`: the track was already on the list and the guest had voted for it; nothing changed.
 */
export type AddRequestOutcome = "CREATED" | "VOTED" | "ALREADY_VOTED";

export type AddRequestResult =
  | { ok: true; outcome: AddRequestOutcome; request: GuestRequest; usedRequests: number; maxRequests: number }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "EVENT_NOT_LIVE"; status: EventStatus }
  | { ok: false; reason: "REQUESTS_CLOSED" }
  /** The DJ rejected this track. Answered neutrally, without a vote, so guests cannot learn what was rejected. */
  | { ok: false; reason: "TRACK_UNAVAILABLE" }
  /** The track has already been played tonight. No vote, consistent with the vote endpoint (409 for PLAYED). */
  | { ok: false; reason: "ALREADY_PLAYED" }
  | { ok: false; reason: "LIMIT_REACHED"; maxRequests: number }
  /** The event holds as many requests as the DJ's plan allows (Free: 100). Votes on listed tracks still work. */
  | { ok: false; reason: "LIST_FULL" };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** The event as guests may see it, by its (normalized) code. */
export function findGuestEvent(code: string, db: PrismaClient = prisma) {
  return db.event.findUnique({
    where: { code },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      requestsOpen: true,
      maxRequestsPerGuest: true,
      dj: { select: { plan: true } },
    },
  });
}

export type GuestEvent = NonNullable<Awaited<ReturnType<typeof findGuestEvent>>>;

/**
 * How many requests (new tracks) of the guest count towards `maxRequestsPerGuest`. Votes on existing tracks do not count,
 * and neither do tracks the DJ rejected: the slot is freed, and the "X z Y" counter cannot reveal a rejection.
 */
export function countGuestRequests(eventId: string, guestId: string, db: PrismaClient | Prisma.TransactionClient = prisma) {
  return db.request.count({ where: { eventId, createdByGuestId: guestId, status: { not: "REJECTED" } } });
}

/**
 * How many requests count towards the plan's per-event limit (`maxRequestsPerEvent`): every track on the event's list
 * except REJECTED ones (PENDING, ACCEPTED and PLAYED). A rejected track frees its slot, like in `countGuestRequests`.
 */
export function countEventRequests(eventId: string, db: PrismaClient | Prisma.TransactionClient = prisma) {
  return db.request.count({ where: { eventId, status: { not: "REJECTED" } } });
}

/** True when the event's list holds as many requests as its DJ's plan allows (no new tracks, votes still work). */
export async function isEventListFull(event: { id: string; dj: { plan: Plan } }, db: PrismaClient = prisma): Promise<boolean> {
  return !canAddRequest(event.dj, await countEventRequests(event.id, db));
}

/** Tracks the guest added to the event, newest first, without ones the DJ rejected. */
export async function listGuestRequests(eventId: string, guestId: string, db: PrismaClient = prisma): Promise<GuestRequest[]> {
  const rows = await db.request.findMany({
    where: { eventId, createdByGuestId: guestId, status: { not: "REJECTED" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: guestRequestSelect,
  });
  return rows.map(toGuestRequest);
}

async function voteFor(requestId: string, guestId: string, db: PrismaClient): Promise<"VOTED" | "ALREADY_VOTED"> {
  try {
    await db.vote.create({ data: { requestId, guestId } });
    return "VOTED";
  } catch (error) {
    // Unique (requestId, guestId): the guest has already voted (also covers a double tap racing itself).
    if (isUniqueViolation(error)) return "ALREADY_VOTED";
    throw error;
  }
}

async function loadRequest(id: string, db: PrismaClient): Promise<GuestRequest> {
  return toGuestRequest(await db.request.findUniqueOrThrow({ where: { id }, select: guestRequestSelect }));
}

/**
 * A guest adds a track to the event's wish list:
 * - the event must be LIVE with requests open (otherwise `EVENT_NOT_LIVE` / `REQUESTS_CLOSED`);
 * - a track already on the list gets the guest's vote instead of a duplicate, and does not use up the guest's limit;
 * - a track the DJ rejected gets no vote and a neutral `TRACK_UNAVAILABLE` (REJECTED never reaches a guest);
 * - a track already played gets no vote and `ALREADY_PLAYED` (it is in the guest's "Zagrane" section anyway);
 * - a new track creates a PENDING request plus the guest's vote, unless the event's list is full for the DJ's plan
 *   (`LIST_FULL`, Free: 100 requests without REJECTED) or the guest reached `maxRequestsPerGuest` (`LIMIT_REACHED`).
 * Expects `track` validated by `trackInputSchema` and `guestId` validated by `isValidGuestId`.
 */
export async function addRequest(
  input: { code: string; guestId: string; track: TrackInput },
  db: PrismaClient = prisma,
): Promise<AddRequestResult> {
  const { guestId, track } = input;
  const event = await findGuestEvent(input.code, db);
  if (!event) return { ok: false, reason: "NOT_FOUND" };
  if (event.status !== "LIVE") return { ok: false, reason: "EVENT_NOT_LIVE", status: event.status };
  if (!event.requestsOpen) return { ok: false, reason: "REQUESTS_CLOSED" };

  const maxRequests = event.maxRequestsPerGuest;
  const done = async (outcome: AddRequestOutcome, requestId: string): Promise<AddRequestResult> => ({
    ok: true,
    outcome,
    request: await loadRequest(requestId, db),
    usedRequests: await countGuestRequests(event.id, guestId, db),
    maxRequests,
  });

  const voteForExisting = async (existing: { id: string; status: string }): Promise<AddRequestResult> => {
    if (existing.status === "REJECTED") return { ok: false, reason: "TRACK_UNAVAILABLE" };
    if (existing.status === "PLAYED") return { ok: false, reason: "ALREADY_PLAYED" };
    return done(await voteFor(existing.id, guestId, db), existing.id);
  };

  const existing = await db.request.findUnique({
    where: { eventId_trackId: { eventId: event.id, trackId: track.id } },
    select: { id: true, status: true },
  });
  if (existing) return voteForExisting(existing);

  try {
    // Count and insert in one transaction, so two quick taps (or two guests) cannot both slip under a limit.
    const created = await db.$transaction(async (tx) => {
      if (!canAddRequest(event.dj, await countEventRequests(event.id, tx))) return "LIST_FULL" as const;
      if ((await countGuestRequests(event.id, guestId, tx)) >= maxRequests) return "LIMIT_REACHED" as const;
      return tx.request.create({
        data: {
          eventId: event.id,
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          coverUrl: track.coverUrl,
          durationSec: track.durationSec,
          createdByGuestId: guestId,
          votes: { create: { guestId } },
        },
        select: { id: true },
      });
    });
    if (created === "LIST_FULL") return { ok: false, reason: "LIST_FULL" };
    if (created === "LIMIT_REACHED") return { ok: false, reason: "LIMIT_REACHED", maxRequests };
    return done("CREATED", created.id);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Race: another guest added the same track between our lookup and insert. Vote for theirs instead.
    const winner = await db.request.findUnique({
      where: { eventId_trackId: { eventId: event.id, trackId: track.id } },
      select: { id: true, status: true },
    });
    if (!winner) throw error;
    return voteForExisting(winner);
  }
}

/** Polish messages for guests, shared by the API and the guest page. */
export const GUEST_MESSAGES = {
  notFound: "Nie ma imprezy o takim kodzie.",
  notStarted: "Impreza jeszcze się nie zaczęła.",
  closed: "Impreza zakończona.",
  requestsClosed: "DJ chwilowo nie przyjmuje nowych życzeń.",
  trackUnavailable: "Ten utwór nie może zostać dodany.",
  requestGone: "Tego utworu nie ma już na liście.",
  alreadyPlayed: "Ten utwór został już zagrany.",
  noGuest: "Odśwież stronę i spróbuj ponownie.",
  listFull: `${PLAN_MESSAGES.listFull}. ${PLAN_MESSAGES.listFullDetails}`,
  limitReached: (max: number) =>
    `Wykorzystano limit życzeń (${max}) na tę imprezę. Możesz dalej dodawać głosy na utwory, które już są na liście.`,
} as const;
