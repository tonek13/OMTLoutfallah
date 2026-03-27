module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': '<rootDir>/jest.ts.transformer.cjs',
  },
};
