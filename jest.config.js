module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup.js'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
