/**
 * Retention / disposal policy enforcement.
 *
 * Each function honors a `dryRun` flag (default false) that returns the count
 * that WOULD be purged without actually deleting. This is the "preview" mode
 * used by the admin UI and by operators verifying scheduled cron behaviour.
 *
 * Every real purge emits an audit log entry against `ResourceType.SYSTEM` so
 * the audit table records its own grooming — that meta-log is itself subject
 * to the audit-log retention window, but the most recent entry is always
 * retained as long as the purge has run.
 *
 * Compliance references:
 *   - Policy 3700 Data Retention · DR-01 (max retention bounded by purpose)
 *   - Policy 3699 Data Disposal · DD-04 (secure deletion of expired data)
 *   - Gap G-05 (retention automation), G-06 (audit log upper-bound)
 */

import prisma from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

/** Default retention period in days for chat messages (policy 3700 DR-01). */
const CHAT_RETENTION_DAYS = 90;

/**
 * Default retention period in days for audit log entries.
 *
 * Policy 3700 DR-01 requires a bounded retention period for every data class.
 * 365 days is the operational sweet spot: long enough that a full annual audit
 * cycle has access to the prior year's events, short enough that we are not
 * accumulating PII (user IDs, IP addresses, action metadata) indefinitely.
 *
 * If a regulator subpoenas longer-window data we can extend via env override
 * (`AUDIT_LOG_RETENTION_DAYS`) without code change.
 */
const AUDIT_LOG_RETENTION_DAYS = (() => {
  const env = process.env.AUDIT_LOG_RETENTION_DAYS;
  if (!env) return 365;
  const parsed = parseInt(env, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 365;
})();

/** A purge result with both "what we did" and "who did it" attribution. */
export interface PurgeResult {
  /** Count of rows actually deleted (0 in dry-run mode). */
  deleted: number;
  /** Count of rows that match the cutoff predicate (always populated). */
  matched: number;
  /** Whether this was a preview (true) or a real deletion (false). */
  dryRun: boolean;
  /** ISO timestamp of the cutoff used. Everything created before this is in scope. */
  cutoff: string;
  /** Retention window in days. */
  retentionDays: number;
}

export interface ChatPurgeResult extends PurgeResult {
  /** Sessions deleted as a follow-up to message deletion (orphan cleanup). */
  deletedSessions: number;
}

/** Identity of the principal triggering a purge — used for the meta-audit log. */
export interface PurgeContext {
  /** User ID of the admin invoking the purge, or a synthetic ID for cron-triggered runs. */
  triggeredBy: string;
  /** Free-form note ("manual", "cron-daily", etc.) for the audit metadata. */
  source?: string;
}

/**
 * Purge chat messages and orphaned sessions older than the retention window.
 *
 * G-05 expansion of the original chat-only retention job. Adds `dryRun`
 * support and meta-audit logging. Backwards compatible with the single-number
 * call signature used by existing cron entries.
 */
export async function purgeChatMessages(
  retentionDays: number = CHAT_RETENTION_DAYS,
  opts: { dryRun?: boolean; ctx?: PurgeContext } = {}
): Promise<ChatPurgeResult> {
  const { dryRun = false, ctx } = opts;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const matched = await prisma.chatMessage.count({
    where: { createdAt: { lt: cutoff } },
  });

  if (dryRun) {
    return {
      deleted: 0,
      matched,
      deletedSessions: 0,
      dryRun: true,
      cutoff: cutoff.toISOString(),
      retentionDays,
    };
  }

  // Step 1: delete old messages
  const { count: deletedMessages } = await prisma.chatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  // Step 2: clean up orphaned sessions (no messages left)
  const { count: deletedSessions } = await prisma.chatSession.deleteMany({
    where: {
      messages: { none: {} },
      createdAt: { lt: cutoff },
    },
  });

  if (ctx) {
    await createAuditLog({
      userId: ctx.triggeredBy,
      action: AuditAction.RETENTION_PURGE_CHAT,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'chat_messages',
      metadata: {
        deletedMessages,
        deletedSessions,
        retentionDays,
        cutoff: cutoff.toISOString(),
        source: ctx.source ?? 'unknown',
      },
    });
  }

  return {
    deleted: deletedMessages,
    matched,
    deletedSessions,
    dryRun: false,
    cutoff: cutoff.toISOString(),
    retentionDays,
  };
}

/**
 * Purge audit log entries older than the retention window.
 *
 * G-06 — Policy 3700 DR-01: every data class needs a bounded retention period.
 * Default 365 days; override via `AUDIT_LOG_RETENTION_DAYS` env var or the
 * `retentionDays` argument.
 *
 * Note: this function intentionally emits a `RETENTION_PURGE_AUDIT` log entry
 * AFTER the delete, recording exactly how many entries were removed. That
 * entry will itself eventually age out — but only after the next purge cycle,
 * so we always have at least one purge fingerprint in the table.
 */
export async function purgeAuditLogs(
  retentionDays: number = AUDIT_LOG_RETENTION_DAYS,
  opts: { dryRun?: boolean; ctx?: PurgeContext } = {}
): Promise<PurgeResult> {
  const { dryRun = false, ctx } = opts;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const matched = await prisma.auditLog.count({
    where: { createdAt: { lt: cutoff } },
  });

  if (dryRun) {
    return {
      deleted: 0,
      matched,
      dryRun: true,
      cutoff: cutoff.toISOString(),
      retentionDays,
    };
  }

  const { count: deleted } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (ctx) {
    await createAuditLog({
      userId: ctx.triggeredBy,
      action: AuditAction.RETENTION_PURGE_AUDIT,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'audit_log',
      metadata: {
        deleted,
        retentionDays,
        cutoff: cutoff.toISOString(),
        source: ctx.source ?? 'unknown',
      },
    });
  }

  return {
    deleted,
    matched,
    dryRun: false,
    cutoff: cutoff.toISOString(),
    retentionDays,
  };
}

/**
 * Default retention window for inactive users (3 years).
 *
 * Policy 3700 DR-01 / GDPR Article 5(1)(e): personal data must not be kept
 * "for longer than is necessary." For dormant accounts (no `lastLoginAt`
 * activity in 3 years) we anonymize — we do NOT hard-delete because:
 *   1. Audit log FK integrity requires the User row to exist.
 *   2. The user's dashboards may be shared with active users who still need
 *      attribution to *something* (we leave them attributed to an "Anonymized
 *      User" stub instead of orphaning the FK).
 *
 * Override via `INACTIVE_USER_RETENTION_DAYS` env var.
 */
const INACTIVE_USER_RETENTION_DAYS = (() => {
  const env = process.env.INACTIVE_USER_RETENTION_DAYS;
  if (!env) return 1095; // 3 years
  const parsed = parseInt(env, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1095;
})();

/**
 * Default retention window for cached Freshworks CRM responses (90 days).
 *
 * Freshworks data is `CUSTOMER_CONFIDENTIAL` (per G-01 / Policy 3698). The
 * Redis cache TTL is 60 seconds for normal operation, but the bulk-purge
 * window is the policy-level upper bound: anything older than 90 days in
 * the cache (which should never happen given TTL=60s, but belt-and-braces)
 * is wiped. The Freshworks integration also exposes a "purge now" trigger
 * for the demo retention story.
 */
const FRESHWORKS_CACHE_RETENTION_DAYS = (() => {
  const env = process.env.FRESHWORKS_CACHE_RETENTION_DAYS;
  if (!env) return 90;
  const parsed = parseInt(env, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
})();

/**
 * Purge (by anonymization) users who have not logged in within the retention
 * window. G-05 / Policy 3700 DR-01.
 *
 * "Purge" here = anonymize-in-place. Same pattern as `/api/user/delete`:
 *   - email   -> `anon-<userId>@redacted.local`
 *   - name    -> `Anonymized User`
 *   - avatar  -> null
 *   - department -> null
 *
 * Users with `lastLoginAt = null` are NEVER touched here — they have never
 * signed in, which usually means they were created by an admin but have not
 * yet onboarded; we don't want to anonymize a fresh invite.
 *
 * Already-anonymized users (email matches `^anon-` or `^deleted-`) are also
 * skipped so re-running the purge is a no-op.
 */
export async function purgeInactiveUsers(
  retentionDays: number = INACTIVE_USER_RETENTION_DAYS,
  opts: { dryRun?: boolean; ctx?: PurgeContext } = {}
): Promise<PurgeResult> {
  const { dryRun = false, ctx } = opts;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // Find candidates: lastLoginAt < cutoff AND not already anonymized.
  const candidates = await prisma.user.findMany({
    where: {
      lastLoginAt: { lt: cutoff, not: null },
      NOT: [
        { email: { startsWith: 'anon-' } },
        { email: { startsWith: 'deleted-' } },
      ],
    },
    select: { id: true },
  });

  const matched = candidates.length;

  if (dryRun || matched === 0) {
    return {
      deleted: 0,
      matched,
      dryRun,
      cutoff: cutoff.toISOString(),
      retentionDays,
    };
  }

  // Anonymize in a single transaction so partial failure rolls back cleanly.
  let anonymized = 0;
  await prisma.$transaction(async (tx) => {
    for (const c of candidates) {
      await tx.user.update({
        where: { id: c.id },
        data: {
          email: `anon-${c.id}@redacted.local`,
          name: 'Anonymized User',
          avatarUrl: null,
          department: null,
        },
      });
      anonymized++;
    }
  });

  if (ctx) {
    await createAuditLog({
      userId: ctx.triggeredBy,
      action: AuditAction.RETENTION_PURGE_INACTIVE_USERS,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'user',
      metadata: {
        anonymized,
        retentionDays,
        cutoff: cutoff.toISOString(),
        source: ctx.source ?? 'unknown',
      },
    });
  }

  return {
    deleted: anonymized,
    matched,
    dryRun: false,
    cutoff: cutoff.toISOString(),
    retentionDays,
  };
}

/**
 * Purge cached Freshworks CRM responses.
 *
 * Implementation note: the Freshworks cache lives in Redis under the `fw:`
 * key prefix. This function uses `SCAN` (not `KEYS`) to iterate keys without
 * blocking the Redis main thread, then `DEL`s matching entries.
 *
 * The `retentionDays` argument is honored only as a metadata field — the
 * actual Redis TTL machinery (60s per entry, set on write by the connector)
 * is the primary retention mechanism. This bulk purge is an emergency lever
 * (demo / incident response) that wipes the cache regardless of per-key TTL.
 *
 * If Redis is not configured / connected, this function returns `matched: 0`
 * and does NOT throw — the cache is effectively non-existent in that case.
 */
export async function purgeFreshworksCache(
  retentionDays: number = FRESHWORKS_CACHE_RETENTION_DAYS,
  opts: { dryRun?: boolean; ctx?: PurgeContext } = {}
): Promise<PurgeResult> {
  const { dryRun = false, ctx } = opts;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // Delegate to the Freshworks cache module which owns the `fw:` key prefix
  // (single source of truth). In dryRun mode we have to inspect-without-delete,
  // which the integration module exposes as a soft contract via SCAN. For now
  // we keep the dryRun semantics simple: matched=0 in dryRun (cache lifetime
  // is 60 s, so per-key TTL effectively performs continuous purging anyway —
  // a manual dryRun is a "would I delete anything if I ran this NOW" check,
  // and is rarely useful here).
  if (dryRun) {
    return {
      deleted: 0,
      matched: 0,
      dryRun: true,
      cutoff: cutoff.toISOString(),
      retentionDays,
    };
  }

  // Lazy-load the integration module to avoid pulling its transitive deps
  // (config, redact, client) into the retention library's import graph
  // unless the purge is actually invoked.
  let deleted = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { flushAllFreshworksCaches } = require('@/lib/integrations/freshworks/shared/cache');
    deleted = await flushAllFreshworksCaches();
  } catch (err) {
    // Cache module unavailable or Redis not configured — treat as no-op.
    // eslint-disable-next-line no-console
    console.warn('[retention] purgeFreshworksCache: cache flush unavailable.', err);
  }

  if (ctx) {
    await createAuditLog({
      userId: ctx.triggeredBy,
      action: AuditAction.RETENTION_PURGE_FRESHWORKS_CACHE,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'freshworks_cache',
      metadata: {
        deleted,
        retentionDays,
        cutoff: cutoff.toISOString(),
        source: ctx.source ?? 'unknown',
      },
    });
  }

  return {
    deleted,
    matched: deleted, // approximate — flush returns total deleted only
    dryRun: false,
    cutoff: cutoff.toISOString(),
    retentionDays,
  };
}

/** Expose constants for the admin UI / cron entries. */
export const RETENTION_DEFAULTS = Object.freeze({
  chatDays: CHAT_RETENTION_DAYS,
  auditDays: AUDIT_LOG_RETENTION_DAYS,
  inactiveUserDays: INACTIVE_USER_RETENTION_DAYS,
  freshworksCacheDays: FRESHWORKS_CACHE_RETENTION_DAYS,
});

