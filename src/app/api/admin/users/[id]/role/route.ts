import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import prisma from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import { z } from 'zod';

const VALID_ROLES = ['VIEWER', 'CREATOR', 'POWER_USER', 'ADMIN'] as const;

const UpdateRoleSchema = z.object({
  role: z.enum(VALID_ROLES),
});

// PUT /api/admin/users/[id]/role — Change a user's role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUserData = await getCurrentUser();

    const canManageUsers = await hasFeaturePermission(currentUserData, 'canManageUsers');
    if (!canManageUsers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: targetUserId } = await params;

    // Validate request body
    const body = await request.json();
    const { role: newRole } = UpdateRoleSchema.parse(body);

    // Prevent self-demotion from ADMIN (safety net)
    if (targetUserId === currentUserData.id && currentUserData.role === 'ADMIN' && newRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot demote your own admin role. Another admin must do this.' },
        { status: 400 }
      );
    }

    // Fetch target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousRole = targetUser.role;

    // No-op check
    if (previousRole === newRole) {
      return NextResponse.json({ success: true, message: 'Role unchanged', user: targetUser });
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
      },
    });

    // Audit log
    await createAuditLog({
      userId: currentUserData.id,
      action: AuditAction.USER_ROLE_CHANGE,
      resourceType: ResourceType.USER,
      resourceId: targetUserId,
      metadata: {
        previousRole,
        newRole,
        targetUserEmail: targetUser.email,
        changedBy: currentUserData.email,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      previousRole,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: VIEWER, CREATOR, POWER_USER, ADMIN', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
