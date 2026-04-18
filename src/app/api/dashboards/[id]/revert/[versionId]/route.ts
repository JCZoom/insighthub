import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { logVersionAction, AuditAction } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string; versionId: string }>;
}

// POST /api/dashboards/[id]/revert/[versionId] — revert to a specific version
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id, versionId } = await context.params;
    const user = await getCurrentUser();

    // Verify ownership
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

    // Get the target version's schema
    const targetVersion = await prisma.dashboardVersion.findFirst({
      where: { id: versionId, dashboardId: id },
    });

    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Create a new version with the reverted schema
    const nextVersion = dashboard.currentVersion + 1;

    const [version] = await prisma.$transaction([
      prisma.dashboardVersion.create({
        data: {
          dashboardId: id,
          version: nextVersion,
          schema: targetVersion.schema,
          changeNote: `Reverted to version ${targetVersion.version}`,
          createdBy: user.id,
        },
      }),
      prisma.dashboard.update({
        where: { id },
        data: { currentVersion: nextVersion },
      }),
    ]);

    // Log version revert for audit
    await logVersionAction(
      user.id,
      AuditAction.VERSION_REVERT,
      version.id,
      {
        dashboardId: id,
        dashboardTitle: dashboard.title,
        fromVersion: dashboard.currentVersion,
        toVersion: targetVersion.version,
        targetVersionId: versionId,
      }
    );

    return NextResponse.json({ version, schema: JSON.parse(targetVersion.schema) });
  } catch (error) {
    console.error('Revert version error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
