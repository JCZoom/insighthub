import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import prisma from '@/lib/db/prisma';
import { createAuditLog, AuditAction, ResourceType } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found in session' },
        { status: 400 }
      );
    }

    // Update user's onboarding status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { hasOnboarded: true },
      select: {
        id: true,
        email: true,
        name: true,
        hasOnboarded: true,
      },
    });

    // Log the onboarding completion for audit purposes
    try {
      await createAuditLog({
        userId,
        action: AuditAction.USER_LOGIN, // Using login action as closest available
        resourceType: ResourceType.USER,
        resourceId: userId,
        metadata: {
          field: 'hasOnboarded',
          oldValue: false,
          newValue: true,
          action: 'onboarding_completed',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditError) {
      console.error('Failed to log onboarding completion audit:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Onboarding completed successfully',
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}