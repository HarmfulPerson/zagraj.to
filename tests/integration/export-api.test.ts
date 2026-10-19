import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentDj } from "@/lib/auth";
import { createPrismaClient } from "@/lib/db-client";
import { generateEventCode } from "@/lib/event-code";

// The session cookie is not available outside a Next.js request; the route handler only needs the current DJ.
const auth = vi.hoisted(() => ({ currentDj: null as CurrentDj | null }));
vi.mock("@/lib/auth", () => ({ getCurrentDj: async () => auth.currentDj }));

const { GET } = await import("@/app/api/events/[id]/export/route");

const prisma = createPrismaClient();

// Export is a Pro feature (ticket 011), so the event owner is PRO unless a test is about the Free plan.
async function createDj(plan: "FREE" | "PRO" = "PRO"): Promise<CurrentDj> {
  const user = await prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ", plan } });
  return { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 24, 19, minute));

async function setup(plan: "FREE" | "PRO" = "PRO") {
  const owner = await createDj(plan);
  const event = await prisma.event.create({
    data: { djId: owner.id, name: "Wesele Łucji", code: generateEventCode(), status: "LIVE", startsAt: new Date("2026-10-24T00:00:00Z") },
  });
  const add = (trackId: string, title: string, artist: string, status: "PENDING" | "ACCEPTED" | "PLAYED" | "REJECTED", votes: number, minute: number) =>
    prisma.request.create({
      data: {
        eventId: event.id,
        trackId,
        title,
        artist,
        status,
        createdByGuestId: "g",
        createdAt: at(minute),
        playedAt: status === "PLAYED" ? at(minute + 30) : null,
        votes: { create: Array.from({ length: votes }, (_, i) => ({ guestId: `guest-${i}` })) },
      },
    });
  await add("1", "Ona tańczy dla mnie", "Weekend", "PENDING", 1, 1);
  await add("2", 'Zażółć, "gęślą"', "Łzy", "PLAYED", 3, 2);
  await add("3", "=HYPERLINK(1)", "Kult", "ACCEPTED", 1, 3);
  await add("4", "Odrzucony", "X", "REJECTED", 5, 4);
  auth.currentDj = owner;
  return { owner, event };
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (id: string, search: string) => GET(new Request(`http://localhost/api/events/${id}/export?${search}`), ctx(id));

beforeEach(async () => {
  auth.currentDj = null;
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/events/[id]/export", () => {
  it("returns the CSV with BOM, Polish header, escaping and download headers; REJECTED left out by default", async () => {
    const { event } = await setup();
    const res = await get(event.id, "format=csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toBe(
      "attachment; filename=\"wesele-lucji-2026-10-24.csv\"; filename*=UTF-8''Wesele%20%C5%81ucji%202026-10-24.csv",
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text.slice(1).split("\r\n")).toEqual([
      "tytuł,artysta,status,głosy,dodano,zagrano",
      '"Zażółć, ""gęślą""",Łzy,Zagrane,3,2026-10-24 21:02,2026-10-24 21:32',
      "Ona tańczy dla mnie,Weekend,Nowe,1,2026-10-24 21:01,",
      "'=HYPERLINK(1),Kult,Zaakceptowane,1,2026-10-24 21:03,",
      "",
    ]);
  });

  it("returns the TXT list by votes with the status filter", async () => {
    const { event } = await setup();
    const res = await get(event.id, "format=txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain('filename="wesele-lucji-2026-10-24.txt"');
    expect(await res.text()).toBe('Łzy – Zażółć, "gęślą"\nWeekend – Ona tańczy dla mnie\nKult – =HYPERLINK(1)\n');

    const filtered = await get(event.id, "format=txt&status=REJECTED&status=PENDING");
    expect(await filtered.text()).toBe("X – Odrzucony\nWeekend – Ona tańczy dla mnie\n");
  });

  it("returns 404 for another DJ's event and for an unknown one", async () => {
    const { event } = await setup();
    // A Free DJ probing someone else's event still gets 404, never "upgrade to Pro".
    auth.currentDj = await createDj("FREE");
    const res = await get(event.id, "format=csv");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND" });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toBeNull();
    expect((await get("does-not-exist", "format=csv")).status).toBe(404);
  });

  it("refuses export for a Free DJ's own event with 403 PLAN_REQUIRED and a Polish message, in both formats", async () => {
    const { event } = await setup("FREE");
    for (const format of ["csv", "txt"]) {
      const res = await get(event.id, `format=${format}`);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        error: "PLAN_REQUIRED",
        message: "Eksport dostępny w planie Pro.",
        upgradeUrl: "/panel/subskrypcja",
      });
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("content-disposition")).toBeNull();
    }
  });

  it("returns 401 without a session", async () => {
    const { event } = await setup();
    auth.currentDj = null;
    const res = await get(event.id, "format=csv");
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("validates the query with zod (400)", async () => {
    const { event } = await setup();
    const noFormat = await get(event.id, "");
    expect(noFormat.status).toBe(400);
    expect(await noFormat.json()).toEqual({ error: "VALIDATION", fieldErrors: { format: "Wybierz format csv albo txt." } });
    const badStatus = await get(event.id, "format=csv&status=DONE");
    expect(badStatus.status).toBe(400);
    expect((await badStatus.json()).fieldErrors).toEqual({ status: "Nieznany status." });
  });

  it("uses the creation day when the event has no date", async () => {
    const { event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { startsAt: null, createdAt: new Date("2026-03-01T23:30:00Z") } });
    const res = await get(event.id, "format=csv");
    expect(res.headers.get("content-disposition")).toContain('filename="wesele-lucji-2026-03-02.csv"');
  });
});
