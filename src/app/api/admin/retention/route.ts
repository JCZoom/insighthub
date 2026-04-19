import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import { purgeChatMessages } from '@/lib/data/retention';

/**
 * POST /api/admin/retention — Run chat message retention purge.
 * Admin-only. Accepts optional `retentionDays` in the body (default 90).
 * Designed to be called by a cron job or admin action.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const retentionDays =
      typeof body.retentionDays === 'number' && body.retentionDays > 0
        ? body.retentionDays
        : 90;

    const result = await purgeChatMessages(retentionDays);

    return NextResponse.json({
      message: `Purged chat data older than ${retentionDays} days`,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('Retention purge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
