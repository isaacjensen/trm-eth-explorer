// Enable auth for THIS file by setting the secret BEFORE the app/config is required.
// Jest gives each test file its own module registry, so this doesn't affect other suites
// (which run with auth disabled, since setup.js sets no AUTH_JWT_SECRET).
process.env.AUTH_JWT_SECRET = 'test-signing-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Stub the domain service so the balance route doesn't hit upstream.
jest.mock('../src/services/BalanceService', () => {
  const actual = jest.requireActual('../src/services/BalanceService');
  return { ...actual, getBalanceEth: jest.fn().mockResolvedValue('1.5') };
});

jest.mock('../src/services/TransactionService', () => {
  const actual = jest.requireActual('../src/services/TransactionService');
  return { ...actual, getTransactionByHash: jest.fn().mockResolvedValue({ hash: '0xtx' }) };
});

const { createApp } = require('../src/app');

const app = createApp();
const SECRET = 'test-signing-secret';
const ADDR = '0xc94770007dda54cF92009BFF0dE90c06F603a09f';
const TX_HASH = '0x' + 'a'.repeat(64);

describe('JWT auth on the balance route', () => {
  test('rejects a request with no token (401)', async () => {
    const res = await request(app).get(`/address/balance/${ADDR}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  test('rejects a non-Bearer / malformed header (401)', async () => {
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  test('rejects a garbage token (401)', async () => {
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  test('rejects an expired token (401)', async () => {
    const token = jwt.sign({ sub: 'client' }, SECRET, { expiresIn: -10 });
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('rejects a token signed with the wrong secret (401)', async () => {
    const token = jwt.sign({ sub: 'client' }, 'wrong-secret');
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  test('rejects a valid token lacking the balance:read scope (403)', async () => {
    const token = jwt.sign({ sub: 'client', scope: 'profile:read' }, SECRET, { expiresIn: '5m' });
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'insufficient_scope' });
  });

  test('accepts a valid token with the balance:read scope (200)', async () => {
    const token = jwt.sign({ sub: 'client', scope: 'balance:read' }, SECRET, { expiresIn: '5m' });
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ balance: 1.5 });
  });

  test('health, readiness, and metrics stay open (no token)', async () => {
    expect((await request(app).get('/healthz')).status).toBe(200);
    expect((await request(app).get('/readyz')).status).toBe(200);
    expect((await request(app).get('/metrics')).status).toBe(200);
  });
});

describe('per-route scope enforcement', () => {
  test('transaction route rejects a balance:read-only token (403)', async () => {
    const token = jwt.sign({ sub: 'client', scope: 'balance:read' }, SECRET, { expiresIn: '5m' });
    const res = await request(app)
      .get(`/transaction/${TX_HASH}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'insufficient_scope' });
  });

  test('transaction route accepts a transaction:read token (200)', async () => {
    const token = jwt.sign({ sub: 'client', scope: 'transaction:read' }, SECRET, { expiresIn: '5m' });
    const res = await request(app)
      .get(`/transaction/${TX_HASH}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('balance route rejects a transaction:read-only token (403)', async () => {
    const token = jwt.sign({ sub: 'client', scope: 'transaction:read' }, SECRET, { expiresIn: '5m' });
    const res = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('a token carrying both scopes works on both routes (200/200)', async () => {
    const token = jwt.sign(
      { sub: 'client', scope: 'balance:read transaction:read' },
      SECRET,
      { expiresIn: '5m' },
    );
    const bal = await request(app)
      .get(`/address/balance/${ADDR}`)
      .set('Authorization', `Bearer ${token}`);
    const tx = await request(app)
      .get(`/transaction/${TX_HASH}`)
      .set('Authorization', `Bearer ${token}`);
    expect(bal.status).toBe(200);
    expect(tx.status).toBe(200);
  });
});
