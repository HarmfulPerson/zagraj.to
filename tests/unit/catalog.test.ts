import { describe, expect, it, vi } from "vitest";

import { MemoryCache } from "@/lib/cache";
import { CachedCatalog, normalizeSearchQuery } from "@/lib/catalog/cached-catalog";
import { DEEZER_SEARCH_URL, DeezerCatalog } from "@/lib/catalog/deezer";
import { CatalogError, type Track } from "@/lib/catalog/types";

const deezerTrack = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Utwór ${id}`,
  duration: 200,
  artist: { id: 1, name: "Sanah" },
  album: { id: 2, cover_medium: `https://cdn.example/${id}.jpg` },
  rank: 1,
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status });

describe("DeezerCatalog", () => {
  it("maps Deezer tracks to Track", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [deezerTrack(843473542, { title: "Szampan" }), deezerTrack(2, { album: { cover_medium: null }, duration: 0 })],
        total: 2,
      }),
    );
    const tracks = await new DeezerCatalog({ fetch: fetchMock }).search("sanah szampan");
    expect(tracks).toEqual<Track[]>([
      { id: "843473542", title: "Szampan", artist: "Sanah", coverUrl: "https://cdn.example/843473542.jpg", durationSec: 200 },
      { id: "2", title: "Utwór 2", artist: "Sanah", coverUrl: null, durationSec: null },
    ]);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(`${url.origin}${url.pathname}`).toBe(DEEZER_SEARCH_URL);
    expect(url.searchParams.get("q")).toBe("sanah szampan");
    expect(url.searchParams.get("limit")).toBe("15");
  });

  it("returns at most 15 tracks", async () => {
    const data = Array.from({ length: 25 }, (_, i) => deezerTrack(i + 1));
    const tracks = await new DeezerCatalog({ fetch: async () => jsonResponse({ data }) }).search("abc");
    expect(tracks).toHaveLength(15);
  });

  it.each([
    ["HTTP error", async () => jsonResponse({}, 500)],
    ["Deezer error body", async () => jsonResponse({ error: { type: "Exception", message: "Quota limit exceeded", code: 4 } })],
    ["invalid JSON", async () => new Response("<html>", { status: 200 })],
    ["network error", async () => Promise.reject(new TypeError("fetch failed"))],
  ])("throws CatalogError on %s", async (_, fetchImpl) => {
    await expect(new DeezerCatalog({ fetch: fetchImpl as typeof fetch }).search("abc")).rejects.toBeInstanceOf(CatalogError);
  });

  it("aborts after the timeout", async () => {
    const hangingFetch = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const error = await new DeezerCatalog({ fetch: hangingFetch as typeof fetch, timeoutMs: 20 }).search("abc").catch((e) => e);
    expect(error).toBeInstanceOf(CatalogError);
    expect(error.message).toBe("Deezer request timed out");
  });
});

describe("CachedCatalog", () => {
  const track: Track = { id: "1", title: "Szampan", artist: "Sanah", coverUrl: null, durationSec: 200 };

  it("serves identical queries from cache for 5 minutes", async () => {
    let now = 0;
    const inner = { search: vi.fn(async () => [track]) };
    const catalog = new CachedCatalog(inner, new MemoryCache<Track[]>({ clock: () => now }));
    expect(await catalog.search("sanah")).toEqual([track]);
    now = 5 * 60 * 1000 - 1;
    expect(await catalog.search("  Sanah ")).toEqual([track]);
    expect(inner.search).toHaveBeenCalledTimes(1);
    now = 5 * 60 * 1000;
    await catalog.search("sanah");
    expect(inner.search).toHaveBeenCalledTimes(2);
    await catalog.search("dawid");
    expect(inner.search).toHaveBeenCalledTimes(3);
  });

  it("does not cache failures", async () => {
    const inner = { search: vi.fn().mockRejectedValueOnce(new CatalogError("x")).mockResolvedValueOnce([track]) };
    const catalog = new CachedCatalog(inner, new MemoryCache<Track[]>());
    await expect(catalog.search("sanah")).rejects.toBeInstanceOf(CatalogError);
    expect(await catalog.search("sanah")).toEqual([track]);
  });

  it("normalizes queries", () => {
    expect(normalizeSearchQuery("  Sanah   Szampan ")).toBe("sanah szampan");
  });
});
