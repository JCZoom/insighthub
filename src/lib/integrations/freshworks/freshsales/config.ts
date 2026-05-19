/**
 * Freshsales — configuration.
 *
 * One of four product configs under the Freshworks suite. Loads env vars,
 * normalizes the domain, builds Freshsales-flavored auth headers.
 *
 * Auth header format (Freshsales-specific):
 *   `Authorization: Token token=<api-key>`
 */

import { env } from '@/lib/env';
import { buildBaseUrl } from '../shared/domain';

export interface FreshsalesConfig {
  configured: true;
  apiKey: string;
  baseUrl: string;
  cacheTtlSeconds: number;
  rateLimitPerMin: number;
}

export function isFreshsalesConfigured(): boolean {
  return env.FRESHSALES_CONFIGURED;
}

export function getFreshsalesConfig(): FreshsalesConfig {
  if (!env.FRESHSALES_API_KEY || !env.FRESHSALES_DOMAIN) {
    throw new Error(
      'Freshsales connector is not configured. Set FRESHSALES_API_KEY and ' +
        'FRESHSALES_DOMAIN (e.g. mytenant.myfreshworks.com) in your env. ' +
        'See docs/VENDOR_REGISTER.md V-01 for setup.'
    );
  }
  return {
    configured: true,
    apiKey: env.FRESHSALES_API_KEY,
    baseUrl: buildBaseUrl(env.FRESHSALES_DOMAIN, 'FRESHSALES_DOMAIN'),
    cacheTtlSeconds: env.FRESHSALES_CACHE_TTL_SECONDS,
    rateLimitPerMin: env.FRESHSALES_RATE_LIMIT_PER_MIN,
  };
}

export function buildFreshsalesAuthHeaders(cfg: FreshsalesConfig): Record<string, string> {
  return {
    Authorization: `Token token=${cfg.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function describeFreshsalesConfigForLog(cfg: FreshsalesConfig): Record<string, unknown> {
  return {
    configured: cfg.configured,
    baseUrl: cfg.baseUrl,
    cacheTtlSeconds: cfg.cacheTtlSeconds,
    rateLimitPerMin: cfg.rateLimitPerMin,
    apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}…${cfg.apiKey.slice(-2)}` : '(absent)',
  };
}
