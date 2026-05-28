/**
 * Freshdesk — public surface for the product.
 */

export {
  isFreshdeskConfigured,
  getFreshdeskConfig,
  describeFreshdeskConfigForLog,
  type FreshdeskConfig,
} from './config';

export {
  listTickets,
  listAgents,
  searchTickets,
  describeFreshdeskClient,
  ticketIsOpen,
  ticketIsOverdue,
  FRESHDESK_STATUS,
  FRESHDESK_PRIORITY,
  type ListTicketsParams,
  type ListAgentsParams,
  type SearchTicketsParams,
  type SearchTicketsResult,
} from './client';

export {
  redactTicket,
  redactTickets,
  redactAgent,
  redactAgents,
  type FreshdeskTicket,
  type FreshdeskAgent,
} from './redact';
