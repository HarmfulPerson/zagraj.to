import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultSearchDeps, createSearchHandler, searchRateLimitKey } from "@/lib/search";

const deezerBody = (count: number) => ({
  data: Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Utwór ${i + 1}`,
    duration: 180,
    artist: { name: "Sanah" },
    album: { cover_medium: `https://cdn.example/${i + 1}.jpg` },
  })),
});

const GUEST_1 = "11111111-1111-4111-8111-111111111111";
const GUEST_2 = "22222222-2222-4222-8222-222222222222";

function searchRequest(q: string | null, headers: Record<string, string> = { cookie: `guestId=${GUEST_1}` }) {
  const url = new URL("http://localhost/api/search");
  if (q !== null) url.searchParams.set("q", q);
  return new Request(url, { headers });
}

let now: number;
let fetchMock: ReturnType<typeof vi.fn>;
let GET: (request: Request) => Promise<Response>;

beforeEach(() => {
  now = 0;
  fetchMock = vi.fn(async () => Response.json(deezerBody(20)));
  GET = createSearchHandler(createDefaultSearchDeps({ fetch: fetchMock as typeof fetch, clock: () => now }));
});

describe("GET /api/search", () => {
  it("returns up to 15 mapped tracks", async () => {
    const res = await GET(searchRequest("sanah"));
    expect(res.status).toBe(200);
    const { tracks } = await res.json();
    expect(tracks).toHaveLength(15);
    expect(tracks[0]).toEqual({ id: "1", title: "Utwór 1", artist: "Sanah", coverUrl: "https://cdn.example/1.jpg", durationSec: 180 });
  });

  it.each([
    [null, "Wpisz, czego szukasz."],
    ["a", "Wpisz co najmniej 2 znaki."],
    ["  a  ", "Wpisz co najmniej 2 znaki."],
    ["x".repeat(101), "Zapytanie może mieć najwyżej 100 znaków."],
  ])("rejects query %j with 400", async (q, message) => {
    const res = await GET(searchRequest(q));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "VALIDATION", fieldErrors: { q: message } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts 2 and 100 characters", async () => {
    expect((await GET(searchRequest("ab"))).status).toBe(200);
    expect((await GET(searchRequest("x".repeat(100)))).status).toBe(200);
  });

  it("caches identical queries for 5 minutes", async () => {
    await GET(searchRequest("sanah"));
    await GET(searchRequest("Sanah"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now = 5 * 60 * 1000;
    await GET(searchRequest("sanah"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("allows 20 searches per minute per guest, then returns 429 in Polish", async () => {
    for (let i = 0; i < 20; i++) expect((await GET(searchRequest(`q${i}`))).status).toBe(200);
    now = 10_000;
    const res = await GET(searchRequest("sanah"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("50");
    expect(await res.json()).toEqual({ error: "RATE_LIMITED", message: "Za dużo wyszukiwań. Odczekaj chwilę i spróbuj ponownie." });
    // Another guest is not affected; the first one is unblocked after a minute.
    expect((await GET(searchRequest("sanah", { cookie: `guestId=${GUEST_2}` }))).status).toBe(200);
    now = 60_000;
    expect((await GET(searchRequest("sanah"))).status).toBe(200);
  });

  it("returns 502 without details when Deezer fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await GET(searchRequest("sanah"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({
      error: "CATALOG_UNAVAILABLE",
      message: "Wyszukiwarka utworów jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
    });
    expect(JSON.stringify(body)).not.toContain("fetch failed");
    // The failure is not cached.
    expect((await GET(searchRequest("sanah"))).status).toBe(200);
  });

  it("returns 502 when Deezer responds with an error status", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    expect((await GET(searchRequest("sanah"))).status).toBe(502);
  });
});

describe("app/api/search/route", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is wired to Deezer through the global fetch", async () => {
    const globalFetch = vi.fn(async () => Response.json(deezerBody(1)));
    vi.stubGlobal("fetch", globalFetch);
    const { GET: routeGet } = await import("@/app/api/search/route");
    const res = await routeGet(searchRequest("sanah"));
    expect(res.status).toBe(200);
    expect((await res.json()).tracks).toHaveLength(1);
    expect(String((globalFetch.mock.calls[0] as unknown[])[0])).toMatch(/^https:\/\/api\.deezer\.com\/search\?/);
  });
});

describe("searchRateLimitKey", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/api/search", { headers });

  it("prefers the guestId cookie", () => {
    expect(searchRateLimitKey(req({ cookie: `a=1; guestId=${GUEST_1}`, "x-forwarded-for": "1.2.3.4" }))).toBe(`guest:${GUEST_1}`);
  });

  it("ignores a guestId that is not a server-issued UUID", () => {
    expect(searchRateLimitKey(req({ cookie: "guestId=abc-123", "x-forwarded-for": "1.2.3.4" }))).toBe("ip:1.2.3.4");
    expect(searchRateLimitKey(req({ cookie: `guestId=${GUEST_1}x` }))).toBe("anonymous");
  });

  it("falls back to the client IP, then to a shared bucket", () => {
    expect(searchRateLimitKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("ip:1.2.3.4");
    expect(searchRateLimitKey(req({ "x-real-ip": "5.6.7.8" }))).toBe("ip:5.6.7.8");
    expect(searchRateLimitKey(req({ cookie: "guestId=" }))).toBe("anonymous");
    expect(searchRateLimitKey(req({}))).toBe("anonymous");
  });
});
