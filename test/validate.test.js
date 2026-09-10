const { isValidAddress, isValidTxHash } = require('../src/utils/validate');

describe('isValidAddress', () => {
  test('accepts the checksummed address from the exercise prompt', () => {
    expect(isValidAddress('0xc94770007dda54cF92009BFF0dE90c06F603a09f')).toBe(true);
  });

  test('accepts an all-lowercase address', () => {
    expect(isValidAddress('0xc94770007dda54cf92009bff0de90c06f603a09f')).toBe(true);
  });

  test('rejects an address that is too short', () => {
    expect(isValidAddress('0x123')).toBe(false);
  });

  test('rejects non-hex characters', () => {
    expect(isValidAddress('0xZZ70007dda54cf92009bff0de90c06f603a09fff')).toBe(false);
  });

  test('rejects a missing 0x prefix', () => {
    expect(isValidAddress('c94770007dda54cf92009bff0de90c06f603a09f')).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidAddress(null)).toBe(false);
    expect(isValidAddress(undefined)).toBe(false);
    expect(isValidAddress(42)).toBe(false);
  });
});

describe('isValidTxHash', () => {
  const VALID = '0x' + 'a'.repeat(64);

  test('accepts a well-formed 32-byte hash', () => {
    expect(isValidTxHash(VALID)).toBe(true);
  });

  test('accepts mixed-case hex', () => {
    expect(isValidTxHash('0x' + 'aB'.repeat(32))).toBe(true);
  });

  test('rejects an address-length value (40 hex, too short)', () => {
    expect(isValidTxHash('0x' + 'a'.repeat(40))).toBe(false);
  });

  test('rejects non-hex characters', () => {
    expect(isValidTxHash('0x' + 'z'.repeat(64))).toBe(false);
  });

  test('rejects a missing 0x prefix', () => {
    expect(isValidTxHash('a'.repeat(64))).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidTxHash(null)).toBe(false);
    expect(isValidTxHash(undefined)).toBe(false);
    expect(isValidTxHash(42)).toBe(false);
  });
});
