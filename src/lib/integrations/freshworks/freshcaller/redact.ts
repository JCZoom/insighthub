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

/**
 * One participant on a Freshcaller call. F-1 fix: the canonical status
 * lives on the Customer participant's `call_status` integer field,
 * NOT at the top of the call object — which is why every prod row
 * showed status='unknown' before this change. Vendor docs:
 * https://developer.freshcaller.com/api/ "The call participant object".
 */
export interface FreshcallerParticipant {
  id?: number | string;
  participant_type?: 'Customer' | 'Agent' | string | null;
  /** Integer status code. See FRESHCALLER_STATUS_CODE_MAP. */
  call_status?: number | string | null;
  duration?: number | null;
  duration_unit?: string | null;
  /** Customer phone number. PII when participant_type === 'Customer'. */
  caller_number?: string | null;
  /** Caller-ID display name. PII when participant_type === 'Customer'. */
  caller_name?: string | null;
  [k: string]: unknown;
}

/**
 * Known Freshcaller call_status integer codes. Sourced from vendor
 * docs + community thread. Conservative — only documented codes are
 * baked in. Unmapped codes fall through as `code-<n>` (NOT 'unknown')
 * so operators can distinguish missing data from new vendor codes.
 */
const FRESHCALLER_STATUS_CODE_MAP: Readonly<Record<number, string>> = Object.freeze({
  1: 'completed',
  3: 'missed',
  10: 'ended',
});

export interface FreshcallerCall {
  id: number | string;
  bill_duration?: number | null;
  bill_duration_unit?: string | null;
  /** May be absent on list-view; use freshcallerCallDurationS(). */
  call_duration?: number | null;
  /**
   * Status fields preserved for back-compat. Modern v1 puts the
   * canonical status on participants[].call_status (Customer
   * participant) as an INTEGER. Resolve via freshcallerCallStatus().
   */
  status?: string | null;
  call_status?: string | null;
  disposition?: string | null;
  call_state?: string | null;
  call_attributes?: { status?: string | null } | null;
  /** Direction: 1 inbound, 2 outbound (varies by API version). */
  direction?: number | string | null;
  call_type?: string | null;
  /** Top-level phone fields (used by some legacy responses). */
  phone_number?: string | null;
  caller_phone_number?: string | null;
  incoming_phone_number?: string | null;
  caller_name?: string | null;
  user_id?: number | null;
  queue_id?: number | null;
  /**
   * Timestamps. Modern v1 uses created_time/updated_time; older
   * back-compat fields preserved. Resolve via
   * freshcallerCallCreatedAt() rather than reading directly — that
   * was the F-1 root cause for ALL_NULL_TIMESTAMPS on prod.
   */
  created_time?: string | null;
  updated_time?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  ended_at?: string | null;
  recording_url?: string | null;
  voicemail_transcript?: string | null;
  /** Participants array. Canonical status + customer PII live here. */
  participants?: FreshcallerParticipant[] | null;
  [k: string]: unknown;
}

/**
 * Find the Customer participant on a call, or null if absent.
 *
 * The vendor's vocabulary is `participant_type === 'Customer'` (case
 * sensitive, capitalised). Defensive: we lower-case before matching
 * because some API versions / SDKs normalize.
 */
function findCustomerParticipant(c: FreshcallerCall): FreshcallerParticipant | null {
  if (!Array.isArray(c.participants) || c.participants.length === 0) return null;
  return (
    c.participants.find((p) => {
      const t = (p?.participant_type ?? '').toString().toLowerCase();
      return t === 'customer';
    }) ?? null
  );
}

/**
 * Resolve a call's status. Reads in priority order:
 *   1. Customer participant's call_status (the canonical location in
 *      Freshcaller v1; integer code translated via the status map).
 *      Unmapped integer codes return as `code-<n>` so operators can
 *      distinguish missing data from new vendor codes.
 *   2. Top-level legacy fields (status / call_status / disposition /
 *      call_state / call_attributes.status) — for non-v1 API
 *      responses or vendor field-name drift.
 *   3. 'unknown' as a last resort. After F-1, this should be a
 *      genuine signal not a systematic miss.
 */
export function freshcallerCallStatus(c: FreshcallerCall): string {
  const customer = findCustomerParticipant(c);
  const cs = customer?.call_status;
  if (typeof cs === 'number') {
    return FRESHCALLER_STATUS_CODE_MAP[cs] ?? `code-${cs}`;
  }
  if (typeof cs === 'string' && cs.length > 0) {
    const asNum = Number(cs);
    if (Number.isInteger(asNum) && FRESHCALLER_STATUS_CODE_MAP[asNum]) {
      return FRESHCALLER_STATUS_CODE_MAP[asNum];
    }
    return cs;
  }
  return (
    c.status ??
    c.call_status ??
    c.disposition ??
    c.call_state ??
    c.call_attributes?.status ??
    'unknown'
  );
}

/**
 * Resolve a call's creation timestamp. Modern Freshcaller v1 uses
 * `created_time`; legacy code paths may use `created_at`. Returns the
 * first non-null one as an ISO string, or null when neither is set.
 *
 * The legacy code read `c.created_at` directly, which is why every
 * prod call had `created_at: null` (vendor renamed the field years
 * ago). This helper is the F-1 fix.
 */
export function freshcallerCallCreatedAt(c: FreshcallerCall): string | null {
  return c.created_time ?? c.created_at ?? null;
}

/**
 * Resolve a call's updated timestamp. Mirrors freshcallerCallCreatedAt.
 */
export function freshcallerCallUpdatedAt(c: FreshcallerCall): string | null {
  return c.updated_time ?? c.updated_at ?? null;
}

/**
 * Resolve a call's duration in seconds. Reads in priority order:
 *   1. Top-level call_duration (modern v1 detail-view).
 *   2. Top-level bill_duration (always present on list-view).
 *   3. Customer participant's duration (per-leg fallback).
 *   4. null.
 *
 * Pre-F-1 we only checked (1) and (2). Adding (3) lets us recover
 * duration when the call object is sparse but the participant array
 * is hydrated — which is the common shape in v1 list-view responses.
 */
export function freshcallerCallDurationS(c: FreshcallerCall): number | null {
  if (typeof c.call_duration === 'number') return c.call_duration;
  if (typeof c.bill_duration === 'number') return c.bill_duration;
  const customer = findCustomerParticipant(c);
  if (customer && typeof customer.duration === 'number') return customer.duration;
  return null;
}

/**
 * Resolve a call's customer-side phone number. Priority order:
 *   1. Customer participant's caller_number (modern v1 location).
 *   2. Top-level phone_number / caller_phone_number /
 *      incoming_phone_number (legacy back-compat).
 *   3. null.
 *
 * The redactor masks (1) the same way it masks (2), so role-based
 * masking applies uniformly regardless of which field carries the
 * value upstream.
 */
export function freshcallerCallPhone(c: FreshcallerCall): string | null {
  const customer = findCustomerParticipant(c);
  if (customer && typeof customer.caller_number === 'string' && customer.caller_number.length > 0) {
    return customer.caller_number;
  }
  return (
    c.phone_number ??
    c.caller_phone_number ??
    c.incoming_phone_number ??
    null
  );
}

export function redactCall<T extends FreshcallerCall>(c: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return c;
  let out: T = { ...c };
  if (out.phone_number != null) out.phone_number = maskPhone(out.phone_number);
  if (out.caller_phone_number != null) out.caller_phone_number = maskPhone(out.caller_phone_number);
  if (out.incoming_phone_number != null) out.incoming_phone_number = maskPhone(out.incoming_phone_number);
  if (out.caller_name != null) out.caller_name = '***';
  if (out.voicemail_transcript != null) {
    out.voicemail_transcript = maskFreeText(out.voicemail_transcript);
  }
  if (out.recording_url != null) out.recording_url = maskUrl(out.recording_url);

  // F-1 PII surface: the participants[] array on Freshcaller v1 carries
  // caller_number + caller_name as customer PII. We mask these for
  // restricted roles the same way we mask the legacy top-level fields.
  // Without this block, a VIEWER could see raw phone numbers in the
  // participants array even though the dashboard's `phone_number`
  // column is masked. Defense-in-depth: scanAndMaskPiiFields below
  // catches strings that match PII heuristics, but explicit masking
  // is more reliable than pattern-matching for known fields.
  if (Array.isArray(out.participants)) {
    out = {
      ...out,
      participants: out.participants.map((p) => {
        if (!p) return p;
        const masked: FreshcallerParticipant = { ...p };
        // Mask only Customer participants — Agent caller_number /
        // caller_name are operator data, not customer PII.
        const t = (masked.participant_type ?? '').toString().toLowerCase();
        if (t === 'customer') {
          if (typeof masked.caller_number === 'string' && masked.caller_number.length > 0) {
            masked.caller_number = maskPhone(masked.caller_number);
          }
          if (typeof masked.caller_name === 'string' && masked.caller_name.length > 0) {
            masked.caller_name = '***';
          }
        }
        return masked;
      }),
    };
  }

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
