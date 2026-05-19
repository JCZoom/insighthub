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
