import { executeSnowflakeQuery, checkSnowflakeHealth, type QueryResult } from './connection';
import { getQueryCacheManager, executeCachedQuery, createQueryCacheKey, type CacheOptions } from '../redis/client';
import { isSnowflakeConfigured } from './config';
import type { SessionUser } from '@/lib/auth/session';

export interface SnowflakeQueryOptions {
  useCache?: boolean;
  cacheTTL?: number; // Cache TTL in seconds
  timeout?: number; // Query timeout in seconds
  userId?: string;
  skipValidation?: boolean;
}

export interface SnowflakeQueryResult<T = any> {
  rows: T[];
  columns: Array<{ name: string; type: string }>;
  executionTime: number;
  queryId?: string;
  fromCache: boolean;
  totalRows: number;
}

/**
 * SQL injection prevention patterns
 */
const DANGEROUS_SQL_PATTERNS = [
  /;\s*(drop|delete|truncate|alter|create|grant|revoke)\s+/i,
  /union\s+select/i,
  /insert\s+into/i,
  /update\s+.+set/i,
  /exec(ute)?\s*\(/i,
  /script\s*:/i,
  /<script/i,
  /javascript\s*:/i
];

/**
 * Validate SQL query for security concerns
 */
function validateQuery(sql: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      errors.push(`Query contains potentially dangerous SQL pattern: ${pattern.source}`);
    }
  }

  // Check for multiple statements (basic check)
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  if (statements.length > 1) {
    errors.push('Multiple SQL statements are not allowed');
  }

  // Ensure it's a SELECT statement for safety
  const trimmedSql = sql.trim().toLowerCase();
  if (!trimmedSql.startsWith('select') && !trimmedSql.startsWith('with') && !trimmedSql.startsWith('show') && !trimmedSql.startsWith('describe')) {
    errors.push('Only SELECT, WITH, SHOW, and DESCRIBE statements are allowed');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize and validate SQL parameters
 */
function sanitizeParameters(parameters: Record<string, any> = {}): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(parameters)) {
    // Validate parameter name (alphanumeric and underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(key)) {
      throw new Error(`Invalid parameter name: ${key}. Parameter names can only contain letters, numbers, and underscores.`);
    }

    // Sanitize value based on type
    if (typeof value === 'string') {
      // Basic string sanitization
      sanitized[key] = value.replace(/['\";]/g, ''); // Remove quotes and semicolons
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value instanceof Date) {
      sanitized[key] = value.toISOString();
    } else if (value === null || value === undefined) {
      sanitized[key] = null;
    } else {
      // For complex types, convert to JSON string
      sanitized[key] = JSON.stringify(value);
    }
  }

  return sanitized;
}

/**
 * Add default limits to prevent resource exhaustion
 */
function addQueryLimits(sql: string, defaultLimit = 10000): string {
  const trimmedSql = sql.trim().toLowerCase();

  // Don't modify if it already has a LIMIT clause
  if (trimmedSql.includes('limit ')) {
    return sql;
  }

  // Don't modify aggregate queries or system queries
  if (trimmedSql.includes('count(') ||
      trimmedSql.includes('sum(') ||
      trimmedSql.includes('avg(') ||
      trimmedSql.includes('max(') ||
      trimmedSql.includes('min(') ||
      trimmedSql.startsWith('show ') ||
      trimmedSql.startsWith('describe ')) {
    return sql;
  }

  // Add LIMIT to prevent runaway queries
  return `${sql.trim()} LIMIT ${defaultLimit}`;
}

export class SnowflakeQueryExecutor {
  private defaultCacheTTL = 300; // 5 minutes
  private defaultTimeout = 30000; // 30 seconds
  private defaultLimit = 10000; // Default row limit

  /**
   * Check if Snowflake is available
   */
  isAvailable(): boolean {
    return isSnowflakeConfigured();
  }

  /**
   * Execute a parameterized Snowflake query with caching
   */
  async executeQuery<T = any>(
    sql: string,
    parameters: Record<string, any> = {},
    options: SnowflakeQueryOptions = {}
  ): Promise<SnowflakeQueryResult<T>> {
    if (!this.isAvailable()) {
      throw new Error('Snowflake is not configured or available');
    }

    // Validate SQL query for security
    if (!options.skipValidation) {
      const validation = validateQuery(sql);
      if (!validation.isValid) {
        throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Sanitize parameters
    const sanitizedParameters = sanitizeParameters(parameters);

    // Add query limits for safety
    const limitedSql = addQueryLimits(sql, this.defaultLimit);

    // Prepare cache key
    const cacheKey = createQueryCacheKey(limitedSql, sanitizedParameters, options.userId);

    const executeQuery = async (): Promise<QueryResult<T>> => {
      try {
        console.log(`Executing Snowflake query: ${limitedSql.substring(0, 100)}...`);
        const result = await executeSnowflakeQuery<T>(limitedSql, sanitizedParameters);
        return result;
      } catch (error) {
        console.error('Snowflake query execution error:', error);
        throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    let result: QueryResult<T>;
    let fromCache = false;

    if (options.useCache !== false) {
      // Use caching
      const cacheOptions: CacheOptions = {
        ttl: options.cacheTTL || this.defaultCacheTTL
      };

      const cachedResult = await executeCachedQuery(cacheKey, executeQuery, cacheOptions);
      result = cachedResult;

      // Check if result came from cache by comparing execution time
      fromCache = cachedResult.executionTime < 50; // Assume < 50ms means from cache
    } else {
      // Skip caching
      result = await executeQuery();
    }

    return {
      rows: result.rows,
      columns: result.columns,
      executionTime: result.executionTime,
      queryId: result.queryId,
      fromCache,
      totalRows: result.rows.length
    };
  }

  /**
   * Execute a simple query with automatic parameter binding
   */
  async query<T = any>(
    sql: string,
    parameters?: Record<string, any>,
    options?: SnowflakeQueryOptions
  ): Promise<SnowflakeQueryResult<T>> {
    return this.executeQuery<T>(sql, parameters, options);
  }

  /**
   * Execute a query with user context for permissions
   */
  async queryWithUser<T = any>(
    user: SessionUser,
    sql: string,
    parameters?: Record<string, any>,
    options?: Omit<SnowflakeQueryOptions, 'userId'>
  ): Promise<SnowflakeQueryResult<T>> {
    return this.executeQuery<T>(sql, parameters, {
      ...options,
      userId: user.id
    });
  }

  /**
   * Get query execution health status
   */
  async getHealth() {
    return checkSnowflakeHealth();
  }

  /**
   * Clear cache for a specific user
   */
  async clearUserCache(userId: string): Promise<number> {
    const cacheManager = getQueryCacheManager();
    return cacheManager.clearUserCache(userId);
  }

  /**
   * Clear all query cache
   */
  async clearAllCache(): Promise<number> {
    const cacheManager = getQueryCacheManager();
    return cacheManager.clearAllCache();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const cacheManager = getQueryCacheManager();
    return cacheManager.getStats();
  }

  /**
   * Set configuration options
   */
  configure(options: {
    defaultCacheTTL?: number;
    defaultTimeout?: number;
    defaultLimit?: number;
  }) {
    if (options.defaultCacheTTL) this.defaultCacheTTL = options.defaultCacheTTL;
    if (options.defaultTimeout) this.defaultTimeout = options.defaultTimeout;
    if (options.defaultLimit) this.defaultLimit = options.defaultLimit;
  }
}

// Global query executor instance
let queryExecutor: SnowflakeQueryExecutor | null = null;

/**
 * Get the global Snowflake query executor
 */
export function getSnowflakeQueryExecutor(): SnowflakeQueryExecutor {
  if (!queryExecutor) {
    queryExecutor = new SnowflakeQueryExecutor();
  }
  return queryExecutor;
}

/**
 * Execute a Snowflake query with security validation and caching
 */
export async function executeSecureQuery<T = any>(
  sql: string,
  parameters?: Record<string, any>,
  options?: SnowflakeQueryOptions
): Promise<SnowflakeQueryResult<T>> {
  const executor = getSnowflakeQueryExecutor();
  return executor.executeQuery<T>(sql, parameters, options);
}

/**
 * Execute a query with user context
 */
export async function executeUserQuery<T = any>(
  user: SessionUser,
  sql: string,
  parameters?: Record<string, any>,
  options?: Omit<SnowflakeQueryOptions, 'userId'>
): Promise<SnowflakeQueryResult<T>> {
  const executor = getSnowflakeQueryExecutor();
  return executor.queryWithUser<T>(user, sql, parameters, options);
}

/**
 * Utility functions for common query patterns
 */
export class SnowflakeQueryBuilder {
  /**
   * Build a safe SELECT query with parameters
   */
  static select(table: string, columns: string[] = ['*'], where?: Record<string, any>, limit = 1000): {
    sql: string;
    parameters: Record<string, any>;
  } {
    const columnsStr = columns.join(', ');
    let sql = `SELECT ${columnsStr} FROM ${table}`;
    const parameters: Record<string, any> = {};

    if (where && Object.keys(where).length > 0) {
      const whereConditions = Object.keys(where).map((key, index) => {
        const paramKey = `param_${index}`;
        parameters[paramKey] = where[key];
        return `${key} = :${paramKey}`;
      });
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    sql += ` LIMIT ${limit}`;

    return { sql, parameters };
  }

  /**
   * Build a COUNT query with parameters
   */
  static count(table: string, where?: Record<string, any>): {
    sql: string;
    parameters: Record<string, any>;
  } {
    let sql = `SELECT COUNT(*) as total FROM ${table}`;
    const parameters: Record<string, any> = {};

    if (where && Object.keys(where).length > 0) {
      const whereConditions = Object.keys(where).map((key, index) => {
        const paramKey = `param_${index}`;
        parameters[paramKey] = where[key];
        return `${key} = :${paramKey}`;
      });
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    return { sql, parameters };
  }

  /**
   * Build a schema introspection query
   */
  static describeTable(database: string, schema: string, table: string): {
    sql: string;
    parameters: Record<string, any>;
  } {
    return {
      sql: 'DESCRIBE TABLE :database.:schema.:table',
      parameters: { database, schema, table }
    };
  }
}