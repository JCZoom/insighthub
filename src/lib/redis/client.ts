// Optional import for Redis - will be undefined if not installed
let Redis: any;
try {
  Redis = require('ioredis');
} catch (error) {
  console.warn('Redis (ioredis) not installed - caching functionality will be disabled');
  Redis = null;
}

import { getRedisConfig, buildRedisConnectionOptions, isRedisConfigured } from './config';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

export interface QueryCacheKey {
  query: string;
  parameters?: Record<string, any>;
  userId?: string;
  timestamp?: string;
}

export class QueryCacheManager {
  private redis: any | null = null;
  private isConnected = false;
  private defaultTTL = 300; // 5 minutes default
  private keyPrefix = 'snowflake:query:';

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    if (!Redis) {
      console.warn('Redis (ioredis) is not installed, query caching will be disabled');
      return;
    }

    if (!isRedisConfigured()) {
      console.warn('Redis is not configured, query caching will be disabled');
      return;
    }

    try {
      const config = getRedisConfig();
      const options = buildRedisConnectionOptions(config);

      this.redis = new Redis(options);

      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (err: any) => {
        console.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      // Test the connection
      await this.redis.ping();
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if Redis is available for caching
   */
  isAvailable(): boolean {
    return this.redis !== null && this.isConnected;
  }

  /**
   * Generate a cache key for a query
   */
  private generateCacheKey(keyData: QueryCacheKey): string {
    const { query, parameters, userId } = keyData;

    // Create a deterministic key based on query and parameters
    const queryNormalized = query.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramsString = parameters ? JSON.stringify(parameters) : '';
    const userPrefix = userId ? `user:${userId}:` : '';

    // Create a hash of the query and parameters for a shorter key
    const crypto = require('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(`${queryNormalized}${paramsString}`)
      .digest('hex')
      .substring(0, 16);

    return `${this.keyPrefix}${userPrefix}${hash}`;
  }

  /**
   * Get cached query result
   */
  async get<T = any>(keyData: QueryCacheKey): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const key = this.generateCacheKey(keyData);
      const cached = await this.redis!.get(key);

      if (cached) {
        const parsed = JSON.parse(cached);
        console.log(`Cache hit for query: ${keyData.query.substring(0, 50)}...`);
        return parsed;
      }

      return null;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached query result
   */
  async set<T = any>(
    keyData: QueryCacheKey,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateCacheKey(keyData);
      const ttl = options.ttl || this.defaultTTL;

      // Add metadata to the cached value
      const cacheData = {
        data: value,
        cachedAt: new Date().toISOString(),
        query: keyData.query.substring(0, 100), // Store truncated query for debugging
        userId: keyData.userId
      };

      const serialized = JSON.stringify(cacheData);

      await this.redis!.setex(key, ttl, serialized);
      console.log(`Cached query result for ${ttl}s: ${keyData.query.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('Redis cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached query result
   */
  async delete(keyData: QueryCacheKey): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const key = this.generateCacheKey(keyData);
      const deleted = await this.redis!.del(key);
      return deleted > 0;
    } catch (error) {
      console.error('Redis cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cached queries for a user
   */
  async clearUserCache(userId: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const pattern = `${this.keyPrefix}user:${userId}:*`;
      const keys = await this.redis!.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redis!.del(...keys);
      console.log(`Cleared ${deleted} cached queries for user ${userId}`);
      return deleted;
    } catch (error) {
      console.error('Redis cache clear user error:', error);
      return 0;
    }
  }

  /**
   * Clear all cached queries
   */
  async clearAllCache(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis!.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redis!.del(...keys);
      console.log(`Cleared ${deleted} total cached queries`);
      return deleted;
    } catch (error) {
      console.error('Redis cache clear all error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    isAvailable: boolean;
    totalKeys: number;
    memoryUsage?: string;
    hitRate?: number;
  }> {
    if (!this.isAvailable()) {
      return { isAvailable: false, totalKeys: 0 };
    }

    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis!.keys(pattern);

      // Get memory info if available
      let memoryUsage: string | undefined;
      try {
        const info = await this.redis!.info('memory');
        const usedMemoryMatch = info.match(/used_memory_human:(.+)/);
        if (usedMemoryMatch) {
          memoryUsage = usedMemoryMatch[1].trim();
        }
      } catch {
        // Ignore if memory info is not available
      }

      return {
        isAvailable: true,
        totalKeys: keys.length,
        memoryUsage
      };
    } catch (error) {
      console.error('Redis cache stats error:', error);
      return { isAvailable: false, totalKeys: 0 };
    }
  }

  /**
   * Set default TTL for cached queries
   */
  setDefaultTTL(seconds: number): void {
    this.defaultTTL = seconds;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }
}

// Global cache manager instance
let cacheManager: QueryCacheManager | null = null;

/**
 * Get the global query cache manager
 */
export function getQueryCacheManager(): QueryCacheManager {
  if (!cacheManager) {
    cacheManager = new QueryCacheManager();
  }
  return cacheManager;
}

/**
 * Cached query execution wrapper
 */
export async function executeCachedQuery<T = any>(
  queryKey: QueryCacheKey,
  queryFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cache = getQueryCacheManager();

  // Try to get from cache first
  const cached = await cache.get<any>(queryKey);
  if (cached && cached.data) {
    return cached.data as T;
  }

  // Execute the query
  const result = await queryFn();

  // Cache the result
  await cache.set(queryKey, result, options);

  return result;
}

/**
 * Utility to create cache keys for common query patterns
 */
export function createQueryCacheKey(
  query: string,
  parameters?: Record<string, any>,
  userId?: string
): QueryCacheKey {
  return { query, parameters, userId };
}

// Cleanup on process exit
process.on('exit', () => {
  if (cacheManager) {
    cacheManager.close();
  }
});

process.on('SIGINT', () => {
  if (cacheManager) {
    cacheManager.close().then(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  if (cacheManager) {
    cacheManager.close().then(() => process.exit(0));
  } else {
    process.exit(0);
  }
});