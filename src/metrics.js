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

module.exports = { register, httpRequestDuration, balanceRequests };
