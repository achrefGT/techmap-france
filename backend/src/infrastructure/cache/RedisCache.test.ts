import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Redis } from '@upstash/redis';

// Mock the Redis client
jest.mock('@upstash/redis');

describe('RedisCache', () => {
  let mockRedisInstance: jest.Mocked<Redis>;
  let RedisCache: typeof import('./RedisCache').RedisCache;
  let cache: import('./RedisCache').RedisCache;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup environment variables
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.REDIS_KEY_PREFIX = 'test:';

    // Create mock instance
    mockRedisInstance = {
      get: jest.fn(),
      mget: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      scard: jest.fn(),
      scan: jest.fn(),
      ping: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedisInstance);

    // Import after mocking
    const module = await import('./RedisCache');
    RedisCache = module.RedisCache;
    cache = new RedisCache();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('constructor', () => {
    it('should throw error if UPSTASH_REDIS_REST_URL is missing', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      jest.resetModules();

      await expect(async () => {
        await import('./RedisCache');
      }).rejects.toThrow('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    });

    it('should throw error if UPSTASH_REDIS_REST_TOKEN is missing', async () => {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      jest.resetModules();

      await expect(async () => {
        await import('./RedisCache');
      }).rejects.toThrow('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    });

    it('should create Redis client with correct config', () => {
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://test.upstash.io',
          token: 'test-token',
          retry: expect.any(Object),
        })
      );
    });
  });

  describe('get()', () => {
    it('should return parsed JSON for valid JSON string', async () => {
      const testData = { foo: 'bar' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cache.get('test-key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('test:test-key');
      expect(result).toEqual(testData);
    });

    it('should return raw value if not JSON', async () => {
      mockRedisInstance.get.mockResolvedValue('plain-string');

      const result = await cache.get('test-key');

      expect(result).toBe('plain-string');
    });

    it('should return null if key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await cache.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('mget()', () => {
    it('should return empty array for empty keys', async () => {
      const result = await cache.mget([]);

      expect(result).toEqual([]);
      expect(mockRedisInstance.mget).not.toHaveBeenCalled();
    });

    it('should return parsed values in correct order', async () => {
      mockRedisInstance.mget.mockResolvedValue([
        JSON.stringify({ id: 1 }),
        JSON.stringify({ id: 2 }),
        null,
      ]);

      const result = await cache.mget(['key1', 'key2', 'key3']);

      expect(mockRedisInstance.mget).toHaveBeenCalledWith(['test:key1', 'test:key2', 'test:key3']);
      expect(result).toEqual([{ id: 1 }, { id: 2 }, null]);
    });

    it('should handle errors gracefully', async () => {
      mockRedisInstance.mget.mockRejectedValue(new Error('Network error'));

      const result = await cache.mget(['key1', 'key2']);

      expect(result).toEqual([null, null]);
    });
  });

  describe('set()', () => {
    it('should set value without TTL', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      mockRedisInstance.sadd.mockResolvedValue(1);

      const result = await cache.set('test-key', { foo: 'bar' });

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        'test:test-key',
        JSON.stringify({ foo: 'bar' })
      );
      expect(mockRedisInstance.sadd).toHaveBeenCalledWith('test:__keys_index', 'test:test-key');
      expect(result).toBe(true);
    });

    it('should set value with TTL', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      mockRedisInstance.sadd.mockResolvedValue(1);

      const result = await cache.set('test-key', { foo: 'bar' }, 3600);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test:test-key',
        3600,
        JSON.stringify({ foo: 'bar' })
      );
      expect(mockRedisInstance.sadd).toHaveBeenCalledWith('test:__ttl_keys_index', 'test:test-key');
      expect(result).toBe(true);
    });

    it('should handle string values', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      mockRedisInstance.sadd.mockResolvedValue(1);

      await cache.set('test-key', 'plain-string');

      expect(mockRedisInstance.set).toHaveBeenCalledWith('test:test-key', 'plain-string');
    });

    it('should return false on error', async () => {
      mockRedisInstance.set.mockRejectedValue(new Error('Network error'));

      const result = await cache.set('test-key', 'value');

      expect(result).toBe(false);
    });

    it('should continue if index tracking fails', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');
      mockRedisInstance.sadd.mockRejectedValue(new Error('Index error'));

      const result = await cache.set('test-key', 'value');

      expect(result).toBe(true);
    });
  });

  describe('del()', () => {
    it('should delete key and remove from indices', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      mockRedisInstance.srem.mockResolvedValue(1);

      const result = await cache.del('test-key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('test:test-key');
      expect(mockRedisInstance.srem).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockRedisInstance.del.mockRejectedValue(new Error('Network error'));

      const result = await cache.del('test-key');

      expect(result).toBe(false);
    });
  });

  describe('exists()', () => {
    it('should return true if key exists (number response)', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);

      const result = await cache.exists('test-key');

      expect(mockRedisInstance.exists).toHaveBeenCalledWith('test:test-key');
      expect(result).toBe(true);
    });

    it('should return true if key exists (string response)', async () => {
      mockRedisInstance.exists.mockResolvedValue('1' as unknown as number);

      const result = await cache.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedisInstance.exists.mockResolvedValue(0);

      const result = await cache.exists('test-key');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedisInstance.exists.mockRejectedValue(new Error('Network error'));

      const result = await cache.exists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('ttl()', () => {
    it('should return TTL in seconds', async () => {
      mockRedisInstance.ttl.mockResolvedValue(3600);

      const result = await cache.ttl('test-key');

      expect(mockRedisInstance.ttl).toHaveBeenCalledWith('test:test-key');
      expect(result).toBe(3600);
    });

    it('should return -2 if key does not exist', async () => {
      mockRedisInstance.ttl.mockResolvedValue(-2);

      const result = await cache.ttl('test-key');

      expect(result).toBe(-2);
    });

    it('should return -2 on error', async () => {
      mockRedisInstance.ttl.mockRejectedValue(new Error('Network error'));

      const result = await cache.ttl('test-key');

      expect(result).toBe(-2);
    });
  });

  describe('increment()', () => {
    it('should increment by default amount (1)', async () => {
      mockRedisInstance.incrby.mockResolvedValue(5);
      mockRedisInstance.sadd.mockResolvedValue(1);

      const result = await cache.increment('counter');

      expect(mockRedisInstance.incrby).toHaveBeenCalledWith('test:counter', 1);
      expect(result).toBe(5);
    });

    it('should increment by custom amount', async () => {
      mockRedisInstance.incrby.mockResolvedValue(15);
      mockRedisInstance.sadd.mockResolvedValue(1);

      const result = await cache.increment('counter', 10);

      expect(mockRedisInstance.incrby).toHaveBeenCalledWith('test:counter', 10);
      expect(result).toBe(15);
    });

    it('should return null on error', async () => {
      mockRedisInstance.incrby.mockRejectedValue(new Error('Network error'));

      const result = await cache.increment('counter');

      expect(result).toBeNull();
    });
  });

  describe('decrement()', () => {
    it('should decrement by default amount (1)', async () => {
      mockRedisInstance.decrby.mockResolvedValue(3);
      mockRedisInstance.sadd.mockResolvedValue(1);

      const result = await cache.decrement('counter');

      expect(mockRedisInstance.decrby).toHaveBeenCalledWith('test:counter', 1);
      expect(result).toBe(3);
    });

    it('should decrement by custom amount', async () => {
      mockRedisInstance.decrby.mockResolvedValue(-5);
      mockRedisInstance.sadd.mockResolvedValue(1);

      const result = await cache.decrement('counter', 10);

      expect(mockRedisInstance.decrby).toHaveBeenCalledWith('test:counter', 10);
      expect(result).toBe(-5);
    });
  });

  describe('ping()', () => {
    it('should return true on successful ping', async () => {
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const result = await cache.ping();

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockRedisInstance.ping.mockRejectedValue(new Error('Connection error'));

      const result = await cache.ping();

      expect(result).toBe(false);
    });
  });

  describe('getStats()', () => {
    it('should return correct statistics', async () => {
      mockRedisInstance.scard.mockResolvedValueOnce(100).mockResolvedValueOnce(50);

      const result = await cache.getStats();

      expect(result).toEqual({ permanentKeys: 100, ttlKeys: 50 });
    });

    it('should return zeros on error', async () => {
      mockRedisInstance.scard.mockRejectedValue(new Error('Network error'));

      const result = await cache.getStats();

      expect(result).toEqual({ permanentKeys: 0, ttlKeys: 0 });
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit error', async () => {
      const rateLimitError = { status: 429, message: 'Too many requests' };

      mockRedisInstance.get
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const result = await cache.get('test-key');

      expect(mockRedisInstance.get).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should not retry non-rate-limit errors', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await cache.get('test-key');

      expect(mockRedisInstance.get).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('should give up after max retries', async () => {
      const rateLimitError = { status: 429, message: 'Too many requests' };
      mockRedisInstance.get.mockRejectedValue(rateLimitError);

      await expect(async () => {
        // Access withRetry directly through a method that uses it
        await cache.get('test-key');
      }).rejects.toThrow();

      expect(mockRedisInstance.get).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('batch operations', () => {
    it('should batch delete large number of keys', async () => {
      const keys = Array.from({ length: 150 }, (_, i) => `key${i}`);
      mockRedisInstance.smembers.mockResolvedValue(keys);
      mockRedisInstance.del.mockResolvedValue(1);

      await cache.clearNamespaceUsingIndex();

      // Should be called 3 times for 150 keys (batch size 50)
      expect(mockRedisInstance.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('scan operations', () => {
    it('should scan and delete matching keys', async () => {
      mockRedisInstance.scan
        .mockResolvedValueOnce(['1', ['test:key1', 'test:key2']])
        .mockResolvedValueOnce(['0', ['test:key3']]);

      mockRedisInstance.del.mockResolvedValue(1);

      const result = await cache.clear('test:*');

      expect(mockRedisInstance.scan).toHaveBeenCalledTimes(2);
      expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
      expect(result).toBe(3); // Total keys deleted
    });

    it('should handle empty scan results', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', []]);

      const result = await cache.clear('nonexistent:*');

      expect(result).toBe(0);
    });
  });
});
