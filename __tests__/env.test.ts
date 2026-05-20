/**
 * Regression test for the assertEnv() hard-throw on auth-bypass-in-production.
 *
 * Background: INC-20260519-001 (production auth bypass). The retrospective
 * action item promotes the prior stderr warning to a hard throw so a
 * misconfigured deploy refuses to start instead of silently bypassing auth.
 * If anyone ever weakens or removes that throw, this test must fail.
 *
 * Runner: built-in `node:test` (Node >= 18). Invoked via tsx loader so we
 * can import the TypeScript source directly. No vitest/jest dependency.
 *
 *   npm run test:unit
 *
 * Each test snapshots and restores process.env so cases don't leak into
 * each other.
 */

import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { assertEnv } from '../src/lib/env';

const KEYS = [
  'NODE_ENV',
  'DEV_MODE',
  'NEXT_PUBLIC_DEV_MODE',
  'ALLOW_DEV_MODE_IN_PRODUCTION',
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
] as const;

let snapshot: Record<string, string | undefined>;

function captureEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) out[k] = process.env[k];
  return out;
}

// `@types/node` types process.env.NODE_ENV as a string-literal union with
// readonly semantics, so direct assignment doesn't typecheck under strict.
// Funnel all writes through this loosely-typed alias — the runtime contract
// is unaffected.
const procEnv = process.env as Record<string, string | undefined>;

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

/**
 * Set up a baseline that satisfies every required ENV_VARS entry so the
 * `result.invalid`/`result.missing` paths don't fire and obscure the
 * specific behavior we're testing.
 */
function withBaseline(overrides: Record<string, string | undefined>): void {
  for (const k of KEYS) delete procEnv[k];
  procEnv.DATABASE_URL = 'file:./dev.db';
  procEnv.NEXTAUTH_SECRET = 'x'.repeat(40); // satisfies prod min-length validator
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete procEnv[k];
    } else {
      procEnv[k] = v;
    }
  }
}

describe('assertEnv() — production auth-bypass guard', () => {
  beforeEach(() => {
    snapshot = captureEnv();
  });

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it('throws when NODE_ENV=production and DEV_MODE=true with no override', () => {
    withBaseline({
      NODE_ENV: 'production',
      DEV_MODE: 'true',
      ALLOW_DEV_MODE_IN_PRODUCTION: undefined,
    });
    assert.throws(
      () => assertEnv(),
      /FATAL: DEV_MODE=true with NODE_ENV=production/,
    );
  });

  it('does NOT throw when the explicit CI override is set', () => {
    withBaseline({
      NODE_ENV: 'production',
      DEV_MODE: 'true',
      ALLOW_DEV_MODE_IN_PRODUCTION: '1',
    });
    assert.doesNotThrow(() => assertEnv());
  });

  it('rejects override values other than the literal "1"', () => {
    withBaseline({
      NODE_ENV: 'production',
      DEV_MODE: 'true',
      ALLOW_DEV_MODE_IN_PRODUCTION: 'true', // common operator mistake
    });
    assert.throws(
      () => assertEnv(),
      /FATAL: DEV_MODE=true with NODE_ENV=production/,
    );
  });

  it('does NOT throw in production when DEV_MODE is "false"', () => {
    withBaseline({
      NODE_ENV: 'production',
      DEV_MODE: 'false',
    });
    assert.doesNotThrow(() => assertEnv());
  });

  it('does NOT throw in production when DEV_MODE is unset', () => {
    withBaseline({
      NODE_ENV: 'production',
      DEV_MODE: undefined,
    });
    assert.doesNotThrow(() => assertEnv());
  });

  it('does NOT throw in development even when DEV_MODE=true', () => {
    withBaseline({
      NODE_ENV: 'development',
      DEV_MODE: 'true',
    });
    assert.doesNotThrow(() => assertEnv());
  });

  it('does NOT throw in test even when DEV_MODE=true', () => {
    withBaseline({
      NODE_ENV: 'test',
      DEV_MODE: 'true',
    });
    assert.doesNotThrow(() => assertEnv());
  });
});
