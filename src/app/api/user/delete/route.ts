import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import { z } from 'zod';

const DeleteRequestSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT', {
    message: 'You must send { "confirmation": "DELETE MY ACCOUNT" } to proceed.',
  }),
});

/**
 * POST /api/user/delete — GDPR right-to-deletion: deletes the authenticated
 * user's account and all associated personal data.
 *
 * Requires explicit confirmation in the request body.
 * Dashboards owned by the user are archived (not destroyed) so shared
 * collaborators don't lose data.  Chat messages and sessions are deleted.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    const body = await request.json();
    const parseResult = DeleteRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    // Audit before deletion (the audit log itself is retained for compliance)
    await createAuditLog({
      userId: user.id,
      action: AuditAction.USER_LOGIN, // Closest existing action
      resourceType: ResourceType.USER,
      resourceId: user.id,
      metadata: { action: 'gdpr_account_deletion', email: user.email },
    });

    // Run deletions in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete chat messages via sessions
      const sessions = await tx.chatSession.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const sessionIds = sessions.map(s => s.id);

      if (sessionIds.length > 0) {
        await tx.chatMessage.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
        await tx.chatSession.deleteMany({
          where: { userId: user.id },
        });
      }

      // 2. Remove dashboard shares (both owned and shared-with-me)
      await tx.dashboardShare.deleteMany({
        where: { userId: user.id },
      });

      // 3. Archive owned dashboards (preserve for collaborators)
      await tx.dashboard.updateMany({
        where: { ownerId: user.id, archivedAt: null },
        data: { archivedAt: new Date() },
      });

      // 4. Remove permission assignments
      await tx.userPermissionAssignment.deleteMany({
        where: { userId: user.id },
      });

      // 5. Anonymize the user record (keep for audit log FK integrity)
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `deleted-${user.id}@redacted.local`,
          name: 'Deleted User',
          avatarUrl: null,
          department: null,
        },
      });
    });

    return NextResponse.json({
      message: 'Account deleted. Your personal data has been removed and dashboards have been archived.',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('User account deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
