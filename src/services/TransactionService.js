'use strict';

const config = require('../config');
const { rpcCall, withRetry } = require('../utils/ethRpc');

// Domain service: fetch a transaction by hash. Mirrors BalanceService — composes the
// shared JSON-RPC transport (utils/ethRpc) with the transaction-specific method, so it
// inherits the same timeout, retry, and error classification.
//
// Returns the transaction object exactly as the node reports it, or null when no such
// transaction exists (eth_getTransactionByHash returns result: null, which rpcCall passes
// straight through). We intentionally do NOT reshape or unit-convert fields (e.g. `value`
// stays wei-hex): for a forensics use case, faithful upstream data beats a lossy
// convenience transform. Compare BalanceService, where the spec's number contract forces
// one lossy cast at the HTTP boundary.

async function getTransactionByHash(hash, opts = {}) {
  const retries = opts.retries ?? config.upstream.retries;
  return withRetry(() => rpcCall('eth_getTransactionByHash', [hash], opts), retries);
}

module.exports = { getTransactionByHash };
