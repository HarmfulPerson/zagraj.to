import { z } from "zod";

import { validationError } from "@/lib/api-responses";
import { MemoryCache } from "@/lib/cache";
import { CachedCatalog } from "@/lib/catalog/cached-catalog";
import { DeezerCatalog } from "@/lib/catalog/deezer";
import { CatalogError, MAX_SEARCH_RESULTS, type Track, type TrackCatalog } from "@/lib/catalog/types";
import type { Clock } from "@/lib/clock";
import { GUEST_ID_COOKIE_NAME } from "@/lib/guest";
import { MemoryRateLimiter, type RateLimiter } from "@/lib/rate-limit";

export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 100;
export const SEARCH_RATE_LIMIT = 20;
export const SEARCH_RATE_WINDOW_MS = 60 * 1000;

export const RATE_LIMITED_MESSAGE = "Za dużo wyszukiwań. Odczekaj chwilę i spróbuj ponownie.";
export const CATALOG_UNAVAILABLE_MESSAGE = "Wyszukiwarka utworów jest chwilowo niedostępna. Spróbuj ponownie za chwilę.";

export const searchQuerySchema = z.object({
  q: z
    .string({ error: "Wpisz, czego szukasz." })
    .trim()
    .min(SEARCH_QUERY_MIN_LENGTH, { error: `Wpisz co najmniej ${SEARCH_QUERY_MIN_LENGTH} znaki.` })
    .max(SEARCH_QUERY_MAX_LENGTH, { error: `Zapytanie może mieć najwyżej ${SEARCH_QUERY_MAX_LENGTH} znaków.` }),
});

const MAX_KEY_LENGTH = 100;

/**
 * Identifies who is searching, for rate limiting: the guest id cookie when present,
 * otherwise the client IP (first `x-forwarded-for` entry), otherwise a shared "anonymous" bucket.
 */
export function searchRateLimitKey(request: Request): string {
  const guestId = readCookie(request.headers.get("cookie"), GUEST_ID_COOKIE_NAME);
  if (guestId) return `guest:${guestId.slice(0, MAX_KEY_LENGTH)}`;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  if (ip) return `ip:${ip.slice(0, MAX_KEY_LENGTH)}`;
  return "anonymous";
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw) || undefined;
    } catch {
      return raw || undefined;
    }
  }
  return undefined;
}

export type SearchDeps = { catalog: TrackCatalog; rateLimiter: RateLimiter };

/** Builds the GET /api/search handler; dependencies are injected so tests can control fetch and time. */
export function createSearchHandler({ catalog, rateLimiter }: SearchDeps) {
  return async function GET(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams;
    const parsed = searchQuerySchema.safeParse({ q: params.get("q") ?? undefined });
    if (!parsed.success) return validationError(parsed.error);

    const limit = await rateLimiter.hit(searchRateLimitKey(request));
    if (!limit.allowed) {
      return Response.json(
        { error: "RATE_LIMITED", message: RATE_LIMITED_MESSAGE },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }

    let tracks: Track[];
    try {
      tracks = await catalog.search(parsed.data.q);
    } catch (error) {
      if (!(error instanceof CatalogError)) console.error("Track search failed", error);
      return Response.json({ error: "CATALOG_UNAVAILABLE", message: CATALOG_UNAVAILABLE_MESSAGE }, { status: 502 });
    }
    return Response.json({ tracks: tracks.slice(0, MAX_SEARCH_RESULTS) });
  };
}

/** Production wiring: Deezer behind a 5-minute in-memory cache, 20 searches per minute per guest. */
export function createDefaultSearchDeps(options: { fetch?: typeof fetch; clock?: Clock } = {}): SearchDeps {
  return {
    catalog: new CachedCatalog(new DeezerCatalog({ fetch: options.fetch }), new MemoryCache<Track[]>({ clock: options.clock })),
    rateLimiter: new MemoryRateLimiter({ limit: SEARCH_RATE_LIMIT, windowMs: SEARCH_RATE_WINDOW_MS, clock: options.clock }),
  };
}
