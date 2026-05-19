/**
 * Freshcaller — product-specific PII redactors.
 *
 * Call records contain:
 *   - Customer phone number (always PII)
 *   - Caller name (when available from caller-ID lookup)
 *   - Voicemail transcript (high PII — may contain account numbers, names)
 *   - Recording URL (the recording itself is PII; the URL grants access)
 *
 * Status, duration, agent_id, queue_id, created_at all pass through.
 */

import {
  shouldMaskForRole,
  maskPhone,
  maskFreeText,
  maskUrl,
  scanAndMaskPiiFields,
  type UserRole,
} from '../shared/redact';

export interface FreshcallerCall {
  id: number | string;
  /** "Inbound" or "Outbound" */
  bill_duration?: number | null;
  call_duration?: number | null;
  /** "completed" | "missed" | "abandoned" | "voicemail" | ... */
  status?: string | null;
  /** Direction: 1 inbound, 2 outbound (varies by API version). */
  direction?: number | string | null;
  /** Customer phone number. */
  phone_number?: string | null;
  /** Caller name if known. */
  caller_name?: string | null;
  /** Agent who handled the call. */
  user_id?: number | null;
  /** Queue / group id. */
  queue_id?: number | null;
  created_at?: string | null;
  ended_at?: string | null;
  /** Recording URL (signed). */
  recording_url?: string | null;
  voicemail_transcript?: string | null;
  [k: string]: unknown;
}

export function redactCall<T extends FreshcallerCall>(c: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return c;
  let out: T = { ...c };
  if (out.phone_number != null) out.phone_number = maskPhone(out.phone_number);
  if (out.caller_name != null) out.caller_name = '***';
  if (out.voicemail_transcript != null) {
    out.voicemail_transcript = maskFreeText(out.voicemail_transcript);
  }
  if (out.recording_url != null) out.recording_url = maskUrl(out.recording_url);
  out = scanAndMaskPiiFields(out as unknown as Record<string, unknown>) as T;
  return out;
}

export function redactCalls<T extends FreshcallerCall>(rows: T[], role: UserRole): T[] {
  return rows.map((c) => redactCall(c, role));
}

export interface FreshcallerUser {
  id: number | string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  available?: boolean | null;
  [k: string]: unknown;
}

export function redactUser<T extends FreshcallerUser>(u: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return u;
  const out = { ...u };
  if (out.name != null) out.name = '***';
  if (out.email != null) {
    const at = out.email.indexOf('@');
    out.email = at > 0 ? `${out.email[0]}***@${out.email.slice(at + 1)}` : '***';
  }
  if (out.phone != null) out.phone = maskPhone(out.phone);
  return out;
}

export function redactUsers<T extends FreshcallerUser>(rows: T[], role: UserRole): T[] {
  return rows.map((u) => redactUser(u, role));
}
