'use strict';

const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Route is labelled by the Express route pattern (e.g. /address/balance/:address),
// never the raw path, to keep metric cardinality bounded.
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const balanceRequests = new client.Counter({
  name: 'balance_requests_total',
  help: 'Balance lookups by outcome',
  labelNames: ['outcome'], // success | invalid | upstream_error | error
  registers: [register],
});

const authAttempts = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Authentication attempts by outcome (only counted when auth is enabled)',
  labelNames: ['outcome'], // ok | missing | invalid | forbidden
  registers: [register],
});

const cacheLookups = new client.Counter({
  name: 'balance_cache_lookups_total',
  help: 'In-process balance cache lookups by result (only counted when the cache is enabled)',
  labelNames: ['result'], // hit | miss
  registers: [register],
});

module.exports = { register, httpRequestDuration, balanceRequests, authAttempts, cacheLookups };
