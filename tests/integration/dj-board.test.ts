import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { changeRequestStatus, getDjBoard, setRequestsOpen } from "@/lib/dj-board";
import { generateEventCode } from "@/lib/event-code";
import type { RequestStatus } from "@/lib/request-status";

// Logs every SQL statement, so the board can be checked for N+1 queries.
const queries: string[] = [];
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./test.db" }),
  log: [{ emit: "event", level: "query" }],
});
prisma.$on("query", (event) => queries.push(event.query));

const NOW = new Date("2026-10-24T22:00:00.000Z");

async function createDj() {
  return prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ" } });
}

async function createEvent(djId: string, status: "DRAFT" | "LIVE" | "CLOSED" = "LIVE") {
  return prisma.event.create({ data: { djId, name: "Wesele", code: generateEventCode(), status } });
}

let seq = 0;
async function createRequest(eventId: string, status: RequestStatus = "PENDING", votes = 1) {
  seq += 1;
  return prisma.request.create({
    data: {
      eventId,
      trackId: `t${seq}`,
      title: `Utwór ${seq}`,
      artist: "Sanah",
      status,
      createdByGuestId: "guest",
      playedAt: status === "PLAYED" ? new Date("2026-10-24T21:00:00.000Z") : null,
      votes: { create: Array.from({ length: votes }, (_, i) => ({ guestId: `g${seq}-${i}` })) },
    },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("changeRequestStatus", () => {
  it("'Zagrane' sets playedAt; 'Cofnij do nowych' clears it", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    const request = await createRequest(event.id, "PENDING", 3);

    const played = await changeRequestStatus(dj.id, request.id, "PLAYED", prisma, () => NOW);
    expect(played).toEqual({ ok: true, item: expect.objectContaining({ id: request.id, status: "PLAYED", votes: 3, playedAt: NOW.toISOString() }) });
    expect(await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: "PLAYED", playedAt: NOW });

    const back = await changeRequestStatus(dj.id, request.id, "PENDING", prisma, () => NOW);
    expect(back).toMatchObject({ ok: true, item: { status: "PENDING", playedAt: null } });
    expect(await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: "PENDING", playedAt: null });
  });

  it("walks the allowed paths: PENDING → ACCEPTED → REJECTED → PENDING → REJECTED", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    const request = await createRequest(event.id);
    for (const to of ["ACCEPTED", "REJECTED", "PENDING", "REJECTED"] as const) {
      expect(await changeRequestStatus(dj.id, request.id, to, prisma)).toMatchObject({ ok: true, item: { status: to } });
    }
  });

  it("refuses a disallowed change and reports the current status, without writing", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    const played = await createRequest(event.id, "PLAYED");
    const rejected = await createRequest(event.id, "REJECTED");

    expect(await changeRequestStatus(dj.id, played.id, "ACCEPTED", prisma)).toEqual({ ok: false, reason: "INVALID_TRANSITION", status: "PLAYED" });
    expect(await changeRequestStatus(dj.id, played.id, "PLAYED", prisma)).toEqual({ ok: false, reason: "INVALID_TRANSITION", status: "PLAYED" });
    expect(await changeRequestStatus(dj.id, rejected.id, "PLAYED", prisma)).toEqual({ ok: false, reason: "INVALID_TRANSITION", status: "REJECTED" });
    expect((await prisma.request.findUniqueOrThrow({ where: { id: played.id } })).playedAt).toEqual(played.playedAt);
  });

  it("treats another DJ's request exactly like a missing one", async () => {
    const owner = await createDj();
    const intruder = await createDj();
    const event = await createEvent(owner.id);
    const request = await createRequest(event.id);

    expect(await changeRequestStatus(intruder.id, request.id, "PLAYED", prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await changeRequestStatus(intruder.id, "missing", "PLAYED", prisma)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PENDING");
  });

  it.each(["DRAFT", "CLOSED"] as const)("refuses changes while the event is %s", async (status) => {
    const dj = await createDj();
    const event = await createEvent(dj.id, status);
    const request = await createRequest(event.id);
    expect(await changeRequestStatus(dj.id, request.id, "PLAYED", prisma)).toEqual({ ok: false, reason: "EVENT_NOT_LIVE", eventStatus: status });
  });

  it("applies only one of two simultaneous identical actions", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    const request = await createRequest(event.id);
    const results = await Promise.all([
      changeRequestStatus(dj.id, request.id, "PLAYED", prisma),
      changeRequestStatus(dj.id, request.id, "PLAYED", prisma),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({ ok: false, reason: "INVALID_TRANSITION", status: "PLAYED" });
  });
});

describe("getDjBoard", () => {
  it("returns all statuses (REJECTED too) with vote counts, only for the owner", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    const pending = await createRequest(event.id, "PENDING", 2);
    const popular = await createRequest(event.id, "PENDING", 5);
    const accepted = await createRequest(event.id, "ACCEPTED", 1);
    const played = await createRequest(event.id, "PLAYED", 4);
    const rejected = await createRequest(event.id, "REJECTED", 9);
    await createRequest((await createEvent(dj.id)).id, "PENDING", 7); // another event of the same DJ

    const board = await getDjBoard(dj.id, event.id, prisma);
    expect(board?.event).toEqual({ id: event.id, status: "LIVE", requestsOpen: true });
    const summary = (status: RequestStatus) => board?.columns[status].map((item) => [item.id, item.votes]);
    expect(summary("PENDING")).toEqual([
      [popular.id, 5],
      [pending.id, 2],
    ]);
    expect(summary("ACCEPTED")).toEqual([[accepted.id, 1]]);
    expect(summary("PLAYED")).toEqual([[played.id, 4]]);
    expect(summary("REJECTED")).toEqual([[rejected.id, 9]]);

    expect(await getDjBoard((await createDj()).id, event.id, prisma)).toBeNull();
  });

  it("does not run a query per request (votes come from one aggregate)", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    const count = async () => {
      queries.length = 0;
      await getDjBoard(dj.id, event.id, prisma);
      return queries.length;
    };
    await createRequest(event.id, "PENDING", 2);
    const withOne = await count();
    for (let i = 0; i < 12; i++) await createRequest(event.id, i % 2 ? "ACCEPTED" : "REJECTED", i);
    expect(await count()).toBe(withOne);
    expect(withOne).toBeLessThanOrEqual(3);
  });
});

describe("setRequestsOpen", () => {
  it("toggles requestsOpen on the DJ's own event only", async () => {
    const dj = await createDj();
    const event = await createEvent(dj.id);
    expect(await setRequestsOpen(dj.id, event.id, false, prisma)).toEqual({ requestsOpen: false });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).requestsOpen).toBe(false);

    expect(await setRequestsOpen((await createDj()).id, event.id, true, prisma)).toBeNull();
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).requestsOpen).toBe(false);
  });
});
