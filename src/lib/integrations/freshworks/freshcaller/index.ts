/**
 * Freshcaller — public surface for the product.
 */

export {
  isFreshcallerConfigured,
  getFreshcallerConfig,
  describeFreshcallerConfigForLog,
  type FreshcallerConfig,
} from './config';

export {
  listCalls,
  listUsers as listFreshcallerUsers,
  describeFreshcallerClient,
  type ListCallsParams,
  type ListUsersParams as ListFreshcallerUsersParams,
} from './client';

export {
  redactCall,
  redactCalls,
  redactUser as redactFreshcallerUser,
  redactUsers as redactFreshcallerUsers,
  freshcallerCallStatus,
  freshcallerCallPhone,
  type FreshcallerCall,
  type FreshcallerUser,
} from './redact';
