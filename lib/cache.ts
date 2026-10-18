import { type Clock, systemClock } from "@/lib/clock";

/** Key-value cache with per-entry TTL. Async so an external store (e.g. Redis) can replace the in-memory one. */
export interface Cache<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T, ttlMs: number): Promise<void>;
}

type Entry<T> = { value: T; expiresAt: number };

/**
 * In-memory cache for a single server process. Expired entries are dropped on read;
 * when `maxEntries` is reached, expired entries are purged and then the oldest ones evicted.
 */
export class MemoryCache<T> implements Cache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly options: { clock?: Clock; maxEntries?: number } = {},
  ) {}

  private now(): number {
    return (this.options.clock ?? systemClock)();
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const maxEntries = this.options.maxEntries ?? 1000;
    this.entries.delete(key);
    if (this.entries.size >= maxEntries) this.evict(maxEntries - 1);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }

  private evict(targetSize: number): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    // Map iterates in insertion order, so the first keys are the oldest.
    for (const key of this.entries.keys()) {
      if (this.entries.size <= targetSize) break;
      this.entries.delete(key);
    }
  }
}
