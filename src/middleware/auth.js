'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { authAttempts } = require('../metrics');

// Bearer-JWT authentication + scope authorization for protected routes.
//
// Enforced only when a signing secret is configured (config.auth.jwtSecret); otherwise
// this is a no-op so local dev and tests run open. The MVP verifies an HS256 token
// against a shared secret; in production the same middleware would verify RS256 against
// the IdP's JWKS (public-key rotation, key caching) — only the verification inputs
// change. Health/readiness/metrics are never wrapped with this, since probes and
// scrapers can't present a token.
//
// Two layers: authentication (valid signature/expiry) -> 401 on failure; authorization
// (token carries config.auth.requiredScope) -> 403 on failure.

// Accepts OAuth-style space-delimited `scope` strings or array `scope`/`scp` claims.
function extractScopes(payload) {
  const raw = payload.scope ?? payload.scp;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(' ').filter(Boolean);
}

function unauthorized(req, res, outcome, reason) {
  authAttempts.inc({ outcome });
  logger.warn({ reason, path: req.path }, 'auth rejected');
  return res.status(401).json({ error: 'unauthorized' });
}

function forbidden(req, res, reason) {
  authAttempts.inc({ outcome: 'forbidden' });
  logger.warn({ reason, path: req.path }, 'auth forbidden');
  return res.status(403).json({ error: 'insufficient_scope' });
}

function requireAuth(req, res, next) {
  // Auth disabled (no secret configured) — pass through.
  if (!config.auth.jwtSecret) return next();

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return unauthorized(req, res, 'missing', 'missing or malformed bearer token');
  }

  let claims;
  try {
    const options = { algorithms: ['HS256'] };
    if (config.auth.jwtAudience) options.audience = config.auth.jwtAudience;
    if (config.auth.jwtIssuer) options.issuer = config.auth.jwtIssuer;

    // Throws on bad signature, expiry, or failed audience/issuer checks.
    claims = jwt.verify(token, config.auth.jwtSecret, options);
  } catch (err) {
    return unauthorized(req, res, 'invalid', err.message);
  }

  // Authenticated. Now authorize: require the configured scope, if any.
  const required = config.auth.requiredScope;
  if (required && !extractScopes(claims).includes(required)) {
    return forbidden(req, res, `token missing required scope: ${required}`);
  }

  req.auth = claims;
  authAttempts.inc({ outcome: 'ok' });
  return next();
}

module.exports = { requireAuth };
