import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db-client";
import { isValidEventCode } from "@/lib/event-code";
import { createEventSchema } from "@/lib/event-validation";
import { changeEventStatus, createEvent, findDjEvent, listDjEvents, updateEvent } from "@/lib/events";

const prisma = createPrismaClient();

async function createDj(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x", displayName: "DJ" } });
}

const input = (name: string, extra: Record<string, unknown> = {}) => createEventSchema.parse({ name, ...extra });

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createEvent", () => {
  it("creates a DRAFT event with a unique valid code and the given fields", async () => {
    const dj = await createDj("a@example.com");
    const event = await createEvent(dj.id, input("Wesele", { startsAt: "2026-10-24", maxRequestsPerGuest: 8 }), prisma);

    expect(event.status).toBe("DRAFT");
    expect(isValidEventCode(event.code)).toBe(true);
    expect(event.name).toBe("Wesele");
    expect(event.maxRequestsPerGuest).toBe(8);
    expect(event.startsAt?.toISOString()).toBe("2026-10-24T00:00:00.000Z");

    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.djId).toBe(dj.id);
  });

  it("gives every event a different code", async () => {
    const dj = await createDj("a@example.com");
    const events = await Promise.all(Array.from({ length: 20 }, (_, i) => createEvent(dj.id, input(`E${i}`), prisma)));
    expect(new Set(events.map((e) => e.code)).size).toBe(20);
  });
});

describe("listDjEvents", () => {
  it("returns only the DJ's own events, newest first", async () => {
    const a = await createDj("a@example.com");
    const b = await createDj("b@example.com");
    const first = await createEvent(a.id, input("Pierwsze"), prisma);
    await prisma.event.update({ where: { id: first.id }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
    await createEvent(b.id, input("Cudze"), prisma);
    const second = await createEvent(a.id, input("Drugie"), prisma);

    const list = await listDjEvents(a.id, prisma);
    expect(list.map((e) => e.id)).toEqual([second.id, first.id]);
    expect(list[0]).not.toHaveProperty("djId");
  });
});

describe("ownership", () => {
  it("hides, and refuses to change, another DJ's event", async () => {
    const owner = await createDj("owner@example.com");
    const intruder = await createDj("intruder@example.com");
    const event = await createEvent(owner.id, input("Moje"), prisma);

    expect(await findDjEvent(intruder.id, event.id, prisma)).toBeNull();
    expect(await updateEvent(intruder.id, event.id, { name: "Hack", maxRequestsPerGuest: 20 }, prisma)).toBeNull();
    expect(await changeEventStatus(intruder.id, event.id, "start", prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });

    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored).toMatchObject({ name: "Moje", maxRequestsPerGuest: 5, status: "DRAFT" });
  });
});

describe("updateEvent", () => {
  it("changes name and limit only", async () => {
    const dj = await createDj("a@example.com");
    const event = await createEvent(dj.id, input("Stara"), prisma);
    const updated = await updateEvent(dj.id, event.id, { name: "Nowa", maxRequestsPerGuest: 12 }, prisma);
    expect(updated).toMatchObject({ id: event.id, name: "Nowa", maxRequestsPerGuest: 12, code: event.code, status: "DRAFT" });
  });

  it("returns null for a missing event", async () => {
    const dj = await createDj("a@example.com");
    expect(await updateEvent(dj.id, "nope", { name: "X", maxRequestsPerGuest: 1 }, prisma)).toBeNull();
  });
});

describe("changeEventStatus", () => {
  it("goes DRAFT → LIVE → CLOSED and then refuses to reopen", async () => {
    const dj = await createDj("a@example.com");
    const event = await createEvent(dj.id, input("E"), prisma);

    expect(await changeEventStatus(dj.id, event.id, "close", prisma)).toEqual({
      ok: false,
      reason: "INVALID_TRANSITION",
      status: "DRAFT",
    });

    const started = await changeEventStatus(dj.id, event.id, "start", prisma);
    expect(started.ok && started.event.status).toBe("LIVE");

    const closed = await changeEventStatus(dj.id, event.id, "close", prisma);
    expect(closed.ok && closed.event.status).toBe("CLOSED");

    expect(await changeEventStatus(dj.id, event.id, "start", prisma)).toEqual({
      ok: false,
      reason: "INVALID_TRANSITION",
      status: "CLOSED",
    });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).status).toBe("CLOSED");
  });

  it("applies only one of two concurrent identical actions", async () => {
    const dj = await createDj("a@example.com");
    const event = await createEvent(dj.id, input("E"), prisma);
    const results = await Promise.all([
      changeEventStatus(dj.id, event.id, "start", prisma),
      changeEventStatus(dj.id, event.id, "start", prisma),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});
