type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const CACHE_STORE_KEY = '__itrobot_server_cache__';

function getStore() {
  const globalWithCache = globalThis as typeof globalThis & {
    [CACHE_STORE_KEY]?: Map<string, CacheEntry<unknown>>;
  };

  if (!globalWithCache[CACHE_STORE_KEY]) {
    globalWithCache[CACHE_STORE_KEY] = new Map<string, CacheEntry<unknown>>();
  }

  return globalWithCache[CACHE_STORE_KEY]!;
}

export async function getOrSetServerCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const store = getStore();
  const cached = store.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await loader();
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export function clearServerCache(prefix?: string) {
  const store = getStore();

  if (!prefix) {
    store.clear();
    return;
  }

  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
