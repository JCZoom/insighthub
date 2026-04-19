export interface RedisConfig {
  url: string;
  password?: string;
  db: number;
  host?: string;
  port?: number;
}

/**
 * Get Redis configuration from environment variables
 */
export function getRedisConfig(): RedisConfig {
  const {
    REDIS_URL = 'redis://localhost:6379',
    REDIS_PASSWORD,
    REDIS_DB = '0',
    REDIS_HOST,
    REDIS_PORT
  } = process.env;

  const config: RedisConfig = {
    url: REDIS_URL,
    password: REDIS_PASSWORD || undefined,
    db: parseInt(REDIS_DB, 10) || 0
  };

  // Parse host and port from URL if not provided separately
  if (REDIS_HOST && REDIS_PORT) {
    config.host = REDIS_HOST;
    config.port = parseInt(REDIS_PORT, 10);
  }

  return config;
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  const config = getRedisConfig();
  return !!config.url || (!!config.host && !!config.port);
}

/**
 * Build Redis connection options for IORedis
 */
export function buildRedisConnectionOptions(config: RedisConfig) {
  if (config.host && config.port) {
    return {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true
    };
  }

  return {
    connectionString: config.url,
    password: config.password,
    db: config.db,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true
  };
}