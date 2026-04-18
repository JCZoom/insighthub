/**
 * Environment variable validation.
 * Import this at the top of instrumentation.ts or layout.tsx to fail fast
 * when required variables are missing.
 */

const requiredVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
] as const;

const optionalVars = [
  'ANTHROPIC_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_DEV_MODE',
  'ASANA_PERSONAL_ACCESS_TOKEN',
  'ASANA_WORKSPACE_GID',
  'ASANA_PROJECT_GID',
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USERNAME',
  'SNOWFLAKE_PASSWORD',
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_DATABASE',
  'SNOWFLAKE_SCHEMA',
] as const;

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of requiredVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Warn about optional but recommended vars
  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY not set — AI chat will not work');
  }

  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  if (!isDevMode && !process.env.GOOGLE_CLIENT_ID) {
    warnings.push('GOOGLE_CLIENT_ID not set and DEV_MODE is off — auth will fail');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function assertEnv(): void {
  const result = validateEnv();

  for (const w of result.warnings) {
    console.warn(`⚠️  ENV: ${w}`);
  }

  if (!result.valid) {
    const msg = `Missing required environment variables: ${result.missing.join(', ')}`;
    console.error(`❌ ENV: ${msg}`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
  }
}

// Export typed env accessors
export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE === 'true',
  ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN || 'uszoom.com',
} as const;
