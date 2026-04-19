/**
 * Environment variable validation and typed access.
 *
 * Import this at the top of instrumentation.ts or layout.tsx to fail fast
 * when required variables are missing.
 *
 * Usage:
 *   import { env, assertEnv } from '@/lib/env';
 *   assertEnv();                     // Throws in production if required vars missing
 *   const key = env.ANTHROPIC_API_KEY; // Typed, with defaults
 */

// ── Variable Definitions ──────────────────────────────────

interface EnvVarDef {
  required: boolean;
  description: string;
  example?: string;
  validate?: (value: string) => boolean;
}

const ENV_VARS: Record<string, EnvVarDef> = {
  DATABASE_URL: {
    required: true,
    description: 'SQLite database path',
    example: 'file:./dev.db',
    validate: (v) => v.startsWith('file:') || v.startsWith('postgresql:'),
  },
  NEXTAUTH_SECRET: {
    required: true,
    description: 'NextAuth JWT signing secret (min 32 chars in production)',
    validate: (v) => process.env.NODE_ENV !== 'production' || v.length >= 32,
  },
  ANTHROPIC_API_KEY: {
    required: false,
    description: 'Anthropic API key for Claude AI chat',
    example: 'sk-ant-...',
    validate: (v) => v.startsWith('sk-ant-'),
  },
  OPENAI_API_KEY: {
    required: false,
    description: 'OpenAI API key for Whisper voice transcription',
    example: 'sk-...',
    validate: (v) => v.startsWith('sk-'),
  },
  GOOGLE_CLIENT_ID: {
    required: false,
    description: 'Google OAuth client ID (required in production)',
  },
  GOOGLE_CLIENT_SECRET: {
    required: false,
    description: 'Google OAuth client secret (required in production)',
  },
  NEXT_PUBLIC_DEV_MODE: {
    required: false,
    description: 'Enable dev mode (bypasses auth, enables dev tools)',
    example: 'true',
  },
  ALLOWED_DOMAIN: {
    required: false,
    description: 'Email domain allowed for login',
    example: 'uszoom.com',
  },
  GIT_COMMIT: {
    required: false,
    description: 'Git commit hash (set by deploy script)',
  },
  ASANA_PERSONAL_ACCESS_TOKEN: {
    required: false,
    description: 'Asana PAT for project sync',
  },
  ASANA_WORKSPACE_GID: {
    required: false,
    description: 'Asana workspace GID',
  },
  ASANA_PROJECT_GID: {
    required: false,
    description: 'Asana project GID',
  },
  SNOWFLAKE_ACCOUNT: {
    required: false,
    description: 'Snowflake account identifier (Phase 3)',
  },
  SNOWFLAKE_USERNAME: {
    required: false,
    description: 'Snowflake username (Phase 3)',
  },
  SNOWFLAKE_PASSWORD: {
    required: false,
    description: 'Snowflake password (Phase 3)',
  },
  SNOWFLAKE_WAREHOUSE: {
    required: false,
    description: 'Snowflake warehouse name (Phase 3)',
  },
  SNOWFLAKE_DATABASE: {
    required: false,
    description: 'Snowflake database name (Phase 3)',
  },
  SNOWFLAKE_SCHEMA: {
    required: false,
    description: 'Snowflake schema name (Phase 3)',
  },
} as const;

// ── Validation ────────────────────────────────────────────

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  for (const [key, def] of Object.entries(ENV_VARS)) {
    const value = process.env[key];

    if (def.required && !value) {
      missing.push(key);
      continue;
    }

    if (value && def.validate && !def.validate(value)) {
      invalid.push(`${key} (${def.description})`);
    }
  }

  // Context-aware warnings
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY not set — AI chat will not work');
  }

  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY not set — voice input will not work');
  }

  if (!isDevMode && !process.env.GOOGLE_CLIENT_ID) {
    warnings.push('GOOGLE_CLIENT_ID not set and DEV_MODE is off — auth will fail');
  }

  if (isProd && isDevMode) {
    warnings.push('NEXT_PUBLIC_DEV_MODE is true in production — auth is bypassed!');
  }

  if (isProd && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    warnings.push('NEXTAUTH_SECRET is too short for production (min 32 chars)');
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings,
  };
}

export function assertEnv(): void {
  const result = validateEnv();

  for (const w of result.warnings) {
    console.warn(`⚠️  ENV: ${w}`);
  }

  // Warn (not fatal): dev mode in production bypasses auth
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEV_MODE === 'true'
  ) {
    console.warn(
      '🚨 WARNING: NEXT_PUBLIC_DEV_MODE=true in production — authentication is bypassed. ' +
        'Set NEXT_PUBLIC_DEV_MODE=false and configure Google OAuth for real deployments.',
    );
  }

  if (result.invalid.length > 0) {
    console.error(`❌ ENV: Invalid environment variables: ${result.invalid.join(', ')}`);
  }

  if (!result.valid) {
    const parts: string[] = [];
    if (result.missing.length > 0) {
      parts.push(`Missing: ${result.missing.join(', ')}`);
    }
    if (result.invalid.length > 0) {
      parts.push(`Invalid: ${result.invalid.join(', ')}`);
    }
    const msg = `Environment validation failed — ${parts.join('; ')}`;
    console.error(`❌ ENV: ${msg}`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
  }
}

// ── Typed Accessors ───────────────────────────────────────

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE === 'true',
  ALLOWED_DOMAIN: process.env.ALLOWED_DOMAIN || 'uszoom.com',
  GIT_COMMIT: process.env.GIT_COMMIT || '',
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
} as const;

// ── Documentation Helper ──────────────────────────────────

export function getEnvDocumentation(): string {
  const lines = ['# Environment Variables', ''];
  for (const [key, def] of Object.entries(ENV_VARS)) {
    const tag = def.required ? '(REQUIRED)' : '(optional)';
    lines.push(`# ${def.description} ${tag}`);
    if (def.example) {
      lines.push(`${key}=${def.example}`);
    } else {
      lines.push(`# ${key}=`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
