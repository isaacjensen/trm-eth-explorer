'use strict';

/**
 * mint-token.js — generate a demo bearer token for the balance API.
 *
 * The API verifies HS256 JWTs signed with a shared secret. Because the secret is
 * shared, we can sign tokens here without a real identity provider — this script just
 * stands in for one so the auth flow is demoable. (In production an IdP mints RS256
 * tokens and you would NOT sign them yourself.)
 *
 * Signing secret source: AWS Secrets Manager when APP_SECRET_ID is set (uses your local
 * AWS creds), otherwise AUTH_JWT_SECRET from your environment / .env.
 *
 * Usage:
 *   node scripts/mint-token.js                 # scope "balance:read", expires in 1h
 *   node scripts/mint-token.js "wrong:scope"   # mint a token that will get a 403
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

// 1) Inputs, with sensible demo defaults.
const scope = process.argv[2] || 'balance:read';
const expiresIn = process.argv[3] || '1h';
const subject = process.env.TOKEN_SUB || 'demo-client';

// 2) Get the signing secret — from Secrets Manager if configured, else from the env.
async function getSigningSecret() {
  if (process.env.APP_SECRET_ID) {
    // Only reach for the AWS SDK when we're actually using Secrets Manager.
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({}); // region/creds from the environment
    const { SecretString } = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.APP_SECRET_ID }),
    );
    return JSON.parse(SecretString).AUTH_JWT_SECRET;
  }
  return process.env.AUTH_JWT_SECRET;
}

// 3) Sign and print. Token goes to stdout (pipeable); the human summary to stderr.
async function main() {
  const secret = await getSigningSecret();
  if (!secret) {
    console.error('No signing secret. Set APP_SECRET_ID (Secrets Manager) or AUTH_JWT_SECRET (.env).');
    process.exit(1);
  }

  const token = jwt.sign({ sub: subject, scope }, secret, { algorithm: 'HS256', expiresIn });

  console.error(`minted: sub=${subject} scope="${scope}" expiresIn=${expiresIn}`);
  console.log(token);
}

main();
