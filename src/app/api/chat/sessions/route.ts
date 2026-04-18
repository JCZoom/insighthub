import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get('dashboardId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const whereClause: any = { userId: user.id };
    if (dashboardId) {
      whereClause.dashboardId = dashboardId;
    }

    // Get sessions with message count
    const sessions = await prisma.chatSession.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Transform to include message count
    const sessionsWithCount = sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      dashboardId: session.dashboardId,
      messageCount: session._count.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    return NextResponse.json({
      sessions: sessionsWithCount,
      total: sessions.length
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}