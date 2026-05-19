/**
 * Freshsales / Freshworks CRM connector — configuration.
 *
 * Loads and validates the connector's environment configuration. The token
 * (FRESHSALES_API_KEY) is the most sensitive credential in the system after
 * NEXTAUTH_SECRET — it grants read/write access to USZoom's entire CRM
 * tenant including contacts, deals, and chat content (full PII).
 *
 * Token-isolation discipline (per `docs/GAME_PLAN_2026-05-19.md` §3.2 and
 * `docs/VENDOR_REGISTER.md` V-01):
 *   - Dev: lives in `.env.local`.
 *   - Production: lives in `/opt/insighthub/.env.freshworks` (mode 0600,
 *     loaded by the Next.js server at boot via `node --env-file`).
 *     NEVER copied via scp; NEVER committed to git.
 *
 * Compliance refs:
 *   - Policy 3692 AUTH-02 (credentials never exposed)
 *   - Policy 3701 ENC-01 (TLS for API transport)
 *   - Gap G-26 (vendor governance), R-041 (token compromise risk)
 */

import { env } from '@/lib/env';

export interface FreshsalesConfig {
  /** Whether the connector is fully configured and safe to call. */
  configured: boolean;
  /** The API token. Never log this. Always derive headers from it via helper. */
  apiKey: string;
  /** Tenant base URL constructed from FRESHSALES_DOMAIN. */
  baseUrl: string;
  /** Redis cache TTL in seconds. Default 60s — bounded retention per policy 3700 DR-01. */
  cacheTtlSeconds: number;
  /** Max API calls per minute (sliding window). Default 60; Freshsales free tier ceiling is 100. */
  rateLimitPerMin: number;
}

/**
 * Return the active Freshsales config.
 *
 * Throws if called when not configured — callers are expected to either
 * branch on `isConfigured()` or use the `safeFreshsalesConfig()` pattern.
 */
export function getFreshsalesConfig(): FreshsalesConfig {
  if (!env.FRESHSALES_API_KEY || !env.FRESHSALES_DOMAIN) {
    throw new Error(
      'Freshsales connector is not configured. Set FRESHSALES_API_KEY and ' +
        'FRESHSALES_DOMAIN (e.g. uszoom.myfreshworks.com) in your env. See ' +
        'docs/VENDOR_REGISTER.md V-01 for setup.'
    );
  }

  return {
    configured: true,
    apiKey: env.FRESHSALES_API_KEY,
    baseUrl: `https://${env.FRESHSALES_DOMAIN}`,
    cacheTtlSeconds: env.FRESHSALES_CACHE_TTL_SECONDS,
    rateLimitPerMin: env.FRESHSALES_RATE_LIMIT_PER_MIN,
  };
}

/**
 * Cheap boolean check — does NOT throw if the connector isn't configured.
 *
 * Use this in API routes and UI code to skip rendering Freshsales features
 * gracefully when the connector is disabled or in a non-Freshsales tenant.
 */
export function isFreshsalesConfigured(): boolean {
  return env.FRESHSALES_CONFIGURED;
}

/**
 * Build the Authorization header for a Freshsales API call.
 *
 * Encapsulated so the raw token never leaves this module. Returns an opaque
 * `Record<string, string>` that's directly usable as `headers:` in fetch().
 */
export function buildAuthHeaders(cfg: FreshsalesConfig): Record<string, string> {
  return {
    Authorization: `Token token=${cfg.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Returns a safe-to-log redacted view of the config — for diagnostics only.
 * NEVER returns the raw apiKey value.
 */
export function describeConfigForLog(cfg: FreshsalesConfig): Record<string, unknown> {
  return {
    configured: cfg.configured,
    baseUrl: cfg.baseUrl,
    cacheTtlSeconds: cfg.cacheTtlSeconds,
    rateLimitPerMin: cfg.rateLimitPerMin,
    apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}…${cfg.apiKey.slice(-2)}` : '(absent)',
  };
}
