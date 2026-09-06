'use strict';

const express = require('express');
const { getBalance } = require('../controllers/Balance');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// requireAuth runs before the controller; it is a no-op unless a JWT secret is
// configured. Health/readiness/metrics live on other routers and stay unauthenticated.
router.get('/address/balance/:address', requireAuth, getBalance);

module.exports = router;
