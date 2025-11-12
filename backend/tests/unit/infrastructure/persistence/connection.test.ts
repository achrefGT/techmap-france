import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Create mock before importing pg
const mockPool = jest.fn();

// Mock pg module
jest.mock('pg', () => ({
  Pool: mockPool,
}));

// Mock dotenv to prevent loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
  default: { config: jest.fn() },
}));

describe('Database Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Clear module cache before each test

    // Set default environment variables
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.NODE_ENV = 'development';

    // Clear optional env vars to ensure clean state
    delete process.env.PG_POOL_MAX;
    delete process.env.PG_IDLE_TIMEOUT;
    delete process.env.PG_CONN_TIMEOUT;
  });

  it('should create pool with correct configuration in development', async () => {
    // Import the module fresh after env vars are set
    await import('../../../../src/infrastructure/persistence/connection');

    expect(mockPool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgresql://localhost:5432/test',
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: false,
      })
    );
  });

  it('should enable SSL in production', async () => {
    process.env.NODE_ENV = 'production';

    await import('../../../../src/infrastructure/persistence/connection');

    expect(mockPool).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: { rejectUnauthorized: false },
      })
    );
  });

  it('should use custom pool configuration from env vars', async () => {
    process.env.PG_POOL_MAX = '10';
    process.env.PG_IDLE_TIMEOUT = '60000';
    process.env.PG_CONN_TIMEOUT = '5000';

    await import('../../../../src/infrastructure/persistence/connection');

    expect(mockPool).toHaveBeenCalledWith(
      expect.objectContaining({
        max: 10,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 5000,
      })
    );
  });
});
