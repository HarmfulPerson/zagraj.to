import { z } from "zod";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { EventStatus } from "@/lib/event-status";

/** Request ids are cuids; anything else cannot be a request and is treated as not found. */
export const requestIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(64);

export type VoteResult =
  | { ok: true; votes: number; votedByMe: boolean }
  /** Unknown request, or one the DJ rejected: guests cannot tell them apart. */
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "EVENT_NOT_LIVE"; status: EventStatus }
  /** The track has already been played; the "Zagrane" section has no hearts. */
  | { ok: false; reason: "ALREADY_PLAYED" };

/** The request if a guest may vote on it: event LIVE (requests may be closed), request PENDING or ACCEPTED. */
async function findVotableRequest(requestId: string, db: PrismaClient) {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, event: { select: { status: true } } },
  });
  if (!request || request.status === "REJECTED") return { ok: false, reason: "NOT_FOUND" } as const;
  if (request.event.status !== "LIVE") return { ok: false, reason: "EVENT_NOT_LIVE", status: request.event.status } as const;
  if (request.status === "PLAYED") return { ok: false, reason: "ALREADY_PLAYED" } as const;
  return { ok: true, id: request.id } as const;
}

async function voteState(requestId: string, guestId: string, db: PrismaClient): Promise<VoteResult> {
  const [votes, mine] = await Promise.all([
    db.vote.count({ where: { requestId } }),
    db.vote.count({ where: { requestId, guestId } }),
  ]);
  return { ok: true, votes, votedByMe: mine > 0 };
}

/**
 * A guest likes a request. Idempotent: a second like (or a double tap racing itself) is stopped by the
 * unique (requestId, guestId) constraint and changes nothing. Works while requests are closed, not after the party.
 * Expects `guestId` validated by `isValidGuestId`.
 */
export async function castVote(requestId: string, guestId: string, db: PrismaClient = prisma): Promise<VoteResult> {
  const found = await findVotableRequest(requestId, db);
  if (!found.ok) return found;
  try {
    await db.vote.create({ data: { requestId, guestId } });
  } catch (error) {
    const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (!duplicate) throw error;
  }
  return voteState(requestId, guestId, db);
}

/** A guest takes back their like. Idempotent: removing a vote that is not there changes nothing. */
export async function removeVote(requestId: string, guestId: string, db: PrismaClient = prisma): Promise<VoteResult> {
  const found = await findVotableRequest(requestId, db);
  if (!found.ok) return found;
  await db.vote.deleteMany({ where: { requestId, guestId } });
  return voteState(requestId, guestId, db);
}
