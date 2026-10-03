import { config } from '../config';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

/**
 * Simple in-memory recap cache keyed by contentId + window.
 * Cache key: {contentId}:{windowStart}:{windowEnd}
 */
export class RecapCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;
  private maxEntries: number;

  constructor(ttlMs = config.cache.recapTtlMs, maxEntries = config.cache.maxEntries) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  private key(contentId: string, windowStartMs: number, windowEndMs: number): string {
    return `${contentId}:${windowStartMs}:${windowEndMs}`;
  }

  get(contentId: string, windowStartMs: number, windowEndMs: number): T | null {
    const k = this.key(contentId, windowStartMs, windowEndMs);
    const entry = this.store.get(k);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.store.delete(k);
      return null;
    }
    return entry.value;
  }

  set(contentId: string, windowStartMs: number, windowEndMs: number, value: T): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.store) {
        if (v.createdAt < oldestTime) {
          oldestTime = v.createdAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(this.key(contentId, windowStartMs, windowEndMs), {
      value,
      createdAt: Date.now()
    });
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
