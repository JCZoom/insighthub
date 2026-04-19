export interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
  role?: string;
}

export interface SnowflakeConnectionOptions {
  account: string;
  username: string;
  password: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  role?: string;
  application?: string;
  timeout?: number;
  insecureConnect?: boolean;
  ocspResponseCacheFilename?: string;
}

/**
 * Get Snowflake configuration from environment variables
 */
export function getSnowflakeConfig(): SnowflakeConfig | null {
  const {
    SNOWFLAKE_ACCOUNT,
    SNOWFLAKE_USERNAME,
    SNOWFLAKE_PASSWORD,
    SNOWFLAKE_WAREHOUSE,
    SNOWFLAKE_DATABASE,
    SNOWFLAKE_SCHEMA,
    SNOWFLAKE_ROLE
  } = process.env;

  // Return null if any required config is missing
  if (!SNOWFLAKE_ACCOUNT || !SNOWFLAKE_USERNAME || !SNOWFLAKE_PASSWORD ||
      !SNOWFLAKE_WAREHOUSE || !SNOWFLAKE_DATABASE || !SNOWFLAKE_SCHEMA) {
    return null;
  }

  return {
    account: SNOWFLAKE_ACCOUNT,
    username: SNOWFLAKE_USERNAME,
    password: SNOWFLAKE_PASSWORD,
    warehouse: SNOWFLAKE_WAREHOUSE,
    database: SNOWFLAKE_DATABASE,
    schema: SNOWFLAKE_SCHEMA,
    role: SNOWFLAKE_ROLE || undefined
  };
}

/**
 * Build Snowflake connection options from configuration
 */
export function buildConnectionOptions(config: SnowflakeConfig): SnowflakeConnectionOptions {
  return {
    account: config.account,
    username: config.username,
    password: config.password,
    warehouse: config.warehouse,
    database: config.database,
    schema: config.schema,
    role: config.role,
    application: 'InsightHub',
    timeout: 30000, // 30 seconds
    insecureConnect: false,
    ocspResponseCacheFilename: process.env.NODE_ENV === 'production' ?
      '/tmp/ocsp_response_cache' : undefined
  };
}

/**
 * Validate Snowflake configuration
 */
export function validateSnowflakeConfig(config: SnowflakeConfig): string[] {
  const errors: string[] = [];

  if (!config.account.trim()) errors.push('Snowflake account is required');
  if (!config.username.trim()) errors.push('Snowflake username is required');
  if (!config.password.trim()) errors.push('Snowflake password is required');
  if (!config.warehouse.trim()) errors.push('Snowflake warehouse is required');
  if (!config.database.trim()) errors.push('Snowflake database is required');
  if (!config.schema.trim()) errors.push('Snowflake schema is required');

  return errors;
}

/**
 * Check if Snowflake is configured and available
 */
export function isSnowflakeConfigured(): boolean {
  // Check if snowflake SDK is available
  let snowflake: any;
  try {
    snowflake = require('snowflake-sdk');
  } catch {
    return false;
  }

  const config = getSnowflakeConfig();
  return config !== null && validateSnowflakeConfig(config).length === 0;
}