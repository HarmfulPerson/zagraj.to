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
    expect(await updateEvent(intruder.id, event.id, { name: "Hack", maxRequestsPerGuest: 20 }, prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
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
    expect(updated.ok).toBe(true);
    expect(updated.ok && updated.event).toMatchObject({ id: event.id, name: "Nowa", maxRequestsPerGuest: 12, code: event.code, status: "DRAFT" });
  });

  it("returns NOT_FOUND for a missing event", async () => {
    const dj = await createDj("a@example.com");
    expect(await updateEvent(dj.id, "nope", { name: "X", maxRequestsPerGuest: 1 }, prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
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

describe("changeEventStatus: plan limits (ticket 011)", () => {
  const OCT_19 = new Date("2026-10-19T18:00:00Z");

  async function createDjWithPlan(email: string, plan: "FREE" | "PRO") {
    return prisma.user.create({ data: { email, passwordHash: "x", displayName: "DJ", plan } });
  }

  it("stamps startedAt when an event goes DRAFT → LIVE (and keeps it when closing)", async () => {
    const dj = await createDj("a@example.com");
    const event = await createEvent(dj.id, input("E"), prisma);
    const started = await changeEventStatus(dj.id, event.id, "start", prisma, OCT_19);
    expect(started.ok && started.event.startedAt).toEqual(OCT_19);

    await changeEventStatus(dj.id, event.id, "close", prisma, new Date("2026-10-20T02:00:00Z"));
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).startedAt).toEqual(OCT_19);
  });

  it("Free: the second start in the same calendar month is refused and the event stays a DRAFT", async () => {
    const dj = await createDjWithPlan("free@example.com", "FREE");
    const first = await createEvent(dj.id, input("Pierwsze"), prisma);
    const second = await createEvent(dj.id, input("Drugie"), prisma);

    expect((await changeEventStatus(dj.id, first.id, "start", prisma, new Date("2026-10-02T19:00:00Z"))).ok).toBe(true);
    // Closing the first event does not give the start back.
    expect((await changeEventStatus(dj.id, first.id, "close", prisma, new Date("2026-10-03T02:00:00Z"))).ok).toBe(true);

    expect(await changeEventStatus(dj.id, second.id, "start", prisma, OCT_19)).toEqual({ ok: false, reason: "PLAN_LIMIT", limit: 1 });
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: second.id } });
    expect(stored).toMatchObject({ status: "DRAFT", startedAt: null });
  });

  it("Free: the limit resets at 00:00 Warsaw time on the 1st (23:00 UTC the day before in winter)", async () => {
    const dj = await createDjWithPlan("free@example.com", "FREE");
    const october = await createEvent(dj.id, input("Październik"), prisma);
    const next = await createEvent(dj.id, input("Listopad"), prisma);
    await changeEventStatus(dj.id, october.id, "start", prisma, new Date("2026-10-10T19:00:00Z"));

    // 31 Oct 23:59:59 Warsaw (UTC+1 after the DST change) is still October.
    expect(await changeEventStatus(dj.id, next.id, "start", prisma, new Date("2026-10-31T22:59:59Z"))).toMatchObject({
      ok: false,
      reason: "PLAN_LIMIT",
    });
    // 1 Nov 00:00 Warsaw = 31 Oct 23:00 UTC: a new month.
    const started = await changeEventStatus(dj.id, next.id, "start", prisma, new Date("2026-10-31T23:00:00Z"));
    expect(started.ok).toBe(true);
  });

  it("Free: an event started at 00:30 Warsaw on the 1st counts for the new month, not the old one", async () => {
    const dj = await createDjWithPlan("free@example.com", "FREE");
    const a = await createEvent(dj.id, input("A"), prisma);
    const b = await createEvent(dj.id, input("B"), prisma);
    // 1 Oct 00:30 Warsaw (UTC+2) = 30 Sep 22:30 UTC.
    await changeEventStatus(dj.id, a.id, "start", prisma, new Date("2026-09-30T22:30:00Z"));
    expect(await changeEventStatus(dj.id, b.id, "start", prisma, OCT_19)).toMatchObject({ ok: false, reason: "PLAN_LIMIT" });
  });

  it("Free: events started in a previous month, and other DJs' starts, do not count", async () => {
    const dj = await createDjWithPlan("free@example.com", "FREE");
    const other = await createDjWithPlan("other@example.com", "FREE");
    const old = await createEvent(dj.id, input("Wrzesień"), prisma);
    const otherEvent = await createEvent(other.id, input("Cudze"), prisma);
    const current = await createEvent(dj.id, input("Teraz"), prisma);
    // 30 Sep 23:30 Warsaw = 21:30 UTC: still September.
    await changeEventStatus(dj.id, old.id, "start", prisma, new Date("2026-09-30T21:30:00Z"));
    await changeEventStatus(other.id, otherEvent.id, "start", prisma, OCT_19);

    expect((await changeEventStatus(dj.id, current.id, "start", prisma, OCT_19)).ok).toBe(true);
  });

  it("Free: of two different events started at the same moment only one goes LIVE", async () => {
    const dj = await createDjWithPlan("free@example.com", "FREE");
    const a = await createEvent(dj.id, input("A"), prisma);
    const b = await createEvent(dj.id, input("B"), prisma);
    const results = await Promise.all([
      changeEventStatus(dj.id, a.id, "start", prisma, OCT_19),
      changeEventStatus(dj.id, b.id, "start", prisma, OCT_19),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "PLAN_LIMIT")).toHaveLength(1);
    expect(await prisma.event.count({ where: { djId: dj.id, status: "LIVE" } })).toBe(1);
  });

  it("Pro: starts any number of events in one month", async () => {
    const dj = await createDjWithPlan("pro@example.com", "PRO");
    for (let i = 0; i < 4; i++) {
      const event = await createEvent(dj.id, input(`E${i}`), prisma);
      expect((await changeEventStatus(dj.id, event.id, "start", prisma, OCT_19)).ok).toBe(true);
    }
  });
});

describe("updateEvent: poster text (Pro only)", () => {
  it("saves, keeps (when omitted) and clears the poster text for a Pro DJ", async () => {
    const dj = await prisma.user.create({ data: { email: "pro@example.com", passwordHash: "x", displayName: "DJ", plan: "PRO" } });
    const event = await createEvent(dj.id, input("E"), prisma);
    const saved = await updateEvent(dj.id, event.id, { name: "E", maxRequestsPerGuest: 5, posterText: "Najlepsza para!" }, prisma);
    expect(saved.ok && saved.event.posterText).toBe("Najlepsza para!");

    const kept = await updateEvent(dj.id, event.id, { name: "E2", maxRequestsPerGuest: 5 }, prisma);
    expect(kept.ok && kept.event).toMatchObject({ name: "E2", posterText: "Najlepsza para!" });

    const cleared = await updateEvent(dj.id, event.id, { name: "E2", maxRequestsPerGuest: 5, posterText: null }, prisma);
    expect(cleared.ok && cleared.event.posterText).toBeNull();
  });

  it("refuses a poster text from a Free DJ without changing anything; clearing is allowed", async () => {
    const dj = await createDj("free@example.com");
    const event = await createEvent(dj.id, input("Stara"), prisma);
    expect(await updateEvent(dj.id, event.id, { name: "Nowa", maxRequestsPerGuest: 5, posterText: "Hej" }, prisma)).toEqual({
      ok: false,
      reason: "PLAN_REQUIRED",
    });
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ name: "Stara", posterText: null });

    expect((await updateEvent(dj.id, event.id, { name: "Nowa", maxRequestsPerGuest: 5, posterText: null }, prisma)).ok).toBe(true);
  });

  it("answers NOT_FOUND (not PLAN_REQUIRED) for a Free DJ's poster text on someone else's event", async () => {
    const owner = await createDj("owner@example.com");
    const intruder = await createDj("intruder@example.com");
    const event = await createEvent(owner.id, input("Moje"), prisma);
    expect(await updateEvent(intruder.id, event.id, { name: "X", maxRequestsPerGuest: 5, posterText: "Hej" }, prisma)).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });
});
