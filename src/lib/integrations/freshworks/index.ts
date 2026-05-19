/**
 * Freshworks suite — unified public surface.
 *
 * The suite covers 4 products under the Freshworks umbrella:
 *   - Freshsales (CRM)
 *   - Freshdesk (support tickets)
 *   - Freshcaller (voice / calls)
 *   - Freshchat (live chat / messaging)
 *
 * Each product has its own subdirectory with `config.ts`, `client.ts`,
 * `redact.ts`, and `index.ts`. Cross-cutting plumbing (HTTP, rate-limit,
 * cache, audit, errors, shared maskers) lives in `shared/`.
 *
 * Most callers should import from this barrel. Heavy consumers can drill
 * into `freshworks/<product>` directly.
 */

// ── Product barrels ─────────────────────────────────────────────────────────

export * from './freshsales';
export * from './freshdesk';
export * from './freshcaller';
export * from './freshchat';

// ── Shared error hierarchy ──────────────────────────────────────────────────

export {
  FreshworksError,
  FreshworksNotConfiguredError,
  FreshworksRateLimitError,
  // Back-compat aliases for the pre-refactor commit:
  FreshsalesError,
  FreshsalesNotConfiguredError,
  FreshsalesRateLimitError,
  type FreshworksProduct,
} from './shared/errors';

// ── Shared cache helpers (retention purge, demo Purge button) ───────────────

export {
  flushAllFreshworksCaches,
  flushProductCache,
  flushFreshworksCache, // back-compat alias for flushAllFreshworksCaches
  isFreshworksCacheAvailable,
  buildCacheKey,
  PRODUCT_CACHE_PREFIX,
} from './shared/cache';

// ── Shared redaction (for callers who roll their own resource shapes) ───────

export {
  shouldMaskForRole,
  unmaskedByDefault,
  maskEmail,
  maskPhone,
  maskName,
  maskFreeText,
  maskUrl,
  scanAndMaskPiiFields,
  type UserRole,
} from './shared/redact';

// ── Shared audit emitters ───────────────────────────────────────────────────

export {
  auditFreshworksRead,
  auditFreshworksUnmaskOverride,
  auditFreshworksRateLimited,
  type FreshworksReadAuditPayload,
} from './shared/audit';
