// Optional import for Snowflake SDK - will be undefined if not installed
let snowflake: any;
try {
  snowflake = require('snowflake-sdk');
} catch (error) {
  console.warn('Snowflake SDK not installed - Snowflake functionality will be disabled');
  snowflake = null;
}

import { getSnowflakeConfig, buildConnectionOptions, type SnowflakeConfig } from './config';

export interface SnowflakeConnection {
  id: string;
  connection: any; // snowflake.Connection when available
  isConnected: boolean;
  lastUsed: Date;
  inUse: boolean;
}

export interface QueryResult<T = any> {
  rows: T[];
  columns: Array<{ name: string; type: string }>;
  executionTime: number;
  queryId?: string;
}

export class SnowflakeConnectionPool {
  private connections: Map<string, SnowflakeConnection> = new Map();
  private maxConnections: number = 5;
  private connectionTimeout: number = 30000; // 30 seconds
  private idleTimeout: number = 300000; // 5 minutes
  private config: SnowflakeConfig | null = null;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(maxConnections = 5) {
    this.maxConnections = maxConnections;
    this.config = getSnowflakeConfig();

    // Start cleanup interval to remove idle connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run every minute
  }

  /**
   * Check if Snowflake is available and configured
   */
  isAvailable(): boolean {
    return snowflake !== null && this.config !== null;
  }

  /**
   * Get an available connection from the pool or create a new one
   */
  async getConnection(): Promise<SnowflakeConnection> {
    if (!this.config) {
      throw new Error('Snowflake is not configured. Please check your environment variables.');
    }

    // Look for an available connection
    for (const [id, conn] of this.connections) {
      if (!conn.inUse && conn.isConnected) {
        conn.inUse = true;
        conn.lastUsed = new Date();
        return conn;
      }
    }

    // If we haven't reached max connections, create a new one
    if (this.connections.size < this.maxConnections) {
      return await this.createConnection();
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        for (const [id, conn] of this.connections) {
          if (!conn.inUse && conn.isConnected) {
            clearInterval(checkInterval);
            conn.inUse = true;
            conn.lastUsed = new Date();
            resolve(conn);
            return;
          }
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available Snowflake connection'));
      }, this.connectionTimeout);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.inUse = false;
      conn.lastUsed = new Date();
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<SnowflakeConnection> {
    if (!this.config) {
      throw new Error('Snowflake is not configured');
    }

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connectionOptions = buildConnectionOptions(this.config);

    return new Promise((resolve, reject) => {
      const connection = snowflake.createConnection(connectionOptions);

      connection.connect((err: any, conn: any) => {
        if (err) {
          console.error('Snowflake connection failed:', err);
          reject(new Error(`Failed to connect to Snowflake: ${err.message}`));
          return;
        }

        const snowflakeConn: SnowflakeConnection = {
          id: connectionId,
          connection: conn,
          isConnected: true,
          lastUsed: new Date(),
          inUse: true
        };

        this.connections.set(connectionId, snowflakeConn);
        console.log(`Snowflake connection established: ${connectionId}`);
        resolve(snowflakeConn);
      });
    });
  }

  /**
   * Execute a query using a connection from the pool
   */
  async executeQuery<T = any>(
    sqlText: string,
    binds?: any[],
    options?: any
  ): Promise<QueryResult<T>> {
    const connection = await this.getConnection();
    const startTime = Date.now();

    try {
      return new Promise((resolve, reject) => {
        const statement = connection.connection.execute({
          sqlText,
          binds: binds || [],
          complete: (err: any, stmt: any, rows: any) => {
            const executionTime = Date.now() - startTime;

            if (err) {
              console.error('Snowflake query error:', err);
              reject(new Error(`Query failed: ${err.message}`));
              return;
            }

            // Extract column metadata
            const columns = stmt.getColumns().map((col: any) => ({
              name: col.getName(),
              type: col.getType()
            }));

            resolve({
              rows: rows as T[],
              columns,
              executionTime,
              queryId: stmt.getQueryId()
            });
          },
          ...options
        });
      });
    } finally {
      this.releaseConnection(connection.id);
    }
  }

  /**
   * Execute a parameterized query with proper escaping
   */
  async executeParameterizedQuery<T = any>(
    sqlText: string,
    parameters: Record<string, any> = {}
  ): Promise<QueryResult<T>> {
    // Convert named parameters to positional binds for Snowflake
    const binds: any[] = [];
    let processedSql = sqlText;

    // Replace named parameters with ? placeholders
    for (const [key, value] of Object.entries(parameters)) {
      const regex = new RegExp(`:${key}\\b`, 'g');
      processedSql = processedSql.replace(regex, '?');
      binds.push(value);
    }

    return this.executeQuery<T>(processedSql, binds);
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();

    for (const [id, conn] of this.connections) {
      const idleTime = now - conn.lastUsed.getTime();

      if (!conn.inUse && idleTime > this.idleTimeout) {
        try {
          conn.connection.destroy((err: any) => {
            if (err) {
              console.error(`Error closing idle connection ${id}:`, err);
            } else {
              console.log(`Closed idle Snowflake connection: ${id}`);
            }
          });
        } catch (err) {
          console.error(`Error destroying idle connection ${id}:`, err);
        }

        this.connections.delete(id);
      }
    }
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const closePromises = Array.from(this.connections.values()).map(conn =>
      new Promise<void>((resolve) => {
        conn.connection.destroy((err: any) => {
          if (err) {
            console.error(`Error closing connection ${conn.id}:`, err);
          }
          resolve();
        });
      })
    );

    await Promise.all(closePromises);
    this.connections.clear();
    console.log('All Snowflake connections closed');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      activeConnections: Array.from(this.connections.values()).filter(c => c.inUse).length,
      idleConnections: Array.from(this.connections.values()).filter(c => !c.inUse).length,
      maxConnections: this.maxConnections,
      isAvailable: this.isAvailable()
    };
  }
}

// Global connection pool instance
let connectionPool: SnowflakeConnectionPool | null = null;

/**
 * Get the global Snowflake connection pool
 */
export function getSnowflakeConnectionPool(): SnowflakeConnectionPool {
  if (!connectionPool) {
    connectionPool = new SnowflakeConnectionPool();
  }
  return connectionPool;
}

/**
 * Execute a query using the global connection pool
 */
export async function executeSnowflakeQuery<T = any>(
  sqlText: string,
  parameters?: Record<string, any>
): Promise<QueryResult<T>> {
  const pool = getSnowflakeConnectionPool();

  if (!pool.isAvailable()) {
    throw new Error('Snowflake is not configured or available');
  }

  if (parameters && Object.keys(parameters).length > 0) {
    return pool.executeParameterizedQuery<T>(sqlText, parameters);
  }

  return pool.executeQuery<T>(sqlText);
}

/**
 * Check Snowflake connection health
 */
export async function checkSnowflakeHealth(): Promise<{
  isHealthy: boolean;
  error?: string;
  stats: ReturnType<SnowflakeConnectionPool['getStats']>
}> {
  try {
    const pool = getSnowflakeConnectionPool();

    if (!pool.isAvailable()) {
      return {
        isHealthy: false,
        error: 'Snowflake is not configured',
        stats: pool.getStats()
      };
    }

    // Test with a simple query
    const result = await executeSnowflakeQuery('SELECT 1 as test');

    return {
      isHealthy: result.rows.length > 0,
      stats: pool.getStats()
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats: { totalConnections: 0, activeConnections: 0, idleConnections: 0, maxConnections: 5, isAvailable: false }
    };
  }
}

// Cleanup on process exit
process.on('exit', () => {
  if (connectionPool) {
    connectionPool.close();
  }
});

process.on('SIGINT', () => {
  if (connectionPool) {
    connectionPool.close().then(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  if (connectionPool) {
    connectionPool.close().then(() => process.exit(0));
  } else {
    process.exit(0);
  }
});