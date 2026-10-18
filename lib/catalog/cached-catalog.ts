import type { Cache } from "@/lib/cache";
import type { Track, TrackCatalog } from "@/lib/catalog/types";

export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

/** Case- and whitespace-insensitive cache key, so "Sanah " and "sanah" share one entry. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Wraps a catalog with a cache of successful results. Failures are not cached. */
export class CachedCatalog implements TrackCatalog {
  constructor(
    private readonly inner: TrackCatalog,
    private readonly cache: Cache<Track[]>,
    private readonly ttlMs: number = SEARCH_CACHE_TTL_MS,
  ) {}

  async search(query: string): Promise<Track[]> {
    const key = normalizeSearchQuery(query);
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const tracks = await this.inner.search(query);
    await this.cache.set(key, tracks, this.ttlMs);
    return tracks;
  }
}
