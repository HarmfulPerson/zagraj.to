import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db-client";

const prisma = createPrismaClient();

async function createEvent(code = "TEST23") {
  const dj = await prisma.user.create({
    data: { email: `dj-${code}@example.com`, passwordHash: "x", displayName: "DJ" },
  });
  return prisma.event.create({ data: { djId: dj.id, name: "Test", code } });
}

function trackData(eventId: string, trackId = "123") {
  return { eventId, trackId, title: "Song", artist: "Artist", createdByGuestId: "guest-a" };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("database constraints (test.db)", () => {
  it("runs against the separate test database", () => {
    expect(process.env.DATABASE_URL).toBe("file:./test.db");
  });

  it("applies defaults from the spec", async () => {
    const event = await createEvent();
    const dj = await prisma.user.findUniqueOrThrow({ where: { id: event.djId } });
    const request = await prisma.request.create({ data: trackData(event.id) });

    expect(dj.plan).toBe("FREE");
    expect(event.status).toBe("DRAFT");
    expect(event.requestsOpen).toBe(true);
    expect(event.maxRequestsPerGuest).toBe(5);
    expect(request.status).toBe("PENDING");
  });

  it("rejects a duplicate (eventId, trackId)", async () => {
    const event = await createEvent();
    await prisma.request.create({ data: trackData(event.id) });

    const error = await prisma.request.create({ data: trackData(event.id) }).catch((e: unknown) => e);
    expect(isUniqueViolation(error)).toBe(true);
    expect(await prisma.request.count()).toBe(1);
  });

  it("allows the same track in different events", async () => {
    const a = await createEvent("AAAAAA");
    const b = await createEvent("BBBBBB");
    await prisma.request.create({ data: trackData(a.id) });
    await prisma.request.create({ data: trackData(b.id) });
    expect(await prisma.request.count()).toBe(2);
  });

  it("rejects a duplicate (requestId, guestId) vote", async () => {
    const event = await createEvent();
    const request = await prisma.request.create({ data: trackData(event.id) });
    await prisma.vote.create({ data: { requestId: request.id, guestId: "guest-b" } });

    const error = await prisma.vote
      .create({ data: { requestId: request.id, guestId: "guest-b" } })
      .catch((e: unknown) => e);
    expect(isUniqueViolation(error)).toBe(true);

    await prisma.vote.create({ data: { requestId: request.id, guestId: "guest-c" } });
    expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(2);
  });

  it("rejects duplicate user email and event code", async () => {
    await createEvent("CCCCCC");
    const dupEmail = await prisma.user
      .create({ data: { email: "dj-CCCCCC@example.com", passwordHash: "x", displayName: "X" } })
      .catch((e: unknown) => e);
    expect(isUniqueViolation(dupEmail)).toBe(true);

    const other = await prisma.user.create({ data: { email: "other@example.com", passwordHash: "x", displayName: "O" } });
    const dupCode = await prisma.event
      .create({ data: { djId: other.id, name: "Dup", code: "CCCCCC" } })
      .catch((e: unknown) => e);
    expect(isUniqueViolation(dupCode)).toBe(true);
  });

  it("rejects status values outside the enum", async () => {
    const event = await createEvent();
    await expect(
      prisma.event.update({ where: { id: event.id }, data: { status: "PAUSED" as never } }),
    ).rejects.toThrow();
  });

  it("cascades deletes from user to events, requests and votes", async () => {
    const event = await createEvent();
    const request = await prisma.request.create({ data: trackData(event.id) });
    await prisma.vote.create({ data: { requestId: request.id, guestId: "guest-b" } });

    await prisma.user.delete({ where: { id: event.djId } });
    expect(await prisma.event.count()).toBe(0);
    expect(await prisma.request.count()).toBe(0);
    expect(await prisma.vote.count()).toBe(0);
  });
});
