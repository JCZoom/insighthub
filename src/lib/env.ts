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
  // ── Dev-mode flags ────────────────────────────────────────────────────────
  // Two flags by design — DO NOT collapse them.
  //
  // DEV_MODE (server-only, runtime-evaluated) is the SECURITY flag. It
  // controls authentication bypass in middleware, the NextAuth credentials
  // provider, the JWT/session callbacks, and the session helpers. Because
  // it is NOT prefixed with NEXT_PUBLIC_, Next.js does NOT inline it into
  // the build at compile time — it is read from process.env at request
  // time. That means flipping `.env.local` and restarting the service is
  // sufficient to toggle it. Set to 'true' for local dev; MUST be 'false'
  // (or unset) on production deployments.
  //
  // NEXT_PUBLIC_DEV_MODE (client, build-baked) is the UI HINT flag. It
  // controls cosmetic affordances visible to the browser (dev login
  // button on /login, power-user demo shortcut in MetricExplanationModal).
  // Because it IS prefixed with NEXT_PUBLIC_, Next.js inlines its value
  // into the JavaScript bundle at `next build` time. Changes to it at
  // runtime have NO effect. It is NOT a security flag.
  //
  // Operators: keep the two values in sync in `.env.local`. The
  // validateEnv() function below warns at startup if they ever desync.
  // Historical context: docs/INCIDENT_RESPONSE_RUNBOOK.md entry from
  // 2026-05-19 when a NEXT_PUBLIC_-prefixed flag was being used for
  // security and a `.env.local` edit on prod failed to disable the bypass.
  DEV_MODE: {
    required: false,
    description: 'Server-only auth bypass (runtime-evaluated). MUST be false/unset in production.',
    example: 'true',
  },
  NEXT_PUBLIC_DEV_MODE: {
    required: false,
    description: 'Client UI hint flag for dev affordances (build-baked). NOT a security flag — see DEV_MODE.',
    example: 'true',
  },
  // Escape hatch for the assertEnv() hard-throw on NODE_ENV=production +
  // DEV_MODE=true. Set ONLY when you knowingly need a production-shaped
  // build to run with the auth bypass on — currently the single legitimate
  // use case is the CI e2e job, which downloads a production build artifact
  // and runs `npm run start` (NODE_ENV=production) with DEV_MODE=true so
  // Playwright tests can navigate without real Google sessions. Set at the
  // CI step level alongside DEV_MODE=true. NEVER set this in the prod
  // service unit (`/etc/systemd/system/insighthub.service` /
  // `/opt/insighthub/.env.local`). The verbose name is intentional —
  // it should never be set by accident or out of habit. Added 2026-05-20
  // alongside the assertEnv() hard-throw (INC-20260519-001 retro action).
  ALLOW_DEV_MODE_IN_PRODUCTION: {
    required: false,
    description: 'Escape hatch: allow DEV_MODE=true with NODE_ENV=production. CI-only.',
    example: '1',
  },
  TRUSTED_MFA_DOMAINS: {
    required: false,
    description:
      'Comma-separated email domains whose Workspace 2SV we trust as the MFA control when Google omits the amr claim. See src/lib/auth/mfa.ts for the trust assumption. Empty = strict amr-only mode.',
    example: 'uszoom.com',
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
  // Demo (sample) data sources — quarantine flag (post-2026-05-19).
  //
  // Two flags by design — DO NOT collapse them. This mirrors the
  // DEV_MODE / NEXT_PUBLIC_DEV_MODE pair (see commentary above):
  //
  //   FEATURE_DEMO_SOURCES (server-only, runtime-evaluated) is the
  //   DATA-HONESTY flag. It gates server-side discovery surfaces:
  //   the LLM source catalog, GET /api/data/query, GET /api/data/schema,
  //   and the widget-library API. Read from process.env at request time
  //   so flipping `.env.local` and restarting is enough. The POST
  //   /api/data/query path still resolves sample sources unconditionally
  //   — saved dashboards keep rendering. Discovery only is gated.
  //
  //   NEXT_PUBLIC_FEATURE_DEMO_SOURCES (client, build-baked) is the UI
  //   HINT flag. It gates client-side surfaces that hardcode demo
  //   template/dashboard names: the Templates page, Gallery initial
  //   state, and the editor's TEMPLATE_SCHEMAS hydration. Because it is
  //   NEXT_PUBLIC_-prefixed, Next.js inlines it at `next build` time.
  //   Operators: keep the two values in sync in `.env.local`. The
  //   validateEnv() function below warns at startup if they desync.
  //
  // Canonical registry: src/lib/data/sample-sources.ts (SAMPLE_SOURCES).
  // Architectural justification: docs/REAL_DATA_MIGRATION_PLAN_2026-05-19.md §3
  // and §A (the post-quarantine UI-leak follow-up).
  FEATURE_DEMO_SOURCES: {
    required: false,
    description: 'Server-side demo-source discovery gate. Runtime-evaluated. Default false.',
    example: 'false',
  },
  NEXT_PUBLIC_FEATURE_DEMO_SOURCES: {
    required: false,
    description:
      'Client UI hint flag mirroring FEATURE_DEMO_SOURCES. Build-baked. NOT a security flag — see FEATURE_DEMO_SOURCES.',
    example: 'false',
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
  // SECURITY flag — server-only, runtime-evaluated.
  const isDevMode = process.env.DEV_MODE === 'true';
  // UI hint flag — client, build-baked.
  const isPublicDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
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
    warnings.push('DEV_MODE is true in production — auth is bypassed!');
  }

  // Desync detection. Either-direction mismatch is an operator error.
  // Server bypass + client hint should agree.
  if (isDevMode !== isPublicDevMode) {
    warnings.push(
      `DEV_MODE (${isDevMode}) and NEXT_PUBLIC_DEV_MODE (${isPublicDevMode}) disagree — ` +
      'these should match in .env.local. The server flag is authoritative for security; ' +
      'the public flag controls UI affordances. Set both the same.'
    );
  }

  if (isProd && process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
    warnings.push('NEXTAUTH_SECRET is too short for production (min 32 chars)');
  }

  // Demo-source flag desync detection. Mirrors the DEV_MODE pattern above:
  // the server flag is authoritative for data-honesty (what the LLM is told
  // about, what discovery APIs return); the public flag is authoritative
  // for client UI affordances (Templates page, Gallery, editor hydration).
  // If they disagree, the operator's intent is ambiguous — warn loudly so
  // the misconfiguration is visible in startup logs.
  const isDemoServer = process.env.FEATURE_DEMO_SOURCES === 'true';
  const isDemoPublic = process.env.NEXT_PUBLIC_FEATURE_DEMO_SOURCES === 'true';
  if (isDemoServer !== isDemoPublic) {
    warnings.push(
      `FEATURE_DEMO_SOURCES (${isDemoServer}) and NEXT_PUBLIC_FEATURE_DEMO_SOURCES ` +
      `(${isDemoPublic}) disagree — these should match in .env.local. Server flag ` +
      'gates LLM/API discovery; public flag gates Templates page + Gallery + editor.'
    );
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

  // FATAL — auth bypass enabled in production. Refuse to start.
  //
  // INC-20260519-001 retro action item (HIGH): the previous behavior was a
  // stderr warning that nobody pages on, which let a misconfigured deploy
  // run for months with auth silently bypassed. The only safe behavior is
  // to fail boot loudly so the service goes 502 instead of 200-OK to every
  // unauthenticated request. The escape hatch ALLOW_DEV_MODE_IN_PRODUCTION=1
  // exists for the single legitimate case (CI e2e job that runs a prod-shaped
  // build with bypass on for Playwright); see ENV_VARS entry above.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DEV_MODE === 'true' &&
    process.env.ALLOW_DEV_MODE_IN_PRODUCTION !== '1'
  ) {
    const msg =
      'FATAL: DEV_MODE=true with NODE_ENV=production — authentication ' +
      'is bypassed. Refusing to start. Set DEV_MODE="false" in your ' +
      'environment, or (CI-only) set ALLOW_DEV_MODE_IN_PRODUCTION=1 to ' +
      'opt in. See docs/incidents/INC-20260519-001.md.';
    console.error(`❌ ENV: ${msg}`);
    throw new Error(msg);
  }

  for (const w of result.warnings) {
    console.warn(`⚠️  ENV: ${w}`);
  }

  // Override is in effect — keep this loud so it shows up in journald and
  // anyone reviewing logs after the fact sees that the bypass was knowingly
  // permitted. Should only ever fire in CI.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DEV_MODE === 'true' &&
    process.env.ALLOW_DEV_MODE_IN_PRODUCTION === '1'
  ) {
    console.warn(
      '⚠️  DEV_MODE=true in production with ALLOW_DEV_MODE_IN_PRODUCTION=1 — ' +
      'auth bypass is intentionally enabled (CI-only escape hatch). If you see ' +
      'this on a real production host, stop the service immediately.'
    );
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEV_MODE === 'true'
  ) {
    console.warn(
      '⚠️  NEXT_PUBLIC_DEV_MODE=true in production — dev UI affordances will be visible (dev login button, etc). ' +
      'Cosmetic only (security is controlled by DEV_MODE) but you almost certainly do not want this in prod.'
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
  // SECURITY flag — server-only, runtime-evaluated. Read this in middleware,
  // auth callbacks, session helpers, and any other server code that gates
  // on "is this a dev bypass environment".
  DEV_MODE: process.env.DEV_MODE === 'true',
  // UI hint flag — client, build-baked. Read this in client components
  // that want to render dev affordances. Do NOT use this for security.
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
  // Demo (sample) data sources quarantine flag — see ENV_VARS entry for
  // semantics. Defaults to false (sample sources hidden from discovery).
  // Server-side gate: data-honesty (LLM catalog, /api/data/query GET, etc.).
  FEATURE_DEMO_SOURCES: process.env.FEATURE_DEMO_SOURCES === 'true',
  // Client-side gate: UI hints (Templates page, Gallery, editor hydration).
  // Build-baked at `next build` time. NOT a security flag.
  NEXT_PUBLIC_FEATURE_DEMO_SOURCES:
    process.env.NEXT_PUBLIC_FEATURE_DEMO_SOURCES === 'true',
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
