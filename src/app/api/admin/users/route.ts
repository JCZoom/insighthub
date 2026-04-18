import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission, assignPermissionGroup, removePermissionGroup, logPermissionChange } from '@/lib/auth/permissions';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';

// Validation schemas
const AssignPermissionSchema = z.object({
  userId: z.string().cuid(),
  permissionGroupId: z.string().cuid(),
  customOverrides: z.record(z.string(), z.unknown()).optional(),
});

const RemovePermissionSchema = z.object({
  userId: z.string().cuid(),
  permissionGroupId: z.string().cuid(),
});

// GET - List all users with their permissions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Check if user can manage users or permissions
    const canManageUsers = await hasFeaturePermission(user, 'canManageUsers');
    const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');

    if (!canManageUsers && !canManagePermissions) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        hasOnboarded: true,
        createdAt: true,
        lastLoginAt: true,
        permissionAssignments: {
          include: {
            permissionGroup: {
              select: {
                id: true,
                name: true,
                description: true,
                isSystem: true,
              }
            }
          }
        },
        _count: {
          select: {
            dashboards: true,
            chatSessions: true,
            publishedWidgets: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Assign permission group to user
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Check if user can manage permissions
    const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');
    if (!canManagePermissions) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = AssignPermissionSchema.parse(body);

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: validatedData.userId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if permission group exists
    const permissionGroup = await prisma.permissionGroup.findUnique({
      where: { id: validatedData.permissionGroupId }
    });

    if (!permissionGroup) {
      return NextResponse.json({ error: 'Permission group not found' }, { status: 404 });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userPermissionAssignment.findUnique({
      where: {
        userId_permissionGroupId: {
          userId: validatedData.userId,
          permissionGroupId: validatedData.permissionGroupId
        }
      }
    });

    if (existingAssignment) {
      return NextResponse.json({ error: 'Permission group already assigned to user' }, { status: 409 });
    }

    await assignPermissionGroup(
      validatedData.userId,
      validatedData.permissionGroupId,
      user.id,
      validatedData.customOverrides
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error assigning permission group:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove permission group from user
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // Check if user can manage permissions
    const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');
    if (!canManagePermissions) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const permissionGroupId = url.searchParams.get('permissionGroupId');

    if (!userId || !permissionGroupId) {
      return NextResponse.json({ error: 'userId and permissionGroupId are required' }, { status: 400 });
    }

    const validatedData = RemovePermissionSchema.parse({ userId, permissionGroupId });

    // Check if assignment exists
    const existingAssignment = await prisma.userPermissionAssignment.findUnique({
      where: {
        userId_permissionGroupId: {
          userId: validatedData.userId,
          permissionGroupId: validatedData.permissionGroupId
        }
      }
    });

    if (!existingAssignment) {
      return NextResponse.json({ error: 'Permission assignment not found' }, { status: 404 });
    }

    await removePermissionGroup(
      validatedData.userId,
      validatedData.permissionGroupId,
      user.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error removing permission group:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}