import { Redis } from '@upstash/redis';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!URL || !TOKEN) {
  throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
}

interface RetryableError {
  status?: number;
  message?: string;
}

/**
 * Redis cache wrapper for Upstash
 * 
 * Features:
 * - Automatic key prefixing/namespacing
 * - Index tracking for safe bulk operations
 * - Rate limit friendly operations (free tier optimized)
 * - Retry logic with exponential backoff
 * 
 * Notes:
 * - Call cleanExpiredFromIndex() periodically (e.g. via cron) to prevent TTL index bloat
 * - For large datasets (>10k keys), consider sharding index sets
 * - Free tier has rate limits: ~100 req/10s - operations use batching where possible
 */
export class RedisCache {
  private client: Redis;
  private prefix = process.env.REDIS_KEY_PREFIX ?? 'app:';
  private indexSetKey = `${this.prefix}__keys_index`;
  private ttlIndexSetKey = `${this.prefix}__ttl_keys_index`;
  
  // Free tier friendly: limit concurrent operations
  private readonly MAX_BATCH_SIZE = 50;
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 100;

  constructor() {
    this.client = new Redis({ 
      url: URL, 
      token: TOKEN,
      retry: {
        retries: this.MAX_RETRIES,
        backoff: (retryCount) => Math.min(this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount), 3000),
      },
    });
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Retry wrapper with exponential backoff for rate limit handling
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (err: unknown) {
        lastError = err;
        
        // Check if it's a rate limit error (429 or similar)
        const error = err as RetryableError;
        const isRateLimit = error?.status === 429 || 
                           error?.message?.includes('rate limit') ||
                           error?.message?.includes('too many requests');
        
        if (isRateLimit && attempt < this.MAX_RETRIES) {
          const delay = Math.min(this.INITIAL_RETRY_DELAY * Math.pow(2, attempt), 3000);
          console.warn(`${operationName}: Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Don't retry non-rate-limit errors
        if (!isRateLimit) {
          break;
        }
      }
    }
    
    throw lastError;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.withRetry(
        () => this.client.get(this.k(key)),
        'GET'
      );
      
      if (raw == null) return null;
      
      try {
        return JSON.parse(String(raw)) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      console.error('Redis GET error:', err);
      return null;
    }
  }

  /**
   * Batch get multiple keys
   * Note: Returns in same order as input keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    
    try {
      const prefixedKeys = keys.map((k) => this.k(k));
      
      // Use array syntax for better compatibility
      const values = await this.withRetry(
        () => this.client.mget<(string | null)[]>(prefixedKeys),
        'MGET'
      );
      
      return (values || []).map((raw: string | null) => {
        if (raw == null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      });
    } catch (err) {
      console.error('Redis MGET error:', err);
      return keys.map(() => null);
    }
  }

  /**
   * Set a key with optional TTL
   * Note: Index tracking may fail silently if setex succeeds but sadd fails
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    
    try {
      if (ttlSeconds) {
        await this.withRetry(
          () => this.client.setex(this.k(key), ttlSeconds, payload),
          'SETEX'
        );
        
        // Best effort: track in TTL index (may fail independently)
        try {
          await this.client.sadd(this.ttlIndexSetKey, this.k(key));
        } catch (indexErr) {
          console.warn('Failed to add key to TTL index:', indexErr);
          // Not critical - key will still expire, just won't be tracked
        }
      } else {
        await this.withRetry(
          () => this.client.set(this.k(key), payload),
          'SET'
        );
        
        try {
          await this.client.sadd(this.indexSetKey, this.k(key));
        } catch (indexErr) {
          console.warn('Failed to add key to index:', indexErr);
        }
      }
      return true;
    } catch (err) {
      console.error('Redis SET error:', err);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.withRetry(
        () => this.client.del(this.k(key)),
        'DEL'
      );
      
      // Clean up from both indices (best effort)
      await Promise.allSettled([
        this.client.srem(this.indexSetKey, this.k(key)),
        this.client.srem(this.ttlIndexSetKey, this.k(key)),
      ]);
      
      return true;
    } catch (err) {
      console.error('Redis DEL error:', err);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.withRetry(
        () => this.client.exists(this.k(key)),
        'EXISTS'
      );
      // Safely coerce to number (handles string "1" or number 1)
      return Number(result) === 1;
    } catch (err) {
      console.error('Redis EXISTS error:', err);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const result = await this.withRetry(
        () => this.client.ttl(this.k(key)),
        'TTL'
      );
      return Number(result);
    } catch (err) {
      console.error('Redis TTL error:', err);
      return -2; // key doesn't exist
    }
  }

  async increment(key: string, amount: number = 1): Promise<number | null> {
    try {
      const result = await this.withRetry(
        () => this.client.incrby(this.k(key), amount),
        'INCRBY'
      );
      
      // Track in index (best effort)
      try {
        await this.client.sadd(this.indexSetKey, this.k(key));
      } catch {
        // Ignore index errors for counters
      }
      
      return Number(result);
    } catch (err) {
      console.error('Redis INCREMENT error:', err);
      return null;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number | null> {
    try {
      const result = await this.withRetry(
        () => this.client.decrby(this.k(key), amount),
        'DECRBY'
      );
      
      try {
        await this.client.sadd(this.indexSetKey, this.k(key));
      } catch {
        // Ignore index errors
      }
      
      return Number(result);
    } catch (err) {
      console.error('Redis DECREMENT error:', err);
      return null;
    }
  }

  /**
   * Clear all keys in namespace using index
   * Free tier friendly: batches deletes to avoid rate limits
   * WARNING: Uses SMEMBERS - for >10k keys, consider pagination
   */
  async clearNamespaceUsingIndex(): Promise<void> {
    try {
      // Clear permanent keys in batches
      const members = await this.client.smembers<string[]>(this.indexSetKey);
      if (members && members.length > 0) {
        await this.batchDelete(members);
        await this.client.del(this.indexSetKey);
      }

      // Clear TTL keys in batches
      const ttlMembers = await this.client.smembers<string[]>(this.ttlIndexSetKey);
      if (ttlMembers && ttlMembers.length > 0) {
        await this.batchDelete(ttlMembers);
        await this.client.del(this.ttlIndexSetKey);
      }
    } catch (err) {
      console.error('Redis clear namespace error:', err);
    }
  }

  /**
   * Delete keys in batches to respect rate limits
   */
  private async batchDelete(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += this.MAX_BATCH_SIZE) {
      const batch = keys.slice(i, i + this.MAX_BATCH_SIZE);
      try {
        await this.withRetry(
          () => this.client.del(...batch),
          'BATCH_DEL'
        );
        
        // Small delay between batches to be nice to free tier
        if (i + this.MAX_BATCH_SIZE < keys.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        console.error(`Failed to delete batch starting at index ${i}:`, err);
      }
    }
  }

  /**
   * Clean expired keys from TTL index
   * IMPORTANT: Run this periodically (e.g. via cron every hour) to prevent index bloat
   * Uses EXISTS in batches to be rate-limit friendly
   */
  async cleanExpiredFromIndex(): Promise<number> {
    try {
      const ttlMembers = await this.client.smembers<string[]>(this.ttlIndexSetKey);
      if (!ttlMembers || ttlMembers.length === 0) return 0;

      const expiredKeys: string[] = [];

      // Check existence in batches
      for (let i = 0; i < ttlMembers.length; i += this.MAX_BATCH_SIZE) {
        const batch = ttlMembers.slice(i, i + this.MAX_BATCH_SIZE);
        
        // Check each key in batch
        const results = await Promise.allSettled(
          batch.map(key => this.client.exists(key))
        );
        
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && Number(result.value) === 0) {
            expiredKeys.push(batch[idx]);
          }
        });
        
        // Small delay between batches
        if (i + this.MAX_BATCH_SIZE < ttlMembers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Remove expired keys from index in batches
      if (expiredKeys.length > 0) {
        for (let i = 0; i < expiredKeys.length; i += this.MAX_BATCH_SIZE) {
          const batch = expiredKeys.slice(i, i + this.MAX_BATCH_SIZE);
          await this.client.srem(this.ttlIndexSetKey, ...batch);
        }
      }

      return expiredKeys.length;
    } catch (err) {
      console.error('Redis clean expired error:', err);
      return 0;
    }
  }

  /**
   * Clear keys matching pattern using SCAN (cursor-based, safe for large datasets)
   * Free tier friendly: small batches with delays
   */
  async clear(pattern: string): Promise<number> {
    let totalDeleted = 0;
    
    try {
      let cursor = '0';
      do {
        const result = await this.withRetry(
          () => this.client.scan(cursor, { match: pattern, count: this.MAX_BATCH_SIZE }),
          'SCAN'
        );
        
        cursor = String(result[0]);
        const keys = result[1] || [];
        
        if (keys.length > 0) {
          try {
            await this.client.del(...keys);
            totalDeleted += keys.length;
          } catch (delErr) {
            console.error('Failed to delete batch:', delErr);
          }
        }
        
        // Small delay between scans to respect rate limits
        if (cursor !== '0') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (cursor !== '0');
      
      return totalDeleted;
    } catch (err) {
      console.error('Redis clear (pattern) error:', err);
      return totalDeleted;
    }
  }

  /**
   * Health check for monitoring
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.withRetry(
        () => this.client.ping(),
        'PING'
      );
      return result === 'PONG';
    } catch (err) {
      console.error('Redis PING error:', err);
      return false;
    }
  }

  /**
   * Get cache statistics
   * Uses SCARD which is O(1) - safe for large sets
   */
  async getStats(): Promise<{ permanentKeys: number; ttlKeys: number }> {
    try {
      const [permanentKeys, ttlKeys] = await Promise.all([
        this.client.scard(this.indexSetKey).then(Number),
        this.client.scard(this.ttlIndexSetKey).then(Number),
      ]);
      
      return { permanentKeys, ttlKeys };
    } catch (err) {
      console.error('Redis getStats error:', err);
      return { permanentKeys: 0, ttlKeys: 0 };
    }
  }
}

// Export both the class and a singleton instance
export const cache = new RedisCache();