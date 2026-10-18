import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { generateUniqueEventCode } from "@/lib/event-code";
import { applyStatusAction, type EventStatus, type EventStatusAction } from "@/lib/event-status";
import type { CreateEventInput, UpdateEventInput } from "@/lib/event-validation";

const djEventSelect = {
  id: true,
  name: true,
  code: true,
  startsAt: true,
  status: true,
  requestsOpen: true,
  maxRequestsPerGuest: true,
  createdAt: true,
} as const;

export type DjEvent = Prisma.EventGetPayload<{ select: typeof djEventSelect }>;

export type StatusChangeResult =
  | { ok: true; event: DjEvent }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "INVALID_TRANSITION"; status: EventStatus };

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

/** Updates name and limit of the DJ's own event. Returns null when the event does not exist or is not theirs. */
export async function updateEvent(
  djId: string,
  eventId: string,
  input: UpdateEventInput,
  db: PrismaClient = prisma,
): Promise<DjEvent | null> {
  const { count } = await db.event.updateMany({
    where: { id: eventId, djId },
    data: { name: input.name, maxRequestsPerGuest: input.maxRequestsPerGuest },
  });
  return count === 0 ? null : findDjEvent(djId, eventId, db);
}

/** Starts or closes the DJ's own event, enforcing DRAFT → LIVE → CLOSED. */
export async function changeEventStatus(
  djId: string,
  eventId: string,
  action: EventStatusAction,
  db: PrismaClient = prisma,
): Promise<StatusChangeResult> {
  const event = await findDjEvent(djId, eventId, db);
  if (!event) return { ok: false, reason: "NOT_FOUND" };

  const next = applyStatusAction(event.status, action);
  if (!next.ok) return { ok: false, reason: "INVALID_TRANSITION", status: event.status };

  // Conditional on the status we validated against, so two concurrent clicks cannot both apply.
  const { count } = await db.event.updateMany({
    where: { id: eventId, djId, status: event.status },
    data: { status: next.status },
  });
  if (count === 0) {
    const current = await findDjEvent(djId, eventId, db);
    return current ? { ok: false, reason: "INVALID_TRANSITION", status: current.status } : { ok: false, reason: "NOT_FOUND" };
  }
  return { ok: true, event: { ...event, status: next.status } };
}
