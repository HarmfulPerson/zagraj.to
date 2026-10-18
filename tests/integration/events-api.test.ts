import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentDj } from "@/lib/auth";
import { createPrismaClient } from "@/lib/db-client";

// The session cookie is not available outside a Next.js request; the route handlers only need the current DJ.
const auth = vi.hoisted(() => ({ currentDj: null as CurrentDj | null }));
vi.mock("@/lib/auth", () => ({ getCurrentDj: async () => auth.currentDj }));

const { GET: listEvents, POST: postEvent } = await import("@/app/api/events/route");
const { GET: getEvent, PATCH: patchEvent } = await import("@/app/api/events/[id]/route");
const { POST: postStatus } = await import("@/app/api/events/[id]/status/route");

const prisma = createPrismaClient();

async function loginAs(email: string): Promise<CurrentDj> {
  const user = await prisma.user.create({ data: { email, passwordHash: "x", displayName: email } });
  auth.currentDj = { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
  return auth.currentDj;
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/events", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function createAs(email: string, name = "Wesele") {
  await loginAs(email);
  const res = await postEvent(jsonRequest("POST", { name }));
  return (await res.json()).event as { id: string; code: string; status: string };
}

beforeEach(async () => {
  auth.currentDj = null;
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("returns 401 without a session", async () => {
    expect((await listEvents()).status).toBe(401);
    expect((await postEvent(jsonRequest("POST", { name: "X" }))).status).toBe(401);
    expect((await getEvent(new Request("http://localhost"), ctx("x"))).status).toBe(401);
    expect((await patchEvent(jsonRequest("PATCH", { name: "X", maxRequestsPerGuest: 3 }), ctx("x"))).status).toBe(401);
    expect((await postStatus(jsonRequest("POST", { action: "start" }), ctx("x"))).status).toBe(401);
  });
});

describe("POST /api/events", () => {
  it("creates a DRAFT event with defaults", async () => {
    await loginAs("a@example.com");
    const res = await postEvent(jsonRequest("POST", { name: "Wesele", startsAt: "2026-10-24" }));
    expect(res.status).toBe(201);
    const { event } = await res.json();
    expect(event).toMatchObject({ name: "Wesele", status: "DRAFT", maxRequestsPerGuest: 5, startsAt: "2026-10-24T00:00:00.000Z" });
    expect(event.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it("validates input with zod and returns field errors", async () => {
    await loginAs("a@example.com");
    const res = await postEvent(jsonRequest("POST", { name: "", maxRequestsPerGuest: 50 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "VALIDATION",
      fieldErrors: { name: "Podaj nazwę wydarzenia.", maxRequestsPerGuest: "Limit musi być liczbą całkowitą od 1 do 20." },
    });
    expect((await postEvent(jsonRequest("POST", "{not json"))).status).toBe(400);
    expect(await prisma.event.count()).toBe(0);
  });
});

describe("another DJ's event", () => {
  it("is 404 for GET, PATCH and status change, and stays unchanged", async () => {
    const event = await createAs("owner@example.com", "Moje");
    await loginAs("intruder@example.com");

    expect((await getEvent(new Request("http://localhost"), ctx(event.id))).status).toBe(404);

    const patch = await patchEvent(jsonRequest("PATCH", { name: "Hack", maxRequestsPerGuest: 20 }), ctx(event.id));
    expect(patch.status).toBe(404);
    expect(await patch.json()).toEqual({ error: "NOT_FOUND" });

    const status = await postStatus(jsonRequest("POST", { action: "start" }), ctx(event.id));
    expect(status.status).toBe(404);

    const { events } = await (await listEvents()).json();
    expect(events).toEqual([]);

    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored).toMatchObject({ name: "Moje", maxRequestsPerGuest: 5, status: "DRAFT" });
  });

  it("is indistinguishable from a missing event", async () => {
    await loginAs("a@example.com");
    expect((await getEvent(new Request("http://localhost"), ctx("does-not-exist"))).status).toBe(404);
    expect((await patchEvent(jsonRequest("PATCH", { name: "X", maxRequestsPerGuest: 3 }), ctx("x".repeat(500)))).status).toBe(404);
  });
});

describe("own event", () => {
  it("can be read, edited, started and closed, but not reopened", async () => {
    const event = await createAs("a@example.com");

    expect((await (await getEvent(new Request("http://localhost"), ctx(event.id))).json()).event.id).toBe(event.id);

    const patch = await patchEvent(jsonRequest("PATCH", { name: "Nowa nazwa", maxRequestsPerGuest: 10 }), ctx(event.id));
    expect(patch.status).toBe(200);
    expect((await patch.json()).event).toMatchObject({ name: "Nowa nazwa", maxRequestsPerGuest: 10 });

    const invalid = await patchEvent(jsonRequest("PATCH", { name: "OK", maxRequestsPerGuest: 0 }), ctx(event.id));
    expect(invalid.status).toBe(400);

    expect((await postStatus(jsonRequest("POST", { action: "reopen" }), ctx(event.id))).status).toBe(400);

    const start = await postStatus(jsonRequest("POST", { action: "start" }), ctx(event.id));
    expect((await start.json()).event.status).toBe("LIVE");
    const close = await postStatus(jsonRequest("POST", { action: "close" }), ctx(event.id));
    expect((await close.json()).event.status).toBe("CLOSED");

    const reopen = await postStatus(jsonRequest("POST", { action: "start" }), ctx(event.id));
    expect(reopen.status).toBe(409);
    expect(await reopen.json()).toEqual({ error: "INVALID_TRANSITION", status: "CLOSED" });
  });
});
