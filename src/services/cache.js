/**
 * Cache locale in memoria (e opzionalmente su disco).
 * Gestisce TTL in ore: se SHUFFLE_CACHE_HOURS=0 → nessuna cache / sempre fresco.
 * Implementazione completa nello STEP 3.
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

export function cacheSet(key, value, ttlHours) {
  if (ttlHours <= 0) return; // "Sempre" = niente cache
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
  store.set(key, { value, expiresAt });
}

export function cacheClear() {
  store.clear();
}
