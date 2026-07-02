import type { Config } from 'jest';

/**
 * Standalone config for the voice-agent evaluation suite.
 * Separate from jest.config.ts so evals (which make REAL Groq API calls) never
 * run as part of `npm test`. Invoke with `npm run eval`.
 */
const config: Config = {
  displayName: 'evals',
  testMatch: ['<rootDir>/evals/**/*.eval.test.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testTimeout: 600000,
};

export default config;
