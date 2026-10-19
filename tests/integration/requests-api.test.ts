import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/events/[id]/requests/route";
import { createPrismaClient } from "@/lib/db-client";
import { generateEventCode } from "@/lib/event-code";

const prisma = createPrismaClient();

const GUEST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const szampan = { id: "1234", title: "Szampan", artist: "sanah", coverUrl: "https://e-cdns-images.dzcdn.net/images/cover/x/250x250.jpg", durationSec: 200 };

function post(code: string, body: unknown, guestId: string | null = GUEST_A, contentType: string | null = "application/json") {
  const headers: Record<string, string> = contentType ? { "content-type": contentType } : {};
  if (guestId !== null) headers.cookie = `guestId=${guestId}`;
  const request = new Request(`http://localhost/api/events/${code}/requests`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id: code }) });
}

async function createEvent(overrides: { status?: "DRAFT" | "LIVE" | "CLOSED"; requestsOpen?: boolean; maxRequestsPerGuest?: number } = {}) {
  const dj = await prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ" } });
  return prisma.event.create({ data: { djId: dj.id, name: "Wesele", code: generateEventCode(), status: "LIVE", ...overrides } });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/events/[code]/requests", () => {
  it("creates a request (201), then votes (200) for another guest, without duplicates", async () => {
    const event = await createEvent();
    const created = await post(event.code, { track: szampan });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      outcome: "CREATED",
      usedRequests: 1,
      maxRequests: 5,
      request: { trackId: "1234", title: "Szampan", artist: "sanah", coverUrl: szampan.coverUrl, durationSec: 200, voteCount: 1 },
    });
    // An existing guest keeps their cookie.
    expect(created.headers.get("set-cookie")).toBeNull();

    const voted = await post(event.code, { track: szampan }, GUEST_B);
    expect(voted.status).toBe(200);
    expect(await voted.json()).toMatchObject({ outcome: "VOTED", usedRequests: 0, request: { voteCount: 2 } });

    const again = await post(event.code, { track: szampan }, GUEST_B);
    expect((await again.json()).outcome).toBe("ALREADY_VOTED");
    expect(await prisma.request.count()).toBe(1);
  });

  it("accepts a lowercase code", async () => {
    const event = await createEvent();
    expect((await post(event.code.toLowerCase(), { track: szampan })).status).toBe(201);
  });

  it("returns 429 with a Polish message above the limit; voting still works", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 1 });
    await post(event.code, { track: { ...szampan, id: "1" } }, GUEST_B);
    await post(event.code, { track: { ...szampan, id: "2" } });

    const limited = await post(event.code, { track: { ...szampan, id: "3" } });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      error: "REQUEST_LIMIT",
      maxRequests: 1,
      message: "Wykorzystano limit życzeń (1) na tę imprezę. Możesz dalej dodawać głosy na utwory, które już są na liście.",
    });
    expect((await post(event.code, { track: { ...szampan, id: "1" } })).status).toBe(200);
  });

  it("returns 403 when the event is not LIVE or requests are closed", async () => {
    const draft = await createEvent({ status: "DRAFT" });
    const closed = await createEvent({ status: "CLOSED" });
    const paused = await createEvent({ requestsOpen: false });

    const draftRes = await post(draft.code, { track: szampan });
    expect(draftRes.status).toBe(403);
    expect(await draftRes.json()).toEqual({ error: "EVENT_NOT_LIVE", status: "DRAFT", message: "Impreza jeszcze się nie zaczęła." });

    const closedRes = await post(closed.code, { track: szampan });
    expect(closedRes.status).toBe(403);
    expect(await closedRes.json()).toEqual({ error: "EVENT_NOT_LIVE", status: "CLOSED", message: "Impreza zakończona." });

    const pausedRes = await post(paused.code, { track: szampan });
    expect(pausedRes.status).toBe(403);
    expect(await pausedRes.json()).toEqual({ error: "REQUESTS_CLOSED", message: "DJ chwilowo nie przyjmuje nowych życzeń." });
    expect(await prisma.request.count()).toBe(0);
  });

  it("returns 404 for an unknown or malformed code", async () => {
    for (const code of ["ZZZZZZ", "abc", "OOOOOO"]) {
      const res = await post(code, { track: szampan });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "NOT_FOUND", message: "Nie ma imprezy o takim kodzie." });
    }
  });

  it("validates the track with zod", async () => {
    const event = await createEvent();
    expect((await post(event.code, "{nope")).status).toBe(400);
    for (const track of [
      undefined,
      { ...szampan, id: "" },
      { ...szampan, id: "../etc" },
      { ...szampan, id: "1".repeat(33) },
      { ...szampan, title: "   " },
      { ...szampan, artist: "x".repeat(201) },
      { id: "1", title: "T" },
    ]) {
      const res = await post(event.code, { track });
      expect(res.status, JSON.stringify(track)).toBe(400);
      expect((await res.json()).error).toBe("VALIDATION");
    }
    expect(await prisma.request.count()).toBe(0);
  });

  it("drops a cover from a foreign host and a bogus duration instead of storing them", async () => {
    const event = await createEvent();
    const res = await post(event.code, {
      track: { ...szampan, title: "  Szampan  ", coverUrl: "https://evil.example/pixel.gif", durationSec: -5 },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).request).toMatchObject({ title: "Szampan", coverUrl: null, durationSec: null });
  });

  it("issues a guestId cookie when it is missing or invalid", async () => {
    const event = await createEvent();
    for (const guestId of [null, "not-a-uuid"]) {
      const res = await post(event.code, { track: { ...szampan, id: guestId ?? "x" } }, guestId);
      expect(res.status).toBe(201);
      const cookie = res.headers.get("set-cookie") ?? "";
      const issued = /guestId=([^;]+)/.exec(cookie)?.[1] ?? "";
      expect(issued).toMatch(UUID);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=lax/i);
      expect(cookie).toMatch(/Max-Age=2592000/);
      const stored = await prisma.request.findFirstOrThrow({ where: { trackId: guestId ?? "x" } });
      expect(stored.createdByGuestId).toBe(issued);
    }
  });

  it("answers 409 with a neutral message for a track the DJ rejected, without a vote", async () => {
    const event = await createEvent();
    await post(event.code, { track: szampan });
    await prisma.request.updateMany({ where: { eventId: event.id }, data: { status: "REJECTED" } });

    const res = await post(event.code, { track: szampan }, GUEST_B);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "TRACK_UNAVAILABLE", message: "Ten utwór nie może zostać dodany." });
    expect(await prisma.vote.count()).toBe(1);
  });

  it("answers 409 ALREADY_PLAYED for a track that was already played, without a vote (like the vote endpoint)", async () => {
    const event = await createEvent();
    await post(event.code, { track: szampan });
    await prisma.request.updateMany({ where: { eventId: event.id }, data: { status: "PLAYED", playedAt: new Date() } });

    const res = await post(event.code, { track: szampan }, GUEST_B);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ALREADY_PLAYED", message: "Ten utwór został już zagrany." });
    expect(await prisma.vote.count()).toBe(1);
    expect(await prisma.request.count()).toBe(1);
  });

  it("requires Content-Type: application/json (415), so cross-site forms cannot post", async () => {
    const event = await createEvent();
    for (const contentType of [null, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      const res = await post(event.code, JSON.stringify({ track: szampan }), GUEST_A, contentType);
      expect(res.status).toBe(415);
      expect(await res.json()).toEqual({ error: "UNSUPPORTED_MEDIA_TYPE" });
    }
    expect(await prisma.request.count()).toBe(0);
    expect((await post(event.code, { track: szampan }, GUEST_A, "application/json; charset=utf-8")).status).toBe(201);
  });
});

describe("POST /api/events/[code]/requests: list full (ticket 011)", () => {
  it("answers 409 LIST_FULL with a Polish message once a Free event holds 100 tracks; an existing track is still a vote", async () => {
    const event = await createEvent({ maxRequestsPerGuest: 20 });
    await prisma.request.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        eventId: event.id,
        trackId: `seed-${i}`,
        title: `Seed ${i}`,
        artist: "X",
        createdByGuestId: `guest-${i}`,
      })),
    });

    const full = await post(event.code, { track: szampan });
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({
      error: "LIST_FULL",
      message: "Lista jest pełna. DJ zebrał już maksymalną liczbę życzeń. Możesz dalej lajkować utwory, które są na liście.",
    });

    const vote = await post(event.code, { track: { ...szampan, id: "seed-7" } });
    expect(vote.status).toBe(200);
    expect((await vote.json()).outcome).toBe("VOTED");
  });
});
