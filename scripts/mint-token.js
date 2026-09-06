'use strict';

// Dev/demo helper: mint an HS256 bearer token the balance API will accept.
//
// This stands in for a real token issuer (IdP). It works only because HS256 signs with
// the SAME shared secret the service verifies against — so whoever holds AUTH_JWT_SECRET
// can mint tokens. In production an IdP (Cognito/Keycloak) mints RS256 tokens and the
// service verifies against the IdP's public JWKS; you would NOT keep the signing key
// next to the verifier. This script exists purely so the auth flow is demoable without
// standing up an IdP.
//
// Usage:
//   node scripts/mint-token.js                 # scope=balance:read, exp=1h
//   node scripts/mint-token.js "balance:read"  # explicit scope
//   node scripts/mint-token.js "wrong:scope"   # to demo a 403 (insufficient_scope)
//   npm run token --silent                     # just the token on stdout

require('dotenv').config();
const jwt = require('jsonwebtoken');

const secret = process.env.AUTH_JWT_SECRET;
if (!secret) {
  console.error('AUTH_JWT_SECRET is not set. Add it to .env (see .env.example).');
  process.exit(1);
}

const scope = process.argv[2] || process.env.AUTH_REQUIRED_SCOPE || 'balance:read';
const expiresIn = process.argv[3] || '1h';
const sub = process.env.TOKEN_SUB || 'demo-client';

const options = { algorithm: 'HS256', expiresIn };
if (process.env.AUTH_JWT_AUDIENCE) options.audience = process.env.AUTH_JWT_AUDIENCE;
if (process.env.AUTH_JWT_ISSUER) options.issuer = process.env.AUTH_JWT_ISSUER;

const token = jwt.sign({ sub, scope }, secret, options);

// Token to stdout (pipeable); human hint to stderr so it doesn't pollute the token.
console.error(`minted token: sub=${sub} scope="${scope}" exp=${expiresIn}`);
console.log(token);
