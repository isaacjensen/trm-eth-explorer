'use strict';

// Central config, read once at startup. Fail fast on missing required values so a
// misconfigured pod crashes immediately (and is caught by CI/readiness) rather than
// serving broken responses.

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Env var ${name} must be an integer`);
  return parsed;
}

const network = process.env.INFURA_NETWORK || 'mainnet';
const apiKey = required('INFURA_API_KEY');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: intFromEnv('PORT', 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  infura: {
    network,
    apiKey, // secret — injected via env / k8s Secret, never committed or logged
    rpcUrl: `https://${network}.infura.io/v3/${apiKey}`,
  },
  upstream: {
    timeoutMs: intFromEnv('UPSTREAM_TIMEOUT_MS', 3000),
    retries: intFromEnv('UPSTREAM_RETRIES', 1),
  },
  auth: {
    // Bearer-JWT auth is enforced on the balance route ONLY when a signing secret is
    // set; unset (dev/test default) leaves the endpoint open so local runs and tests
    // aren't blocked. MVP verifies an HS256 token against this shared secret; in
    // production this would verify RS256 against the IdP's JWKS. The secret is a secret
    // — injected via env / k8s Secret, never committed or logged.
    jwtSecret: process.env.AUTH_JWT_SECRET || null,
    jwtAudience: process.env.AUTH_JWT_AUDIENCE || null,
    jwtIssuer: process.env.AUTH_JWT_ISSUER || null,
  },
};

module.exports = config;
