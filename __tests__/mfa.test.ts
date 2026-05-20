/**
 * Regression tests for the MFA verification helpers.
 *
 * What these protect against:
 *   - Domain-trust fallback firing when TRUSTED_MFA_DOMAINS is unset (would
 *     silently bypass the application-layer MFA gate).
 *   - Domain-trust accepting emails outside the configured allow-list.
 *   - amr-positive case ever being downgraded to domain-trust attribution.
 *
 * Why these matter: the domain-trust fallback was added 2026-05-20 because
 * Google's `amr` claim is unreliable in second-factor flows. The fallback
 * is a safety net that depends on TRUSTED_MFA_DOMAINS being set correctly.
 * If a future refactor accidentally evaluates the fallback even when the
 * env var is empty, the entire MFA gate becomes a no-op for any successful
 * Google sign-in (regardless of role). That's a P0 security regression that
 * would not be caught by ESLint, typecheck, or e2e.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDomainTrustedForMfa,
  verifyMfa,
  type AmrParseResult,
} from '@/lib/auth/mfa';

const KEYS = ['TRUSTED_MFA_DOMAINS'] as const;
const procEnv = process.env as Record<string, string | undefined>;
let snapshot: Record<string, string | undefined> = {};

function captureEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) out[k] = process.env[k];
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) {
      delete procEnv[k];
    } else {
      procEnv[k] = v;
    }
  }
}

const NO_AMR: AmrParseResult = {
  mfaVerified: false,
  amrValues: [],
  authTime: null,
  parseError: false,
};

const WITH_HWK: AmrParseResult = {
  mfaVerified: true,
  amrValues: ['hwk'],
  authTime: 1747000000,
  parseError: false,
};

describe('isDomainTrustedForMfa()', () => {
  beforeEach(() => {
    snapshot = captureEnv();
  });

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it('returns false when TRUSTED_MFA_DOMAINS is unset', () => {
    delete procEnv.TRUSTED_MFA_DOMAINS;
    assert.equal(isDomainTrustedForMfa('jeff@uszoom.com'), false);
  });

  it('returns false when TRUSTED_MFA_DOMAINS is empty string', () => {
    procEnv.TRUSTED_MFA_DOMAINS = '';
    assert.equal(isDomainTrustedForMfa('jeff@uszoom.com'), false);
  });

  it('returns false when email is null/undefined/empty', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    assert.equal(isDomainTrustedForMfa(null), false);
    assert.equal(isDomainTrustedForMfa(undefined), false);
    assert.equal(isDomainTrustedForMfa(''), false);
  });

  it('matches a single-domain allow-list (case-insensitive)', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    assert.equal(isDomainTrustedForMfa('jeff@uszoom.com'), true);
    assert.equal(isDomainTrustedForMfa('Jeff@USZOOM.COM'), true);
  });

  it('rejects domains not in the allow-list', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    assert.equal(isDomainTrustedForMfa('jeff@example.com'), false);
    assert.equal(isDomainTrustedForMfa('jeff@evil-uszoom.com'), false);
  });

  it('does NOT do a substring match (catches the "uszoom" vs "uszoom.com" footgun)', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    // The implementation matches with a leading @ to anchor at the start of
    // the domain. If someone refactored it to a naive endsWith on the email,
    // 'attacker.uszoom.com' would slip through (it ends with 'uszoom.com').
    assert.equal(isDomainTrustedForMfa('jeff@attacker.uszoom.com'), false);
  });

  it('supports multiple comma-separated domains with whitespace', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com, other.example';
    assert.equal(isDomainTrustedForMfa('jeff@uszoom.com'), true);
    assert.equal(isDomainTrustedForMfa('jeff@other.example'), true);
    assert.equal(isDomainTrustedForMfa('jeff@third.com'), false);
  });

  it('ignores empty list entries (trailing commas, double commas)', () => {
    procEnv.TRUSTED_MFA_DOMAINS = ',,uszoom.com,,';
    assert.equal(isDomainTrustedForMfa('jeff@uszoom.com'), true);
    // A literal empty domain entry must NOT match every email — that would
    // be a "trust everything" footgun.
    assert.equal(isDomainTrustedForMfa('jeff@evil.com'), false);
  });
});

describe('verifyMfa() — combined check', () => {
  beforeEach(() => {
    snapshot = captureEnv();
  });

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it('verified via amr when amr.mfaVerified is true (even with no domain-trust set)', () => {
    delete procEnv.TRUSTED_MFA_DOMAINS;
    const result = verifyMfa('jeff@uszoom.com', WITH_HWK);
    assert.deepEqual(result, { verified: true, via: 'amr' });
  });

  it('verified via domain-trust when amr is empty but domain matches', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    const result = verifyMfa('jeff@uszoom.com', NO_AMR);
    assert.deepEqual(result, { verified: true, via: 'domain-trust' });
  });

  it('NOT verified when amr is empty AND domain-trust is unset', () => {
    delete procEnv.TRUSTED_MFA_DOMAINS;
    const result = verifyMfa('jeff@uszoom.com', NO_AMR);
    assert.deepEqual(result, { verified: false });
  });

  it('NOT verified when amr is empty AND email is outside the allow-list', () => {
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    const result = verifyMfa('jeff@example.com', NO_AMR);
    assert.deepEqual(result, { verified: false });
  });

  it('attributes to amr (not domain-trust) when both signals could fire', () => {
    // Defense in depth: even with the fallback enabled, an actual amr
    // assertion must be reported as amr-verified — otherwise the audit
    // trail loses the distinction between "Google asserted MFA" and "we
    // assumed MFA based on the domain".
    procEnv.TRUSTED_MFA_DOMAINS = 'uszoom.com';
    const result = verifyMfa('jeff@uszoom.com', WITH_HWK);
    assert.deepEqual(result, { verified: true, via: 'amr' });
  });
});
