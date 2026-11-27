'use strict'

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/setup.js'],
  setupFilesAfterEnv: ['jest-extended/all', '<rootDir>/test/setup.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'config/**/*.js',
    'lib/**/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
}
