'use strict';

const express = require('express');
const { healthz, readyz } = require('../controllers/Health');

const router = express.Router();

router.get('/healthz', healthz);
router.get('/readyz', readyz);

module.exports = router;
