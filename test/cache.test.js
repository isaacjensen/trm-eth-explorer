const { createCache } = require('../src/utils/cache');

describe('createCache', () => {
  test('returns a stored value before it expires', () => {
    const cache = createCache();
    cache.set('k', 'v', 1000);
    expect(cache.get('k')).toBe('v');
  });

  test('returns undefined for a missing key', () => {
    const cache = createCache();
    expect(cache.get('nope')).toBeUndefined();
  });

  test('expires an entry once its TTL passes', () => {
    jest.useFakeTimers();
    try {
      const cache = createCache();
      cache.set('k', 'v', 1000);
      jest.advanceTimersByTime(1001);
      expect(cache.get('k')).toBeUndefined();
      expect(cache.size()).toBe(0); // dropped lazily on read
    } finally {
      jest.useRealTimers();
    }
  });

  test('evicts the oldest entry when full', () => {
    const cache = createCache({ maxEntries: 2 });
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    cache.set('c', 3, 1000); // over capacity -> 'a' (oldest) is evicted
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size()).toBe(2);
  });

  test('overwriting a key does not evict another entry', () => {
    const cache = createCache({ maxEntries: 2 });
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    cache.set('a', 9, 1000); // same key, at capacity: no eviction
    expect(cache.get('a')).toBe(9);
    expect(cache.get('b')).toBe(2);
  });
});
