import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/folders/[id] - Get a specific folder
export async function GET(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: resolvedParams.id,
        ownerId: user.id
      },
      include: {
        children: {
          include: {
            _count: {
              select: {
                children: true,
                dashboards: true
              }
            }
          },
          orderBy: { name: 'asc' }
        },
        dashboards: {
          include: {
            owner: {
              select: { id: true, name: true }
            },
            _count: {
              select: { versions: true }
            }
          },
          orderBy: { updatedAt: 'desc' }
        },
        parent: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            children: true,
            dashboards: true
          }
        }
      }
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/folders/[id] - Update a folder
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, visibility, parentId } = body;

    // Check if folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: { id: resolvedParams.id, ownerId: user.id }
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // If moving to a different parent, validate parent exists and prevent cycles
    if (parentId !== undefined && parentId !== folder.parentId) {
      if (parentId) {
        const parentFolder = await prisma.folder.findFirst({
          where: { id: parentId, ownerId: user.id }
        });
        if (!parentFolder) {
          return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
        }

        // Prevent moving a folder into itself or its descendants
        if (parentId === resolvedParams.id) {
          return NextResponse.json({ error: 'Cannot move folder into itself' }, { status: 400 });
        }

        // Check for cycles by traversing up the parent chain
        let currentParentId = parentId;
        while (currentParentId) {
          if (currentParentId === resolvedParams.id) {
            return NextResponse.json({ error: 'Cannot move folder into its descendant' }, { status: 400 });
          }
          const parent = await prisma.folder.findFirst({
            where: { id: currentParentId }
          });
          currentParentId = parent?.parentId || null;
        }
      }
    }

    // If renaming, check for duplicates in the same location
    if (name && name.trim() !== folder.name) {
      const targetParentId = parentId !== undefined ? parentId : folder.parentId;
      const existingFolder = await prisma.folder.findFirst({
        where: {
          ownerId: user.id,
          parentId: targetParentId,
          name: name.trim(),
          NOT: { id: resolvedParams.id }
        }
      });

      if (existingFolder) {
        return NextResponse.json({ error: 'A folder with this name already exists in this location' }, { status: 409 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (visibility !== undefined) updateData.visibility = visibility;
    if (parentId !== undefined) updateData.parentId = parentId;

    const updatedFolder = await prisma.folder.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        _count: {
          select: {
            children: true,
            dashboards: true
          }
        }
      }
    });

    // Log the folder update
    await createAuditLog({
      userId: user.id,
      action: AuditAction.FOLDER_UPDATE,
      resourceType: ResourceType.FOLDER,
      resourceId: resolvedParams.id,
      metadata: {
        changes: updateData,
        oldName: folder.name,
        newName: updatedFolder.name
      }
    });

    return NextResponse.json({ folder: updatedFolder });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/folders/[id] - Delete a folder
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Check if folder exists and belongs to user
    const folder = await prisma.folder.findFirst({
      where: { id: resolvedParams.id, ownerId: user.id },
      include: {
        children: true,
        dashboards: true
      }
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check if folder has children or dashboards
    if (folder.children.length > 0 || folder.dashboards.length > 0) {
      if (!force) {
        return NextResponse.json({
          error: 'Folder is not empty',
          details: {
            children: folder.children.length,
            dashboards: folder.dashboards.length
          }
        }, { status: 409 });
      }

      // If force delete, move children to parent and dashboards to root
      if (folder.children.length > 0) {
        await prisma.folder.updateMany({
          where: { parentId: resolvedParams.id },
          data: { parentId: folder.parentId }
        });
      }

      if (folder.dashboards.length > 0) {
        await prisma.dashboard.updateMany({
          where: { folderId: resolvedParams.id },
          data: { folderId: null }
        });
      }
    }

    await prisma.folder.delete({
      where: { id: resolvedParams.id }
    });

    // Log the folder deletion
    await createAuditLog({
      userId: user.id,
      action: AuditAction.FOLDER_DELETE,
      resourceType: ResourceType.FOLDER,
      resourceId: resolvedParams.id,
      metadata: {
        folderName: folder.name,
        force: force,
        childrenMoved: folder.children.length,
        dashboardsMoved: folder.dashboards.length
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}