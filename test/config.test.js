// Locks the production fail-closed auth invariant. config.js reads env at import time,
// so each case resets the module registry and sets the env it needs.
describe('config: auth fail-closed in production', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, INFURA_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('throws in production when AUTH_JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_JWT_SECRET;
    expect(() => require('../src/config')).toThrow(/AUTH_JWT_SECRET is required/);
  });

  test('boots in production when AUTH_JWT_SECRET is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_JWT_SECRET = 'a-secret';
    expect(() => require('../src/config')).not.toThrow();
  });

  test('boots in development without a secret (endpoint open for local dev)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_JWT_SECRET;
    expect(() => require('../src/config')).not.toThrow();
  });
});
