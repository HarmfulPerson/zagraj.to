import { describe, expect, it } from "vitest";

import { MemoryCache } from "@/lib/cache";

function fakeClock(start = 0) {
  const clock = { now: start, fn: () => clock.now };
  return clock;
}

describe("MemoryCache", () => {
  it("returns a stored value until its TTL passes", async () => {
    const clock = fakeClock();
    const cache = new MemoryCache<string>({ clock: clock.fn });
    await cache.set("a", "x", 1000);
    clock.now = 999;
    expect(await cache.get("a")).toBe("x");
    clock.now = 1000;
    expect(await cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts expired and then oldest entries when full", async () => {
    const clock = fakeClock();
    const cache = new MemoryCache<number>({ clock: clock.fn, maxEntries: 3 });
    await cache.set("short", 1, 10);
    await cache.set("b", 2, 1000);
    await cache.set("c", 3, 1000);
    clock.now = 20;
    await cache.set("d", 4, 1000);
    expect(await cache.get("short")).toBeUndefined();
    expect(await cache.get("b")).toBe(2);
    await cache.set("e", 5, 1000);
    expect(cache.size).toBe(3);
    expect(await cache.get("b")).toBeUndefined();
    expect(await cache.get("e")).toBe(5);
  });
});
