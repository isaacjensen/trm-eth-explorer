'use strict';

const { isValidAddress } = require('../lib/validate');
const { getBalanceEth } = require('../services/BalanceService');
const { UpstreamError } = require('../lib/ethRpc');
const { balanceRequests } = require('../metrics');
const logger = require('../lib/logger');

// HTTP layer for balance lookups: validate input, call the service, shape the response
// to the spec, and map errors to status codes. No business logic lives here.

async function getBalance(req, res) {
  const { address } = req.params;

  if (!isValidAddress(address)) {
    balanceRequests.inc({ outcome: 'invalid' });
    return res.status(400).json({ error: 'invalid ethereum address' });
  }

  try {
    const balance = await getBalanceEth(address);
    balanceRequests.inc({ outcome: 'success' });
    // Spec contract is { "balance": <number> }. Note: Number() can lose precision
    // for very large balances (beyond ~15 significant figures). Acceptable for the
    // MVP and documented in the README; a wei string field is the production fix.
    return res.status(200).json({ balance: Number(balance) });
  } catch (err) {
    if (err instanceof UpstreamError) {
      balanceRequests.inc({ outcome: 'upstream_error' });
      logger.error({ err: err.message, status: err.status, address }, 'balance lookup failed');
      const clientStatus = err.status === 429 ? 429 : err.status === 504 ? 504 : 502;
      return res.status(clientStatus).json({ error: 'failed to fetch balance' });
    }
    balanceRequests.inc({ outcome: 'error' });
    logger.error({ err: err.message, address }, 'unexpected error in balance lookup');
    return res.status(500).json({ error: 'internal error' });
  }
}

module.exports = { getBalance };
