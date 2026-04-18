import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser, canCreateDashboard } from '@/lib/auth/session';
import { logDashboardAction, AuditAction } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/dashboards/[id]/duplicate — clone a dashboard
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();

    if (!canCreateDashboard(user)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get the source dashboard with current version
    const source = await prisma.dashboard.findFirst({
      where: {
        id,
        archivedAt: null,
        OR: [
          { ownerId: user.id },
          { isPublic: true },
          { shares: { some: { userId: user.id } } },
        ],
      },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const sourceSchema = source.versions[0]?.schema || '{}';

    const clone = await prisma.dashboard.create({
      data: {
        title: `${source.title} (copy)`,
        description: source.description,
        tags: source.tags,
        ownerId: user.id,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            schema: sourceSchema,
            changeNote: `Cloned from "${source.title}"`,
            createdBy: user.id,
          },
        },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        versions: { take: 1 },
      },
    });

    // Log dashboard duplication for audit
    await logDashboardAction(
      user.id,
      AuditAction.DASHBOARD_DUPLICATE,
      clone.id,
      {
        title: clone.title,
        sourceDashboardId: id,
        sourceDashboardTitle: source.title,
      }
    );

    return NextResponse.json({ dashboard: clone }, { status: 201 });
  } catch (error) {
    console.error('Duplicate dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
