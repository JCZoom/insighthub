import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

// GET /api/folders - List all folders for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');

    // When no parentId filter, return ALL folders so the client can build the full tree.
    // When parentId is specified, filter to only that parent's children.
    const where = {
      ownerId: user.id,
      ...(parentId ? { parentId } : {}),
    };

    const folders = await prisma.folder.findMany({
      where,
      include: {
        children: true,
        dashboards: {
          include: {
            owner: {
              select: { id: true, name: true }
            },
            _count: {
              select: { versions: true }
            }
          }
        },
        _count: {
          select: {
            children: true,
            dashboards: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/folders - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, parentId, visibility = 'PRIVATE' } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    // Check if parent folder exists and belongs to user (if parentId provided)
    if (parentId) {
      const parentFolder = await prisma.folder.findFirst({
        where: { id: parentId, ownerId: user.id }
      });
      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }
    }

    // Check for duplicate folder names in the same parent
    const existingFolder = await prisma.folder.findFirst({
      where: {
        ownerId: user.id,
        parentId: parentId || null,
        name: name.trim()
      }
    });

    if (existingFolder) {
      return NextResponse.json({ error: 'A folder with this name already exists in this location' }, { status: 409 });
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        ownerId: user.id,
        parentId: parentId || null,
        visibility: visibility
      },
      include: {
        _count: {
          select: {
            children: true,
            dashboards: true
          }
        }
      }
    });

    // Log the folder creation
    await createAuditLog({
      userId: user.id,
      action: AuditAction.FOLDER_CREATE,
      resourceType: ResourceType.FOLDER,
      resourceId: folder.id,
      metadata: {
        folderName: folder.name,
        parentId: parentId,
        visibility: visibility
      }
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}