'use strict';

// Load .env for local dev only. In containers/k8s, env comes from the environment
// (ConfigMap/Secret), and a missing .env here is a harmless no-op.
require('dotenv').config();

const { createApp } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'server listening');
});

// Graceful shutdown so in-flight requests drain on pod termination (SIGTERM).
function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
  // Safety net if connections don't drain in time.
  setTimeout(() => {
    logger.error('forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
