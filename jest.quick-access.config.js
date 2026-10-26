module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/lib/__tests__/quick-access.test.ts', '**/src/lib/__tests__/direct-movement.test.ts', '**/src/lib/__tests__/direct-session.test.ts', '**/src/lib/__tests__/oauth.test.ts', '**/src/models/__tests__/quickAccess.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { target: 'ES2020', module: 'CommonJS', esModuleInterop: true },
    }],
  },
};
