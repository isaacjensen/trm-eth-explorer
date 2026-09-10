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
  cache: {
    // Short-TTL in-process cache of balances, to collapse repeat lookups of a hot address
    // into one upstream call. Off by default (0) so dev/test are deterministic; the Helm
    // chart enables it in staging/prod via CACHE_TTL_MS. Kept short on purpose: a balance
    // can change every block, so the TTL is the accuracy-vs-load knob.
    ttlMs: intFromEnv('CACHE_TTL_MS', 0),
    maxEntries: intFromEnv('CACHE_MAX_ENTRIES', 10000),
  },
  auth: {
    // Bearer-JWT auth on the balance route. In production the signing secret is REQUIRED
    // (see the fail-closed check below) so the deployed service can never run open. In
    // dev/test the endpoint is open when no secret is set, so local runs and tests aren't
    // blocked. MVP verifies an HS256 token against this shared secret; production would
    // verify RS256 against the IdP's JWKS. The secret is injected via env / k8s Secret,
    // never committed or logged.
    jwtSecret: process.env.AUTH_JWT_SECRET || null,
    jwtAudience: process.env.AUTH_JWT_AUDIENCE || null,
    jwtIssuer: process.env.AUTH_JWT_ISSUER || null,
    // Authorization: an authenticated token must carry this scope. Overridable to a
    // different scope name, but not disableable — always defaults to balance:read.
    requiredScope: process.env.AUTH_REQUIRED_SCOPE || 'balance:read',
  },
};

// Fail closed in production: refuse to boot without an auth secret, so a misconfigured
// deploy crashes loudly (caught by CI / CrashLoopBackoff) instead of silently serving
// the balance endpoint with authentication disabled. Dev/test (NODE_ENV != production)
// may run open for convenience.
if (config.env === 'production' && !config.auth.jwtSecret) {
  throw new Error('AUTH_JWT_SECRET is required when NODE_ENV=production (auth cannot be disabled in prod)');
}

module.exports = config;
