const request = require('supertest');

// Mock the domain service so the route/controller is tested in isolation. UpstreamError
// comes from the real transport module (utils/ethRpc) so the controller's `instanceof`
// check still works.
jest.mock('../src/services/BalanceService', () => {
  const actual = jest.requireActual('../src/services/BalanceService');
  return { ...actual, getBalanceEth: jest.fn() };
});

const { getBalanceEth } = require('../src/services/BalanceService');
const { UpstreamError } = require('../src/utils/ethRpc');
const { createApp } = require('../src/app');

const app = createApp();
const VALID = '0xc94770007dda54cF92009BFF0dE90c06F603a09f';

describe('GET /address/balance/:address', () => {
  test('returns the balance for a valid address', async () => {
    getBalanceEth.mockResolvedValue('0.0001365');

    const res = await request(app).get(`/address/balance/${VALID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ balance: 0.0001365 });
  });

  test('returns 400 for an invalid address (no upstream call)', async () => {
    const res = await request(app).get('/address/balance/0x123');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(getBalanceEth).not.toHaveBeenCalled();
  });

  test('returns 502 on an upstream server error', async () => {
    getBalanceEth.mockRejectedValue(new UpstreamError('boom', { status: 502, retryable: true }));

    const res = await request(app).get(`/address/balance/${VALID}`);

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });

  test('passes through a 429 from upstream', async () => {
    getBalanceEth.mockRejectedValue(new UpstreamError('rate', { status: 429, retryable: true }));

    const res = await request(app).get(`/address/balance/${VALID}`);

    expect(res.status).toBe(429);
  });

  test('returns 504 on an upstream timeout', async () => {
    getBalanceEth.mockRejectedValue(new UpstreamError('timeout', { status: 504, retryable: true }));

    const res = await request(app).get(`/address/balance/${VALID}`);

    expect(res.status).toBe(504);
  });
});

describe('operability endpoints', () => {
  test('GET /healthz returns 200', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /readyz returns 200', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
  });

  test('GET /metrics exposes prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_request_duration_seconds');
  });

  test('unknown route returns 404 json', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });
});
