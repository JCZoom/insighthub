/**
 * Freshsales / Freshworks CRM integration — public surface.
 *
 * Importers should pull from `@/lib/integrations/freshworks` rather than the
 * individual submodules. This barrel is the stable contract; the internals
 * can be refactored without breaking callers.
 */

export {
  isFreshsalesConfigured,
  getFreshsalesConfig,
  describeConfigForLog,
  type FreshsalesConfig,
} from './config';

export {
  listContacts,
  listDeals,
  listAccounts,
  describeFreshsalesClient,
  FreshsalesError,
  FreshsalesNotConfiguredError,
  FreshsalesRateLimitError,
  type ListContactsParams,
  type ListDealsParams,
  type ListAccountsParams,
} from './client';

export {
  flushFreshworksCache,
  isFreshworksCacheAvailable,
  buildCacheKey,
} from './cache';

export {
  redactContact,
  redactDeal,
  redactAccount,
  redactContacts,
  redactDeals,
  redactAccounts,
  shouldMaskForRole,
  maskEmail,
  maskPhone,
  maskName,
  maskFreeText,
  type UserRole,
  type FreshsalesContact,
  type FreshsalesDeal,
  type FreshsalesAccount,
} from './redact';

export {
  auditFreshworksRead,
  auditFreshworksUnmaskOverride,
  auditFreshworksRateLimited,
  type FreshworksReadAuditPayload,
} from './audit';
