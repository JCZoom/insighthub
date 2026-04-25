import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Determine whether the current user can create/remove aliases for this dashboard.
// Only the dashboard owner may manage its aliases (aliases live inside the owner's
// own folder tree). Shared users do not see other users' folders, so this is
// straightforward for now.
async function loadOwnedDashboard(dashboardId: string, userId: string) {
  return prisma.dashboard.findFirst({
    where: { id: dashboardId, ownerId: userId },
    select: { id: true, title: true, folderId: true, ownerId: true },
  });
}

// POST /api/dashboards/[id]/aliases
// Body: { folderIds: string[] } — add the dashboard as an alias to each folder.
// Idempotent: re-aliasing into a folder that already has the alias (or is the
// primary folder) is silently ignored.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dashboard = await loadOwnedDashboard(id, user.id);
    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const body = await request.json();
    const folderIdsRaw = body?.folderIds;
    if (!Array.isArray(folderIdsRaw) || folderIdsRaw.length === 0) {
      return NextResponse.json({ error: 'folderIds must be a non-empty array' }, { status: 400 });
    }
    const folderIds: string[] = folderIdsRaw.filter((fid): fid is string => typeof fid === 'string' && fid.length > 0);

    // Verify every folder belongs to the user
    const folders = await prisma.folder.findMany({
      where: { id: { in: folderIds }, ownerId: user.id },
      select: { id: true, name: true },
    });
    if (folders.length !== folderIds.length) {
      return NextResponse.json({ error: 'One or more folders not found' }, { status: 404 });
    }

    // Exclude the primary folder (adding an alias there is a no-op) and any folder
    // that already has this alias.
    const existingAliases = await prisma.folderAlias.findMany({
      where: { dashboardId: id, folderId: { in: folderIds } },
      select: { folderId: true },
    });
    const existingSet = new Set(existingAliases.map((a) => a.folderId));
    const toCreate = folderIds.filter(
      (fid) => fid !== dashboard.folderId && !existingSet.has(fid)
    );

    if (toCreate.length > 0) {
      // createMany avoids a round-trip per insert and tolerates the unique index
      // via skipDuplicates (sqlite + Prisma 5 supports skipDuplicates).
      await prisma.folderAlias.createMany({
        data: toCreate.map((folderId) => ({ folderId, dashboardId: id })),
      });

      await createAuditLog({
        userId: user.id,
        action: AuditAction.DASHBOARD_ALIAS_ADD,
        resourceType: ResourceType.DASHBOARD,
        resourceId: id,
        metadata: {
          dashboardTitle: dashboard.title,
          folderIds: toCreate,
          folderNames: folders
            .filter((f) => toCreate.includes(f.id))
            .map((f) => f.name),
        },
      });
    }

    // Return the refreshed alias list for this dashboard
    const aliases = await prisma.folderAlias.findMany({
      where: { dashboardId: id },
      select: { folderId: true },
    });

    return NextResponse.json({
      added: toCreate.length,
      skipped: folderIds.length - toCreate.length,
      aliases: aliases.map((a) => a.folderId),
    });
  } catch (error) {
    console.error('Create alias error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/dashboards/[id]/aliases?folderId=xxx
// Removes the alias row connecting this dashboard to the given folder. The
// dashboard itself is untouched.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dashboard = await loadOwnedDashboard(id, user.id);
    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const folderId = new URL(request.url).searchParams.get('folderId');
    if (!folderId) {
      return NextResponse.json({ error: 'folderId query param is required' }, { status: 400 });
    }

    const deleted = await prisma.folderAlias.deleteMany({
      where: { dashboardId: id, folderId },
    });

    if (deleted.count > 0) {
      await createAuditLog({
        userId: user.id,
        action: AuditAction.DASHBOARD_ALIAS_REMOVE,
        resourceType: ResourceType.DASHBOARD,
        resourceId: id,
        metadata: {
          dashboardTitle: dashboard.title,
          folderId,
        },
      });
    }

    return NextResponse.json({ removed: deleted.count });
  } catch (error) {
    console.error('Delete alias error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
