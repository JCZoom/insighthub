/**
 * Freshdesk — configuration.
 *
 * Auth header (Freshdesk-specific):
 *   `Authorization: Basic base64(<api-key>:X)`
 *
 * The literal "X" stands in for the password — Freshdesk uses the API key
 * as the username and any non-empty string as the password. We use "X"
 * because that's the documented convention.
 *
 * Base URL: `https://<tenant>.freshdesk.com/api/v2/...`
 *
 * Reference: https://developers.freshdesk.com/api/
 */

import { env } from '@/lib/env';
import { buildBaseUrl } from '../shared/domain';

export interface FreshdeskConfig {
  configured: true;
  apiKey: string;
  baseUrl: string;
  cacheTtlSeconds: number;
  rateLimitPerMin: number;
}

export function isFreshdeskConfigured(): boolean {
  return env.FRESHDESK_CONFIGURED;
}

export function getFreshdeskConfig(): FreshdeskConfig {
  if (!env.FRESHDESK_API_KEY || !env.FRESHDESK_DOMAIN) {
    throw new Error(
      'Freshdesk connector is not configured. Set FRESHDESK_API_KEY and ' +
        'FRESHDESK_DOMAIN (e.g. mytenant.freshdesk.com) in your env. ' +
        'See docs/VENDOR_REGISTER.md V-11 for setup.'
    );
  }
  return {
    configured: true,
    apiKey: env.FRESHDESK_API_KEY,
    baseUrl: buildBaseUrl(env.FRESHDESK_DOMAIN, 'FRESHDESK_DOMAIN'),
    // Freshdesk shares the FRESHSALES_CACHE_TTL_SECONDS by default — the
    // PII policy is uniform across the suite. (Could split later if needed.)
    cacheTtlSeconds: env.FRESHSALES_CACHE_TTL_SECONDS,
    rateLimitPerMin: env.FRESHDESK_RATE_LIMIT_PER_MIN,
  };
}

/**
 * Build Freshdesk Basic auth header.
 *
 * We construct the base64 string here rather than at call time so the raw
 * key never appears in a string passed across module boundaries.
 */
export function buildFreshdeskAuthHeaders(cfg: FreshdeskConfig): Record<string, string> {
  const credentials = Buffer.from(`${cfg.apiKey}:X`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function describeFreshdeskConfigForLog(cfg: FreshdeskConfig): Record<string, unknown> {
  return {
    configured: cfg.configured,
    baseUrl: cfg.baseUrl,
    cacheTtlSeconds: cfg.cacheTtlSeconds,
    rateLimitPerMin: cfg.rateLimitPerMin,
    apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}…${cfg.apiKey.slice(-2)}` : '(absent)',
  };
}
