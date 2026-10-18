import { createDefaultSearchDeps, createSearchHandler } from "@/lib/search";

/**
 * GET /api/search?q=...: up to 15 tracks from the catalog (Deezer).
 * 400 for a query outside 2–100 characters, 429 above 20 searches/minute per guest, 502 when Deezer fails.
 * Reads the request URL, headers and cookies, so it always runs at request time.
 */
export const GET = createSearchHandler(createDefaultSearchDeps());
