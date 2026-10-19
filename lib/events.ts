import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { generateUniqueEventCode } from "@/lib/event-code";
import { applyStatusAction, type EventStatus, type EventStatusAction } from "@/lib/event-status";
import type { CreateEventInput, UpdateEventInput } from "@/lib/event-validation";
import { canCustomizePoster, canStartEvent, planMonthRange } from "@/lib/plans";

const djEventSelect = {
  id: true,
  name: true,
  code: true,
  startsAt: true,
  status: true,
  requestsOpen: true,
  maxRequestsPerGuest: true,
  startedAt: true,
  posterText: true,
  createdAt: true,
} as const;

export type DjEvent = Prisma.EventGetPayload<{ select: typeof djEventSelect }>;

export type StatusChangeResult =
  | { ok: true; event: DjEvent }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "INVALID_TRANSITION"; status: EventStatus }
  /** Free plan: the DJ already started `limit` event(s) this calendar month (see `canStartEvent`). */
  | { ok: false; reason: "PLAN_LIMIT"; limit: number };

export type UpdateEventResult =
  | { ok: true; event: DjEvent }
  | { ok: false; reason: "NOT_FOUND" }
  /** A poster text was sent, but the DJ's plan does not include it (Pro only). */
  | { ok: false; reason: "PLAN_REQUIRED" };

/** All events of a DJ, newest first. */
export function listDjEvents(djId: string, db: PrismaClient = prisma): Promise<DjEvent[]> {
  return db.event.findMany({
    where: { djId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: djEventSelect,
  });
}

/** The event if it exists and belongs to the DJ; otherwise null (callers answer 404 either way). */
export function findDjEvent(djId: string, eventId: string, db: PrismaClient = prisma): Promise<DjEvent | null> {
  return db.event.findFirst({ where: { id: eventId, djId }, select: djEventSelect });
}

function isCodeCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  return JSON.stringify(error.meta ?? {}).includes("code");
}

/** Creates a DRAFT event with a fresh unique code. Expects input validated by `createEventSchema`. */
export async function createEvent(djId: string, input: CreateEventInput, db: PrismaClient = prisma): Promise<DjEvent> {
  const isTaken = async (code: string) => (await db.event.findUnique({ where: { code }, select: { id: true } })) !== null;
  for (let attempt = 0; ; attempt++) {
    const code = await generateUniqueEventCode(isTaken);
    try {
      return await db.event.create({
        data: { djId, code, name: input.name, startsAt: input.startsAt, maxRequestsPerGuest: input.maxRequestsPerGuest },
        select: djEventSelect,
      });
    } catch (error) {
      // Race: another event took the same code between the check and the insert.
      if (attempt < 2 && isCodeCollision(error)) continue;
      throw error;
    }
  }
}

/**
 * Updates name, per-guest limit and (Pro only) the poster text of the DJ's own event.
 * `posterText` undefined leaves it unchanged, null clears it; a non-empty text needs a plan with `canCustomizePoster`.
 */
export async function updateEvent(
  djId: string,
  eventId: string,
  input: UpdateEventInput,
  db: PrismaClient = prisma,
): Promise<UpdateEventResult> {
  if (input.posterText) {
    const owner = await db.user.findUnique({ where: { id: djId }, select: { plan: true } });
    if (!owner) return { ok: false, reason: "NOT_FOUND" };
    if (!canCustomizePoster(owner)) {
      // Someone else's event still looks missing, never "upgrade needed".
      return (await findDjEvent(djId, eventId, db)) ? { ok: false, reason: "PLAN_REQUIRED" } : { ok: false, reason: "NOT_FOUND" };
    }
  }
  const { count } = await db.event.updateMany({
    where: { id: eventId, djId },
    data: { name: input.name, maxRequestsPerGuest: input.maxRequestsPerGuest, posterText: input.posterText },
  });
  const event = count === 0 ? null : await findDjEvent(djId, eventId, db);
  return event ? { ok: true, event } : { ok: false, reason: "NOT_FOUND" };
}

/**
 * Starts or closes the DJ's own event, enforcing DRAFT → LIVE → CLOSED and the plan's monthly start limit.
 * Starting stamps `startedAt = now`. The limit check and the update run in one transaction (SQLite serializes write
 * transactions), so two quick starts of different events cannot both slip under the Free limit.
 * Shared by the API route and the panel's server action.
 */
export async function changeEventStatus(
  djId: string,
  eventId: string,
  action: EventStatusAction,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<StatusChangeResult> {
  return db.$transaction(async (tx): Promise<StatusChangeResult> => {
    const event = await tx.event.findFirst({
      where: { id: eventId, djId },
      select: { ...djEventSelect, dj: { select: { plan: true } } },
    });
    if (!event) return { ok: false, reason: "NOT_FOUND" };
    const { dj, ...current } = event;

    const next = applyStatusAction(current.status, action);
    if (!next.ok) return { ok: false, reason: "INVALID_TRANSITION", status: current.status };

    const starting = next.status === "LIVE";
    if (starting) {
      const { start, end } = planMonthRange(now);
      const started = await tx.event.findMany({
        where: { djId, startedAt: { gte: start, lt: end } },
        select: { startedAt: true },
      });
      const allowed = canStartEvent({ plan: dj.plan, startedAt: started.map((e) => e.startedAt!) }, now);
      if (!allowed.ok) return { ok: false, reason: "PLAN_LIMIT", limit: allowed.limit };
    }

    // Conditional on the status we validated against, so two concurrent clicks cannot both apply.
    const data = starting ? { status: next.status, startedAt: now } : { status: next.status };
    const { count } = await tx.event.updateMany({ where: { id: eventId, djId, status: current.status }, data });
    if (count === 0) {
      const latest = await tx.event.findFirst({ where: { id: eventId, djId }, select: { status: true } });
      return latest ? { ok: false, reason: "INVALID_TRANSITION", status: latest.status } : { ok: false, reason: "NOT_FOUND" };
    }
    return { ok: true, event: { ...current, ...data } };
  });
}
