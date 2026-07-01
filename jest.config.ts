import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'server',
      testMatch: [
        '<rootDir>/__tests__/sprint2/**/*.test.ts',
        '<rootDir>/__tests__/sprint3/**/*.test.ts',
        '<rootDir>/__tests__/sprint4/**/*.test.ts',
        '<rootDir>/__tests__/sprint5/**/*.test.ts',
        '<rootDir>/__tests__/sprint6/**/*.test.ts',
        '<rootDir>/__tests__/sprint7/**/*.test.ts',
        '<rootDir>/__tests__/sprint8/**/*.test.ts',
        '<rootDir>/__tests__/sprint10/**/*.test.ts',
      ],
      testEnvironment: 'node',
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }],
      },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    },
    {
      displayName: 'client',
      testMatch: [
        '<rootDir>/__tests__/sprint1/**/*.test.tsx',
        '<rootDir>/__tests__/sprint9/**/*.test.tsx',
      ],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true, jsx: 'react-jsx' } }],
      },
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    },
  ],
};

export default config;
