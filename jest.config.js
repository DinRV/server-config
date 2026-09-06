/**
 * Jest Configuration
 * 
 * Addresses test flakiness caused by environment variable bleed
 * between test suites (QA-3201). The globalSetup script snapshots
 * the process environment before tests run, enabling deterministic
 * env state per suite without manually stubbing every variable.
 * 
 * Also configures coverage thresholds per the Q3 quality gates.
 */

module.exports = {
  testEnvironment: 'node',
  
  // Global setup captures env snapshot for test isolation
  globalSetup: './test/setup/globalSetup.js',
  globalTeardown: './test/setup/globalTeardown.js',
  
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.spec.js',
  ],
  
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/index.js',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  maxWorkers: '50%',
  testTimeout: 15000,
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
  },
};
