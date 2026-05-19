/**
 * Freshchat — product-specific PII redactors.
 *
 * Freshchat is the suite's highest PII tier — conversations carry message
 * bodies which may contain SSNs, account numbers, addresses, family
 * relationships. ALWAYS mask `messages[].text` for non-privileged roles.
 *
 * Users carry email, phone, name, and optionally referencing identifiers
 * from the customer's own app (`reference_id`).
 */

import {
  shouldMaskForRole,
  maskEmail,
  maskPhone,
  maskFreeText,
  scanAndMaskPiiFields,
  type UserRole,
} from '../shared/redact';

export interface FreshchatConversation {
  conversation_id: string;
  status?: 'new' | 'assigned' | 'resolved' | string;
  channel_id?: string | null;
  assigned_agent_id?: string | null;
  assigned_group_id?: string | null;
  created_time?: string | null;
  updated_time?: string | null;
  /** Initial message preview when included. */
  messages?: FreshchatMessage[] | null;
  [k: string]: unknown;
}

export interface FreshchatMessage {
  id?: string;
  conversation_id?: string;
  actor_type?: 'agent' | 'user' | 'system' | string;
  actor_id?: string | null;
  /** The most sensitive field in the suite. */
  message_parts?: Array<{ text?: { content?: string | null } | null }> | null;
  /** Convenience flat text field present in some response variants. */
  text?: string | null;
  created_time?: string | null;
  [k: string]: unknown;
}

export function redactMessage<T extends FreshchatMessage>(m: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return m;
  const out = { ...m };
  if (out.text != null) out.text = maskFreeText(out.text);
  if (Array.isArray(out.message_parts)) {
    out.message_parts = out.message_parts.map((p) => {
      if (p?.text?.content) {
        return { ...p, text: { ...p.text, content: maskFreeText(p.text.content) } };
      }
      return p;
    });
  }
  return out;
}

export function redactConversation<T extends FreshchatConversation>(c: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return c;
  let out: T = { ...c };
  if (Array.isArray(out.messages)) {
    out.messages = out.messages.map((m) => redactMessage(m, role));
  }
  out = scanAndMaskPiiFields(out as unknown as Record<string, unknown>) as T;
  return out;
}

export function redactConversations<T extends FreshchatConversation>(
  rows: T[],
  role: UserRole
): T[] {
  return rows.map((c) => redactConversation(c, role));
}

export interface FreshchatUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Customer-app-supplied identifier — often an account number. */
  reference_id?: string | null;
  created_time?: string | null;
  updated_time?: string | null;
  [k: string]: unknown;
}

export function redactUser<T extends FreshchatUser>(u: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return u;
  const out = { ...u };
  if (out.first_name != null) out.first_name = '***';
  if (out.last_name != null) out.last_name = '***';
  if (out.email != null) out.email = maskEmail(out.email);
  if (out.phone != null) out.phone = maskPhone(out.phone);
  if (out.reference_id != null) out.reference_id = '***';
  return out;
}

export function redactUsers<T extends FreshchatUser>(rows: T[], role: UserRole): T[] {
  return rows.map((u) => redactUser(u, role));
}
