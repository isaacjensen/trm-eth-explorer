// Runs before config.js is imported in any test. Provides the required env so the
// fail-fast config loader is satisfied, and silences logs during test runs.
process.env.INFURA_API_KEY = 'test-key';
process.env.INFURA_NETWORK = 'mainnet';
process.env.LOG_LEVEL = 'silent';
