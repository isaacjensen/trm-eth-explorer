const { isValidAddress } = require('../src/lib/validate');

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
