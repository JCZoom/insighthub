/**
 * Freshsales — public surface for the product.
 */

export {
  isFreshsalesConfigured,
  getFreshsalesConfig,
  describeFreshsalesConfigForLog,
  type FreshsalesConfig,
} from './config';

export {
  listContacts,
  listDeals,
  listAccounts,
  describeFreshsalesClient,
  getDealStageMap,
  enrichDealWithStageName,
  type ListContactsParams,
  type ListDealsParams,
  type ListAccountsParams,
} from './client';

export {
  redactContact,
  redactDeal,
  redactAccount,
  redactContacts,
  redactDeals,
  redactAccounts,
  type FreshsalesContact,
  type FreshsalesDeal,
  type FreshsalesAccount,
} from './redact';
