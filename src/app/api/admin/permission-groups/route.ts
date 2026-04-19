import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission, logPermissionChange } from '@/lib/auth/permissions';
import prisma from '@/lib/db/prisma';
import { z } from 'zod';

async function checkPermission() {
  const user = await getCurrentUser();
  const canManage = await hasFeaturePermission(user, 'canManagePermissions');
  if (!canManage) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  return null;
}

// GET - List all permission groups
export async function GET(_request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;

  try {
    const groups = await prisma.permissionGroup.findMany({
      include: {
        _count: {
          select: { userAssignments: true }
        },
        userAssignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: [
        { isSystem: 'desc' }, // System groups first
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error fetching permission groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permission groups' },
      { status: 500 }
    );
  }
}

// Validation schema for creating/updating permission groups
const PermissionGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  featurePermissions: z.record(z.string(), z.boolean()),
  dataPermissions: z.record(z.string(), z.enum(['FULL', 'NONE', 'FILTERED'])),
});

// POST - Create a new permission group
export async function POST(request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;

  try {
    const user = await getCurrentUser();
    const body = await request.json();

    // Validate input
    const validatedData = PermissionGroupSchema.parse(body);

    // Check if a group with this name already exists
    const existingGroup = await prisma.permissionGroup.findUnique({
      where: { name: validatedData.name }
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: 'A permission group with this name already exists' },
        { status: 400 }
      );
    }

    const group = await prisma.permissionGroup.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        isSystem: false,
        featurePermissions: JSON.stringify(validatedData.featurePermissions),
        dataPermissions: JSON.stringify(validatedData.dataPermissions),
      },
      include: {
        _count: {
          select: { userAssignments: true }
        },
        userAssignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    // Log the creation
    await logPermissionChange(
      user.id,
      'permission_group.create',
      'PERMISSION_GROUP',
      group.id,
      { name: group.name, description: group.description }
    );

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating permission group:', error);
    return NextResponse.json(
      { error: 'Failed to create permission group' },
      { status: 500 }
    );
  }
}

const UpdatePermissionGroupSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  featurePermissions: z.record(z.string(), z.boolean()).optional(),
  dataPermissions: z.record(z.string(), z.enum(['FULL', 'NONE', 'FILTERED'])).optional(),
});

// PUT - Update a permission group
export async function PUT(request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;

  try {
    const user = await getCurrentUser();
    const body = await request.json();

    // Validate input
    const validatedData = UpdatePermissionGroupSchema.parse(body);

    // Check if the group exists and is not a system group
    const existingGroup = await prisma.permissionGroup.findUnique({
      where: { id: validatedData.id }
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Permission group not found' },
        { status: 404 }
      );
    }

    if (existingGroup.isSystem) {
      return NextResponse.json(
        { error: 'Cannot modify system permission groups' },
        { status: 400 }
      );
    }

    // Check for name conflicts if name is being updated
    if (validatedData.name && validatedData.name !== existingGroup.name) {
      const nameConflict = await prisma.permissionGroup.findUnique({
        where: { name: validatedData.name }
      });

      if (nameConflict && nameConflict.id !== validatedData.id) {
        return NextResponse.json(
          { error: 'A permission group with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.featurePermissions) updateData.featurePermissions = JSON.stringify(validatedData.featurePermissions);
    if (validatedData.dataPermissions) updateData.dataPermissions = JSON.stringify(validatedData.dataPermissions);

    const group = await prisma.permissionGroup.update({
      where: { id: validatedData.id },
      data: updateData,
      include: {
        _count: {
          select: { userAssignments: true }
        },
        userAssignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    // Log the update
    await logPermissionChange(
      user.id,
      'permission_group.update',
      'PERMISSION_GROUP',
      group.id,
      { changes: updateData }
    );

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Error updating permission group:', error);
    return NextResponse.json(
      { error: 'Failed to update permission group' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a permission group
export async function DELETE(request: NextRequest) {
  const denied = await checkPermission();
  if (denied) return denied;

  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Permission group ID is required' },
        { status: 400 }
      );
    }

    // Check if the group exists
    const existingGroup = await prisma.permissionGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userAssignments: true }
        }
      }
    });

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Permission group not found' },
        { status: 404 }
      );
    }

    if (existingGroup.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system permission groups' },
        { status: 400 }
      );
    }

    if (existingGroup._count.userAssignments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete permission group that has users assigned to it' },
        { status: 400 }
      );
    }

    // Delete the group (this will cascade to delete related DataAccessRule records)
    await prisma.permissionGroup.delete({
      where: { id }
    });

    // Log the deletion
    await logPermissionChange(
      user.id,
      'permission_group.delete',
      'PERMISSION_GROUP',
      id,
      { name: existingGroup.name }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission group:', error);
    return NextResponse.json(
      { error: 'Failed to delete permission group' },
      { status: 500 }
    );
  }
}