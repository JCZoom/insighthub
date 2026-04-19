import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

/**
 * GET /api/user/export — GDPR right-to-access: exports all personal data
 * for the authenticated user as a JSON download.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    const [dbUser, dashboards, chatSessions, auditLogs, shares] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          department: true,
          hasOnboarded: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.dashboard.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
        },
      }),
      prisma.chatSession.findMany({
        where: { userId: user.id },
        include: {
          messages: {
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: { userId: user.id },
        select: {
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.dashboardShare.findMany({
        where: { userId: user.id },
        select: {
          dashboardId: true,
          permission: true,
          createdAt: true,
        },
      }),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: dbUser,
      dashboards,
      chatSessions: chatSessions.map(s => ({
        id: s.id,
        dashboardId: s.dashboardId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: s.messages,
      })),
      sharedWithMe: shares,
      auditLogs,
    };

    // Audit this export
    await createAuditLog({
      userId: user.id,
      action: AuditAction.USER_DATA_EXPORT,
      resourceType: ResourceType.USER,
      resourceId: user.id,
      metadata: { action: 'gdpr_data_export' },
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="insighthub-export-${user.id}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('User data export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
