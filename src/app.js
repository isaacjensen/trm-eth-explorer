'use strict';

const express = require('express');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const { register, httpRequestDuration } = require('./metrics');
const balanceRoute = require('./routes/balance');
const transactionRoute = require('./routes/transaction');
const healthRoute = require('./routes/health');

// App factory (no listen) so tests can drive it with supertest.
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(pinoHttp({ logger }));

  // Record request duration once the response finishes, labelled by route pattern.
  app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.baseUrl + req.route.path : req.path;
      end({ method: req.method, route, status: res.statusCode });
    });
    next();
  });

  app.use(healthRoute);
  app.use(balanceRoute);
  app.use(transactionRoute);

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  return app;
}

module.exports = { createApp };
