import { type Clock, systemClock } from "@/lib/clock";

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

/** Counts hits per key. Async so an external store (e.g. Redis) can replace the in-memory one. */
export interface RateLimiter {
  hit(key: string): Promise<RateLimitResult>;
}

type Window = { startedAt: number; count: number };

/** Default cap on tracked keys, so clients rotating identifiers cannot grow memory without bound. */
export const DEFAULT_RATE_LIMIT_MAX_KEYS = 10_000;

/**
 * Fixed-window limiter kept in memory of a single server process:
 * at most `limit` hits per key in each `windowMs` window, counted from the key's first hit.
 * Tracks at most `maxKeys` keys; above that the least recently started windows are evicted.
 */
export class MemoryRateLimiter implements RateLimiter {
  // Insertion order = window start order (a restarted window is re-inserted), so the first entry is the oldest.
  private readonly windows = new Map<string, Window>();
  private readonly clock: Clock;
  private readonly maxKeys: number;
  private lastPurgeAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly options: { limit: number; windowMs: number; clock?: Clock; maxKeys?: number },
  ) {
    this.clock = options.clock ?? systemClock;
    this.maxKeys = Math.max(1, options.maxKeys ?? DEFAULT_RATE_LIMIT_MAX_KEYS);
  }

  async hit(key: string): Promise<RateLimitResult> {
    const now = this.clock();
    const { limit, windowMs } = this.options;
    let window = this.windows.get(key);
    if (!window || now - window.startedAt >= windowMs) {
      if (window) this.windows.delete(key);
      else this.makeRoom(now);
      window = { startedAt: now, count: 0 };
      this.windows.set(key, window);
    }
    if (window.count >= limit) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((window.startedAt + windowMs - now) / 1000)) };
    }
    window.count += 1;
    return { allowed: true, remaining: limit - window.count };
  }

  get size(): number {
    return this.windows.size;
  }

  /** Before adding a key: drop finished windows (at most once per window length) and evict the oldest when full. */
  private makeRoom(now: number): void {
    const { windowMs } = this.options;
    if (now - this.lastPurgeAt >= windowMs || this.windows.size >= this.maxKeys) {
      this.lastPurgeAt = now;
      // Oldest first: stop at the first window that is still running.
      for (const [key, window] of this.windows) {
        if (now - window.startedAt < windowMs) break;
        this.windows.delete(key);
      }
    }
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}
