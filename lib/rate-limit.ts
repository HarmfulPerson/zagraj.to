import { type Clock, systemClock } from "@/lib/clock";

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

/** Counts hits per key. Async so an external store (e.g. Redis) can replace the in-memory one. */
export interface RateLimiter {
  hit(key: string): Promise<RateLimitResult>;
}

type Window = { startedAt: number; count: number };

/**
 * Fixed-window limiter kept in memory of a single server process:
 * at most `limit` hits per key in each `windowMs` window, counted from the key's first hit.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly clock: Clock;

  constructor(
    private readonly options: { limit: number; windowMs: number; clock?: Clock },
  ) {
    this.clock = options.clock ?? systemClock;
  }

  async hit(key: string): Promise<RateLimitResult> {
    const now = this.clock();
    const { limit, windowMs } = this.options;
    let window = this.windows.get(key);
    if (!window || now - window.startedAt >= windowMs) {
      if (!window) this.purgeExpired(now);
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

  /** Drops finished windows so the map does not grow with every guest ever seen. */
  private purgeExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.options.windowMs) this.windows.delete(key);
    }
  }
}
