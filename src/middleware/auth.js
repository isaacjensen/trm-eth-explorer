'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../lib/logger');
const { authAttempts } = require('../metrics');

// Bearer-JWT authentication for protected routes.
//
// Enforced only when a signing secret is configured (config.auth.jwtSecret); otherwise
// this is a no-op so local dev and tests run open. The MVP verifies an HS256 token
// against a shared secret; in production the same middleware would verify RS256 against
// the IdP's JWKS (public-key rotation, key caching) — only the verification inputs
// change. Health/readiness/metrics are never wrapped with this, since probes and
// scrapers can't present a token.

function unauthorized(req, res, outcome, reason) {
  authAttempts.inc({ outcome });
  logger.warn({ reason, path: req.path }, 'auth rejected');
  return res.status(401).json({ error: 'unauthorized' });
}

function requireAuth(req, res, next) {
  // Auth disabled (no secret configured) — pass through.
  if (!config.auth.jwtSecret) return next();

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return unauthorized(req, res, 'missing', 'missing or malformed bearer token');
  }

  try {
    const options = { algorithms: ['HS256'] };
    if (config.auth.jwtAudience) options.audience = config.auth.jwtAudience;
    if (config.auth.jwtIssuer) options.issuer = config.auth.jwtIssuer;

    // Throws on bad signature, expiry, or failed audience/issuer checks.
    req.auth = jwt.verify(token, config.auth.jwtSecret, options);
    authAttempts.inc({ outcome: 'ok' });
    return next();
  } catch (err) {
    return unauthorized(req, res, 'invalid', err.message);
  }
}

module.exports = { requireAuth };
