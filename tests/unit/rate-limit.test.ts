import { describe, expect, it } from "vitest";

import { MemoryRateLimiter } from "@/lib/rate-limit";

describe("MemoryRateLimiter", () => {
  it("allows `limit` hits per window per key, then blocks with retry-after", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter({ limit: 3, windowMs: 60_000, clock: () => now });
    expect(await limiter.hit("a")).toEqual({ allowed: true, remaining: 2 });
    await limiter.hit("a");
    expect(await limiter.hit("a")).toEqual({ allowed: true, remaining: 0 });
    now = 15_000;
    expect(await limiter.hit("a")).toEqual({ allowed: false, retryAfterSec: 45 });
    // Other keys have their own budget.
    expect((await limiter.hit("b")).allowed).toBe(true);
    now = 60_000;
    expect(await limiter.hit("a")).toEqual({ allowed: true, remaining: 2 });
  });

  it("purges finished windows of other keys", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter({ limit: 1, windowMs: 1000, clock: () => now });
    await limiter.hit("a");
    await limiter.hit("b");
    now = 2000;
    await limiter.hit("c");
    expect(limiter.size).toBe(1);
  });
});
