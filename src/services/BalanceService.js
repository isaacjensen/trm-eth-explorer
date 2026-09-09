'use strict';

const { formatEther } = require('ethers');
const config = require('../config');
const { rpcCall, withRetry } = require('../utils/ethRpc');

// Domain service: turn an address into an ETH balance. Composes the JSON-RPC transport
// (utils/ethRpc) with the balance-specific method and formatting. `ethers` is used only
// for its well-tested wei->eth formatting (BigInt-safe), not for the network call.
// New chain stats (tx count, code, etc.) would each be a sibling service reusing the
// same transport.

async function getBalanceEth(address, opts = {}) {
  const retries = opts.retries ?? config.upstream.retries;
  const weiHex = await withRetry(() => rpcCall('eth_getBalance', [address, 'latest'], opts), retries);
  // weiHex is a hex string; BigInt + formatEther keeps full 18-decimal precision.
  return formatEther(BigInt(weiHex));
}

module.exports = { getBalanceEth };
