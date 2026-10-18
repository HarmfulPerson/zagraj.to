/** A track as returned by a catalog search. `id` is the source's track id (Deezer for now). */
export type Track = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number | null;
};

/** A source of tracks. Deezer is the only implementation in the MVP; others can be added behind this interface. */
export interface TrackCatalog {
  search(query: string): Promise<Track[]>;
}

/** The catalog source failed (network error, timeout, bad status or unexpected response). */
export class CatalogError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CatalogError";
  }
}

/** Maximum number of tracks a search returns. */
export const MAX_SEARCH_RESULTS = 15;
