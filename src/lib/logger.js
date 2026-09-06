'use strict';

const pino = require('pino');
const config = require('../config');

// Structured JSON logs to stdout — the right shape for container log collectors.
// Redact anything that could leak the Infura key or auth headers.
const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'infura.apiKey', 'infura.rpcUrl'],
    remove: true,
  },
});

module.exports = logger;
