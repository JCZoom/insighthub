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
  VERIFY_INTEGRITY_ENABLED: {
    required: false,
    description: 'Enable the Data Integrity Verification Pipeline (default: true)',
    example: 'true',
  },
  VERIFY_INTEGRITY_AI_ENABLED: {
    required: false,
    description: 'Enable AI verification layers 2 & 2.5 (default: true)',
    example: 'true',
  },
  VERIFY_INTEGRITY_CONFIDENCE_THRESHOLD: {
    required: false,
    description: 'Confidence threshold below which escalation is triggered (default: 0.70)',
    example: '0.70',
    validate: (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 1; },
  },
  VERIFY_INTEGRITY_TIMEOUT_MS: {
    required: false,
    description: 'Max milliseconds to wait for AI verification (default: 5000)',
    example: '5000',
    validate: (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0; },
  },
  // Freshsales / Freshworks CRM integration (G-01, G-05, R-041, V-01).
  // Lives in `.env.local` for dev; on production EC2 these should be loaded
  // from `/opt/insighthub/.env.freshworks` (a separate file with mode 0600,
  // never copied via scp). See `docs/FRESHWORKS_OPERATOR_RUNBOOK.md`.
  FRESHSALES_API_KEY: {
    required: false,
    description: 'Freshsales API token (Freshworks CRM). Stored CC; never logged.',
    example: 'YOUR_FRESHSALES_API_TOKEN',
  },
  FRESHSALES_DOMAIN: {
    required: false,
    description: 'Freshsales tenant domain, e.g. uszoom.myfreshworks.com. Scheme + trailing slash are tolerated and stripped by shared/domain.ts normalizeDomain() at call time; the strict validator that previously lived here caused production boot failures and was inconsistent with FRESHDESK/FRESHCALLER/FRESHCHAT (none of which run a strict check). Removed 2026-05-19.',
    example: 'uszoom.myfreshworks.com',
  },
  FRESHSALES_CACHE_TTL_SECONDS: {
    required: false,
    description: 'Redis cache TTL for Freshsales responses (default: 60). Bounded retention per policy 3700 DR-01.',
    example: '60',
    validate: (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 && n <= 3600; },
  },
  FRESHSALES_RATE_LIMIT_PER_MIN: {
    required: false,
    description: 'Max Freshsales API calls per minute from InsightHub (default: 60; Freshsales free tier is 100/min).',
    example: '60',
    validate: (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 && n <= 100; },
  },
  // ── Freshdesk (support tickets) ────────────────────────────────────────────
  FRESHDESK_API_KEY: {
    required: false,
    description: 'Freshdesk API key (Freshworks support module). Stored CC; never logged.',
    example: 'YOUR_FRESHDESK_API_KEY',
  },
  FRESHDESK_DOMAIN: {
    required: false,
    description: 'Freshdesk tenant domain, e.g. mytenant.freshdesk.com.',
    example: 'mytenant.freshdesk.com',
  },
  FRESHDESK_RATE_LIMIT_PER_MIN: {
    required: false,
    description: 'Max Freshdesk API calls per minute (default: 40; Freshdesk free tier is 50/min).',
    example: '40',
    validate: (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 && n <= 50; },
  },
  // ── Freshcaller (voice / calls) ────────────────────────────────────────────
  FRESHCALLER_API_KEY: {
    required: false,
    description: 'Freshcaller API key. Stored CC; never logged. Custom auth header (X-Api-Auth).',
    example: 'YOUR_FRESHCALLER_API_KEY',
  },
  FRESHCALLER_DOMAIN: {
    required: false,
    description: 'Freshcaller tenant domain, e.g. mytenant.freshcaller.com.',
    example: 'mytenant.freshcaller.com',
  },
  FRESHCALLER_RATE_LIMIT_PER_MIN: {
    required: false,
    description: 'Max Freshcaller API calls per minute (default: 25; Freshcaller starter is 30/min).',
    example: '25',
    validate: (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 && n <= 30; },
  },
  // ── Freshchat (messaging) ──────────────────────────────────────────────────
  FRESHCHAT_API_KEY: {
    required: false,
    description: 'Freshchat API token (Bearer). Stored CC; never logged.',
    example: 'YOUR_FRESHCHAT_API_KEY',
  },
  FRESHCHAT_DOMAIN: {
    required: false,
    description: 'Freshchat tenant domain (UI host), e.g. mytenant.freshchat.com. Used for diagnostics; API calls go to api.freshchat.com.',
    example: 'mytenant.freshchat.com',
  },
  FRESHCHAT_API_HOST: {
    required: false,
    description: 'Freshchat API host override (default: api.freshchat.com). Most tenants use the default.',
    example: 'api.freshchat.com',
  },
  FRESHCHAT_RATE_LIMIT_PER_MIN: {
    required: false,
    description: 'Max Freshchat API calls per minute (default: 60). Bound by PII-volume policy, not vendor quota.',
    example: '60',
    validate: (v) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 && n <= 180; },
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

  // Dev mode in production — warn but don't crash (intentional until OAuth is configured)
  // TODO: Restore throw when OAuth is enabled and NEXT_PUBLIC_DEV_MODE is set to false
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEV_MODE === 'true'
  ) {
    console.warn(
      '⚠️  NEXT_PUBLIC_DEV_MODE=true in production — authentication is bypassed. ' +
      'This is acceptable during development but must be disabled before public launch.'
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
  VERIFY_INTEGRITY_ENABLED: process.env.VERIFY_INTEGRITY_ENABLED !== 'false',
  VERIFY_INTEGRITY_AI_ENABLED: process.env.VERIFY_INTEGRITY_AI_ENABLED !== 'false',
  VERIFY_INTEGRITY_CONFIDENCE_THRESHOLD: parseFloat(process.env.VERIFY_INTEGRITY_CONFIDENCE_THRESHOLD || '0.70'),
  VERIFY_INTEGRITY_TIMEOUT_MS: parseInt(process.env.VERIFY_INTEGRITY_TIMEOUT_MS || '5000', 10),
  FRESHSALES_API_KEY: process.env.FRESHSALES_API_KEY || '',
  FRESHSALES_DOMAIN: process.env.FRESHSALES_DOMAIN || '',
  FRESHSALES_CACHE_TTL_SECONDS: parseInt(process.env.FRESHSALES_CACHE_TTL_SECONDS || '60', 10),
  FRESHSALES_RATE_LIMIT_PER_MIN: parseInt(process.env.FRESHSALES_RATE_LIMIT_PER_MIN || '60', 10),
  FRESHSALES_CONFIGURED:
    !!process.env.FRESHSALES_API_KEY && !!process.env.FRESHSALES_DOMAIN,
  FRESHDESK_API_KEY: process.env.FRESHDESK_API_KEY || '',
  FRESHDESK_DOMAIN: process.env.FRESHDESK_DOMAIN || '',
  FRESHDESK_RATE_LIMIT_PER_MIN: parseInt(process.env.FRESHDESK_RATE_LIMIT_PER_MIN || '40', 10),
  FRESHDESK_CONFIGURED:
    !!process.env.FRESHDESK_API_KEY && !!process.env.FRESHDESK_DOMAIN,
  FRESHCALLER_API_KEY: process.env.FRESHCALLER_API_KEY || '',
  FRESHCALLER_DOMAIN: process.env.FRESHCALLER_DOMAIN || '',
  FRESHCALLER_RATE_LIMIT_PER_MIN: parseInt(process.env.FRESHCALLER_RATE_LIMIT_PER_MIN || '25', 10),
  FRESHCALLER_CONFIGURED:
    !!process.env.FRESHCALLER_API_KEY && !!process.env.FRESHCALLER_DOMAIN,
  FRESHCHAT_API_KEY: process.env.FRESHCHAT_API_KEY || '',
  FRESHCHAT_DOMAIN: process.env.FRESHCHAT_DOMAIN || '',
  FRESHCHAT_API_HOST: process.env.FRESHCHAT_API_HOST || 'api.freshchat.com',
  FRESHCHAT_RATE_LIMIT_PER_MIN: parseInt(process.env.FRESHCHAT_RATE_LIMIT_PER_MIN || '60', 10),
  FRESHCHAT_CONFIGURED:
    !!process.env.FRESHCHAT_API_KEY,
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
