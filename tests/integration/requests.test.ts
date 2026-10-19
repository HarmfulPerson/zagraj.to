import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db-client";
import { generateEventCode } from "@/lib/event-code";
import {
  addRequest,
  countEventRequests,
  countGuestRequests,
  isEventListFull,
  listGuestRequests,
  trackInputSchema,
  type TrackInput,
} from "@/lib/requests";

const prisma = createPrismaClient();

const GUEST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const track = (id: string, extra: Partial<TrackInput> = {}): TrackInput =>
  trackInputSchema.parse({ id, title: `Utwór ${id}`, artist: "Sanah", coverUrl: null, durationSec: 200, ...extra });

async function createEvent(overrides: { status?: "DRAFT" | "LIVE" | "CLOSED"; requestsOpen?: boolean; maxRequestsPerGuest?: number } = {}) {
  const dj = await prisma.user.create({
    data: { email: `dj-${Math.random().toString(36).slice(2)}@example.com`, passwordHash: "x", displayName: "DJ" },
  });
  return prisma.event.create({
    data: { djId: dj.id, name: "Wesele", code: generateEventCode(), status: "LIVE", ...overrides },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("addRequest: new track", () => {
  it("creates a PENDING request with the creator's vote", async () => {
    const event = await createEvent();
    const result = await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);

    expect(result).toMatchObject({
      ok: true,
      outcome: "CREATED",
      usedRequests: 1,
      maxRequests: 5,
      request: { trackId: "101", title: "Utwór 101", artist: "Sanah", coverUrl: null, durationSec: 200, voteCount: 1 },
    });
    const stored = await prisma.request.findFirstOrThrow({ where: { eventId: event.id }, include: { votes: true } });
    expect(stored.status).toBe("PENDING");
    expect(stored.createdByGuestId).toBe(GUEST_A);
    expect(stored.votes.map((vote) => vote.guestId)).toEqual([GUEST_A]);
  });
});

describe("addRequest: track already on the list", () => {
  it("adds a vote instead of a duplicate request", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);
    const result = await addRequest({ code: event.code, guestId: GUEST_B, track: track("101", { title: "Inny tytuł" }) }, prisma);

    expect(result).toMatchObject({ ok: true, outcome: "VOTED", usedRequests: 0, request: { title: "Utwór 101", voteCount: 2 } });
    expect(await prisma.request.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.vote.count()).toBe(2);
  });

  it("does not vote twice for the same guest", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_B, track: track("101") }, prisma);

    for (const guestId of [GUEST_A, GUEST_B]) {
      const again = await addRequest({ code: event.code, guestId, track: track("101") }, prisma);
      expect(again).toMatchObject({ ok: true, outcome: "ALREADY_VOTED", request: { voteCount: 2 } });
    }
    expect(await prisma.vote.count()).toBe(2);
    expect(await prisma.request.count()).toBe(1);
  });

  it("keeps the same track separate between events", async () => {
    const first = await createEvent();
    const second = await createEvent();
    await addRequest({ code: first.code, guestId: GUEST_A, track: track("101") }, prisma);
    const result = await addRequest({ code: second.code, guestId: GUEST_A, track: track("101") }, prisma);
    expect(result).toMatchObject({ ok: true, outcome: "CREATED" });
  });
});

describe("addRequest: track the DJ rejected", () => {
  it("answers TRACK_UNAVAILABLE without a vote or a new request, for any guest", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 1 });
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);
    await prisma.request.updateMany({ where: { eventId: event.id }, data: { status: "REJECTED" } });

    for (const guestId of [GUEST_A, GUEST_B]) {
      expect(await addRequest({ code: event.code, guestId, track: track("101") }, prisma)).toEqual({
        ok: false,
        reason: "TRACK_UNAVAILABLE",
      });
    }
    expect(await prisma.request.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.vote.count()).toBe(1);
  });

  it("also when the rejected track is found only after a racing insert", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);
    await prisma.request.updateMany({ where: { eventId: event.id }, data: { status: "REJECTED" } });
    let hidden = false;
    const racingDb = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop !== "request") return Reflect.get(target, prop, receiver);
        return new Proxy(target.request, {
          get(requestDelegate, method, r) {
            if (method === "findUnique" && !hidden) {
              hidden = true;
              return async () => null;
            }
            return Reflect.get(requestDelegate, method, r);
          },
        });
      },
    }) as PrismaClient;
    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("101") }, racingDb)).toEqual({
      ok: false,
      reason: "TRACK_UNAVAILABLE",
    });
    expect(await prisma.vote.count()).toBe(1);
  });
});

describe("addRequest: track already played", () => {
  it("answers ALREADY_PLAYED without a vote, for the author and for other guests", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);
    await prisma.request.updateMany({ where: { eventId: event.id }, data: { status: "PLAYED", playedAt: new Date() } });

    for (const guestId of [GUEST_A, GUEST_B]) {
      expect(await addRequest({ code: event.code, guestId, track: track("101") }, prisma)).toEqual({ ok: false, reason: "ALREADY_PLAYED" });
    }
    expect(await prisma.request.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.vote.count()).toBe(1);
  });

  it("votes again once the DJ takes the track back from Zagrane", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);
    await prisma.request.updateMany({ where: { eventId: event.id }, data: { status: "PENDING", playedAt: null } });
    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("101") }, prisma)).toMatchObject({ ok: true, outcome: "VOTED" });
  });
});

describe("addRequest: maxRequestsPerGuest", () => {
  it("refuses a new track above the limit", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 2 });
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("1") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("2") }, prisma);
    const result = await addRequest({ code: event.code, guestId: GUEST_A, track: track("3") }, prisma);

    expect(result).toEqual({ ok: false, reason: "LIMIT_REACHED", maxRequests: 2 });
    expect(await prisma.request.count({ where: { eventId: event.id } })).toBe(2);
    // Other guests keep their own limit.
    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("3") }, prisma)).toMatchObject({ outcome: "CREATED" });
  });

  it("lets a guest at the limit still vote for tracks already on the list", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 1 });
    await addRequest({ code: event.code, guestId: GUEST_B, track: track("9") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("1") }, prisma);

    const vote = await addRequest({ code: event.code, guestId: GUEST_A, track: track("9") }, prisma);
    expect(vote).toMatchObject({ ok: true, outcome: "VOTED", usedRequests: 1 });
  });

  it("does not count votes on existing tracks towards the limit", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 1 });
    await addRequest({ code: event.code, guestId: GUEST_B, track: track("9") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("9") }, prisma);

    expect(await countGuestRequests(event.id, GUEST_A, prisma)).toBe(0);
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("1") }, prisma)).toMatchObject({ outcome: "CREATED" });
  });

  it("frees the slot of a rejected track, but not of accepted or played ones", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 3 });
    for (const id of ["1", "2", "3"]) await addRequest({ code: event.code, guestId: GUEST_A, track: track(id) }, prisma);
    await prisma.request.updateMany({ where: { trackId: "1" }, data: { status: "ACCEPTED" } });
    await prisma.request.updateMany({ where: { trackId: "2" }, data: { status: "PLAYED", playedAt: new Date() } });
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("4") }, prisma)).toEqual({
      ok: false,
      reason: "LIMIT_REACHED",
      maxRequests: 3,
    });

    await prisma.request.updateMany({ where: { trackId: "3" }, data: { status: "REJECTED" } });
    expect(await countGuestRequests(event.id, GUEST_A, prisma)).toBe(2);
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("4") }, prisma)).toMatchObject({
      ok: true,
      outcome: "CREATED",
      usedRequests: 3,
      maxRequests: 3,
    });
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("5") }, prisma)).toMatchObject({ reason: "LIMIT_REACHED" });
  });

  it("does not let parallel taps of one guest exceed the limit", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 2 });
    const results = await Promise.all(
      ["1", "2", "3", "4"].map((id) => addRequest({ code: event.code, guestId: GUEST_A, track: track(id) }, prisma)),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(await countGuestRequests(event.id, GUEST_A, prisma)).toBe(2);
  });
});

describe("addRequest: event state", () => {
  it.each(["DRAFT", "CLOSED"] as const)("refuses when the event is %s", async (status) => {
    const event = await createEvent({ status });
    const result = await addRequest({ code: event.code, guestId: GUEST_A, track: track("1") }, prisma);
    expect(result).toEqual({ ok: false, reason: "EVENT_NOT_LIVE", status });
    expect(await prisma.request.count()).toBe(0);
  });

  it("refuses when requests are closed, also for tracks already on the list", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("1") }, prisma);
    await prisma.event.update({ where: { id: event.id }, data: { requestsOpen: false } });

    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("2") }, prisma)).toEqual({ ok: false, reason: "REQUESTS_CLOSED" });
    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("1") }, prisma)).toEqual({ ok: false, reason: "REQUESTS_CLOSED" });
    expect(await prisma.vote.count()).toBe(1);
  });

  it("returns NOT_FOUND for an unknown code", async () => {
    expect(await addRequest({ code: "ZZZZZZ", guestId: GUEST_A, track: track("1") }, prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("addRequest: two guests adding the same track at once", () => {
  it("falls back to a vote when the insert hits the unique (eventId, trackId)", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("101") }, prisma);

    // Guest B's lookup ran before A's insert: it sees no request, then the insert collides.
    let hidden = false;
    const racingDb = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop !== "request") return Reflect.get(target, prop, receiver);
        return new Proxy(target.request, {
          get(requestDelegate, method, r) {
            if (method === "findUnique" && !hidden) {
              hidden = true;
              return async () => null;
            }
            return Reflect.get(requestDelegate, method, r);
          },
        });
      },
    }) as PrismaClient;

    const result = await addRequest({ code: event.code, guestId: GUEST_B, track: track("101") }, racingDb);
    expect(hidden).toBe(true);
    expect(result).toMatchObject({ ok: true, outcome: "VOTED", usedRequests: 0, request: { voteCount: 2 } });
    expect(await prisma.request.count()).toBe(1);
  });

  it("ends with one request and both votes when run concurrently", async () => {
    const event = await createEvent();
    const results = await Promise.all(
      [GUEST_A, GUEST_B].map((guestId) => addRequest({ code: event.code, guestId, track: track("101") }, prisma)),
    );
    expect(results.map((result) => (result.ok ? result.outcome : result.reason)).sort()).toEqual(["CREATED", "VOTED"]);
    expect(await prisma.request.count()).toBe(1);
    expect(await prisma.vote.count()).toBe(2);
  });
});

describe("listGuestRequests", () => {
  it("lists the guest's own tracks newest first, without rejected ones", async () => {
    const event = await createEvent();
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("1") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("2") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_A, track: track("3") }, prisma);
    await addRequest({ code: event.code, guestId: GUEST_B, track: track("4") }, prisma);
    for (const [trackId, minute] of [["1", 1], ["2", 2], ["3", 3]] as const) {
      await prisma.request.updateMany({ where: { trackId }, data: { createdAt: new Date(Date.UTC(2026, 9, 24, 20, minute)) } });
    }
    await prisma.request.updateMany({ where: { trackId: "2" }, data: { status: "REJECTED" } });

    const mine = await listGuestRequests(event.id, GUEST_A, prisma);
    expect(mine.map((request) => request.trackId)).toEqual(["3", "1"]);
    // Rejected tracks do not count towards the limit (the counter must not reveal a rejection).
    expect(await countGuestRequests(event.id, GUEST_A, prisma)).toBe(2);
  });
});

describe("addRequest: plan limit of requests per event (ticket 011)", () => {
  /** Fills the event with `count` requests from other guests, with the given status. */
  async function fill(eventId: string, count: number, status: "PENDING" | "ACCEPTED" | "PLAYED" | "REJECTED" = "PENDING", offset = 0) {
    await prisma.request.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        eventId,
        trackId: `seed-${status}-${offset + i}`,
        title: `Seed ${i}`,
        artist: "X",
        status,
        createdByGuestId: `guest-${offset + i}`,
      })),
    });
  }

  async function eventOf(plan: "FREE" | "PRO") {
    const event = await createEvent({ maxRequestsPerGuest: 20 });
    await prisma.user.update({ where: { id: event.djId }, data: { plan } });
    return event;
  }

  it("Free: the 100th track is accepted, the 101st gets LIST_FULL; votes on listed tracks still work", async () => {
    const event = await eventOf("FREE");
    await fill(event.id, 99);
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("100") }, prisma)).toMatchObject({ ok: true, outcome: "CREATED" });

    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("101") }, prisma)).toEqual({ ok: false, reason: "LIST_FULL" });
    expect(await prisma.request.count({ where: { eventId: event.id } })).toBe(100);

    // Adding a track that is already on the list is a vote, not a new request.
    expect(await addRequest({ code: event.code, guestId: GUEST_B, track: track("100") }, prisma)).toMatchObject({ ok: true, outcome: "VOTED" });
    expect(await isEventListFull({ id: event.id, dj: { plan: "FREE" } }, prisma)).toBe(true);
  });

  it("Free: PLAYED and ACCEPTED count, REJECTED frees its slot", async () => {
    const event = await eventOf("FREE");
    await fill(event.id, 50, "PLAYED");
    await fill(event.id, 49, "ACCEPTED");
    await fill(event.id, 10, "REJECTED");
    expect(await countEventRequests(event.id, prisma)).toBe(99);
    expect((await addRequest({ code: event.code, guestId: GUEST_A, track: track("a") }, prisma)).ok).toBe(true);
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("b") }, prisma)).toEqual({ ok: false, reason: "LIST_FULL" });

    await prisma.request.updateMany({ where: { eventId: event.id, trackId: "a" }, data: { status: "REJECTED" } });
    expect((await addRequest({ code: event.code, guestId: GUEST_A, track: track("b") }, prisma)).ok).toBe(true);
  });

  it("Free: two guests adding different tracks at the same moment cannot exceed 100", async () => {
    const event = await eventOf("FREE");
    await fill(event.id, 99);
    const results = await Promise.all([
      addRequest({ code: event.code, guestId: GUEST_A, track: track("x") }, prisma),
      addRequest({ code: event.code, guestId: GUEST_B, track: track("y") }, prisma),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.request.count({ where: { eventId: event.id } })).toBe(100);
  });

  it("Pro: no limit of requests per event", async () => {
    const event = await eventOf("PRO");
    await fill(event.id, 150);
    expect(await addRequest({ code: event.code, guestId: GUEST_A, track: track("151") }, prisma)).toMatchObject({ ok: true, outcome: "CREATED" });
    expect(await isEventListFull({ id: event.id, dj: { plan: "PRO" } }, prisma)).toBe(false);
  });
});
