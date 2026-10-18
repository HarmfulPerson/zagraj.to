import { z } from "zod";

import { CatalogError, MAX_SEARCH_RESULTS, type Track, type TrackCatalog } from "@/lib/catalog/types";

export const DEEZER_SEARCH_URL = "https://api.deezer.com/search";
export const DEEZER_TIMEOUT_MS = 5000;

const deezerTrackSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  duration: z.number().nullish(),
  artist: z.object({ name: z.string() }),
  album: z.object({ cover_medium: z.string().nullish() }).nullish(),
});

const deezerSearchSchema = z.object({ data: z.array(deezerTrackSchema) });

export type DeezerTrack = z.infer<typeof deezerTrackSchema>;

export function mapDeezerTrack(track: DeezerTrack): Track {
  return {
    id: String(track.id),
    title: track.title,
    artist: track.artist.name,
    coverUrl: track.album?.cover_medium || null,
    durationSec: typeof track.duration === "number" && track.duration > 0 ? track.duration : null,
  };
}

type DeezerOptions = { fetch?: typeof fetch; timeoutMs?: number; limit?: number };

/** Searches the public Deezer API (no key needed). Any failure is reported as `CatalogError`. */
export class DeezerCatalog implements TrackCatalog {
  constructor(private readonly options: DeezerOptions = {}) {}

  async search(query: string): Promise<Track[]> {
    const limit = this.options.limit ?? MAX_SEARCH_RESULTS;
    const timeoutMs = this.options.timeoutMs ?? DEEZER_TIMEOUT_MS;
    const doFetch = this.options.fetch ?? fetch;
    const url = `${DEEZER_SEARCH_URL}?${new URLSearchParams({ q: query, limit: String(limit) })}`;

    let body: unknown;
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
      if (!res.ok) throw new CatalogError(`Deezer responded with HTTP ${res.status}`);
      body = await res.json();
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new CatalogError(timedOut ? "Deezer request timed out" : "Deezer request failed", { cause: error });
    }

    // Deezer reports errors (e.g. quota exceeded) as HTTP 200 with `{ error: { ... } }`.
    const parsed = deezerSearchSchema.safeParse(body);
    if (!parsed.success) throw new CatalogError("Unexpected Deezer response", { cause: parsed.error });
    return parsed.data.data.slice(0, limit).map(mapDeezerTrack);
  }
}
