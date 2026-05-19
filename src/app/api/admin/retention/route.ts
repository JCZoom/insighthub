import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import {
  purgeChatMessages,
  purgeAuditLogs,
  purgeInactiveUsers,
  purgeFreshworksCache,
  RETENTION_DEFAULTS,
  type PurgeContext,
} from '@/lib/data/retention';

type Target = 'chat' | 'audit' | 'inactive_users' | 'freshworks_cache' | 'all';

const VALID_TARGETS: readonly Target[] = [
  'chat', 'audit', 'inactive_users', 'freshworks_cache', 'all',
] as const;

function parseTarget(raw: unknown): Target {
  if (typeof raw === 'string' && (VALID_TARGETS as readonly string[]).includes(raw)) {
    return raw as Target;
  }
  return 'chat'; // default preserves backwards-compat with pre-G-06 callers
}

function parseDays(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && raw > 0 && Number.isFinite(raw) ? raw : fallback;
}

/**
 * POST /api/admin/retention — Run a retention purge.
 *
 * Admin-only. Body (all optional):
 *   {
 *     target?: 'chat' | 'audit' | 'inactive_users' | 'freshworks_cache' | 'all',
 *     retentionDays?: number,              // chat
 *     auditRetentionDays?: number,         // audit
 *     inactiveUserRetentionDays?: number,  // inactive_users
 *     freshworksCacheRetentionDays?: number, // freshworks_cache
 *     dryRun?: boolean                     // default false; counts only
 *   }
 *
 * Every non-dry-run invocation emits an audit log entry via the retention
 * helpers themselves (G-06 meta-logging). The endpoint is the admin-UI entry
 * point AND the cron entry point — cron uses `triggeredBy: 'system:cron'`.
 *
 * For the demo retention story: pass `target='freshworks_cache'` to wipe the
 * Freshworks cache live; the dashboard will re-fetch from the API on the
 * next request.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const target = parseTarget(body.target);
    const dryRun = body.dryRun === true;
    const chatDays = parseDays(body.retentionDays, RETENTION_DEFAULTS.chatDays);
    const auditDays = parseDays(body.auditRetentionDays, RETENTION_DEFAULTS.auditDays);
    const userDays = parseDays(
      body.inactiveUserRetentionDays,
      RETENTION_DEFAULTS.inactiveUserDays
    );
    const fwDays = parseDays(
      body.freshworksCacheRetentionDays,
      RETENTION_DEFAULTS.freshworksCacheDays
    );

    const ctx: PurgeContext = {
      triggeredBy: user.id,
      source: dryRun ? 'admin:dry-run' : 'admin:manual',
    };

    const results: Record<string, unknown> = { dryRun };

    if (target === 'chat' || target === 'all') {
      results.chat = await purgeChatMessages(chatDays, { dryRun, ctx });
    }
    if (target === 'audit' || target === 'all') {
      results.audit = await purgeAuditLogs(auditDays, { dryRun, ctx });
    }
    if (target === 'inactive_users' || target === 'all') {
      results.inactiveUsers = await purgeInactiveUsers(userDays, { dryRun, ctx });
    }
    if (target === 'freshworks_cache' || target === 'all') {
      results.freshworksCache = await purgeFreshworksCache(fwDays, { dryRun, ctx });
    }

    return NextResponse.json({
      message: dryRun
        ? `Dry-run preview for target=${target} complete`
        : `Purge complete for target=${target}`,
      ...results,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Retention purge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
