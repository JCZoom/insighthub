/**
 * Freshsales connector — PII redaction.
 *
 * Top-tier hardening (per Game Plan §3.2 amendment, 2026-05-19 09:16 ET):
 *   **Field-level masking is ON BY DEFAULT for VIEWER role.**
 *   POWER_USER and ADMIN see unmasked data. To grant unmasked view to a
 *   VIEWER on a specific widget, an admin must issue an explicit override
 *   which emits a `FRESHWORKS_UNMASK_OVERRIDE` audit event.
 *
 * Why this design? Freshsales records contain full customer PII (email,
 * phone, addresses, chat content). A dashboard accidentally shared with a
 * VIEWER-role user must not leak that PII; masking-by-default ensures the
 * worst case is "VIEWER sees masked values" rather than "VIEWER sees full
 * PII". The unmask path requires deliberate admin action AND is audited.
 *
 * Compliance refs:
 *   - Policy 3698 DC-02 (sensitivity-driven access)
 *   - Policy 3691 AC-05 (need-to-know)
 *   - Gap G-01 (classification framework), G-30 (DLP — partial coverage)
 */

export type UserRole = 'VIEWER' | 'CREATOR' | 'POWER_USER' | 'ADMIN';

/** Roles that see masked PII by default. */
const MASKED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['VIEWER', 'CREATOR']);

/** Roles that see full PII by default. */
const UNMASKED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['POWER_USER', 'ADMIN']);

/**
 * Should this role see masked PII by default?
 *
 * VIEWER and CREATOR → yes (mask).
 * POWER_USER and ADMIN → no (full visibility).
 */
export function shouldMaskForRole(role: UserRole): boolean {
  return MASKED_ROLES.has(role);
}

/** Documented for reference; not used directly. */
export function unmaskedByDefault(role: UserRole): boolean {
  return UNMASKED_ROLES.has(role);
}

// ── Field-level maskers ──────────────────────────────────────────────────────

/**
 * Mask an email address.
 *   "jeff.coy@uszoom.com" → "j***@uszoom.com"
 *
 * Preserves the domain (useful for "is this a USZoom contact?" filtering)
 * and the first character of the local-part. Returns "***" if the input
 * is unparseable.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length === 0) return `***@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Mask a phone number.
 *   "+1-555-123-4567" → "+1-***-***-4567"
 *   "(555) 123-4567"  → "(***) ***-4567"
 *
 * Keeps the country code (if formatted with +) and the last 4 digits.
 * Returns "***" for inputs with fewer than 4 digits.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const last4 = digits.slice(-4);
  // Find every digit and replace all but the last 4 with *
  let count = 0;
  const target = digits.length - 4;
  return phone.replace(/\d/g, () => (count++ < target ? '*' : last4[count - target - 1]));
}

/**
 * Mask a free-text PII field (chat message, note, mailing address).
 *   Anything more than 12 characters becomes "<masked: 87 chars>".
 *   Shorter strings are fully masked to "***".
 *
 * We do NOT preserve any substring — chat content may begin with
 * "John Smith's SSN is..." and a prefix preview would still leak.
 */
export function maskFreeText(text: string | null | undefined): string {
  if (!text) return '';
  const len = text.length;
  if (len <= 12) return '***';
  return `<masked: ${len} chars>`;
}

/**
 * Mask a person name.
 *   "Rebecca Moris" → "R. M."
 *   "Bono"          → "B."
 *
 * Initials only — preserves the human-friendly cardinality (you can still
 * say "there are 5 distinct contacts named R.M.") without revealing identity.
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '***';
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(' ');
}

// ── Whole-row redaction ──────────────────────────────────────────────────────

/**
 * Field-name patterns that trigger automatic masking. Any field whose name
 * matches one of these patterns is treated as PII when masking is in effect.
 *
 * This is a defence-in-depth signal — the specific resource redactors below
 * are authoritative. The pattern list catches anything we forgot.
 */
const PII_FIELD_PATTERNS: RegExp[] = [
  /email/i,
  /phone/i,
  /mobile/i,
  /(?:^|_)address/i,
  /street/i,
  /zip|postal/i,
  /\bssn\b/i,
  /\btax\b.*id/i,
  /chat|message|note/i,
  /first.?name|last.?name|full.?name/i,
];

/** Returns true if a field name looks PII-ish (defence in depth). */
function isPiiFieldName(name: string): boolean {
  return PII_FIELD_PATTERNS.some((p) => p.test(name));
}

// ── Resource-specific redactors ──────────────────────────────────────────────

/** Freshsales contact shape we care about (other fields passed through). */
export interface FreshsalesContact {
  id: number | string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  work_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  // Allow arbitrary additional fields without forcing type widening on the
  // caller. The redactor passes them through unchanged when present.
  [k: string]: unknown;
}

export function redactContact<T extends FreshsalesContact>(c: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return c;
  const out = { ...c };
  if (out.first_name != null) out.first_name = maskName(out.first_name);
  if (out.last_name != null) out.last_name = maskName(out.last_name);
  if (out.display_name != null) out.display_name = maskName(out.display_name);
  if (out.email != null) out.email = maskEmail(out.email);
  if (out.mobile_number != null) out.mobile_number = maskPhone(out.mobile_number);
  if (out.work_number != null) out.work_number = maskPhone(out.work_number);
  if (out.address != null) out.address = maskFreeText(out.address);
  // Defence in depth: scan any extra fields with PII-looking names.
  // We cast to a mutable string-key map for the iteration; this is safe
  // because we only ever overwrite a key that already exists on the row.
  const mut = out as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(mut)) {
    if (typeof v === 'string' && isPiiFieldName(k) && mut[k] === (c as unknown as Record<string, unknown>)[k]) {
      mut[k] = maskFreeText(v);
    }
  }
  return out;
}

/** Freshsales deal shape — minimal PII (mostly amounts/stages). */
export interface FreshsalesDeal {
  id: number | string;
  name?: string | null;
  amount?: number | null;
  deal_stage_id?: number | string | null;
  expected_close?: string | null;
  primary_contact?: { id: number | string; display_name?: string | null; email?: string | null } | null;
  [k: string]: unknown;
}

export function redactDeal<T extends FreshsalesDeal>(d: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return d;
  const out = { ...d };
  // Deal NAMES are often the customer's company — keep them. Amounts/stages
  // are not PII. Only mask the embedded primary_contact details.
  if (out.primary_contact) {
    out.primary_contact = {
      ...out.primary_contact,
      display_name: maskName(out.primary_contact.display_name ?? null),
      email: maskEmail(out.primary_contact.email ?? null),
    };
  }
  return out;
}

/** Freshsales account (company) — generally not PII. */
export interface FreshsalesAccount {
  id: number | string;
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  [k: string]: unknown;
}

export function redactAccount<T extends FreshsalesAccount>(a: T, role: UserRole): T {
  if (!shouldMaskForRole(role)) return a;
  const out = { ...a };
  if (out.phone != null) out.phone = maskPhone(out.phone);
  return out;
}

// ── Convenience: mask an array of any of the above ───────────────────────────

export function redactContacts<T extends FreshsalesContact>(rows: T[], role: UserRole): T[] {
  return rows.map((r) => redactContact(r, role));
}
export function redactDeals<T extends FreshsalesDeal>(rows: T[], role: UserRole): T[] {
  return rows.map((r) => redactDeal(r, role));
}
export function redactAccounts<T extends FreshsalesAccount>(rows: T[], role: UserRole): T[] {
  return rows.map((r) => redactAccount(r, role));
}
