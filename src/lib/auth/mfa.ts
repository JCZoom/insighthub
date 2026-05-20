/**
 * Multi-Factor-Authentication enforcement helpers (G-02).
 *
 * USZoom Authentication & Password Policy 3692 (AUTH-02, AUTH-06) requires
 * that MFA be ENFORCED at the application layer for accounts with access to
 * customer PII or regulated data. We satisfy this by parsing the Google OIDC
 * `amr` (Authentication Methods References) claim from the ID token and
 * rejecting privileged sign-ins where MFA is not present.
 *
 * Compliance reference:
 *   - Policy 3692 AUTH-02 / AUTH-06
 *   - Policy 3691 AC-05 (Access Control / authentication strength)
 *   - Gap G-02 (closes 2026-05-19, scope: AMR check + admin gate + UI surface)
 *
 * Reference:
 *   - RFC 8176 (Authentication Method Reference Values)
 *   - Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
 */

/** AMR values that count as a successful second-factor assertion (RFC 8176). */
const MFA_AMR_VALUES = new Set([
  'mfa', // explicit "multiple factors" (Google Workspace 2SV / hardware key flow)
  'otp', // one-time password (SMS/email/TOTP)
  'hwk', // hardware key (YubiKey, Titan)
  'swk', // software key (Authenticator app)
  'sms', // SMS-delivered OTP
  'tel', // telephone-delivered code
  'fpt', // fingerprint
  'face', // face recognition
  'iris', // iris scan
]);

/**
 * Roles for which we strictly require MFA. Currently ADMIN + POWER_USER.
 * VIEWER and CREATOR can sign in without MFA but the warning is logged.
 */
const MFA_REQUIRED_ROLES = new Set(['ADMIN', 'POWER_USER']);

/** Roles that don't strictly require MFA today but should soon (Tier-2 follow-up). */
export function requiresMfa(role: string | undefined | null): boolean {
  if (!role) return false;
  return MFA_REQUIRED_ROLES.has(role);
}

/** Result of parsing the AMR claim out of a Google ID token. */
export interface AmrParseResult {
  /** True if at least one MFA-grade value was present in `amr`. */
  mfaVerified: boolean;
  /** The raw `amr` claim values (lowercased). Empty array if the claim was absent. */
  amrValues: string[];
  /** OIDC `auth_time` claim (seconds since epoch) if present — when the user actually authenticated. */
  authTime: number | null;
  /** True if the claim could not be parsed (malformed token, etc). Treat as "no MFA evidence." */
  parseError: boolean;
}

/**
 * Decode the payload section of a JWT WITHOUT verifying its signature.
 *
 * Why no signature check here? NextAuth's GoogleProvider already validated
 * the id_token's signature and issuer in the callback handshake before this
 * code runs. We are only reading the claims for downstream decision-making.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // JWT base64 is URL-safe; Buffer.from in Node decodes either variant.
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    return typeof payload === 'object' && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

/** Outcome of the combined MFA verification check. */
export type MfaVerificationResult =
  | { verified: true; via: 'amr' | 'domain-trust' }
  | { verified: false };

/**
 * True if the given email belongs to a Workspace domain we've configured to
 * trust for MFA enforcement (TRUSTED_MFA_DOMAINS, comma-separated).
 *
 * Trust assumption: Google Workspace for the listed domains enforces 2SV at
 * the domain level (verified by IT-admin policy outside this codebase). Per
 * 2026-05-20 INC-20260519-001 retro: Google's `amr` claim is documented as
 * unreliable — it is often empty even when the user authenticated with a
 * security key as a second factor. Without a domain-trust fallback, the
 * application's MFA gate is unfalsifiable from a successful sign-in alone,
 * which produces an effective lockout for privileged users (Jeff couldn't
 * reach /admin even after using YubiKey).
 *
 * This is defense-in-depth. The PRIMARY MFA control is Google Workspace's
 * own 2SV enforcement. The application gate exists to fail-closed if that
 * upstream control is misconfigured. Setting TRUSTED_MFA_DOMAINS means we
 * accept the upstream control as authoritative for the listed domains.
 *
 * Never list a domain you don't control, and never list domains whose
 * Workspace policy you can't verify enforces 2SV.
 */
export function isDomainTrustedForMfa(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.TRUSTED_MFA_DOMAINS ?? '';
  const trusted = raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (trusted.length === 0) return false;
  const lower = email.toLowerCase();
  return trusted.some((d) => lower.endsWith(`@${d}`));
}

/**
 * Combined MFA verification: prefer the explicit `amr` claim, fall back to
 * the domain-trust list if `amr` was empty. Caller can use `via` to log
 * which signal authorized the sign-in for audit-trail purposes.
 */
export function verifyMfa(email: string | null | undefined, amr: AmrParseResult): MfaVerificationResult {
  if (amr.mfaVerified) return { verified: true, via: 'amr' };
  if (isDomainTrustedForMfa(email)) return { verified: true, via: 'domain-trust' };
  return { verified: false };
}

/**
 * Parse the AMR + auth_time claims out of an OIDC id_token.
 *
 * Returns `{ mfaVerified: false, parseError: true }` if the token is missing
 * or malformed — callers treat that as "no MFA evidence" and apply the same
 * gate as an empty amr claim.
 */
export function parseIdTokenAMR(idToken: string | undefined | null): AmrParseResult {
  if (!idToken) {
    return { mfaVerified: false, amrValues: [], authTime: null, parseError: true };
  }

  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    return { mfaVerified: false, amrValues: [], authTime: null, parseError: true };
  }

  const rawAmr = payload.amr;
  const amrValues: string[] = Array.isArray(rawAmr)
    ? rawAmr.filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase())
    : [];

  const mfaVerified = amrValues.some((v) => MFA_AMR_VALUES.has(v));

  const rawAuthTime = payload.auth_time;
  const authTime =
    typeof rawAuthTime === 'number' && Number.isFinite(rawAuthTime) ? rawAuthTime : null;

  return { mfaVerified, amrValues, authTime, parseError: false };
}
