'use strict';

const config = require('../config');
const logger = require('./logger');

// JSON-RPC transport for the Ethereum node (Infura). Owns the timeout budget, retry
// policy, and error classification so every method built on top of it inherits the
// same failure handling. This layer knows nothing about any specific RPC method —
// method-specific logic lives in the services layer (e.g. BalanceService), which
// composes this transport. We call JSON-RPC directly (rather than via a full provider
// abstraction) so we own the failure modes explicitly — the interesting part of this
// service.

class UpstreamError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status; // suggested client-facing status
    this.retryable = retryable === true;
  }
}

// fetchImpl is injectable purely for testing; defaults to the Node 18+ global fetch.
async function rpcCall(method, params, opts = {}) {
  const {
    fetchImpl = fetch,
    url = config.infura.rpcUrl,
    timeoutMs = config.upstream.timeoutMs,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new UpstreamError('upstream rate limited', { status: 429, retryable: true });
    }
    if (res.status >= 500) {
      throw new UpstreamError(`upstream ${res.status}`, { status: 502, retryable: true });
    }
    if (!res.ok) {
      throw new UpstreamError(`upstream ${res.status}`, { status: 502, retryable: false });
    }

    const body = await res.json();
    if (body.error) {
      // JSON-RPC application-level error (e.g. bad params) — not worth retrying.
      throw new UpstreamError(`rpc error: ${body.error.message || 'unknown'}`, {
        status: 502,
        retryable: false,
      });
    }
    return body.result;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new UpstreamError('upstream timeout', { status: 504, retryable: true });
    }
    if (err instanceof UpstreamError) throw err;
    // Network-level failure (DNS, connection reset, etc.)
    throw new UpstreamError(`upstream network error: ${err.message}`, {
      status: 502,
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, retries) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!err.retryable || attempt === retries) break;
      const backoffMs = 150 * (attempt + 1);
      logger.warn({ attempt, backoffMs, err: err.message }, 'retrying upstream call');
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastErr;
}

module.exports = { rpcCall, withRetry, UpstreamError };
