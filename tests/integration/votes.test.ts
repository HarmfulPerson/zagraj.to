import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/db-client";
import { generateEventCode } from "@/lib/event-code";
import { getGuestList } from "@/lib/guest-list";
import { castVote, removeVote } from "@/lib/votes";

const prisma = createPrismaClient();

const GUEST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GUEST_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Status = "PENDING" | "ACCEPTED" | "REJECTED" | "PLAYED";

async function createEvent(overrides: { status?: "DRAFT" | "LIVE" | "CLOSED"; requestsOpen?: boolean } = {}) {
  const dj = await prisma.user.create({
    data: { email: `dj-${Math.random().toString(36).slice(2)}@example.com`, passwordHash: "x", displayName: "DJ" },
  });
  return prisma.event.create({ data: { djId: dj.id, name: "Wesele", code: generateEventCode(), status: "LIVE", ...overrides } });
}

let trackSeq = 0;
async function createRequest(
  eventId: string,
  options: { status?: Status; by?: string; voters?: string[]; createdAt?: Date; playedAt?: Date } = {},
) {
  trackSeq += 1;
  const by = options.by ?? GUEST_A;
  const voters = options.voters ?? [by];
  return prisma.request.create({
    data: {
      eventId,
      trackId: `t${trackSeq}`,
      title: `Utwór ${trackSeq}`,
      artist: "Sanah",
      status: options.status ?? "PENDING",
      createdByGuestId: by,
      createdAt: options.createdAt,
      playedAt: options.playedAt,
      votes: { create: voters.map((guestId) => ({ guestId })) },
    },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("castVote / removeVote", () => {
  it("adds and removes the guest's vote", async () => {
    const event = await createEvent();
    const request = await createRequest(event.id);

    expect(await castVote(request.id, GUEST_B, prisma)).toEqual({ ok: true, votes: 2, votedByMe: true });
    expect(await removeVote(request.id, GUEST_B, prisma)).toEqual({ ok: true, votes: 1, votedByMe: false });
    expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(1);
  });

  it("makes a double vote impossible (sequential and concurrent)", async () => {
    const event = await createEvent();
    const request = await createRequest(event.id, { voters: [] });

    await castVote(request.id, GUEST_B, prisma);
    expect(await castVote(request.id, GUEST_B, prisma)).toEqual({ ok: true, votes: 1, votedByMe: true });

    const results = await Promise.all(Array.from({ length: 6 }, () => castVote(request.id, GUEST_C, prisma)));
    expect(results.every((result) => result.ok && result.votedByMe)).toBe(true);
    expect(await prisma.vote.count({ where: { requestId: request.id, guestId: GUEST_C } })).toBe(1);
    expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(2);

    // The database itself refuses a duplicate (requestId, guestId).
    await expect(prisma.vote.create({ data: { requestId: request.id, guestId: GUEST_C } })).rejects.toThrow();
  });

  it("removing a vote that is not there changes nothing", async () => {
    const event = await createEvent();
    const request = await createRequest(event.id);
    expect(await removeVote(request.id, GUEST_B, prisma)).toEqual({ ok: true, votes: 1, votedByMe: false });
  });

  it("works while requests are closed", async () => {
    const event = await createEvent({ requestsOpen: false });
    const request = await createRequest(event.id);
    expect(await castVote(request.id, GUEST_B, prisma)).toMatchObject({ ok: true, votes: 2 });
    expect(await removeVote(request.id, GUEST_B, prisma)).toMatchObject({ ok: true, votes: 1 });
  });

  it("is refused once the event is CLOSED (and in DRAFT), without touching votes", async () => {
    for (const status of ["CLOSED", "DRAFT"] as const) {
      const event = await createEvent({ status });
      const request = await createRequest(event.id, { voters: [GUEST_B] });
      expect(await castVote(request.id, GUEST_C, prisma)).toEqual({ ok: false, reason: "EVENT_NOT_LIVE", status });
      expect(await removeVote(request.id, GUEST_B, prisma)).toEqual({ ok: false, reason: "EVENT_NOT_LIVE", status });
      expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(1);
    }
  });

  it("treats a REJECTED request like a missing one", async () => {
    const event = await createEvent();
    const rejected = await createRequest(event.id, { status: "REJECTED" });
    expect(await castVote(rejected.id, GUEST_B, prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await removeVote(rejected.id, GUEST_A, prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await castVote("nie-ma-takiego", GUEST_B, prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await prisma.vote.count({ where: { requestId: rejected.id } })).toBe(1);
  });

  it("allows voting on ACCEPTED, not on PLAYED", async () => {
    const event = await createEvent();
    const accepted = await createRequest(event.id, { status: "ACCEPTED" });
    const played = await createRequest(event.id, { status: "PLAYED", playedAt: new Date() });
    expect(await castVote(accepted.id, GUEST_B, prisma)).toMatchObject({ ok: true, votes: 2 });
    expect(await castVote(played.id, GUEST_B, prisma)).toEqual({ ok: false, reason: "ALREADY_PLAYED" });
  });
});

describe("getGuestList", () => {
  it("returns the queue by votes, played separately, never REJECTED, with per-guest flags", async () => {
    const event = await createEvent();
    const t0 = Date.UTC(2026, 5, 1, 20);
    const minute = (m: number) => new Date(t0 + m * 60_000);
    const one = await createRequest(event.id, { by: GUEST_B, voters: [GUEST_B], createdAt: minute(1) });
    const three = await createRequest(event.id, { by: GUEST_A, voters: [GUEST_A, GUEST_B, GUEST_C], createdAt: minute(5) });
    const twoOld = await createRequest(event.id, { by: GUEST_C, voters: [GUEST_C, GUEST_A], createdAt: minute(2), status: "ACCEPTED" });
    const twoNew = await createRequest(event.id, { by: GUEST_B, voters: [GUEST_B, GUEST_C], createdAt: minute(3) });
    await createRequest(event.id, { status: "REJECTED", voters: [GUEST_A, GUEST_B, GUEST_C], by: GUEST_A });
    const playedOld = await createRequest(event.id, { status: "PLAYED", playedAt: minute(10) });
    const playedNew = await createRequest(event.id, { status: "PLAYED", playedAt: minute(20) });

    const list = await getGuestList(event.code, GUEST_A, prisma);
    expect(list?.event).toEqual({ status: "LIVE", requestsOpen: true, listFull: false });
    expect(list?.queue.map((item) => item.id)).toEqual([three.id, twoOld.id, twoNew.id, one.id]);
    expect(list?.queue.map((item) => item.votes)).toEqual([3, 2, 2, 1]);
    expect(list?.queue.map((item) => item.votedByMe)).toEqual([true, true, false, false]);
    expect(list?.queue.map((item) => item.mine)).toEqual([true, false, false, false]);
    expect(list?.queue[1].status).toBe("ACCEPTED");
    expect(list?.played.map((item) => item.id)).toEqual([playedNew.id, playedOld.id]);
    expect(JSON.stringify(list)).not.toMatch(/REJECTED|bbbbbbbb|cccccccc|aaaaaaaa/);
  });

  it("caps the played section at the last 20", async () => {
    const event = await createEvent();
    for (let i = 0; i < 22; i += 1) {
      await createRequest(event.id, { status: "PLAYED", playedAt: new Date(Date.UTC(2026, 5, 1, 20, i)) });
    }
    const list = await getGuestList(event.code, GUEST_A, prisma);
    expect(list?.played).toHaveLength(20);
    expect(list?.played[0].title).toBe(`Utwór ${trackSeq}`);
  });

  it("without a guest id, nothing is voted or mine; DRAFT/CLOSED give empty lists; unknown code null", async () => {
    const event = await createEvent();
    await createRequest(event.id);
    const anonymous = await getGuestList(event.code, null, prisma);
    expect(anonymous?.queue[0]).toMatchObject({ votedByMe: false, mine: false, votes: 1 });

    const closed = await createEvent({ status: "CLOSED", requestsOpen: false });
    await createRequest(closed.id);
    expect(await getGuestList(closed.code, GUEST_A, prisma)).toEqual({
      event: { status: "CLOSED", requestsOpen: false, listFull: false },
      queue: [],
      played: [],
    });
    expect(await getGuestList("ZZZZZZ", GUEST_A, prisma)).toBeNull();
  });
});

describe("getGuestList: listFull (ticket 011)", () => {
  async function fill(eventId: string, count: number) {
    await prisma.request.createMany({
      data: Array.from({ length: count }, (_, i) => ({ eventId, trackId: `seed-${i}`, title: `S${i}`, artist: "X", createdByGuestId: `g-${i}` })),
    });
  }

  it("is true for a Free event with 100 tracks, false with 99 and for Pro; liking still works when full", async () => {
    const event = await createEvent();
    await fill(event.id, 99);
    expect((await getGuestList(event.code, GUEST_A, prisma))?.event.listFull).toBe(false);

    await prisma.request.create({ data: { eventId: event.id, trackId: "last", title: "L", artist: "X", createdByGuestId: GUEST_B } });
    const full = await getGuestList(event.code, GUEST_A, prisma);
    expect(full?.event).toEqual({ status: "LIVE", requestsOpen: true, listFull: true });

    const request = await prisma.request.findFirstOrThrow({ where: { eventId: event.id, trackId: "last" } });
    expect(await castVote(request.id, GUEST_A, prisma)).toMatchObject({ ok: true });

    await prisma.user.update({ where: { id: event.djId }, data: { plan: "PRO" } });
    expect((await getGuestList(event.code, GUEST_A, prisma))?.event.listFull).toBe(false);
  });
});
