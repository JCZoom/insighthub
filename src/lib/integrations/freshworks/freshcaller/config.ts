/**
 * Freshcaller — configuration.
 *
 * Auth header (Freshcaller-specific — distinctly NOT `Authorization`):
 *   `X-Api-Auth: <api-key>`
 *
 * This is one of two products in the suite that doesn't use the standard
 * Authorization header (Freshchat is the other, using Bearer).
 *
 * Base URL: `https://<tenant>.freshcaller.com/api/v1/...`
 *
 * Reference: https://support.freshcaller.com/support/solutions/articles/50000027841-api-documentation
 */

import { env } from '@/lib/env';
import { buildBaseUrl } from '../shared/domain';

export interface FreshcallerConfig {
  configured: true;
  apiKey: string;
  baseUrl: string;
  cacheTtlSeconds: number;
  rateLimitPerMin: number;
}

export function isFreshcallerConfigured(): boolean {
  return env.FRESHCALLER_CONFIGURED;
}

export function getFreshcallerConfig(): FreshcallerConfig {
  if (!env.FRESHCALLER_API_KEY || !env.FRESHCALLER_DOMAIN) {
    throw new Error(
      'Freshcaller connector is not configured. Set FRESHCALLER_API_KEY and ' +
        'FRESHCALLER_DOMAIN (e.g. mytenant.freshcaller.com) in your env. ' +
        'See docs/VENDOR_REGISTER.md V-12 for setup.'
    );
  }
  return {
    configured: true,
    apiKey: env.FRESHCALLER_API_KEY,
    baseUrl: buildBaseUrl(env.FRESHCALLER_DOMAIN, 'FRESHCALLER_DOMAIN'),
    cacheTtlSeconds: env.FRESHSALES_CACHE_TTL_SECONDS,
    rateLimitPerMin: env.FRESHCALLER_RATE_LIMIT_PER_MIN,
  };
}

export function buildFreshcallerAuthHeaders(cfg: FreshcallerConfig): Record<string, string> {
  return {
    // Freshcaller's custom header — NOT `Authorization`.
    'X-Api-Auth': cfg.apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function describeFreshcallerConfigForLog(cfg: FreshcallerConfig): Record<string, unknown> {
  return {
    configured: cfg.configured,
    baseUrl: cfg.baseUrl,
    cacheTtlSeconds: cfg.cacheTtlSeconds,
    rateLimitPerMin: cfg.rateLimitPerMin,
    apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}…${cfg.apiKey.slice(-2)}` : '(absent)',
  };
}
