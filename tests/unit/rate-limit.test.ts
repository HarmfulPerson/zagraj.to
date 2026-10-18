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

describe("MemoryRateLimiter key cap", () => {
  it("evicts the oldest windows once maxKeys keys are tracked", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter({ limit: 1, windowMs: 60_000, clock: () => now, maxKeys: 3 });
    for (const key of ["a", "b", "c"]) {
      await limiter.hit(key);
      now += 1;
    }
    expect(limiter.size).toBe(3);
    await limiter.hit("d");
    expect(limiter.size).toBe(3);
    // "a" was evicted, so it starts a fresh window; "c" is still blocked.
    expect((await limiter.hit("a")).allowed).toBe(true);
    expect((await limiter.hit("c")).allowed).toBe(false);
  });

  it("stays bounded when every hit uses a new key", async () => {
    const limiter = new MemoryRateLimiter({ limit: 20, windowMs: 60_000, clock: () => 0 });
    for (let i = 0; i < 12_000; i++) await limiter.hit(`guest:${i}`);
    expect(limiter.size).toBe(10_000);
  });

  it("restarting a window moves the key to the back of the eviction queue", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter({ limit: 1, windowMs: 1000, clock: () => now, maxKeys: 2 });
    await limiter.hit("a");
    now = 500;
    await limiter.hit("b");
    now = 1000;
    await limiter.hit("a"); // new window for "a", now newer than "b"
    now = 1200;
    await limiter.hit("c"); // full: evicts "b", whose window is still running but is now the oldest
    expect((await limiter.hit("a")).allowed).toBe(false);
    expect((await limiter.hit("b")).allowed).toBe(true);
  });
});
