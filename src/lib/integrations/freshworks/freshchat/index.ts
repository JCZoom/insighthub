/**
 * Freshchat — public surface for the product.
 */

export {
  isFreshchatConfigured,
  getFreshchatConfig,
  describeFreshchatConfigForLog,
  type FreshchatConfig,
} from './config';

export {
  listConversations,
  listUsers as listFreshchatUsers,
  describeFreshchatClient,
  type ListConversationsParams,
  type ListUsersParams as ListFreshchatUsersParams,
} from './client';

export {
  redactConversation,
  redactConversations,
  redactMessage,
  redactUser as redactFreshchatUser,
  redactUsers as redactFreshchatUsers,
  type FreshchatConversation,
  type FreshchatMessage,
  type FreshchatUser,
} from './redact';
