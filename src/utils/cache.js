'use strict';

// Tiny in-process TTL cache: key -> { value, expiresAt }. Bounded by maxEntries (the
// oldest inserted entry is evicted first) so memory can't grow without limit. Expired
// entries are dropped lazily on read.
//
// This is per-pod, not shared: every replica keeps its own cache, so the hit rate falls
// as the HPA scales replicas out. The production answer is a shared cache (Redis /
// ElastiCache); this is the cheap first step that removes duplicate upstream calls for a
// hot address within a short window on a single pod. The TTL is deliberately short: a
// balance can change every block (~12s), so a long TTL trades accuracy for hit rate,
// which matters for a forensics product.

function createCache({ maxEntries = 10000 } = {}) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key, value, ttlMs) {
    // Evict the oldest inserted entry when full (Map preserves insertion order).
    if (store.size >= maxEntries && !store.has(key)) {
      store.delete(store.keys().next().value);
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function clear() {
    store.clear();
  }

  return { get, set, clear, size: () => store.size };
}

module.exports = { createCache };
