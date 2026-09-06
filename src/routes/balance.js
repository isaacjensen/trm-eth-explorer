'use strict';

const express = require('express');
const { getBalance } = require('../controllers/Balance');

const router = express.Router();

router.get('/address/balance/:address', getBalance);

module.exports = router;
