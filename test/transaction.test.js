const request = require('supertest');

// Mock the domain service so the route/controller is tested in isolation. UpstreamError
// comes from the real transport module so the controller's `instanceof` check still works.
jest.mock('../src/services/TransactionService', () => {
  const actual = jest.requireActual('../src/services/TransactionService');
  return { ...actual, getTransactionByHash: jest.fn() };
});

const { getTransactionByHash } = require('../src/services/TransactionService');
const { UpstreamError } = require('../src/utils/ethRpc');
const { createApp } = require('../src/app');

const app = createApp();
const VALID = '0x' + 'a'.repeat(64);
const TX = { hash: VALID, from: '0xabc', to: '0xdef', value: '0x0', blockNumber: '0x1' };

describe('GET /transaction/:hash', () => {
  test('returns the transaction for a valid hash', async () => {
    getTransactionByHash.mockResolvedValue(TX);

    const res = await request(app).get(`/transaction/${VALID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transaction: TX });
  });

  test('returns 400 for an invalid hash (no upstream call)', async () => {
    const res = await request(app).get('/transaction/0x123');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(getTransactionByHash).not.toHaveBeenCalled();
  });

  test('returns 404 when the transaction is not found', async () => {
    getTransactionByHash.mockResolvedValue(null);

    const res = await request(app).get(`/transaction/${VALID}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 502 on an upstream server error', async () => {
    getTransactionByHash.mockRejectedValue(new UpstreamError('boom', { status: 502, retryable: true }));

    const res = await request(app).get(`/transaction/${VALID}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  test('passes through a 429 from upstream', async () => {
    getTransactionByHash.mockRejectedValue(new UpstreamError('rate', { status: 429, retryable: true }));

    const res = await request(app).get(`/transaction/${VALID}`);

    expect(res.status).toBe(429);
  });

  test('returns 504 on an upstream timeout', async () => {
    getTransactionByHash.mockRejectedValue(new UpstreamError('timeout', { status: 504, retryable: true }));

    const res = await request(app).get(`/transaction/${VALID}`);

    expect(res.status).toBe(504);
  });
});
