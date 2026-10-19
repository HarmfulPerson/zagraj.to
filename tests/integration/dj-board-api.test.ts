import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentDj } from "@/lib/auth";
import { createPrismaClient } from "@/lib/db-client";
import { generateEventCode } from "@/lib/event-code";

// The session cookie is not available outside a Next.js request; the route handlers only need the current DJ.
const auth = vi.hoisted(() => ({ currentDj: null as CurrentDj | null }));
vi.mock("@/lib/auth", () => ({ getCurrentDj: async () => auth.currentDj }));

const { GET: getBoard } = await import("@/app/api/events/[id]/board/route");
const { POST: postRequestsOpen } = await import("@/app/api/events/[id]/requests-open/route");
const { POST: postStatus } = await import("@/app/api/requests/[id]/status/route");

const prisma = createPrismaClient();

async function createDj(): Promise<CurrentDj> {
  const user = await prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ" } });
  return { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
}

async function setup(status: "DRAFT" | "LIVE" | "CLOSED" = "LIVE") {
  const owner = await createDj();
  const event = await prisma.event.create({ data: { djId: owner.id, name: "Wesele", code: generateEventCode(), status } });
  const request = await prisma.request.create({
    data: {
      eventId: event.id,
      trackId: "1",
      title: "Szampan",
      artist: "sanah",
      createdByGuestId: "g",
      votes: { create: [{ guestId: "g" }, { guestId: "h" }] },
    },
  });
  const rejected = await prisma.request.create({
    data: { eventId: event.id, trackId: "2", title: "Bitwa", artist: "X", status: "REJECTED", createdByGuestId: "g" },
  });
  auth.currentDj = owner;
  return { owner, event, request, rejected };
}

function json(body: unknown, contentType: string | null = "application/json") {
  const headers: Record<string, string> = contentType ? { "content-type": contentType } : {};
  return new Request("http://localhost/api", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const changeStatus = (id: string, body: unknown, contentType?: string | null) => postStatus(json(body, contentType), ctx(id));
const toggle = (id: string, body: unknown, contentType?: string | null) => postRequestsOpen(json(body, contentType), ctx(id));
const board = (id: string) => getBoard(new Request(`http://localhost/api/events/${id}/board`), ctx(id));

beforeEach(async () => {
  auth.currentDj = null;
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/requests/[id]/status", () => {
  it("marks a request as played (200) and returns the updated item", async () => {
    const { request } = await setup();
    const res = await changeStatus(request.id, { status: "PLAYED" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const { item } = await res.json();
    expect(item).toMatchObject({ id: request.id, status: "PLAYED", votes: 2 });
    expect(item.playedAt).toEqual(expect.any(String));
  });

  it("returns 404 for another DJ's request and changes nothing", async () => {
    const { request } = await setup();
    auth.currentDj = await createDj();
    const res = await changeStatus(request.id, { status: "PLAYED" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND" });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PENDING");

    expect((await changeStatus("does-not-exist", { status: "PLAYED" })).status).toBe(404);
    expect((await changeStatus("bad id!", { status: "PLAYED" })).status).toBe(404);
  });

  it("returns 401 without a session", async () => {
    const { request } = await setup();
    auth.currentDj = null;
    const res = await changeStatus(request.id, { status: "PLAYED" });
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("validates the body with zod (400) and requires JSON (415)", async () => {
    const { request } = await setup();
    const invalid = await changeStatus(request.id, { status: "DONE" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "VALIDATION", fieldErrors: { status: "Nieznany status." } });
    expect((await changeStatus(request.id, {})).status).toBe(400);
    expect((await changeStatus(request.id, "{oops")).status).toBe(400);

    for (const contentType of [null, "text/plain", "application/x-www-form-urlencoded"]) {
      const res = await changeStatus(request.id, { status: "PLAYED" }, contentType);
      expect(res.status).toBe(415);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    }
    expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("PENDING");
  });

  it("answers 409 for a disallowed change, with the current status and a Polish message", async () => {
    const { rejected } = await setup();
    const res = await changeStatus(rejected.id, { status: "PLAYED" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "INVALID_TRANSITION",
      status: "REJECTED",
      message: "Ten utwór ma już inny status. Tablica została odświeżona.",
    });
  });

  it("answers 409 when the event is not LIVE", async () => {
    const { request } = await setup("CLOSED");
    const res = await changeStatus(request.id, { status: "PLAYED" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "EVENT_NOT_LIVE", status: "CLOSED" });
  });
});

describe("POST /api/events/[id]/requests-open", () => {
  it("closes and reopens requests", async () => {
    const { event } = await setup();
    const closed = await toggle(event.id, { requestsOpen: false });
    expect(closed.status).toBe(200);
    expect(closed.headers.get("cache-control")).toBe("private, no-store");
    expect(await closed.json()).toEqual({ requestsOpen: false });
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).requestsOpen).toBe(false);

    expect(await (await toggle(event.id, { requestsOpen: true })).json()).toEqual({ requestsOpen: true });
  });

  it("returns 404 for another DJ's event, 401 without a session, 400/415 for bad input", async () => {
    const { event } = await setup();
    expect((await toggle(event.id, { requestsOpen: "no" })).status).toBe(400);
    expect((await toggle(event.id, { requestsOpen: false }, "text/plain")).status).toBe(415);

    auth.currentDj = await createDj();
    const res = await toggle(event.id, { requestsOpen: false });
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");

    auth.currentDj = null;
    expect((await toggle(event.id, { requestsOpen: false })).status).toBe(401);
    expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).requestsOpen).toBe(true);
  });
});

describe("GET /api/events/[id]/board", () => {
  it("returns every column, REJECTED included, with votes; never cached", async () => {
    const { event, request, rejected } = await setup();
    const res = await board(event.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.event).toEqual({ id: event.id, status: "LIVE", requestsOpen: true });
    expect(body.columns.PENDING).toEqual([expect.objectContaining({ id: request.id, votes: 2, title: "Szampan" })]);
    expect(body.columns.REJECTED).toEqual([expect.objectContaining({ id: rejected.id, votes: 0 })]);
    expect(body.columns.ACCEPTED).toEqual([]);
    expect(body.columns.PLAYED).toEqual([]);
    // Guests' ids are not part of the board.
    expect(JSON.stringify(body)).not.toContain("createdByGuestId");
  });

  it("returns 404 for another DJ's event and 401 without a session", async () => {
    const { event } = await setup();
    auth.currentDj = await createDj();
    expect((await board(event.id)).status).toBe(404);
    auth.currentDj = null;
    const res = await board(event.id);
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
