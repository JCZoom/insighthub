import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { logDashboardAction, AuditAction } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/dashboards/[id]/share — share dashboard with a user
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    const body = await request.json();
    const { userId, permission } = body as {
      userId: string;
      permission?: 'VIEW' | 'COMMENT' | 'EDIT';
    };

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify ownership or edit permission
    const dashboard = await prisma.dashboard.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          { shares: { some: { userId: user.id, permission: 'EDIT' } } },
        ],
      },
    });

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found or insufficient permissions' }, { status: 404 });
    }

    const share = await prisma.dashboardShare.upsert({
      where: { dashboardId_userId: { dashboardId: id, userId } },
      create: {
        dashboardId: id,
        userId,
        permission: permission || 'VIEW',
      },
      update: {
        permission: permission || 'VIEW',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Log dashboard share for audit
    await logDashboardAction(
      user.id,
      AuditAction.DASHBOARD_SHARE,
      id,
      {
        dashboardTitle: dashboard.title,
        sharedWithUserId: userId,
        sharedWithUser: share.user.name,
        permission: permission || 'VIEW',
      }
    );

    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    console.error('Share dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/dashboards/[id]/share — list shares for a dashboard
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    const dashboard = await prisma.dashboard.findFirst({
      where: {
        id,
        OR: [
          { ownerId: user.id },
          { shares: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const shares = await prisma.dashboardShare.findMany({
      where: { dashboardId: id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ shares });
  } catch (error) {
    console.error('List shares error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
