const { getTransactionByHash } = require('../src/services/TransactionService');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// A representative eth_getTransactionByHash result (trimmed). Fields stay wei-hex, as the
// node returns them — the service does not reshape them.
const TX = {
  hash: '0x' + 'a'.repeat(64),
  from: '0xc94770007dda54cF92009BFF0dE90c06F603a09f',
  to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  value: '0xde0b6b3a7640000', // 1 ETH in wei-hex
  blockNumber: '0x10d4f',
};

describe('getTransactionByHash', () => {
  test('returns the transaction object unchanged for a known hash', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ result: TX }));
    const tx = await getTransactionByHash('0xabc', { fetchImpl });
    expect(tx).toEqual(TX);
  });

  test('returns null when the transaction is not found', async () => {
    // eth_getTransactionByHash returns result: null for an unknown hash.
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ result: null }));
    const tx = await getTransactionByHash('0xabc', { fetchImpl });
    expect(tx).toBeNull();
  });

  test('retries once on a 500 then succeeds', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ result: TX }));

    const tx = await getTransactionByHash('0xabc', { fetchImpl, retries: 1 });

    expect(tx).toEqual(TX);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('surfaces a 429 as a retryable UpstreamError', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    await expect(getTransactionByHash('0xabc', { fetchImpl, retries: 0 })).rejects.toMatchObject({
      status: 429,
      retryable: true,
    });
  });

  test('does not retry a JSON-RPC application error', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'bad params' } }));

    await expect(getTransactionByHash('0xabc', { fetchImpl, retries: 1 })).rejects.toMatchObject({
      status: 502,
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
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
      getTransactionByHash('0xabc', { fetchImpl, timeoutMs: 20, retries: 0 }),
    ).rejects.toMatchObject({ status: 504 });
  });
});
