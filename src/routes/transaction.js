'use strict';

const express = require('express');
const { getTransaction } = require('../controllers/Transaction');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Requires the transaction:read scope — a balance:read token is NOT sufficient.
// requireAuth is a no-op unless a JWT secret is configured.
router.get('/transaction/:hash', requireAuth('transaction:read'), getTransaction);

module.exports = router;
