// ─────────────────────────────────────────────────────────────────────────
//  Tiny request cache + in-flight de-duplication.
//  Goal: never hit the same GET endpoint more than ~once per minute, and
//  never fire two identical requests concurrently. This keeps the UI snappy
//  (switching lists/views re-reads the cache instantly) and avoids API spam.
// ─────────────────────────────────────────────────────────────────────────

interface Entry<T = unknown> {
  ts: number;
  value: T;
}

const DEFAULT_TTL = 60_000; // 1 minute

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** Synchronously read a still-fresh cached value, if any. */
export function peek<T>(key: string, ttl = DEFAULT_TTL): T | undefined {
  const hit = store.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.value as T;
  return undefined;
}

/**
 * Return cached value when fresh; otherwise run `fn` once (de-duping
 * concurrent callers) and cache the result.
 */
export function cachedFetch<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const fresh = peek<T>(key, ttl);
  if (fresh !== undefined) return Promise.resolve(fresh);

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = fn()
    .then((value) => {
      store.set(key, { ts: Date.now(), value });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, p);
  return p;
}

/** Drop every cached entry whose key starts with `prefix` (call after writes). */
export function invalidate(prefix: string) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function invalidateAll() {
  store.clear();
}
