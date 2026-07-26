/**
 * Cache in memoria con TTL in secondi.
 * ttlSeconds <= 0 → non salvare (sempre fresco).
 */
const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlSeconds) {
  if (ttlSeconds <= 0) return;
  const expiresAt = Date.now() + ttlSeconds * 1000;
  store.set(key, { value, expiresAt });
}

export function cacheClear() {
  store.clear();
}

/** 1 giorno in secondi — lista Top 100. */
export const DAY_SECONDS = 24 * 60 * 60;

/** 7 giorni in secondi — lista Popolari. */
export const WEEK_SECONDS = 7 * 24 * 60 * 60;
