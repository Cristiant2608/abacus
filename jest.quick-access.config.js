module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/lib/__tests__/quick-access.test.ts', '**/src/models/__tests__/quickAccess.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { target: 'ES2020', module: 'CommonJS', esModuleInterop: true },
    }],
  },
};
