const { formatEther } = require('ethers');
const { getBalanceEth } = require('../src/services/BalanceService');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('getBalanceEth', () => {
  test('converts wei hex to an eth string', async () => {
    // 0.0001365 ETH = 136500000000000 wei
    const wei = 136500000000000n;
    const hex = '0x' + wei.toString(16);
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ result: hex }));

    const balance = await getBalanceEth('0xabc', { fetchImpl });

    expect(balance).toBe('0.0001365');
  });

  test('preserves precision for very large balances', async () => {
    const wei = 1234567890123456789012345n;
    const hex = '0x' + wei.toString(16);
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ result: hex }));

    const balance = await getBalanceEth('0xabc', { fetchImpl });

    expect(balance).toBe(formatEther(wei));
  });

  test('returns 0.0 for a zero balance', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ result: '0x0' }));
    const balance = await getBalanceEth('0xabc', { fetchImpl });
    expect(balance).toBe('0.0');
  });

  test('retries once on a 500 then succeeds', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ result: '0x0' }));

    const balance = await getBalanceEth('0xabc', { fetchImpl, retries: 1 });

    expect(balance).toBe('0.0');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('surfaces a 429 as a retryable UpstreamError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    await expect(getBalanceEth('0xabc', { fetchImpl, retries: 0 })).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });
  });

  test('does not retry a JSON-RPC application error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'bad params' } }));

    await expect(getBalanceEth('0xabc', { fetchImpl, retries: 1 })).rejects.toMatchObject({
      status: 502,
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('serves a second lookup from cache without a second upstream call', async () => {
    // Distinct address so it can't collide with the other tests' shared cache instance.
    const addr = '0xcache0000000000000000000000000000000cache';
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ result: '0x0' }));

    // cacheTtlMs > 0 enables the cache for these calls (default is 0 / disabled in test).
    const first = await getBalanceEth(addr, { fetchImpl, cacheTtlMs: 1000 });
    const second = await getBalanceEth(addr, { fetchImpl, cacheTtlMs: 1000 });

    expect(first).toBe('0.0');
    expect(second).toBe('0.0');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // second call was a cache hit
  });

  test('maps a timeout to a 504 UpstreamError', async () => {
    const fetchImpl = jest.fn(
      (url, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    await expect(
      getBalanceEth('0xabc', { fetchImpl, timeoutMs: 20, retries: 0 }),
    ).rejects.toMatchObject({ status: 504 });
  });
});
