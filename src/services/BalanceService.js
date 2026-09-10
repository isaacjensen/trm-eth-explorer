'use strict';

const { formatEther } = require('ethers');
const config = require('../config');
const { rpcCall, withRetry } = require('../utils/ethRpc');
const { createCache } = require('../utils/cache');
const { cacheLookups } = require('../metrics');

// Domain service: turn an address into an ETH balance. Composes the JSON-RPC transport
// (utils/ethRpc) with the balance-specific method and formatting. `ethers` is used only
// for its well-tested wei->eth formatting (BigInt-safe), not for the network call.
// New chain stats (tx count, code, etc.) would each be a sibling service reusing the
// same transport.

// One cache per process, shared across requests. TTL is decided per call (see below), so
// this instance is just bounded storage.
const cache = createCache({ maxEntries: config.cache.maxEntries });

async function getBalanceEth(address, opts = {}) {
  const retries = opts.retries ?? config.upstream.retries;
  const ttlMs = opts.cacheTtlMs ?? config.cache.ttlMs;
  const cacheEnabled = ttlMs > 0;
  // Key on the lowercased address + block tag; 'latest' is the only tag today but keying
  // on it keeps the cache correct if other tags are ever added.
  const key = cacheEnabled ? `${address.toLowerCase()}:latest` : null;

  if (cacheEnabled) {
    const hit = cache.get(key);
    if (hit !== undefined) {
      cacheLookups.inc({ result: 'hit' });
      return hit;
    }
    cacheLookups.inc({ result: 'miss' });
  }

  const weiHex = await withRetry(() => rpcCall('eth_getBalance', [address, 'latest'], opts), retries);
  // weiHex is a hex string; BigInt + formatEther keeps full 18-decimal precision.
  const eth = formatEther(BigInt(weiHex));

  if (cacheEnabled) cache.set(key, eth, ttlMs);
  return eth;
}

module.exports = { getBalanceEth, _cache: cache };
