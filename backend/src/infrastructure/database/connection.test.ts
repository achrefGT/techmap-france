import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Pool } from 'pg';

jest.mock('pg');

describe('Database Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.NODE_ENV = 'development';
  });

  it('should create pool with correct configuration in development', () => {
    jest.isolateModules(() => {
      require('./connection');
      
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgresql://localhost:5432/test',
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          ssl: false,
        })
      );
    });
  });

  it('should enable SSL in production', () => {
    process.env.NODE_ENV = 'production';
    
    jest.isolateModules(() => {
      require('./connection');
      
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        })
      );
    });
  });

  it('should use custom pool configuration from env vars', () => {
    process.env.PG_POOL_MAX = '10';
    process.env.PG_IDLE_TIMEOUT = '60000';
    process.env.PG_CONN_TIMEOUT = '5000';
    
    jest.isolateModules(() => {
      require('./connection');
      
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 10,
          idleTimeoutMillis: 60000,
          connectionTimeoutMillis: 5000,
        })
      );
    });
  });
});