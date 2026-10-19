import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/events/[id]/requests/route";
import { DELETE, POST } from "@/app/api/requests/[id]/vote/route";
import { createPrismaClient } from "@/lib/db-client";
import { generateEventCode } from "@/lib/event-code";

const prisma = createPrismaClient();

const GUEST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function voteRequest(method: "POST" | "DELETE", id: string, options: { guestId?: string | null; contentType?: string | null } = {}) {
  const { guestId = GUEST_B, contentType = "application/json" } = options;
  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  if (guestId) headers.cookie = `guestId=${guestId}`;
  const request = new Request(`http://localhost/api/requests/${id}/vote`, { method, headers });
  const ctx = { params: Promise.resolve({ id }) };
  return method === "POST" ? POST(request, ctx) : DELETE(request, ctx);
}

function getList(code: string, guestId: string | null = GUEST_A) {
  const headers: Record<string, string> = guestId ? { cookie: `guestId=${guestId}` } : {};
  return GET(new Request(`http://localhost/api/events/${code}/requests`, { headers }), { params: Promise.resolve({ id: code }) });
}

async function createEvent(overrides: { status?: "DRAFT" | "LIVE" | "CLOSED"; requestsOpen?: boolean } = {}) {
  const dj = await prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ" } });
  return prisma.event.create({ data: { djId: dj.id, name: "Wesele", code: generateEventCode(), status: "LIVE", ...overrides } });
}

let seq = 0;
async function createRequest(eventId: string, status: "PENDING" | "ACCEPTED" | "REJECTED" | "PLAYED" = "PENDING", by = GUEST_A) {
  seq += 1;
  return prisma.request.create({
    data: {
      eventId,
      trackId: `t${seq}`,
      title: `Utwór ${seq}`,
      artist: "Sanah",
      status,
      createdByGuestId: by,
      playedAt: status === "PLAYED" ? new Date() : null,
      votes: { create: { guestId: by } },
    },
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST / DELETE /api/requests/[id]/vote", () => {
  it("likes and unlikes; a second like changes nothing", async () => {
    const event = await createEvent();
    const request = await createRequest(event.id);

    const liked = await voteRequest("POST", request.id);
    expect(liked.status).toBe(200);
    expect(await liked.json()).toEqual({ votes: 2, votedByMe: true });

    const again = await voteRequest("POST", request.id);
    expect(await again.json()).toEqual({ votes: 2, votedByMe: true });
    expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(2);

    const unliked = await voteRequest("DELETE", request.id);
    expect(unliked.status).toBe(200);
    expect(await unliked.json()).toEqual({ votes: 1, votedByMe: false });
  });

  it("works with requests closed, but not in a CLOSED event (403, Polish message)", async () => {
    const paused = await createEvent({ requestsOpen: false });
    const request = await createRequest(paused.id);
    expect((await voteRequest("POST", request.id)).status).toBe(200);

    await prisma.event.update({ where: { id: paused.id }, data: { status: "CLOSED" } });
    const refused = await voteRequest("DELETE", request.id);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "EVENT_NOT_LIVE", status: "CLOSED", message: "Impreza zakończona." });
    expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(2);
  });

  it("answers 404 for unknown, malformed and REJECTED requests alike", async () => {
    const event = await createEvent();
    const rejected = await createRequest(event.id, "REJECTED");
    for (const id of [rejected.id, "cnieistnieje000000000000", "../etc", "x".repeat(65)]) {
      const response = await voteRequest("POST", id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "NOT_FOUND", message: "Tego utworu nie ma już na liście." });
    }
    expect(await prisma.vote.count({ where: { requestId: rejected.id } })).toBe(1);
  });

  it("marks every answer, success or error, as private and not cacheable", async () => {
    const event = await createEvent();
    const request = await createRequest(event.id);
    const played = await createRequest(event.id, "PLAYED");
    const responses = [
      await voteRequest("POST", request.id),
      await voteRequest("DELETE", request.id),
      await voteRequest("POST", "cnieistnieje000000000000"),
      await voteRequest("POST", played.id),
      await voteRequest("POST", request.id, { guestId: null }),
      await voteRequest("POST", request.id, { contentType: "text/plain" }),
    ];
    expect(responses.map((response) => response.status)).toEqual([200, 200, 404, 409, 401, 415]);
    for (const response of responses) expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("answers 409 for a played track", async () => {
    const event = await createEvent();
    const played = await createRequest(event.id, "PLAYED");
    expect((await voteRequest("POST", played.id)).status).toBe(409);
  });

  it("requires a valid guest cookie (401) and a JSON content type (415)", async () => {
    const event = await createEvent();
    const request = await createRequest(event.id);
    expect((await voteRequest("POST", request.id, { guestId: null })).status).toBe(401);
    expect((await voteRequest("POST", request.id, { guestId: "not-a-uuid" })).status).toBe(401);
    for (const contentType of [null, "text/plain", "application/x-www-form-urlencoded"]) {
      expect((await voteRequest("POST", request.id, { contentType })).status).toBe(415);
      expect((await voteRequest("DELETE", request.id, { contentType })).status).toBe(415);
    }
    expect(await prisma.vote.count({ where: { requestId: request.id } })).toBe(1);
  });
});

describe("GET /api/events/[code]/requests", () => {
  it("returns the sorted queue and played section for the guest, without REJECTED or guest ids", async () => {
    const event = await createEvent();
    const popular = await createRequest(event.id, "PENDING", GUEST_B);
    await prisma.vote.create({ data: { requestId: popular.id, guestId: GUEST_A } });
    const mine = await createRequest(event.id, "ACCEPTED", GUEST_A);
    await createRequest(event.id, "REJECTED", GUEST_A);
    const played = await createRequest(event.id, "PLAYED", GUEST_B);

    const response = await getList(event.code.toLowerCase());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.event).toEqual({ status: "LIVE", requestsOpen: true, listFull: false });
    expect(body.queue).toEqual([
      expect.objectContaining({ id: popular.id, votes: 2, votedByMe: true, mine: false, status: "PENDING" }),
      expect.objectContaining({ id: mine.id, votes: 1, votedByMe: true, mine: true, status: "ACCEPTED" }),
    ]);
    expect(body.played).toEqual([expect.objectContaining({ id: played.id, status: "PLAYED", votedByMe: false })]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(GUEST_A);
    expect(raw).not.toContain(GUEST_B);
    expect(raw).not.toContain("REJECTED");
    expect(raw).not.toContain("createdByGuestId");
  });

  it("works without a guest cookie (no per-guest flags) and answers 404 for unknown codes", async () => {
    const event = await createEvent();
    await createRequest(event.id);
    const body = await (await getList(event.code, null)).json();
    expect(body.queue[0]).toMatchObject({ votedByMe: false, mine: false });

    for (const code of ["ZZZZZZ", "nie-ma"]) {
      const response = await getList(code);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "NOT_FOUND", message: "Nie ma imprezy o takim kodzie." });
    }
  });
});
