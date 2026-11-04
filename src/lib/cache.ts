interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  __adminMemoryCache?: Map<string, CacheEntry<unknown>>;
};

if (!globalForCache.__adminMemoryCache) {
  globalForCache.__adminMemoryCache = new Map<string, CacheEntry<unknown>>();
}

const cache = globalForCache.__adminMemoryCache;

/**
 * Retrieves cached data or executes the fetcher function and caches the result.
 * @param key Unique cache key
 * @param ttlSeconds Cache duration in seconds
 * @param fetcher Async function returning fresh data
 */
export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const freshData = await fetcher();
  cache.set(key, {
    data: freshData,
    expiresAt: now + ttlSeconds * 1000,
  });

  return freshData;
}

/**
 * Invalidates cache entries by exact key or key prefix.
 * @param keyOrPrefix Key or prefix to invalidate. If omitted, all entries are purged.
 */
export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      cache.delete(key);
    }
  }
}

