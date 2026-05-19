/**
 * Freshworks suite — shared PII redaction helpers.
 *
 * Top-tier hardening (per Game Plan §3 amendment, 2026-05-19 09:16 ET):
 *   **Field-level masking is ON BY DEFAULT for VIEWER and CREATOR roles.**
 *   POWER_USER and ADMIN see unmasked data. To grant unmasked view to a
 *   masked role on a specific widget, an admin must issue an explicit
 *   override which emits a `FRESHWORKS_UNMASK_OVERRIDE` audit event.
 *
 * Why this design? Freshworks products handle full customer PII (email,
 * phone, addresses, chat/ticket bodies, call recordings, deal info). A
 * dashboard accidentally shared with a VIEWER-role user must not leak that
 * PII; masking-by-default ensures the worst case is "VIEWER sees masked
 * values" rather than "VIEWER sees full PII". The unmask path requires
 * deliberate admin action AND is audited.
 *
 * The product-specific redactors live in each product's own `redact.ts`
 * (they know their resource shape). The helpers here are the building
 * blocks: maskEmail, maskPhone, maskName, maskFreeText, and the role
 * threshold.
 *
 * Compliance refs:
 *   - Policy 3698 DC-02 (sensitivity-driven access)
 *   - Policy 3691 AC-05 (need-to-know)
 *   - Gap G-01 (classification framework), G-30 (DLP — partial coverage)
 */

export type UserRole = 'VIEWER' | 'CREATOR' | 'POWER_USER' | 'ADMIN';

const MASKED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['VIEWER', 'CREATOR']);
const UNMASKED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['POWER_USER', 'ADMIN']);

/** VIEWER and CREATOR → yes. POWER_USER and ADMIN → no. */
export function shouldMaskForRole(role: UserRole): boolean {
  return MASKED_ROLES.has(role);
}

export function unmaskedByDefault(role: UserRole): boolean {
  return UNMASKED_ROLES.has(role);
}

// ── Field-level maskers ──────────────────────────────────────────────────────

/**
 * Mask an email address.
 *   "jeff.coy@uszoom.com" → "j***@uszoom.com"
 *
 * Preserves the domain (useful for "is this a USZoom contact?" filtering)
 * and the first character of the local-part.
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
 *
 * Keeps the country code and the last 4 digits.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const last4 = digits.slice(-4);
  let count = 0;
  const target = digits.length - 4;
  return phone.replace(/\d/g, () => (count++ < target ? '*' : last4[count - target - 1]));
}

/**
 * Mask a free-text PII field (chat message, note, ticket body, voicemail
 * transcript). Strings >12 chars are replaced with `<masked: N chars>`;
 * shorter strings become `***`.
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
 *
 * Initials only — preserves human-friendly cardinality without identity.
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '***';
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(' ');
}

/**
 * Mask a URL that might contain identifying tokens or customer references.
 * Keeps the host, replaces the path with `/***`.
 *   "https://app.acme.com/customers/12345" → "https://app.acme.com/***"
 */
export function maskUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/***`;
  } catch {
    return '***';
  }
}

// ── Defence-in-depth field-name patterns ─────────────────────────────────────

const PII_FIELD_PATTERNS: RegExp[] = [
  /email/i,
  /phone/i,
  /mobile/i,
  /(?:^|_)address/i,
  /street/i,
  /zip|postal/i,
  /\bssn\b/i,
  /\btax\b.*id/i,
  /chat|message|note|body|transcript/i,
  /first.?name|last.?name|full.?name/i,
];

/** Returns true if a field name looks PII-ish (defence in depth). */
export function isPiiFieldName(name: string): boolean {
  return PII_FIELD_PATTERNS.some((p) => p.test(name));
}

/**
 * Defence-in-depth scan: for any string field whose name matches a PII
 * pattern, replace it with the free-text mask. Mutates a shallow copy.
 *
 * Use this AFTER product-specific masking to catch anything we forgot.
 */
export function scanAndMaskPiiFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  const mut = out as Record<string, unknown>;
  for (const [k, v] of Object.entries(mut)) {
    if (typeof v === 'string' && isPiiFieldName(k)) {
      mut[k] = maskFreeText(v);
    }
  }
  return out;
}
