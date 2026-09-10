'use strict';

const { isValidTxHash } = require('../utils/validate');
const { getTransactionByHash } = require('../services/TransactionService');
const { UpstreamError } = require('../utils/ethRpc');
const { transactionRequests } = require('../metrics');
const logger = require('../utils/logger');

// HTTP layer for transaction lookups: validate input, call the service, shape the
// response, and map errors to status codes. Mirrors controllers/Balance.js; no business
// logic lives here.

async function getTransaction(req, res) {
  const { hash } = req.params;

  if (!isValidTxHash(hash)) {
    transactionRequests.inc({ outcome: 'invalid' });
    return res.status(400).json({ error: 'invalid transaction hash' });
  }

  try {
    const transaction = await getTransactionByHash(hash);
    if (transaction === null) {
      // Well-formed hash, but no such transaction on chain (node returns null).
      transactionRequests.inc({ outcome: 'not_found' });
      return res.status(404).json({ error: 'transaction not found' });
    }
    transactionRequests.inc({ outcome: 'success' });
    // Returned as-is from the node (value/gas/etc. stay wei-hex); see TransactionService.
    return res.status(200).json({ transaction });
  } catch (err) {
    if (err instanceof UpstreamError) {
      transactionRequests.inc({ outcome: 'upstream_error' });
      logger.error({ err: err.message, status: err.status, hash }, 'transaction lookup failed');
      const clientStatus = err.status === 429 ? 429 : err.status === 504 ? 504 : 502;
      return res.status(clientStatus).json({ error: 'failed to fetch transaction' });
    }
    transactionRequests.inc({ outcome: 'error' });
    logger.error({ err: err.message, hash }, 'unexpected error in transaction lookup');
    return res.status(500).json({ error: 'internal error' });
  }
}

module.exports = { getTransaction };
