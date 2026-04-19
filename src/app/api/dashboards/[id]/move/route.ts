import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/dashboards/[id]/move - Move dashboard to a different folder
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { folderId } = body;

    // Check if dashboard exists and user has access
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: resolvedParams.id, ownerId: user.id }
    });

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    // If moving to a folder, verify folder exists and belongs to user
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, ownerId: user.id }
      });
      if (!folder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 });
      }
    }

    const oldFolderId = dashboard.folderId;

    // Update dashboard folder
    const updatedDashboard = await prisma.dashboard.update({
      where: { id: resolvedParams.id },
      data: { folderId: folderId || null },
      include: {
        folder: {
          select: { id: true, name: true }
        },
        owner: {
          select: { id: true, name: true }
        }
      }
    });

    // Log the move operation
    await createAuditLog({
      userId: user.id,
      action: AuditAction.DASHBOARD_MOVE,
      resourceType: ResourceType.DASHBOARD,
      resourceId: resolvedParams.id,
      metadata: {
        dashboardTitle: updatedDashboard.title,
        fromFolderId: oldFolderId,
        toFolderId: folderId,
        fromFolderName: oldFolderId ? 'Previous Folder' : 'Root',
        toFolderName: updatedDashboard.folder?.name || 'Root'
      }
    });

    return NextResponse.json({ dashboard: updatedDashboard });
  } catch (error) {
    console.error('Error moving dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}