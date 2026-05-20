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
  freshcallerCallCreatedAt,
  freshcallerCallUpdatedAt,
  freshcallerCallDurationS,
  type FreshcallerCall,
  type FreshcallerParticipant,
  type FreshcallerUser,
} from './redact';
