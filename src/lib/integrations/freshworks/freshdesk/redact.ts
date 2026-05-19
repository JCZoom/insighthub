/**
 * Freshdesk — product-specific PII redactors.
 *
 * Freshdesk tickets carry the highest PII density in the suite:
 *   - Requester email (always)
 *   - Ticket body / description (often customer chat history with names,
 *     account numbers, addresses)
 *   - Ticket subject (frequently contains customer names)
 *   - Conversation thread (every reply — high PII)
 *
 * For VIEWER/CREATOR roles, mask subject/description/body aggressively.
 * Status/priority/agent_id/created_at pass through unchanged (operational
 * metadata, not PII).
 */

import {
  shouldMaskForRole,
  maskEmail,
  maskFreeText,
  scanAndMaskPiiFields,
  type UserRole,
} from '../shared/redact';

export interface FreshdeskTicket {
  id: number;
  subject?: string | null;
  description_text?: string | null;
  description?: string | null;
  status?: number | null;
  priority?: number | null;
  type?: string | null;
  source?: number | null;
  requester_id?: number | null;
  responder_id?: number | null; // agent
  created_at?: string | null;
  updated_at?: string | null;
  due_by?: string | null;
  fr_due_by?: string | null; // first response due
  fr_escalated?: boolean | null;
  is_escalated?: boolean | null;
  tags?: string[] | null;
  // Embedded requester object when ?include=requester
  requester?: { id: number; email?: string | null; name?: string | null } | null;
  [k: string]: unknown;
}

export function redactTicket<T extends FreshdeskTicket>(t: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return t;
  let out: T = { ...t };
  if (out.subject != null) out.subject = maskFreeText(out.subject);
  if (out.description_text != null) out.description_text = maskFreeText(out.description_text);
  if (out.description != null) out.description = maskFreeText(out.description);
  if (out.requester) {
    out.requester = {
      ...out.requester,
      email: maskEmail(out.requester.email ?? null),
      name: out.requester.name ? '***' : null,
    };
  }
  out = scanAndMaskPiiFields(out as unknown as Record<string, unknown>) as T;
  return out;
}

export function redactTickets<T extends FreshdeskTicket>(rows: T[], role: UserRole): T[] {
  return rows.map((t) => redactTicket(t, role));
}

export interface FreshdeskAgent {
  id: number;
  contact?: {
    name?: string | null;
    email?: string | null;
    mobile?: string | null;
    phone?: string | null;
  } | null;
  available?: boolean | null;
  occasional?: boolean | null;
  signature?: string | null;
  ticket_scope?: number | null;
  group_ids?: number[] | null;
  [k: string]: unknown;
}

export function redactAgent<T extends FreshdeskAgent>(a: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return a;
  const out = { ...a };
  if (out.contact) {
    out.contact = {
      ...out.contact,
      email: maskEmail(out.contact.email ?? null),
      name: out.contact.name ? '***' : null,
      mobile: out.contact.mobile ? '***' : null,
      phone: out.contact.phone ? '***' : null,
    };
  }
  return out;
}

export function redactAgents<T extends FreshdeskAgent>(rows: T[], role: UserRole): T[] {
  return rows.map((a) => redactAgent(a, role));
}
