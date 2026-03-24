module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, useESM: false }],
  },
};
