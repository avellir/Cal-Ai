/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: '<rootDir>/__tests__/customEnvironment.js',
  clearMocks: true,
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
