const { rpcCall, withRetry, UpstreamError } = require('../src/utils/ethRpc');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// The 429 / 5xx / JSON-RPC-error / timeout paths are already exercised through
// BalanceService.test.js (getBalanceEth -> rpcCall). These cover the two error branches
// that go through no other test, plus withRetry directly.
describe('rpcCall error classification', () => {
  test('a non-2xx 4xx is a non-retryable 502', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 403));
    await expect(
      rpcCall('eth_getBalance', ['0xabc', 'latest'], { fetchImpl }),
    ).rejects.toMatchObject({ status: 502, retryable: false });
  });

  test('a network-level failure is a retryable 502', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      rpcCall('eth_getBalance', ['0xabc', 'latest'], { fetchImpl }),
    ).rejects.toMatchObject({ status: 502, retryable: true });
  });
});

describe('withRetry', () => {
  test('returns the result without retrying on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, 2)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries a retryable failure up to `retries` times, then throws', async () => {
    const err = new UpstreamError('boom', { status: 502, retryable: true });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 2)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  test('does not retry a non-retryable failure', async () => {
    const err = new UpstreamError('bad params', { status: 502, retryable: false });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 2)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
