/**
 * Freshchat — configuration.
 *
 * Auth header (Freshchat-specific):
 *   `Authorization: Bearer <api-key>`
 *
 * Base URL: `https://api.freshchat.com/v2/...` (global API endpoint by
 * default; FRESHCHAT_API_HOST env var overrides if a tenant needs it).
 *
 * The FRESHCHAT_DOMAIN env var (e.g. mytenant.freshchat.com) holds the UI
 * host — useful for diagnostics and for building human-friendly links back
 * to the Freshchat admin console — but the REST API itself doesn't live
 * there.
 *
 * Reference: https://developers.freshchat.com/api/
 */

import { env } from '@/lib/env';
import { buildBaseUrl, normalizeDomain } from '../shared/domain';

export interface FreshchatConfig {
  configured: true;
  apiKey: string;
  /** API base URL (api.freshchat.com or override). */
  baseUrl: string;
  /** Tenant UI host for diagnostics + link-back. */
  tenantHost: string;
  cacheTtlSeconds: number;
  rateLimitPerMin: number;
}

export function isFreshchatConfigured(): boolean {
  return env.FRESHCHAT_CONFIGURED;
}

export function getFreshchatConfig(): FreshchatConfig {
  if (!env.FRESHCHAT_API_KEY) {
    throw new Error(
      'Freshchat connector is not configured. Set FRESHCHAT_API_KEY in your ' +
        'env (Bearer token from Freshchat → Settings → API Tokens). ' +
        'See docs/VENDOR_REGISTER.md V-13 for setup.'
    );
  }
  return {
    configured: true,
    apiKey: env.FRESHCHAT_API_KEY,
    baseUrl: buildBaseUrl(env.FRESHCHAT_API_HOST, 'FRESHCHAT_API_HOST'),
    tenantHost: env.FRESHCHAT_DOMAIN
      ? normalizeDomain(env.FRESHCHAT_DOMAIN, 'FRESHCHAT_DOMAIN')
      : '(not set)',
    cacheTtlSeconds: env.FRESHSALES_CACHE_TTL_SECONDS,
    rateLimitPerMin: env.FRESHCHAT_RATE_LIMIT_PER_MIN,
  };
}

export function buildFreshchatAuthHeaders(cfg: FreshchatConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function describeFreshchatConfigForLog(cfg: FreshchatConfig): Record<string, unknown> {
  return {
    configured: cfg.configured,
    baseUrl: cfg.baseUrl,
    tenantHost: cfg.tenantHost,
    cacheTtlSeconds: cfg.cacheTtlSeconds,
    rateLimitPerMin: cfg.rateLimitPerMin,
    apiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}…${cfg.apiKey.slice(-2)}` : '(absent)',
  };
}
